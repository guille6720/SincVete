-- SincVete - Módulo 10: Laboratorio

CREATE TYPE public.lab_order_status AS ENUM (
  'solicitada',
  'en_proceso',
  'completada',
  'cancelada'
);

CREATE TYPE public.lab_priority AS ENUM (
  'rutina',
  'urgente'
);

CREATE TYPE public.lab_sample_type AS ENUM (
  'sangre',
  'orina',
  'materia_fecal',
  'hisopado',
  'otro'
);

CREATE TYPE public.lab_result_flag AS ENUM (
  'pendiente',
  'normal',
  'alto',
  'bajo',
  'anormal'
);

CREATE TABLE public.lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  ordered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.lab_order_status NOT NULL DEFAULT 'solicitada',
  priority public.lab_priority NOT NULL DEFAULT 'rutina',
  sample_type public.lab_sample_type,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  interpretation TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_lab_orders_org_ordered ON public.lab_orders (organization_id, ordered_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lab_orders_patient ON public.lab_orders (patient_id, ordered_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lab_orders_status ON public.lab_orders (organization_id, status, ordered_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE public.lab_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  lab_order_id UUID NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL CHECK (char_length(test_name) BETWEEN 1 AND 120),
  result_value TEXT,
  unit TEXT,
  reference_range TEXT,
  flag public.lab_result_flag NOT NULL DEFAULT 'pendiente',
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_lab_order_items_order ON public.lab_order_items (lab_order_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_lab_orders_updated_at
  BEFORE UPDATE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_lab_order_items_updated_at
  BEFORE UPDATE ON public.lab_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_lab_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_lab_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.lab_order_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_orders_select_tenant" ON public.lab_orders
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

CREATE POLICY "lab_orders_insert_tenant" ON public.lab_orders
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "lab_orders_update_tenant" ON public.lab_orders
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "lab_order_items_select_tenant" ON public.lab_order_items
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

CREATE POLICY "lab_order_items_insert_tenant" ON public.lab_order_items
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "lab_order_items_update_tenant" ON public.lab_order_items
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.list_lab_queue(
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
  ordered_by UUID,
  completed_by UUID,
  status public.lab_order_status,
  priority public.lab_priority,
  sample_type public.lab_sample_type,
  title TEXT,
  ordered_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  interpretation TEXT,
  notes TEXT,
  item_count BIGINT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  ordered_by_name TEXT,
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
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id, o.organization_id, o.branch_id, o.patient_id, o.owner_id,
    o.consultation_id, o.clinical_entry_id, o.ordered_by, o.completed_by,
    o.status, o.priority, o.sample_type, o.title, o.ordered_at, o.collected_at,
    o.completed_at, o.interpretation, o.notes,
    (
      SELECT COUNT(*)
      FROM public.lab_order_items i
      WHERE i.lab_order_id = o.id AND i.deleted_at IS NULL
    ) AS item_count,
    p.name AS patient_name,
    p.species AS patient_species,
    ow.full_name AS owner_full_name,
    pr.full_name AS ordered_by_name,
    o.created_at, o.updated_at
  FROM public.lab_orders o
  INNER JOIN public.patients p ON p.id = o.patient_id AND p.deleted_at IS NULL
  INNER JOIN public.owners ow ON ow.id = o.owner_id AND ow.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = o.ordered_by
  WHERE o.organization_id = v_org_id
    AND o.deleted_at IS NULL
    AND o.status IN ('solicitada', 'en_proceso')
    AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ORDER BY
    CASE o.priority WHEN 'urgente' THEN 0 ELSE 1 END,
    CASE o.status WHEN 'en_proceso' THEN 0 ELSE 1 END,
    o.ordered_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_lab_queue TO authenticated;

CREATE OR REPLACE FUNCTION public.search_lab_orders(
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
  ordered_by UUID,
  completed_by UUID,
  status public.lab_order_status,
  priority public.lab_priority,
  sample_type public.lab_sample_type,
  title TEXT,
  ordered_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  interpretation TEXT,
  notes TEXT,
  item_count BIGINT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  ordered_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
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
      o.*,
      p.name AS pat_name,
      p.species AS pat_species,
      ow.full_name AS own_name,
      pr.full_name AS ord_name,
      (
        SELECT COUNT(*)
        FROM public.lab_order_items i
        WHERE i.lab_order_id = o.id AND i.deleted_at IS NULL
      ) AS items_cnt
    FROM public.lab_orders o
    INNER JOIN public.patients p ON p.id = o.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners ow ON ow.id = o.owner_id AND ow.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = o.ordered_by
    WHERE o.organization_id = v_org_id
      AND o.deleted_at IS NULL
      AND (p_patient_id IS NULL OR o.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
      AND (p_status IS NULL OR btrim(p_status) = '' OR o.status::TEXT = p_status)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR o.title ILIKE '%' || p_search || '%'
        OR o.interpretation ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR ow.full_name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.patient_id, f.owner_id,
    f.consultation_id, f.clinical_entry_id, f.ordered_by, f.completed_by,
    f.status, f.priority, f.sample_type, f.title, f.ordered_at, f.collected_at,
    f.completed_at, f.interpretation, f.notes, f.items_cnt,
    f.pat_name, f.pat_species, f.own_name, f.ord_name,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.ordered_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_lab_orders TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_lab_order(
  p_lab_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_order public.lab_orders%ROWTYPE;
  v_entry_id UUID;
  v_results TEXT;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Sin permisos para completar el laboratorio';
  END IF;

  SELECT * INTO v_order
  FROM public.lab_orders
  WHERE id = p_lab_order_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de laboratorio no encontrada';
  END IF;

  IF v_order.status = 'completada' THEN
    RETURN jsonb_build_object(
      'lab_order_id', v_order.id,
      'clinical_entry_id', v_order.clinical_entry_id
    );
  END IF;

  IF v_order.status NOT IN ('solicitada', 'en_proceso') THEN
    RAISE EXCEPTION 'La orden no se puede completar';
  END IF;

  SELECT string_agg(
    CONCAT_WS(
      ' · ',
      i.test_name,
      NULLIF(btrim(COALESCE(i.result_value, '')), ''),
      CASE WHEN i.unit IS NOT NULL AND btrim(i.unit) <> '' THEN i.unit END,
      CASE
        WHEN i.flag = 'alto' THEN '↑'
        WHEN i.flag = 'bajo' THEN '↓'
        WHEN i.flag = 'anormal' THEN '!'
        ELSE NULL
      END,
      CASE
        WHEN i.reference_range IS NOT NULL AND btrim(i.reference_range) <> ''
          THEN 'Ref: ' || i.reference_range
        ELSE NULL
      END
    ),
    E'\n'
    ORDER BY i.sort_order, i.created_at
  )
  INTO v_results
  FROM public.lab_order_items i
  WHERE i.lab_order_id = v_order.id
    AND i.deleted_at IS NULL;

  INSERT INTO public.clinical_entries (
    organization_id,
    branch_id,
    patient_id,
    owner_id,
    recorded_by,
    entry_date,
    entry_type,
    title,
    diagnosis,
    treatment,
    plan,
    notes
  ) VALUES (
    v_order.organization_id,
    v_order.branch_id,
    v_order.patient_id,
    v_order.owner_id,
    COALESCE(v_order.completed_by, auth.uid()),
    now(),
    'laboratorio',
    v_order.title,
    v_order.interpretation,
    v_results,
    CASE
      WHEN v_order.sample_type IS NOT NULL THEN 'Muestra: ' || v_order.sample_type::TEXT
      ELSE NULL
    END,
    v_order.notes
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.lab_orders
  SET
    status = 'completada',
    completed_at = now(),
    completed_by = COALESCE(completed_by, auth.uid()),
    clinical_entry_id = v_entry_id
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'lab_order_id', v_order.id,
    'clinical_entry_id', v_entry_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_lab_order TO authenticated;
