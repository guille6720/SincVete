-- SincVete - Módulo 18: Farmacia

DO $$ BEGIN
  CREATE TYPE public.prescription_status AS ENUM (
    'activa',
    'dispensada',
    'anulada'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.prescription_route AS ENUM (
    'oral',
    'sc',
    'im',
    'topico',
    'oftalmico',
    'otico',
    'otro'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.prescription_sequences (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE RESTRICT,
  last_number INT NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

ALTER TABLE public.prescription_sequences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  prescribed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispensed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.prescription_status NOT NULL DEFAULT 'activa',
  number TEXT,
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 5000),
  void_reason TEXT CHECK (void_reason IS NULL OR char_length(void_reason) <= 500),
  prescribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispensed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT prescriptions_number_len CHECK (
    number IS NULL OR char_length(number) BETWEEN 3 AND 20
  )
);

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prescribed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispensed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.prescription_status,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS prescribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  inventory_product_id UUID REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  medication_name TEXT NOT NULL CHECK (char_length(medication_name) BETWEEN 1 AND 160),
  dose TEXT NOT NULL CHECK (char_length(dose) BETWEEN 1 AND 80),
  frequency TEXT NOT NULL CHECK (char_length(frequency) BETWEEN 1 AND 80),
  duration TEXT CHECK (duration IS NULL OR char_length(duration) BETWEEN 1 AND 80),
  route public.prescription_route NOT NULL DEFAULT 'oral',
  quantity NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  instructions TEXT CHECK (instructions IS NULL OR char_length(instructions) <= 1000),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.prescription_items
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS inventory_product_id UUID REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS medication_name TEXT,
  ADD COLUMN IF NOT EXISTS dose TEXT,
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS duration TEXT,
  ADD COLUMN IF NOT EXISTS route public.prescription_route NOT NULL DEFAULT 'oral',
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prescriptions_org_created
  ON public.prescriptions (organization_id, prescribed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_org_status
  ON public.prescriptions (organization_id, status, prescribed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
  ON public.prescriptions (patient_id, prescribed_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_org_number
  ON public.prescriptions (organization_id, number)
  WHERE deleted_at IS NULL AND number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescription_items_rx
  ON public.prescription_items (prescription_id, sort_order)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_prescriptions ON public.prescriptions;
CREATE TRIGGER trg_audit_prescriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS trg_prescription_items_updated_at ON public.prescription_items;
CREATE TRIGGER trg_prescription_items_updated_at
  BEFORE UPDATE ON public.prescription_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescriptions_select_tenant" ON public.prescriptions;
CREATE POLICY "prescriptions_select_tenant" ON public.prescriptions
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

DROP POLICY IF EXISTS "prescriptions_insert_tenant" ON public.prescriptions;
CREATE POLICY "prescriptions_insert_tenant" ON public.prescriptions
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "prescriptions_update_tenant" ON public.prescriptions;
CREATE POLICY "prescriptions_update_tenant" ON public.prescriptions
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "prescription_items_select_tenant" ON public.prescription_items;
CREATE POLICY "prescription_items_select_tenant" ON public.prescription_items
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

DROP POLICY IF EXISTS "prescription_items_insert_tenant" ON public.prescription_items;
CREATE POLICY "prescription_items_insert_tenant" ON public.prescription_items
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "prescription_items_update_tenant" ON public.prescription_items;
CREATE POLICY "prescription_items_update_tenant" ON public.prescription_items
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.count_active_prescriptions(
  p_branch_id UUID DEFAULT NULL
)
RETURNS INTEGER
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
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)::int
    FROM public.prescriptions rx
    WHERE rx.organization_id = v_org_id
      AND rx.deleted_at IS NULL
      AND rx.status = 'activa'
      AND (p_branch_id IS NULL OR rx.branch_id = p_branch_id)
  );
END;
$$;

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
  ORDER BY rx.prescribed_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_prescriptions(
  p_search TEXT DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
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
  deleted_at TIMESTAMPTZ,
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
    SELECT
      rx.*,
      p.name AS pat_name,
      p.species AS pat_species,
      ow.full_name AS own_name,
      pr.full_name AS presc_name,
      (
        SELECT COUNT(*)
        FROM public.prescription_items i
        WHERE i.prescription_id = rx.id AND i.deleted_at IS NULL
      ) AS items_cnt
    FROM public.prescriptions rx
    INNER JOIN public.patients p ON p.id = rx.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners ow ON ow.id = rx.owner_id AND ow.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = rx.prescribed_by
    WHERE rx.organization_id = v_org_id
      AND rx.deleted_at IS NULL
      AND (p_patient_id IS NULL OR rx.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR rx.branch_id = p_branch_id)
      AND (p_status IS NULL OR btrim(p_status) = '' OR rx.status::TEXT = p_status)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR rx.number ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR ow.full_name ILIKE '%' || p_search || '%'
        OR EXISTS (
          SELECT 1
          FROM public.prescription_items i
          WHERE i.prescription_id = rx.id
            AND i.deleted_at IS NULL
            AND i.medication_name ILIKE '%' || p_search || '%'
        )
      )
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
    f.prescribed_by,
    f.dispensed_by,
    f.voided_by,
    f.status,
    f.number,
    f.notes,
    f.void_reason,
    f.prescribed_at,
    f.dispensed_at,
    f.voided_at,
    f.items_cnt,
    f.pat_name,
    f.pat_species,
    f.own_name,
    f.presc_name,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.prescribed_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_prescription(
  p_patient_id UUID,
  p_owner_id UUID,
  p_branch_id UUID,
  p_items JSONB,
  p_consultation_id UUID DEFAULT NULL,
  p_clinical_entry_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_patient public.patients%ROWTYPE;
  v_branch public.branches%ROWTYPE;
  v_next INT;
  v_number TEXT;
  v_rx_id UUID;
  v_item JSONB;
  v_name TEXT;
  v_dose TEXT;
  v_frequency TEXT;
  v_duration TEXT;
  v_route TEXT;
  v_quantity NUMERIC(14, 3);
  v_product_id UUID;
  v_instructions TEXT;
  v_sort INT := 0;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'Agregá al menos un medicamento';
  END IF;

  SELECT * INTO v_patient
  FROM public.patients
  WHERE id = p_patient_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente no encontrado';
  END IF;

  IF v_patient.owner_id <> p_owner_id THEN
    RAISE EXCEPTION 'El propietario no coincide';
  END IF;

  SELECT * INTO v_branch
  FROM public.branches
  WHERE id = p_branch_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sucursal no encontrada';
  END IF;

  INSERT INTO public.prescription_sequences (organization_id, last_number)
  VALUES (v_org_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.prescription_sequences
  SET last_number = last_number + 1
  WHERE organization_id = v_org_id
  RETURNING last_number INTO v_next;

  v_number := 'R-' || lpad(v_next::TEXT, 6, '0');

  INSERT INTO public.prescriptions (
    organization_id,
    branch_id,
    patient_id,
    owner_id,
    consultation_id,
    clinical_entry_id,
    prescribed_by,
    status,
    number,
    notes,
    prescribed_at
  )
  VALUES (
    v_org_id,
    p_branch_id,
    p_patient_id,
    p_owner_id,
    p_consultation_id,
    p_clinical_entry_id,
    auth.uid(),
    'activa',
    v_number,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    now()
  )
  RETURNING id INTO v_rx_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_name := NULLIF(btrim(COALESCE(v_item->>'medication_name', '')), '');
    v_dose := NULLIF(btrim(COALESCE(v_item->>'dose', '')), '');
    v_frequency := NULLIF(btrim(COALESCE(v_item->>'frequency', '')), '');
    v_duration := NULLIF(btrim(COALESCE(v_item->>'duration', '')), '');
    v_route := COALESCE(NULLIF(btrim(COALESCE(v_item->>'route', '')), ''), 'oral');
    v_instructions := NULLIF(btrim(COALESCE(v_item->>'instructions', '')), '');
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 0);

    IF v_item->>'inventory_product_id' IS NULL OR btrim(v_item->>'inventory_product_id') = '' THEN
      v_product_id := NULL;
    ELSE
      v_product_id := (v_item->>'inventory_product_id')::UUID;
    END IF;

    IF v_name IS NULL OR char_length(v_name) > 160 THEN
      RAISE EXCEPTION 'Indicá el medicamento';
    END IF;
    IF v_dose IS NULL OR char_length(v_dose) > 80 THEN
      RAISE EXCEPTION 'Indicá la dosis';
    END IF;
    IF v_frequency IS NULL OR char_length(v_frequency) > 80 THEN
      RAISE EXCEPTION 'Indicá la frecuencia';
    END IF;
    IF v_quantity < 0 THEN
      RAISE EXCEPTION 'La cantidad no puede ser negativa';
    END IF;
    IF v_route NOT IN ('oral', 'sc', 'im', 'topico', 'oftalmico', 'otico', 'otro') THEN
      RAISE EXCEPTION 'Vía de administración inválida';
    END IF;

    IF v_product_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.inventory_products ip
        WHERE ip.id = v_product_id
          AND ip.organization_id = v_org_id
          AND ip.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Producto de inventario no encontrado';
      END IF;
    END IF;

    INSERT INTO public.prescription_items (
      organization_id,
      prescription_id,
      inventory_product_id,
      medication_name,
      dose,
      frequency,
      duration,
      route,
      quantity,
      instructions,
      sort_order
    )
    VALUES (
      v_org_id,
      v_rx_id,
      v_product_id,
      v_name,
      v_dose,
      v_frequency,
      v_duration,
      v_route::public.prescription_route,
      v_quantity,
      v_instructions,
      v_sort
    );

    v_sort := v_sort + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'prescription_id', v_rx_id,
    'number', v_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dispense_prescription(
  p_prescription_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_rx public.prescriptions%ROWTYPE;
  v_item public.prescription_items%ROWTYPE;
  v_product public.inventory_products%ROWTYPE;
  v_before NUMERIC(14, 3);
  v_after NUMERIC(14, 3);
  v_reason TEXT;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  SELECT * INTO v_rx
  FROM public.prescriptions
  WHERE id = p_prescription_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receta no encontrada';
  END IF;

  IF v_rx.status = 'dispensada' THEN
    RETURN jsonb_build_object(
      'prescription_id', v_rx.id,
      'number', v_rx.number,
      'status', v_rx.status
    );
  END IF;

  IF v_rx.status <> 'activa' THEN
    RAISE EXCEPTION 'Solo se pueden dispensar recetas activas';
  END IF;

  v_reason := 'Receta ' || COALESCE(v_rx.number, v_rx.id::TEXT);

  FOR v_item IN
    SELECT *
    FROM public.prescription_items
    WHERE prescription_id = v_rx.id
      AND deleted_at IS NULL
    ORDER BY sort_order ASC
  LOOP
    IF v_item.inventory_product_id IS NULL OR v_item.quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_product
    FROM public.inventory_products
    WHERE id = v_item.inventory_product_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_item.medication_name;
    END IF;

    v_before := v_product.quantity;
    IF v_before < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente de %', v_item.medication_name;
    END IF;

    v_after := v_before - v_item.quantity;

    UPDATE public.inventory_products
    SET quantity = v_after
    WHERE id = v_product.id;

    INSERT INTO public.inventory_movements (
      organization_id,
      branch_id,
      product_id,
      movement_type,
      quantity,
      quantity_before,
      quantity_after,
      reason,
      performed_by
    )
    VALUES (
      v_org_id,
      v_product.branch_id,
      v_product.id,
      'salida',
      v_item.quantity,
      v_before,
      v_after,
      v_reason,
      auth.uid()
    );
  END LOOP;

  UPDATE public.prescriptions
  SET
    status = 'dispensada',
    dispensed_at = now(),
    dispensed_by = auth.uid()
  WHERE id = v_rx.id;

  RETURN jsonb_build_object(
    'prescription_id', v_rx.id,
    'number', v_rx.number,
    'status', 'dispensada'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_prescription(
  p_prescription_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_rx public.prescriptions%ROWTYPE;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  SELECT * INTO v_rx
  FROM public.prescriptions
  WHERE id = p_prescription_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receta no encontrada';
  END IF;

  IF v_rx.status = 'anulada' THEN
    RETURN jsonb_build_object(
      'prescription_id', v_rx.id,
      'number', v_rx.number,
      'status', v_rx.status
    );
  END IF;

  IF v_rx.status <> 'activa' THEN
    RAISE EXCEPTION 'Solo se pueden anular recetas activas';
  END IF;

  UPDATE public.prescriptions
  SET
    status = 'anulada',
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE id = v_rx.id;

  RETURN jsonb_build_object(
    'prescription_id', v_rx.id,
    'number', v_rx.number,
    'status', 'anulada'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_active_prescriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_active_prescriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_prescriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_prescription TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispense_prescription TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_prescription TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_month_start TIMESTAMPTZ;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_today DATE;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:read') THEN
    RETURN '{}'::jsonb;
  END IF;

  v_month_start := date_trunc(
    'month',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';

  v_today_start := date_trunc(
    'day',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';

  v_today_end := v_today_start + interval '1 day';
  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;

  RETURN jsonb_build_object(
    'active_patients',
      (
        SELECT COUNT(*)
        FROM public.patients p
        WHERE p.organization_id = v_org_id
          AND p.deleted_at IS NULL
          AND p.is_active = true
          AND p.is_deceased = false
          AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      ),
    'active_owners',
      (
        SELECT COUNT(*)
        FROM public.owners o
        WHERE o.organization_id = v_org_id
          AND o.deleted_at IS NULL
          AND o.is_active = true
          AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
      ),
    'patients_this_month',
      (
        SELECT COUNT(*)
        FROM public.patients p
        WHERE p.organization_id = v_org_id
          AND p.deleted_at IS NULL
          AND p.created_at >= v_month_start
          AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      ),
    'owners_this_month',
      (
        SELECT COUNT(*)
        FROM public.owners o
        WHERE o.organization_id = v_org_id
          AND o.deleted_at IS NULL
          AND o.created_at >= v_month_start
          AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
      ),
    'appointments_today',
      (
        SELECT COUNT(*)
        FROM public.appointments a
        WHERE a.organization_id = v_org_id
          AND a.deleted_at IS NULL
          AND a.starts_at >= v_today_start
          AND a.starts_at < v_today_end
          AND a.status NOT IN ('cancelada', 'ausente')
          AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
          AND public.has_permission('appointments:read')
      ),
    'consultations_this_month',
      (
        SELECT COUNT(*)
        FROM public.consultations c
        WHERE c.organization_id = v_org_id
          AND c.deleted_at IS NULL
          AND c.status = 'completada'
          AND c.completed_at >= v_month_start
          AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'hospitalizations_active',
      (
        SELECT COUNT(*)
        FROM public.hospitalizations h
        WHERE h.organization_id = v_org_id
          AND h.deleted_at IS NULL
          AND h.status IN ('internado', 'observacion')
          AND (p_branch_id IS NULL OR h.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'vaccinations_overdue',
      (
        SELECT COUNT(*)
        FROM (
          SELECT DISTINCT ON (v.patient_id, lower(btrim(v.vaccine_name)))
            v.next_due_at
          FROM public.vaccinations v
          INNER JOIN public.patients p
            ON p.id = v.patient_id
            AND p.deleted_at IS NULL
            AND p.is_deceased = false
            AND p.is_active = true
          WHERE v.organization_id = v_org_id
            AND v.deleted_at IS NULL
            AND v.next_due_at IS NOT NULL
            AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
            AND public.has_permission('clinical:read')
          ORDER BY v.patient_id, lower(btrim(v.vaccine_name)), v.administered_at DESC, v.created_at DESC
        ) latest
        WHERE latest.next_due_at < v_today
      ),
    'surgeries_active',
      (
        SELECT COUNT(*)
        FROM public.surgeries s
        WHERE s.organization_id = v_org_id
          AND s.deleted_at IS NULL
          AND s.status IN ('en_curso', 'recuperacion')
          AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'lab_orders_pending',
      (
        SELECT COUNT(*)
        FROM public.lab_orders o
        WHERE o.organization_id = v_org_id
          AND o.deleted_at IS NULL
          AND o.status IN ('solicitada', 'en_proceso')
          AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'inventory_low_stock',
      (
        SELECT COUNT(*)
        FROM public.inventory_products ip
        WHERE ip.organization_id = v_org_id
          AND ip.deleted_at IS NULL
          AND ip.is_active = true
          AND ip.quantity <= ip.min_quantity
          AND (p_branch_id IS NULL OR ip.branch_id = p_branch_id)
          AND public.has_permission('inventory:read')
      ),
    'invoices_open',
      (
        SELECT COUNT(*)
        FROM public.invoices inv
        WHERE inv.organization_id = v_org_id
          AND inv.deleted_at IS NULL
          AND inv.status = 'emitida'
          AND inv.balance > 0
          AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id)
          AND public.has_permission('billing:read')
      ),
    'reminders_pending',
      public.count_pending_reminders(p_branch_id),
    'prescriptions_active',
      public.count_active_prescriptions(p_branch_id),
    'species_counts',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object('species', s.species, 'count', s.cnt)
            ORDER BY s.cnt DESC, s.species ASC
          )
          FROM (
            SELECT p.species::TEXT AS species, COUNT(*) AS cnt
            FROM public.patients p
            WHERE p.organization_id = v_org_id
              AND p.deleted_at IS NULL
              AND p.is_active = true
              AND p.is_deceased = false
              AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
            GROUP BY p.species
          ) s
        ),
        '[]'::jsonb
      ),
    'recent_patients',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
          FROM (
            SELECT
              p.id,
              p.name,
              p.species::TEXT AS species,
              o.full_name AS owner_full_name,
              p.created_at
            FROM public.patients p
            INNER JOIN public.owners o ON o.id = p.owner_id AND o.deleted_at IS NULL
            WHERE p.organization_id = v_org_id
              AND p.deleted_at IS NULL
              AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
            ORDER BY p.created_at DESC
            LIMIT 5
          ) r
        ),
        '[]'::jsonb
      ),
    'recent_owners',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
          FROM (
            SELECT o.id, o.full_name, o.created_at
            FROM public.owners o
            WHERE o.organization_id = v_org_id
              AND o.deleted_at IS NULL
              AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
            ORDER BY o.created_at DESC
            LIMIT 5
          ) r
        ),
        '[]'::jsonb
      )
  );
END;
$$;
