-- SincVete - Módulo 12: Facturación

CREATE TYPE public.invoice_status AS ENUM (
  'borrador',
  'emitida',
  'pagada',
  'anulada'
);

CREATE TYPE public.payment_method AS ENUM (
  'efectivo',
  'transferencia',
  'tarjeta',
  'mercadopago',
  'otro'
);

CREATE TABLE public.invoice_sequences (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE RESTRICT,
  last_number INT NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.invoice_status NOT NULL DEFAULT 'borrador',
  number TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (char_length(currency) BETWEEN 3 AND 3),
  issued_at TIMESTAMPTZ,
  due_at DATE,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT invoices_number_len CHECK (number IS NULL OR char_length(number) BETWEEN 3 AND 30),
  CONSTRAINT invoices_paid_not_over_total CHECK (paid_amount <= total),
  CONSTRAINT invoices_balance_matches CHECK (balance = total - paid_amount)
);

CREATE UNIQUE INDEX uq_invoices_org_number
  ON public.invoices (organization_id, number)
  WHERE deleted_at IS NULL AND number IS NOT NULL;

CREATE INDEX idx_invoices_org_created
  ON public.invoices (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_status
  ON public.invoices (organization_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_owner
  ON public.invoices (owner_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_patient
  ON public.invoices (patient_id, created_at DESC)
  WHERE deleted_at IS NULL AND patient_id IS NOT NULL;

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  inventory_product_id UUID REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_invoice_items_invoice
  ON public.invoice_items (invoice_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  method public.payment_method NOT NULL DEFAULT 'efectivo',
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT payments_reference_len CHECK (
    reference IS NULL OR char_length(reference) BETWEEN 1 AND 80
  )
);

CREATE INDEX idx_payments_invoice
  ON public.payments (invoice_id, paid_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoice_items_updated_at
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_invoice_items
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_tenant" ON public.invoices
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:read')
  );

CREATE POLICY "invoices_insert_tenant" ON public.invoices
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

CREATE POLICY "invoices_update_tenant" ON public.invoices
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:write')
  );

CREATE POLICY "invoice_items_select_tenant" ON public.invoice_items
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:read')
  );

CREATE POLICY "invoice_items_insert_tenant" ON public.invoice_items
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

CREATE POLICY "invoice_items_update_tenant" ON public.invoice_items
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:write')
  );

CREATE POLICY "invoice_items_delete_tenant" ON public.invoice_items
  FOR DELETE USING (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

CREATE POLICY "payments_select_tenant" ON public.payments
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:read')
  );

CREATE POLICY "payments_insert_tenant" ON public.payments
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal NUMERIC(14, 2);
BEGIN
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_subtotal
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id
    AND deleted_at IS NULL;

  UPDATE public.invoices
  SET
    subtotal = v_subtotal,
    tax_amount = 0,
    total = v_subtotal,
    balance = v_subtotal - paid_amount
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_invoices(
  p_search TEXT DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
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
  owner_id UUID,
  patient_id UUID,
  consultation_id UUID,
  created_by UUID,
  issued_by UUID,
  status public.invoice_status,
  number TEXT,
  currency TEXT,
  issued_at TIMESTAMPTZ,
  due_at DATE,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  subtotal NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  paid_amount NUMERIC,
  balance NUMERIC,
  notes TEXT,
  item_count BIGINT,
  owner_full_name TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  created_by_name TEXT,
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
  v_page INT;
  v_page_size INT;
  v_search TEXT;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('billing:read') THEN
    RETURN;
  END IF;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_search := NULLIF(btrim(COALESCE(p_search, '')), '');

  RETURN QUERY
  WITH filtered AS (
    SELECT i.*
    FROM public.invoices i
    INNER JOIN public.owners o ON o.id = i.owner_id
    LEFT JOIN public.patients p ON p.id = i.patient_id
    WHERE i.organization_id = v_org_id
      AND i.deleted_at IS NULL
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND (p_owner_id IS NULL OR i.owner_id = p_owner_id)
      AND (p_patient_id IS NULL OR i.patient_id = p_patient_id)
      AND (p_status IS NULL OR i.status::TEXT = p_status)
      AND (
        v_search IS NULL
        OR COALESCE(i.number, '') ILIKE '%' || v_search || '%'
        OR o.full_name ILIKE '%' || v_search || '%'
        OR COALESCE(p.name, '') ILIKE '%' || v_search || '%'
      )
  )
  SELECT
    f.id,
    f.organization_id,
    f.branch_id,
    f.owner_id,
    f.patient_id,
    f.consultation_id,
    f.created_by,
    f.issued_by,
    f.status,
    f.number,
    f.currency,
    f.issued_at,
    f.due_at,
    f.paid_at,
    f.voided_at,
    f.subtotal,
    f.tax_amount,
    f.total,
    f.paid_amount,
    f.balance,
    f.notes,
    (
      SELECT COUNT(*)
      FROM public.invoice_items it
      WHERE it.invoice_id = f.id AND it.deleted_at IS NULL
    ) AS item_count,
    o.full_name AS owner_full_name,
    p.name AS patient_name,
    p.species AS patient_species,
    pr.full_name AS created_by_name,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  INNER JOIN public.owners o ON o.id = f.owner_id
  LEFT JOIN public.patients p ON p.id = f.patient_id
  LEFT JOIN public.profiles pr ON pr.id = f.created_by
  ORDER BY
    CASE f.status
      WHEN 'emitida' THEN 0
      WHEN 'borrador' THEN 1
      WHEN 'pagada' THEN 2
      ELSE 3
    END,
    f.created_at DESC
  LIMIT v_page_size
  OFFSET (v_page - 1) * v_page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_open_invoices(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  owner_id UUID,
  patient_id UUID,
  consultation_id UUID,
  created_by UUID,
  issued_by UUID,
  status public.invoice_status,
  number TEXT,
  currency TEXT,
  issued_at TIMESTAMPTZ,
  due_at DATE,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  subtotal NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  paid_amount NUMERIC,
  balance NUMERIC,
  notes TEXT,
  item_count BIGINT,
  owner_full_name TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  created_by_name TEXT,
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
  IF v_org_id IS NULL OR NOT public.has_permission('billing:read') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.organization_id,
    i.branch_id,
    i.owner_id,
    i.patient_id,
    i.consultation_id,
    i.created_by,
    i.issued_by,
    i.status,
    i.number,
    i.currency,
    i.issued_at,
    i.due_at,
    i.paid_at,
    i.voided_at,
    i.subtotal,
    i.tax_amount,
    i.total,
    i.paid_amount,
    i.balance,
    i.notes,
    (
      SELECT COUNT(*)
      FROM public.invoice_items it
      WHERE it.invoice_id = i.id AND it.deleted_at IS NULL
    ) AS item_count,
    o.full_name AS owner_full_name,
    p.name AS patient_name,
    p.species AS patient_species,
    pr.full_name AS created_by_name,
    i.created_at,
    i.updated_at,
    i.deleted_at
  FROM public.invoices i
  INNER JOIN public.owners o ON o.id = i.owner_id
  LEFT JOIN public.patients p ON p.id = i.patient_id
  LEFT JOIN public.profiles pr ON pr.id = i.created_by
  WHERE i.organization_id = v_org_id
    AND i.deleted_at IS NULL
    AND i.status = 'emitida'
    AND i.balance > 0
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
  ORDER BY i.issued_at ASC NULLS LAST, i.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_invoice(
  p_invoice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_invoice public.invoices%ROWTYPE;
  v_next INT;
  v_number TEXT;
  v_item_count INT;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('billing:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_invoice.status <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se pueden emitir borradores';
  END IF;

  SELECT COUNT(*) INTO v_item_count
  FROM public.invoice_items
  WHERE invoice_id = v_invoice.id AND deleted_at IS NULL;

  IF v_item_count < 1 THEN
    RAISE EXCEPTION 'Agregá al menos un ítem';
  END IF;

  PERFORM public.recalc_invoice_totals(v_invoice.id);

  INSERT INTO public.invoice_sequences (organization_id, last_number)
  VALUES (v_org_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE public.invoice_sequences
  SET last_number = last_number + 1
  WHERE organization_id = v_org_id
  RETURNING last_number INTO v_next;

  v_number := 'F-' || lpad(v_next::TEXT, 6, '0');

  UPDATE public.invoices
  SET
    status = 'emitida',
    number = v_number,
    issued_at = now(),
    issued_by = auth.uid()
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice.id,
    'number', v_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_method public.payment_method DEFAULT 'efectivo',
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_invoice public.invoices%ROWTYPE;
  v_payment_id UUID;
  v_paid NUMERIC(14, 2);
  v_balance NUMERIC(14, 2);
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('billing:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El importe debe ser mayor a 0';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_invoice.status <> 'emitida' THEN
    RAISE EXCEPTION 'Solo se pueden cobrar facturas emitidas';
  END IF;

  IF p_amount > v_invoice.balance THEN
    RAISE EXCEPTION 'El importe supera el saldo';
  END IF;

  INSERT INTO public.payments (
    organization_id,
    invoice_id,
    recorded_by,
    method,
    amount,
    paid_at,
    reference,
    notes
  )
  VALUES (
    v_org_id,
    v_invoice.id,
    auth.uid(),
    p_method,
    p_amount,
    COALESCE(p_paid_at, now()),
    NULLIF(btrim(COALESCE(p_reference, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_payment_id;

  v_paid := v_invoice.paid_amount + p_amount;
  v_balance := v_invoice.total - v_paid;

  UPDATE public.invoices
  SET
    paid_amount = v_paid,
    balance = v_balance,
    status = CASE WHEN v_balance = 0 THEN 'pagada'::public.invoice_status ELSE status END,
    paid_at = CASE WHEN v_balance = 0 THEN now() ELSE paid_at END
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id,
    'paid_amount', v_paid,
    'balance', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_invoice(
  p_invoice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_invoice public.invoices%ROWTYPE;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('billing:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_invoice.status NOT IN ('borrador', 'emitida') THEN
    RAISE EXCEPTION 'No se puede anular esta factura';
  END IF;

  IF v_invoice.paid_amount > 0 THEN
    RAISE EXCEPTION 'No se puede anular una factura con pagos';
  END IF;

  UPDATE public.invoices
  SET
    status = 'anulada',
    voided_at = now()
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object('invoice_id', v_invoice.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_invoice_totals TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_invoice TO authenticated;
