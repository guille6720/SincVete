-- Cap active prescription board to avoid unbounded loads on /farmacia

CREATE OR REPLACE FUNCTION public.list_active_prescriptions(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  patient_id UUID,
  owner_id UUID,
  consultation_id UUID,
  clinical_entry_id UUID,
  prescribed_by UUID,
  dispensed_by UUID,
  voided_by UUID,
  status public.prescription_status,
  number TEXT,
  notes TEXT,
  void_reason TEXT,
  prescribed_at TIMESTAMPTZ,
  dispensed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  item_count BIGINT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  prescribed_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
)
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
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    rx.id,
    rx.organization_id,
    rx.branch_id,
    rx.patient_id,
    rx.owner_id,
    rx.consultation_id,
    rx.clinical_entry_id,
    rx.prescribed_by,
    rx.dispensed_by,
    rx.voided_by,
    rx.status,
    rx.number,
    rx.notes,
    rx.void_reason,
    rx.prescribed_at,
    rx.dispensed_at,
    rx.voided_at,
    (
      SELECT COUNT(*)
      FROM public.prescription_items i
      WHERE i.prescription_id = rx.id AND i.deleted_at IS NULL
    ) AS item_count,
    p.name AS patient_name,
    p.species AS patient_species,
    ow.full_name AS owner_full_name,
    pr.full_name AS prescribed_by_name,
    rx.created_at,
    rx.updated_at,
    rx.deleted_at
  FROM public.prescriptions rx
  INNER JOIN public.patients p ON p.id = rx.patient_id AND p.deleted_at IS NULL
  INNER JOIN public.owners ow ON ow.id = rx.owner_id AND ow.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = rx.prescribed_by
  WHERE rx.organization_id = v_org_id
    AND rx.deleted_at IS NULL
    AND rx.status = 'activa'
    AND (p_branch_id IS NULL OR rx.branch_id = p_branch_id)
  ORDER BY rx.prescribed_at ASC
  LIMIT 100;
END;
$$;
