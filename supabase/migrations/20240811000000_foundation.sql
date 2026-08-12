-- SincVete - Módulo 0: Fundación SaaS
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE public.user_role AS ENUM (
  'owner',
  'admin',
  'veterinarian',
  'nurse',
  'receptionist',
  'cashier',
  'lab_tech',
  'readonly'
);

CREATE TYPE public.org_plan AS ENUM (
  'trial',
  'basic',
  'professional',
  'enterprise'
);

-- Organizations (tenant root)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$' AND char_length(slug) BETWEEN 3 AND 50),
  plan public.org_plan NOT NULL DEFAULT 'trial',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON public.organizations (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_active ON public.organizations (created_at DESC) WHERE deleted_at IS NULL;

-- Branches (multi-sucursal)
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  code TEXT NOT NULL CHECK (char_length(code) BETWEEN 2 AND 20),
  address TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, code)
);

CREATE INDEX idx_branches_org ON public.branches (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_branches_org_active ON public.branches (organization_id, is_active) WHERE deleted_at IS NULL;

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_profiles_org ON public.profiles (organization_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_profiles_org_user ON public.profiles (organization_id, id) WHERE deleted_at IS NULL;

-- Branch membership with roles
CREATE TABLE public.branch_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'readonly',
  permissions JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (branch_id, user_id)
);

CREATE INDEX idx_branch_members_org ON public.branch_members (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_branch_members_user ON public.branch_members (user_id) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_branch_members_branch ON public.branch_members (branch_id) WHERE deleted_at IS NULL AND is_active = true;

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_created ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_branch_members_updated_at
  BEFORE UPDATE ON public.branch_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: get current user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND deleted_at IS NULL
    AND is_active = true
  LIMIT 1;
$$;

-- Helper: check permission
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
  custom_perms JSONB;
  role_perms TEXT[];
BEGIN
  SELECT bm.role, bm.permissions
  INTO user_role, custom_perms
  FROM public.branch_members bm
  WHERE bm.user_id = auth.uid()
    AND bm.deleted_at IS NULL
    AND bm.is_active = true
  ORDER BY bm.created_at ASC
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  IF custom_perms IS NOT NULL AND jsonb_array_length(custom_perms) > 0 THEN
    RETURN custom_perms ? required_permission;
  END IF;

  role_perms := CASE user_role
    WHEN 'owner' THEN ARRAY[
      'org:manage','branch:manage','users:manage','patients:read','patients:write',
      'appointments:read','appointments:write','clinical:read','clinical:write',
      'billing:read','billing:write','inventory:read','inventory:write',
      'reports:read','audit:read'
    ]
    WHEN 'admin' THEN ARRAY[
      'org:manage','branch:manage','users:manage','patients:read','patients:write',
      'appointments:read','appointments:write','clinical:read','clinical:write',
      'billing:read','billing:write','inventory:read','inventory:write',
      'reports:read','audit:read'
    ]
    WHEN 'veterinarian' THEN ARRAY[
      'patients:read','patients:write','appointments:read','appointments:write',
      'clinical:read','clinical:write','inventory:read','reports:read'
    ]
    WHEN 'nurse' THEN ARRAY[
      'patients:read','patients:write','appointments:read','appointments:write',
      'clinical:read','clinical:write','inventory:read'
    ]
    WHEN 'receptionist' THEN ARRAY[
      'patients:read','patients:write','appointments:read','appointments:write','billing:read'
    ]
    WHEN 'cashier' THEN ARRAY['patients:read','appointments:read','billing:read','billing:write']
    WHEN 'lab_tech' THEN ARRAY['patients:read','clinical:read','clinical:write','inventory:read']
    WHEN 'readonly' THEN ARRAY['patients:read','appointments:read','clinical:read','reports:read']
    ELSE ARRAY[]::TEXT[]
  END;

  RETURN required_permission = ANY(role_perms);
END;
$$;

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  branch_id_val UUID;
  action_name TEXT;
  old_row JSONB;
  new_row JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_name := 'create';
    new_row := to_jsonb(NEW);
    org_id := NEW.organization_id;
    branch_id_val := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'update';
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    org_id := NEW.organization_id;
    branch_id_val := NULL;
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'delete';
    old_row := to_jsonb(OLD);
    org_id := OLD.organization_id;
    branch_id_val := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    org_id,
    branch_id_val,
    auth.uid(),
    action_name,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    old_row,
    new_row
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_branch_members
  AFTER INSERT OR UPDATE OR DELETE ON public.branch_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Organizations
CREATE POLICY "org_select_own" ON public.organizations
  FOR SELECT USING (id = public.get_user_organization_id() AND deleted_at IS NULL);

CREATE POLICY "org_update_admin" ON public.organizations
  FOR UPDATE USING (
    id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('org:manage')
  );

-- RLS Policies: Branches
CREATE POLICY "branches_select_tenant" ON public.branches
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "branches_insert_admin" ON public.branches
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('branch:manage')
  );

CREATE POLICY "branches_update_admin" ON public.branches
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('branch:manage')
  );

-- RLS Policies: Profiles
CREATE POLICY "profiles_select_tenant" ON public.profiles
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND (id = auth.uid() OR public.has_permission('users:manage'))
  );

-- RLS Policies: Branch Members
CREATE POLICY "branch_members_select_tenant" ON public.branch_members
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "branch_members_manage_admin" ON public.branch_members
  FOR ALL USING (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('users:manage')
  );

-- RLS Policies: Audit Logs
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('audit:read')
  );

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
  );

-- Signup function (creates org + branch + profile + membership atomically)
CREATE OR REPLACE FUNCTION public.handle_new_user_signup(
  p_full_name TEXT,
  p_organization_name TEXT,
  p_organization_slug TEXT,
  p_branch_name TEXT DEFAULT 'Sucursal Principal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_branch_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = p_organization_slug AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Organization slug already taken';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (p_organization_name, p_organization_slug)
  RETURNING id INTO v_org_id;

  INSERT INTO public.branches (organization_id, name, code, is_main)
  VALUES (v_org_id, p_branch_name, 'MAIN', true)
  RETURNING id INTO v_branch_id;

  INSERT INTO public.profiles (id, organization_id, full_name)
  VALUES (v_user_id, v_org_id, p_full_name);

  INSERT INTO public.branch_members (organization_id, branch_id, user_id, role)
  VALUES (v_org_id, v_branch_id, v_user_id, 'owner');

  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'branch_id', v_branch_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user_signup TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission TO authenticated;
