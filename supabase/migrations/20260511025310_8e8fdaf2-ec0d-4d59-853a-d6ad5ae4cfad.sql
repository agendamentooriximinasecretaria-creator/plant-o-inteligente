-- Função para obter informações das tabelas
CREATE OR REPLACE FUNCTION get_tables_info()
RETURNS TABLE (table_name text, record_count bigint) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::text,
        (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter DDL básico de uma tabela
CREATE OR REPLACE FUNCTION get_table_ddl(target_table text)
RETURNS text AS $$
DECLARE
    ddl text;
BEGIN
    -- Esta é uma versão simplificada, pois gerar DDL completo em PL/pgSQL é complexo.
    -- O ideal é usar ferramentas como pg_dump, mas isto ajuda para PostgREST.
    SELECT 'CREATE TABLE IF NOT EXISTS public.' || target_table || ' (' || 
           string_agg(column_name || ' ' || data_type || 
           CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END, ', ') || ');'
    INTO ddl
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = target_table;
    
    RETURN ddl;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
