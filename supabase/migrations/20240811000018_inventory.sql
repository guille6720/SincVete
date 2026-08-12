-- SincVete - Módulo 11: Inventario

CREATE TYPE public.inventory_product_category AS ENUM (
  'medicamento',
  'vacuna',
  'insumo',
  'alimento',
  'laboratorio',
  'otro'
);

CREATE TYPE public.inventory_unit AS ENUM (
  'unidad',
  'caja',
  'frasco',
  'ml',
  'mg',
  'g',
  'kg',
  'dosis',
  'otro'
);

CREATE TYPE public.inventory_movement_type AS ENUM (
  'entrada',
  'salida',
  'ajuste',
  'descarte'
);

CREATE TABLE public.inventory_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  sku TEXT,
  category public.inventory_product_category NOT NULL DEFAULT 'medicamento',
  unit public.inventory_unit NOT NULL DEFAULT 'unidad',
  quantity NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  unit_cost NUMERIC(14, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  unit_price NUMERIC(14, 2) CHECK (unit_price IS NULL OR unit_price >= 0),
  manufacturer TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT inventory_products_sku_len CHECK (sku IS NULL OR char_length(sku) BETWEEN 1 AND 60),
  CONSTRAINT inventory_products_manufacturer_len CHECK (
    manufacturer IS NULL OR char_length(manufacturer) BETWEEN 1 AND 120
  )
);

CREATE UNIQUE INDEX uq_inventory_products_sku
  ON public.inventory_products (organization_id, branch_id, lower(sku))
  WHERE deleted_at IS NULL AND sku IS NOT NULL;

CREATE INDEX idx_inventory_products_org_name
  ON public.inventory_products (organization_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_products_low_stock
  ON public.inventory_products (organization_id, branch_id, quantity)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE RESTRICT,
  movement_type public.inventory_movement_type NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  quantity_before NUMERIC(14, 3) NOT NULL CHECK (quantity_before >= 0),
  quantity_after NUMERIC(14, 3) NOT NULL CHECK (quantity_after >= 0),
  lot_number TEXT,
  expires_at DATE,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT inventory_movements_lot_len CHECK (
    lot_number IS NULL OR char_length(lot_number) BETWEEN 1 AND 80
  )
);

CREATE INDEX idx_inventory_movements_product
  ON public.inventory_movements (product_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_movements_org
  ON public.inventory_movements (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_inventory_products_updated_at
  BEFORE UPDATE ON public.inventory_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_inventory_movements_updated_at
  BEFORE UPDATE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_inventory_products
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_products
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_inventory_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_products_select_tenant" ON public.inventory_products
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('inventory:read')
  );

CREATE POLICY "inventory_products_insert_tenant" ON public.inventory_products
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('inventory:write')
  );

CREATE POLICY "inventory_products_update_tenant" ON public.inventory_products
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('inventory:write')
  );

CREATE POLICY "inventory_movements_select_tenant" ON public.inventory_movements
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('inventory:read')
  );

CREATE POLICY "inventory_movements_insert_tenant" ON public.inventory_movements
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('inventory:write')
  );

CREATE OR REPLACE FUNCTION public.search_inventory_products(
  p_search TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_low_stock BOOLEAN DEFAULT FALSE,
  p_active_only BOOLEAN DEFAULT TRUE,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  name TEXT,
  sku TEXT,
  category public.inventory_product_category,
  unit public.inventory_unit,
  quantity NUMERIC,
  min_quantity NUMERIC,
  unit_cost NUMERIC,
  unit_price NUMERIC,
  manufacturer TEXT,
  notes TEXT,
  is_active BOOLEAN,
  is_low_stock BOOLEAN,
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
  IF v_org_id IS NULL OR NOT public.has_permission('inventory:read') THEN
    RETURN;
  END IF;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_search := NULLIF(btrim(COALESCE(p_search, '')), '');

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.*,
      (p.is_active AND p.quantity <= p.min_quantity) AS is_low_stock
    FROM public.inventory_products p
    WHERE p.organization_id = v_org_id
      AND p.deleted_at IS NULL
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (p_category IS NULL OR p.category::TEXT = p_category)
      AND (NOT COALESCE(p_active_only, true) OR p.is_active = true)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR COALESCE(p.sku, '') ILIKE '%' || v_search || '%'
        OR COALESCE(p.manufacturer, '') ILIKE '%' || v_search || '%'
      )
      AND (
        NOT COALESCE(p_low_stock, false)
        OR (p.is_active AND p.quantity <= p.min_quantity)
      )
  )
  SELECT
    f.id,
    f.organization_id,
    f.branch_id,
    f.name,
    f.sku,
    f.category,
    f.unit,
    f.quantity,
    f.min_quantity,
    f.unit_cost,
    f.unit_price,
    f.manufacturer,
    f.notes,
    f.is_active,
    f.is_low_stock,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY
    CASE WHEN f.is_low_stock THEN 0 ELSE 1 END,
    f.name ASC
  LIMIT v_page_size
  OFFSET (v_page - 1) * v_page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_low_stock(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  name TEXT,
  sku TEXT,
  category public.inventory_product_category,
  unit public.inventory_unit,
  quantity NUMERIC,
  min_quantity NUMERIC,
  unit_cost NUMERIC,
  unit_price NUMERIC,
  manufacturer TEXT,
  notes TEXT,
  is_active BOOLEAN,
  is_low_stock BOOLEAN,
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
  IF v_org_id IS NULL OR NOT public.has_permission('inventory:read') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.organization_id,
    p.branch_id,
    p.name,
    p.sku,
    p.category,
    p.unit,
    p.quantity,
    p.min_quantity,
    p.unit_cost,
    p.unit_price,
    p.manufacturer,
    p.notes,
    p.is_active,
    true AS is_low_stock,
    p.created_at,
    p.updated_at,
    p.deleted_at
  FROM public.inventory_products p
  WHERE p.organization_id = v_org_id
    AND p.deleted_at IS NULL
    AND p.is_active = true
    AND p.quantity <= p.min_quantity
    AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
  ORDER BY p.quantity ASC, p.name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  p_product_id UUID,
  p_movement_type public.inventory_movement_type,
  p_quantity NUMERIC,
  p_reason TEXT DEFAULT NULL,
  p_lot_number TEXT DEFAULT NULL,
  p_expires_at DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_product public.inventory_products%ROWTYPE;
  v_before NUMERIC(14, 3);
  v_after NUMERIC(14, 3);
  v_movement_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('inventory:write') THEN
    RAISE EXCEPTION 'Permiso denegado';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;

  SELECT * INTO v_product
  FROM public.inventory_products
  WHERE id = p_product_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  v_before := v_product.quantity;

  IF p_movement_type = 'entrada' THEN
    v_after := v_before + p_quantity;
  ELSIF p_movement_type = 'salida' OR p_movement_type = 'descarte' THEN
    IF v_before < p_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente';
    END IF;
    v_after := v_before - p_quantity;
  ELSIF p_movement_type = 'ajuste' THEN
    v_after := p_quantity;
    IF v_after = v_before THEN
      RAISE EXCEPTION 'El ajuste no modifica el stock';
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido';
  END IF;

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
    lot_number,
    expires_at,
    reason,
    performed_by
  )
  VALUES (
    v_org_id,
    v_product.branch_id,
    v_product.id,
    p_movement_type,
    CASE
      WHEN p_movement_type = 'ajuste' THEN ABS(v_after - v_before)
      ELSE p_quantity
    END,
    v_before,
    v_after,
    NULLIF(btrim(COALESCE(p_lot_number, '')), ''),
    p_expires_at,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'product_id', v_product.id,
    'quantity_before', v_before,
    'quantity_after', v_after
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_inventory_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_low_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement TO authenticated;
