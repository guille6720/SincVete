-- Allow users to always read their own profile (avoids session dead-ends).
CREATE POLICY "profiles_select_self" ON public.profiles
  FOR SELECT USING (id = auth.uid() AND deleted_at IS NULL);

-- Ensure signup sets active branch so /home resolves staff session immediately.
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

  INSERT INTO public.profiles (id, organization_id, full_name, active_branch_id)
  VALUES (v_user_id, v_org_id, p_full_name, v_branch_id);

  INSERT INTO public.branch_members (organization_id, branch_id, user_id, role)
  VALUES (v_org_id, v_branch_id, v_user_id, 'owner');

  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'branch_id', v_branch_id
  );
END;
$$;
