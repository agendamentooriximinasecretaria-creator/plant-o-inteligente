CREATE OR REPLACE FUNCTION public.check_descanso_minimo(
  p_profissional_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time,
  p_descanso_horas numeric,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(violando_shift_id uuid, gap_horas numeric, vizinho_inicio timestamp, vizinho_fim timestamp)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_novo_ini timestamp;
  v_novo_fim timestamp;
BEGIN
  v_novo_ini := (p_data + p_hora_inicio)::timestamp;
  IF p_hora_fim <= p_hora_inicio THEN
    v_novo_fim := ((p_data + interval '1 day') + p_hora_fim)::timestamp;
  ELSE
    v_novo_fim := (p_data + p_hora_fim)::timestamp;
  END IF;

  RETURN QUERY
  WITH vizinhos AS (
    SELECT
      s.id,
      (s.data + s.hora_inicio)::timestamp AS ini,
      CASE
        WHEN s.hora_fim <= s.hora_inicio
          THEN ((s.data + interval '1 day') + s.hora_fim)::timestamp
        ELSE (s.data + s.hora_fim)::timestamp
      END AS fim
    FROM public.shifts s
    WHERE s.profissional_id = p_profissional_id
      AND s.status NOT IN ('cancelado')
      AND COALESCE(s.tipo_plantao, '') NOT IN ('folga', 'indisponibilidade')
      AND (p_exclude_id IS NULL OR s.id <> p_exclude_id)
      AND s.data BETWEEN (p_data - 2) AND (p_data + 2)
  )
  SELECT
    v.id,
    CASE
      WHEN v_novo_ini >= v.fim THEN EXTRACT(EPOCH FROM (v_novo_ini - v.fim))/3600.0
      WHEN v.ini    >= v_novo_fim THEN EXTRACT(EPOCH FROM (v.ini - v_novo_fim))/3600.0
      ELSE 0
    END::numeric AS gap_horas,
    v.ini,
    v.fim
  FROM vizinhos v
  WHERE
    (v_novo_ini >= v.fim AND EXTRACT(EPOCH FROM (v_novo_ini - v.fim))/3600.0 < p_descanso_horas)
    OR
    (v.ini >= v_novo_fim AND EXTRACT(EPOCH FROM (v.ini - v_novo_fim))/3600.0 < p_descanso_horas);
END;
$$;