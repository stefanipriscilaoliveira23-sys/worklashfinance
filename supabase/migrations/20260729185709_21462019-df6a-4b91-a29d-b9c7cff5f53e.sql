CREATE OR REPLACE FUNCTION public.agenda_slots_ocupados(_data date)
RETURNS TABLE (hora_inicio time, hora_fim time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT a.hora_inicio, a.hora_fim
  FROM public.agendamentos a
  WHERE a.data = _data AND a.status <> 'Cancelado'
$fn$;

CREATE OR REPLACE FUNCTION public.criar_agendamento_publico(
  _slug text, _nome text, _whatsapp text, _instagram text,
  _data date, _hora_inicio time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tipo public.agenda_tipos%ROWTYPE;
  v_fim time;
  v_mentorada uuid;
  v_id uuid;
  v_digits text;
BEGIN
  SELECT * INTO v_tipo FROM public.agenda_tipos WHERE slug = _slug AND ativo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tipo de agendamento nao encontrado'; END IF;

  v_fim := _hora_inicio + make_interval(mins => v_tipo.duracao_minutos);

  IF EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.data = _data AND a.status <> 'Cancelado'
      AND a.hora_inicio < v_fim AND a.hora_fim > _hora_inicio
  ) THEN
    RAISE EXCEPTION 'Horario indisponivel';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.agenda_bloqueios b
    WHERE b.data = _data
      AND (b.hora_inicio IS NULL OR (b.hora_inicio < v_fim AND b.hora_fim > _hora_inicio))
  ) THEN
    RAISE EXCEPTION 'Horario indisponivel';
  END IF;

  v_digits := regexp_replace(coalesce(_whatsapp,''), '[^0-9]', '', 'g');
  IF length(v_digits) >= 10 THEN
    SELECT m.id INTO v_mentorada FROM public.mentoradas m
    WHERE regexp_replace(coalesce(m.telefone,''), '[^0-9]', '', 'g') = v_digits
    LIMIT 1;
  END IF;

  INSERT INTO public.agendamentos (tipo_id, nome, whatsapp, instagram, mentorada_id, data, hora_inicio, hora_fim, status, origem)
  VALUES (v_tipo.id, _nome, _whatsapp, _instagram, v_mentorada, _data, _hora_inicio, v_fim, 'Confirmado', 'Auto-agendamento')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.agenda_slots_ocupados(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento_publico(text, text, text, text, date, time) TO anon, authenticated;