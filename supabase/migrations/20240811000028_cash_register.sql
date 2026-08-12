-- SincVete - Módulo 19: Caja

DO $$ BEGIN
  CREATE TYPE public.cash_session_status AS ENUM (
    'abierta',
    'cerrada'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cash_movement_kind AS ENUM (
    'cobro',
    'ingreso',
    'egreso',
    'retiro'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.cash_session_status NOT NULL DEFAULT 'abierta',
  opening_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  expected_cash NUMERIC(14, 2),
  counted_cash NUMERIC(14, 2) CHECK (counted_cash IS NULL OR counted_cash >= 0),
  difference NUMERIC(14, 2),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 5000),
  close_notes TEXT CHECK (close_notes IS NULL OR char_length(close_notes) <= 5000),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.cash_session_status,
  ADD COLUMN IF NOT EXISTS opening_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS counted_cash NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS difference NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS close_notes TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.cash_movement_kind NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'efectivo',
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind public.cash_movement_kind,
  ADD COLUMN IF NOT EXISTS method public.payment_method NOT NULL DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cash_sessions_org_opened
  ON public.cash_sessions (organization_id, opened_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_sessions_org_status
  ON public.cash_sessions (organization_id, status, opened_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_sessions_open_branch
  ON public.cash_sessions (organization_id, branch_id)
  WHERE deleted_at IS NULL AND status = 'abierta';

CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON public.cash_movements (cash_session_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_movements_payment
  ON public.cash_movements (payment_id)
  WHERE deleted_at IS NULL AND payment_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cash_sessions_updated_at ON public.cash_sessions;
CREATE TRIGGER trg_cash_sessions_updated_at
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_cash_sessions ON public.cash_sessions;
CREATE TRIGGER trg_audit_cash_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS trg_cash_movements_updated_at ON public.cash_movements;
CREATE TRIGGER trg_cash_movements_updated_at
  BEFORE UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_cash_movements ON public.cash_movements;
CREATE TRIGGER trg_audit_cash_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_select_tenant" ON public.cash_sessions;
CREATE POLICY "cash_sessions_select_tenant" ON public.cash_sessions
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:read')
  );

DROP POLICY IF EXISTS "cash_sessions_insert_tenant" ON public.cash_sessions;
CREATE POLICY "cash_sessions_insert_tenant" ON public.cash_sessions
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

DROP POLICY IF EXISTS "cash_sessions_update_tenant" ON public.cash_sessions;
CREATE POLICY "cash_sessions_update_tenant" ON public.cash_sessions
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:write')
  );

DROP POLICY IF EXISTS "cash_movements_select_tenant" ON public.cash_movements;
CREATE POLICY "cash_movements_select_tenant" ON public.cash_movements
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:read')
  );

DROP POLICY IF EXISTS "cash_movements_insert_tenant" ON public.cash_movements;
CREATE POLICY "cash_movements_insert_tenant" ON public.cash_movements
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

CREATE OR REPLACE FUNCTION public.cash_session_expected_amount(
  p_session_id UUID
)
RETURNS NUMERIC(14, 2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(
    COALESCE(s.opening_amount, 0)
    + COALESCE((
      SELECT SUM(m.amount)
      FROM public.cash_movements m
      WHERE m.cash_session_id = s.id
        AND m.deleted_at IS NULL
        AND m.kind IN ('cobro', 'ingreso')
        AND m.method = 'efectivo'
    ), 0)
    - COALESCE((
      SELECT SUM(m.amount)
      FROM public.cash_movements m
      WHERE m.cash_session_id = s.id
        AND m.deleted_at IS NULL
        AND m.kind IN ('egreso', 'retiro')
    ), 0)
  , 2)
  FROM public.cash_sessions s
  WHERE s.id = p_session_id
    AND s.deleted_at IS NULL
    AND s.organization_id = public.get_user_organization_id();
$$;

CREATE OR REPLACE FUNCTION public.count_open_cash_sessions(
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
  IF v_org_id IS NULL OR NOT public.has_permission('billing:read') THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)::int
    FROM public.cash_sessions s
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND s.status = 'abierta'
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_open_cash_session(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  opened_by UUID,
  closed_by UUID,
  status public.cash_session_status,
  opening_amount NUMERIC,
  expected_cash NUMERIC,
  counted_cash NUMERIC,
  difference NUMERIC,
  notes TEXT,
  close_notes TEXT,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  movement_count BIGINT,
  opened_by_name TEXT,
  closed_by_name TEXT,
  branch_name TEXT,
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
    s.id,
    s.organization_id,
    s.branch_id,
    s.opened_by,
    s.closed_by,
    s.status,
    s.opening_amount,
    public.cash_session_expected_amount(s.id),
    s.counted_cash,
    s.difference,
    s.notes,
    s.close_notes,
    s.opened_at,
    s.closed_at,
    (
      SELECT COUNT(*)
      FROM public.cash_movements m
      WHERE m.cash_session_id = s.id AND m.deleted_at IS NULL
    ) AS movement_count,
    opener.full_name AS opened_by_name,
    closer.full_name AS closed_by_name,
    b.name AS branch_name,
    s.created_at,
    s.updated_at,
    s.deleted_at
  FROM public.cash_sessions s
  INNER JOIN public.branches b ON b.id = s.branch_id AND b.deleted_at IS NULL
  LEFT JOIN public.profiles opener ON opener.id = s.opened_by
  LEFT JOIN public.profiles closer ON closer.id = s.closed_by
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND s.status = 'abierta'
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  ORDER BY s.opened_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_cash_sessions(
  p_branch_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  opened_by UUID,
  closed_by UUID,
  status public.cash_session_status,
  opening_amount NUMERIC,
  expected_cash NUMERIC,
  counted_cash NUMERIC,
  difference NUMERIC,
  notes TEXT,
  close_notes TEXT,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  movement_count BIGINT,
  opened_by_name TEXT,
  closed_by_name TEXT,
  branch_name TEXT,
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
  IF v_org_id IS NULL OR NOT public.has_permission('billing:read') THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      s.*,
      opener.full_name AS open_name,
      closer.full_name AS close_name,
      b.name AS br_name,
      (
        SELECT COUNT(*)
        FROM public.cash_movements m
        WHERE m.cash_session_id = s.id AND m.deleted_at IS NULL
      ) AS mov_cnt,
      CASE
        WHEN s.status = 'cerrada' THEN COALESCE(s.expected_cash, public.cash_session_expected_amount(s.id))
        ELSE public.cash_session_expected_amount(s.id)
      END AS exp_cash
    FROM public.cash_sessions s
    INNER JOIN public.branches b ON b.id = s.branch_id AND b.deleted_at IS NULL
    LEFT JOIN public.profiles opener ON opener.id = s.opened_by
    LEFT JOIN public.profiles closer ON closer.id = s.closed_by
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (p_status IS NULL OR btrim(p_status) = '' OR s.status::TEXT = p_status)
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id,
    f.organization_id,
    f.branch_id,
    f.opened_by,
    f.closed_by,
    f.status,
    f.opening_amount,
    f.exp_cash,
    f.counted_cash,
    f.difference,
    f.notes,
    f.close_notes,
    f.opened_at,
    f.closed_at,
    f.mov_cnt,
    f.open_name,
    f.close_name,
    f.br_name,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.opened_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_cash_movements(
  p_session_id UUID
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  cash_session_id UUID,
  payment_id UUID,
  recorded_by UUID,
  kind public.cash_movement_kind,
  method public.payment_method,
  amount NUMERIC,
  notes TEXT,
  recorded_by_name TEXT,
  invoice_id UUID,
  invoice_number TEXT,
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
    m.id,
    m.organization_id,
    m.cash_session_id,
    m.payment_id,
    m.recorded_by,
    m.kind,
    m.method,
    m.amount,
    m.notes,
    pr.full_name AS recorded_by_name,
    pay.invoice_id,
    inv.number AS invoice_number,
    m.created_at,
    m.updated_at,
    m.deleted_at
  FROM public.cash_movements m
  INNER JOIN public.cash_sessions s
    ON s.id = m.cash_session_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = m.recorded_by
  LEFT JOIN public.payments pay ON pay.id = m.payment_id AND pay.deleted_at IS NULL
  LEFT JOIN public.invoices inv ON inv.id = pay.invoice_id AND inv.deleted_at IS NULL
  WHERE m.cash_session_id = p_session_id
    AND m.organization_id = v_org_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_cash_session(
  p_branch_id UUID,
  p_opening_amount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_session_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('billing:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN
    RAISE EXCEPTION 'El fondo inicial no puede ser negativo';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
      AND b.organization_id = v_org_id
      AND b.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sucursal no encontrada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cash_sessions s
    WHERE s.organization_id = v_org_id
      AND s.branch_id = p_branch_id
      AND s.status = 'abierta'
      AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya hay una caja abierta en esta sucursal';
  END IF;

  INSERT INTO public.cash_sessions (
    organization_id,
    branch_id,
    opened_by,
    status,
    opening_amount,
    notes,
    opened_at
  )
  VALUES (
    v_org_id,
    p_branch_id,
    auth.uid(),
    'abierta',
    ROUND(p_opening_amount, 2),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    now()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('cash_session_id', v_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_cash_movement(
  p_session_id UUID,
  p_kind TEXT,
  p_amount NUMERIC,
  p_method public.payment_method DEFAULT 'efectivo',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_session public.cash_sessions%ROWTYPE;
  v_kind public.cash_movement_kind;
  v_method public.payment_method;
  v_movement_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('billing:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('ingreso', 'egreso', 'retiro') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido';
  END IF;

  v_kind := p_kind::public.cash_movement_kind;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El importe debe ser mayor a 0';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada';
  END IF;

  IF v_session.status <> 'abierta' THEN
    RAISE EXCEPTION 'La caja está cerrada';
  END IF;

  IF v_kind IN ('egreso', 'retiro') THEN
    v_method := 'efectivo';
  ELSE
    v_method := COALESCE(p_method, 'efectivo');
  END IF;

  INSERT INTO public.cash_movements (
    organization_id,
    cash_session_id,
    recorded_by,
    kind,
    method,
    amount,
    notes
  )
  VALUES (
    v_org_id,
    v_session.id,
    auth.uid(),
    v_kind,
    v_method,
    ROUND(p_amount, 2),
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'cash_movement_id', v_movement_id,
    'cash_session_id', v_session.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id UUID,
  p_counted_cash NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_session public.cash_sessions%ROWTYPE;
  v_expected NUMERIC(14, 2);
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('billing:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'El efectivo contado no puede ser negativo';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada';
  END IF;

  IF v_session.status = 'cerrada' THEN
    RETURN jsonb_build_object(
      'cash_session_id', v_session.id,
      'status', v_session.status
    );
  END IF;

  v_expected := public.cash_session_expected_amount(v_session.id);

  UPDATE public.cash_sessions
  SET
    status = 'cerrada',
    expected_cash = v_expected,
    counted_cash = ROUND(p_counted_cash, 2),
    difference = ROUND(p_counted_cash, 2) - v_expected,
    close_notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
    closed_at = now(),
    closed_by = auth.uid()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'cash_session_id', v_session.id,
    'expected_cash', v_expected,
    'counted_cash', ROUND(p_counted_cash, 2),
    'difference', ROUND(p_counted_cash, 2) - v_expected
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
  v_session_id UUID;
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

  SELECT s.id INTO v_session_id
  FROM public.cash_sessions s
  WHERE s.organization_id = v_org_id
    AND s.branch_id = v_invoice.branch_id
    AND s.status = 'abierta'
    AND s.deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_session_id IS NOT NULL THEN
    INSERT INTO public.cash_movements (
      organization_id,
      cash_session_id,
      payment_id,
      recorded_by,
      kind,
      method,
      amount,
      notes
    )
    VALUES (
      v_org_id,
      v_session_id,
      v_payment_id,
      auth.uid(),
      'cobro',
      p_method,
      p_amount,
      COALESCE('Cobro ' || NULLIF(v_invoice.number, ''), 'Cobro de factura')
    );
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id,
    'paid_amount', v_paid,
    'balance', v_balance,
    'cash_session_id', v_session_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cash_session_expected_amount TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_open_cash_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_open_cash_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_cash_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_cash_movements TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_cash_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_cash_movement TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment TO authenticated;

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
    'cash_sessions_open',
      public.count_open_cash_sessions(p_branch_id),
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
