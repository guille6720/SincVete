-- SincVete - Módulo 2: Agenda / Citas

CREATE TYPE public.appointment_status AS ENUM (
  'programada',
  'confirmada',
  'en_curso',
  'completada',
  'cancelada',
  'ausente'
);

CREATE TYPE public.appointment_type AS ENUM (
  'consulta',
  'vacunacion',
  'cirugia',
  'control',
  'emergencia',
  'otro'
);

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'programada',
  appointment_type public.appointment_type NOT NULL DEFAULT 'consulta',
  title TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointments_org_starts ON public.appointments (organization_id, starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_appointments_branch_starts ON public.appointments (branch_id, starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_appointments_patient ON public.appointments (patient_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_appointments_assigned ON public.appointments (assigned_user_id, starts_at)
  WHERE deleted_at IS NULL AND assigned_user_id IS NOT NULL;

CREATE INDEX idx_appointments_status ON public.appointments (organization_id, status, starts_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_tenant" ON public.appointments
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('appointments:read')
  );

CREATE POLICY "appointments_insert_tenant" ON public.appointments
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('appointments:write')
  );

CREATE POLICY "appointments_update_tenant" ON public.appointments
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('appointments:write')
  );

CREATE OR REPLACE FUNCTION public.list_appointments_range(
  p_week_start DATE,
  p_branch_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_assigned_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  patient_id UUID,
  owner_id UUID,
  assigned_user_id UUID,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status public.appointment_status,
  appointment_type public.appointment_type,
  title TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  assigned_user_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_range_start TIMESTAMPTZ;
  v_range_end TIMESTAMPTZ;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('appointments:read') THEN
    RETURN;
  END IF;

  v_range_start := (p_week_start::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_range_end := ((p_week_start + 7)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');

  RETURN QUERY
  SELECT
    a.id,
    a.organization_id,
    a.branch_id,
    a.patient_id,
    a.owner_id,
    a.assigned_user_id,
    a.starts_at,
    a.ends_at,
    a.status,
    a.appointment_type,
    a.title,
    a.notes,
    a.cancellation_reason,
    p.name AS patient_name,
    p.species AS patient_species,
    o.full_name AS owner_full_name,
    pr.full_name AS assigned_user_name,
    a.created_at,
    a.updated_at
  FROM public.appointments a
  INNER JOIN public.patients p ON p.id = a.patient_id AND p.deleted_at IS NULL
  INNER JOIN public.owners o ON o.id = a.owner_id AND o.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = a.assigned_user_id
  WHERE a.organization_id = v_org_id
    AND a.deleted_at IS NULL
    AND a.starts_at >= v_range_start
    AND a.starts_at < v_range_end
    AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
    AND (p_status IS NULL OR btrim(p_status) = '' OR a.status::TEXT = p_status)
    AND (p_assigned_user_id IS NULL OR a.assigned_user_id = p_assigned_user_id)
  ORDER BY a.starts_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_appointments_range TO authenticated;
