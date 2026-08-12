-- SincVete - Módulo 21: Configuración

-- Preferencia de sucursal activa por usuario
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_branch
  ON public.profiles (active_branch_id)
  WHERE deleted_at IS NULL;

-- Invitaciones de equipo
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  role public.user_role NOT NULL DEFAULT 'readonly',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_invitations_pending_email
  ON public.organization_invitations (organization_id, lower(email))
  WHERE deleted_at IS NULL AND status = 'pending';

CREATE INDEX idx_invitations_org_status
  ON public.organization_invitations (organization_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_organization_invitations_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_organization_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- Validar que el usuario pertenece a la sucursal activa
CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branch_members bm
    WHERE bm.user_id = auth.uid()
      AND bm.branch_id = p_branch_id
      AND bm.deleted_at IS NULL
      AND bm.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_branch_access TO authenticated;

-- RLS invitations
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select_tenant" ON public.organization_invitations
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('users:manage')
  );

CREATE POLICY "invitations_insert_admin" ON public.organization_invitations
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('users:manage')
  );

CREATE POLICY "invitations_update_admin" ON public.organization_invitations
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('users:manage')
  );

-- Permitir actualizar sucursal activa propia
CREATE POLICY "profiles_update_active_branch_self" ON public.profiles
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND id = auth.uid()
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND id = auth.uid()
    AND (
      active_branch_id IS NULL
      OR public.user_has_branch_access(active_branch_id)
    )
  );

-- Agregar miembro al equipo (usuario ya registrado en auth)
CREATE OR REPLACE FUNCTION public.add_team_member(
  p_user_id UUID,
  p_branch_id UUID,
  p_role public.user_role
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_member_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_permission('users:manage') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_branch_id
      AND b.organization_id = v_org_id
      AND b.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.organization_id <> v_org_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User belongs to another organization';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    INSERT INTO public.profiles (id, organization_id, full_name)
    SELECT
      p_user_id,
      v_org_id,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1)
      )
    FROM auth.users u
    WHERE u.id = p_user_id;
  END IF;

  INSERT INTO public.branch_members (organization_id, branch_id, user_id, role)
  VALUES (v_org_id, p_branch_id, p_user_id, p_role)
  ON CONFLICT (branch_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true,
        deleted_at = NULL,
        updated_at = now()
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_team_member TO authenticated;
