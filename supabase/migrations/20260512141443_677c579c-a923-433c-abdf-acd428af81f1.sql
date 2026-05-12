-- Improved function to get table information
CREATE OR REPLACE FUNCTION public.get_tables_info()
RETURNS TABLE(table_name text, record_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::text,
        (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE '\_pg\_%'
    AND t.table_name NOT LIKE 'pg\_%';
END;
$$;

-- Improved function to generate basic DDL
CREATE OR REPLACE FUNCTION public.get_table_ddl(target_table text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ddl text;
    pk_cols text;
    fk_details text;
BEGIN
    -- 1. Columns and types
    SELECT 'CREATE TABLE IF NOT EXISTS public.' || target_table || " (" || 
           string_agg(
               column_name || ' ' || 
               CASE 
                   WHEN data_type = 'USER-DEFINED' THEN udt_name 
                   ELSE data_type 
               END || 
               CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
               CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END, 
               ', ' ORDER BY ordinal_position
           )
    INTO ddl
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = target_table;

    -- 2. Primary Keys
    SELECT string_agg(column_name, ', ')
    INTO pk_cols
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
    AND tc.table_name = target_table
    AND tc.constraint_type = 'PRIMARY KEY';

    IF pk_cols IS NOT NULL THEN
        ddl := ddl || ', PRIMARY KEY (' || pk_cols || ')';
    END IF;

    -- 3. Foreign Keys (Basic)
    SELECT string_agg(
        'CONSTRAINT ' || tc.constraint_name || ' FOREIGN KEY (' || kcu.column_name || ') REFERENCES ' || ccu.table_name || '(' || ccu.column_name || ')',
        ', '
    )
    INTO fk_details
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND tc.table_name = target_table;

    IF fk_details IS NOT NULL THEN
        ddl := ddl || ', ' || fk_details;
    END IF;

    ddl := ddl || ');';
    
    RETURN ddl;
END;
$$;
