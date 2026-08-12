-- SincVete - Módulo 17: IA clínica

DO $$ BEGIN
  CREATE TYPE public.ai_suggestion_kind AS ENUM (
    'patient_summary',
    'soap_assist',
    'owner_instructions'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  kind public.ai_suggestion_kind NOT NULL,
  prompt_hash TEXT NOT NULL CHECK (char_length(prompt_hash) BETWEEN 8 AND 64),
  input_excerpt TEXT CHECK (char_length(input_excerpt) <= 2000),
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT NOT NULL CHECK (char_length(model) BETWEEN 2 AND 80),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.ai_suggestions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind public.ai_suggestion_kind,
  ADD COLUMN IF NOT EXISTS prompt_hash TEXT,
  ADD COLUMN IF NOT EXISTS input_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS output JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_org_created
  ON public.ai_suggestions (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_patient
  ON public.ai_suggestions (patient_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_ai_suggestions_updated_at ON public.ai_suggestions;
CREATE TRIGGER trg_ai_suggestions_updated_at
  BEFORE UPDATE ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_ai_suggestions ON public.ai_suggestions;
CREATE TRIGGER trg_audit_ai_suggestions
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_suggestions_select_tenant" ON public.ai_suggestions;
CREATE POLICY "ai_suggestions_select_tenant" ON public.ai_suggestions
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

DROP POLICY IF EXISTS "ai_suggestions_insert_tenant" ON public.ai_suggestions;
CREATE POLICY "ai_suggestions_insert_tenant" ON public.ai_suggestions
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.get_patient_clinical_context(
  p_patient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'patient', jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'species', p.species::text,
        'breed', p.breed,
        'sex', p.sex::text,
        'birth_date', p.birth_date,
        'is_neutered', p.is_neutered,
        'is_deceased', p.is_deceased,
        'owner_id', p.owner_id,
        'owner_name', o.full_name
      ),
      'entries', COALESCE(
        (
          SELECT jsonb_agg(row_to_json(e) ORDER BY e.entry_date DESC)
          FROM (
            SELECT
              ce.id,
              ce.entry_date,
              ce.entry_type::text AS entry_type,
              ce.title,
              ce.anamnesis,
              ce.physical_exam,
              ce.diagnosis,
              ce.treatment,
              ce.plan,
              ce.weight_kg,
              ce.temperature_c
            FROM public.clinical_entries ce
            WHERE ce.organization_id = v_org_id
              AND ce.patient_id = p.id
              AND ce.deleted_at IS NULL
            ORDER BY ce.entry_date DESC
            LIMIT 8
          ) e
        ),
        '[]'::jsonb
      ),
      'vaccinations', COALESCE(
        (
          SELECT jsonb_agg(row_to_json(v) ORDER BY v.administered_at DESC)
          FROM (
            SELECT
              vac.vaccine_name,
              vac.administered_at,
              vac.next_due_at
            FROM public.vaccinations vac
            WHERE vac.organization_id = v_org_id
              AND vac.patient_id = p.id
              AND vac.deleted_at IS NULL
            ORDER BY vac.administered_at DESC
            LIMIT 8
          ) v
        ),
        '[]'::jsonb
      )
    )
    FROM public.patients p
    INNER JOIN public.owners o ON o.id = p.owner_id AND o.deleted_at IS NULL
    WHERE p.id = p_patient_id
      AND p.organization_id = v_org_id
      AND p.deleted_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_ai_suggestion(
  p_patient_id UUID,
  p_kind TEXT,
  p_prompt_hash TEXT,
  p_output JSONB,
  p_model TEXT,
  p_input_excerpt TEXT DEFAULT NULL,
  p_consultation_id UUID DEFAULT NULL,
  p_clinical_entry_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_owner_id UUID;
  v_branch_id UUID;
  v_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'No tenés permisos para generar sugerencias de IA';
  END IF;

  IF p_kind NOT IN ('patient_summary', 'soap_assist', 'owner_instructions') THEN
    RAISE EXCEPTION 'Tipo de sugerencia inválido';
  END IF;

  SELECT p.owner_id, COALESCE(p_branch_id, p.branch_id)
  INTO v_owner_id, v_branch_id
  FROM public.patients p
  WHERE p.id = p_patient_id
    AND p.organization_id = v_org_id
    AND p.deleted_at IS NULL;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Paciente no encontrado';
  END IF;

  INSERT INTO public.ai_suggestions (
    organization_id,
    branch_id,
    patient_id,
    owner_id,
    consultation_id,
    clinical_entry_id,
    kind,
    prompt_hash,
    input_excerpt,
    output,
    model,
    created_by
  ) VALUES (
    v_org_id,
    v_branch_id,
    p_patient_id,
    v_owner_id,
    p_consultation_id,
    p_clinical_entry_id,
    p_kind::public.ai_suggestion_kind,
    p_prompt_hash,
    NULLIF(btrim(COALESCE(p_input_excerpt, '')), ''),
    COALESCE(p_output, '{}'::jsonb),
    p_model,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_ai_suggestions(
  p_patient_id UUID DEFAULT NULL,
  p_kind TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  patient_id UUID,
  owner_id UUID,
  consultation_id UUID,
  clinical_entry_id UUID,
  kind public.ai_suggestion_kind,
  prompt_hash TEXT,
  input_excerpt TEXT,
  output JSONB,
  model TEXT,
  created_by UUID,
  patient_name TEXT,
  owner_full_name TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_offset INT;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT s.*
    FROM public.ai_suggestions s
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND (p_patient_id IS NULL OR s.patient_id = p_patient_id)
      AND (p_kind IS NULL OR btrim(p_kind) = '' OR s.kind::text = p_kind)
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id,
    f.organization_id,
    f.branch_id,
    f.patient_id,
    f.owner_id,
    f.consultation_id,
    f.clinical_entry_id,
    f.kind,
    f.prompt_hash,
    f.input_excerpt,
    f.output,
    f.model,
    f.created_by,
    p.name,
    o.full_name,
    pr.full_name,
    f.created_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  INNER JOIN public.patients p ON p.id = f.patient_id
  INNER JOIN public.owners o ON o.id = f.owner_id
  LEFT JOIN public.profiles pr ON pr.id = f.created_by
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_clinical_context TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_suggestion TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_ai_suggestions TO authenticated;
