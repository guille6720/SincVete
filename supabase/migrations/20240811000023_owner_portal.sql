-- SincVete - Módulo 14: Portal del propietario

ALTER TABLE public.owners
  ADD COLUMN portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_owners_portal_user
  ON public.owners (portal_user_id)
  WHERE portal_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.owner_portal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_portal_invites_email_format CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

CREATE UNIQUE INDEX idx_owner_portal_invites_pending_owner
  ON public.owner_portal_invites (owner_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX idx_owner_portal_invites_hash
  ON public.owner_portal_invites (token_hash);

CREATE INDEX idx_owner_portal_invites_org
  ON public.owner_portal_invites (organization_id, created_at DESC);

CREATE TRIGGER trg_owner_portal_invites_updated_at
  BEFORE UPDATE ON public.owner_portal_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_owner_portal_invites
  AFTER INSERT OR UPDATE OR DELETE ON public.owner_portal_invites
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.owner_portal_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_clinic_staff()
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
      AND bm.deleted_at IS NULL
      AND bm.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_portal_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
  FROM public.owners o
  WHERE o.portal_user_id = auth.uid()
    AND o.deleted_at IS NULL
    AND o.is_active = true
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "org_select_own" ON public.organizations;
CREATE POLICY "org_select_own" ON public.organizations
  FOR SELECT USING (
    id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.is_clinic_staff()
  );

DROP POLICY IF EXISTS "branches_select_tenant" ON public.branches;
CREATE POLICY "branches_select_tenant" ON public.branches
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.is_clinic_staff()
  );

DROP POLICY IF EXISTS "profiles_select_tenant" ON public.profiles;
CREATE POLICY "profiles_select_tenant" ON public.profiles
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND (id = auth.uid() OR public.is_clinic_staff())
  );

DROP POLICY IF EXISTS "branch_members_select_tenant" ON public.branch_members;
CREATE POLICY "branch_members_select_tenant" ON public.branch_members
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.is_clinic_staff()
  );

CREATE POLICY "owner_portal_invites_select_staff" ON public.owner_portal_invites
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('patients:read')
  );

CREATE OR REPLACE FUNCTION public.preview_owner_portal_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_invite public.owner_portal_invites%ROWTYPE;
  v_owner public.owners%ROWTYPE;
  v_org public.organizations%ROWTYPE;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN '{}'::jsonb;
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_invite
  FROM public.owner_portal_invites
  WHERE token_hash = v_hash
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO v_owner
  FROM public.owners
  WHERE id = v_invite.owner_id
    AND deleted_at IS NULL
    AND is_active = true;

  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = v_invite.organization_id
    AND deleted_at IS NULL;

  IF v_owner.id IS NULL OR v_org.id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'owner_name', v_owner.full_name,
    'clinic_name', v_org.name,
    'expires_at', v_invite.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_owner_portal_invite(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_owner public.owners%ROWTYPE;
  v_token TEXT;
  v_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:write') THEN
    RAISE EXCEPTION 'No tenés permisos para invitar al portal';
  END IF;

  SELECT * INTO v_owner
  FROM public.owners
  WHERE id = p_owner_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF v_owner.id IS NULL THEN
    RAISE EXCEPTION 'Propietario no encontrado';
  END IF;

  IF v_owner.portal_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'El propietario ya tiene acceso al portal';
  END IF;

  IF v_owner.email IS NULL OR btrim(v_owner.email) = '' THEN
    RAISE EXCEPTION 'El propietario no tiene email';
  END IF;

  UPDATE public.owner_portal_invites
  SET revoked_at = now()
  WHERE owner_id = v_owner.id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + interval '7 days';

  INSERT INTO public.owner_portal_invites (
    organization_id, owner_id, email, token_hash, invited_by, expires_at
  ) VALUES (
    v_org_id, v_owner.id, lower(btrim(v_owner.email)), v_hash, auth.uid(), v_expires
  );

  RETURN jsonb_build_object(
    'token', v_token,
    'email', lower(btrim(v_owner.email)),
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_owner_portal_invite(
  p_token TEXT,
  p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_hash TEXT;
  v_invite public.owner_portal_invites%ROWTYPE;
  v_owner public.owners%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invitación inválida o vencida';
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_invite
  FROM public.owner_portal_invites
  WHERE token_hash = v_hash
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitación inválida o vencida';
  END IF;

  IF lower(btrim(coalesce(v_email, ''))) <> lower(btrim(v_invite.email)) THEN
    RAISE EXCEPTION 'El email no coincide con la invitación';
  END IF;

  SELECT * INTO v_owner
  FROM public.owners
  WHERE id = v_invite.owner_id
    AND deleted_at IS NULL
    AND is_active = true
  FOR UPDATE;

  IF v_owner.id IS NULL THEN
    RAISE EXCEPTION 'Propietario no encontrado';
  END IF;

  IF v_owner.portal_user_id IS NOT NULL AND v_owner.portal_user_id <> v_user_id THEN
    RAISE EXCEPTION 'El propietario ya tiene acceso al portal';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.owners
    WHERE portal_user_id = v_user_id
      AND id <> v_owner.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta cuenta ya está vinculada a otro propietario';
  END IF;

  IF public.is_clinic_staff() THEN
    RAISE EXCEPTION 'Esta cuenta pertenece al equipo de una clínica';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
    AND deleted_at IS NULL;

  v_name := COALESCE(
    NULLIF(btrim(coalesce(p_full_name, '')), ''),
    v_owner.full_name
  );

  IF v_profile.id IS NULL THEN
    INSERT INTO public.profiles (id, organization_id, full_name)
    VALUES (v_user_id, v_owner.organization_id, v_name);
  ELSIF v_profile.organization_id <> v_owner.organization_id THEN
    RAISE EXCEPTION 'Esta cuenta pertenece a otra clínica';
  END IF;

  UPDATE public.owners
  SET portal_user_id = v_user_id
  WHERE id = v_owner.id;

  UPDATE public.owner_portal_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;

  UPDATE public.owner_portal_invites
  SET revoked_at = now()
  WHERE owner_id = v_owner.id
    AND id <> v_invite.id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'owner_id', v_owner.id,
    'organization_id', v_owner.organization_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_owner_portal_access(p_owner_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:write') THEN
    RAISE EXCEPTION 'No tenés permisos para revocar el portal';
  END IF;

  UPDATE public.owner_portal_invites
  SET revoked_at = now()
  WHERE owner_id = p_owner_id
    AND organization_id = v_org_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  UPDATE public.owners
  SET portal_user_id = NULL
  WHERE id = p_owner_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_portal_status(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_owner public.owners%ROWTYPE;
  v_invite public.owner_portal_invites%ROWTYPE;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:read') THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO v_owner
  FROM public.owners
  WHERE id = p_owner_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL;

  IF v_owner.id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_owner.portal_user_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'active',
      'email', v_owner.email,
      'portal_user_id', v_owner.portal_user_id
    );
  END IF;

  SELECT * INTO v_invite
  FROM public.owner_portal_invites
  WHERE owner_id = v_owner.id
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'invited',
      'email', v_invite.email,
      'expires_at', v_invite.expires_at
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'inactive',
    'email', v_owner.email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_portal_home()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_owner public.owners%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_today DATE;
  v_horizon DATE;
BEGIN
  v_owner_id := public.get_portal_owner_id();
  IF v_owner_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO v_owner FROM public.owners WHERE id = v_owner_id;
  SELECT * INTO v_org FROM public.organizations WHERE id = v_owner.organization_id;

  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_horizon := v_today + 30;

  RETURN jsonb_build_object(
    'clinic', jsonb_build_object(
      'name', v_org.name,
      'phone', v_org.settings ->> 'phone',
      'email', v_org.settings ->> 'email'
    ),
    'owner', jsonb_build_object(
      'id', v_owner.id,
      'full_name', v_owner.full_name,
      'email', v_owner.email,
      'phone', v_owner.phone
    ),
    'patients', COALESCE((
      SELECT jsonb_agg(row_to_json(p)::jsonb ORDER BY p.name)
      FROM (
        SELECT
          pt.id,
          pt.name,
          pt.species::text AS species,
          pt.breed,
          pt.sex::text AS sex,
          pt.birth_date,
          pt.is_deceased
        FROM public.patients pt
        WHERE pt.owner_id = v_owner_id
          AND pt.deleted_at IS NULL
          AND pt.is_active = true
      ) p
    ), '[]'::jsonb),
    'upcoming_appointments', COALESCE((
      SELECT jsonb_agg(row_to_json(a)::jsonb ORDER BY a.starts_at)
      FROM (
        SELECT
          ap.id,
          ap.patient_id,
          pt.name AS patient_name,
          ap.starts_at,
          ap.ends_at,
          ap.status::text AS status,
          ap.appointment_type::text AS appointment_type,
          ap.title
        FROM public.appointments ap
        INNER JOIN public.patients pt ON pt.id = ap.patient_id
        WHERE ap.owner_id = v_owner_id
          AND ap.deleted_at IS NULL
          AND ap.status IN ('programada', 'confirmada', 'en_curso')
          AND ap.starts_at >= now() - interval '2 hours'
        ORDER BY ap.starts_at ASC
        LIMIT 20
      ) a
    ), '[]'::jsonb),
    'vaccines_due', COALESCE((
      SELECT jsonb_agg(row_to_json(v)::jsonb ORDER BY v.next_due_at)
      FROM (
        SELECT
          l.id,
          l.patient_id,
          l.patient_name,
          l.vaccine_name,
          l.administered_at,
          l.next_due_at,
          CASE
            WHEN l.next_due_at < v_today THEN 'vencida'
            ELSE 'por_vencer'
          END AS due_status
        FROM (
          SELECT DISTINCT ON (vac.patient_id, lower(btrim(vac.vaccine_name)))
            vac.id,
            vac.patient_id,
            pt.name AS patient_name,
            vac.vaccine_name,
            vac.administered_at,
            vac.next_due_at
          FROM public.vaccinations vac
          INNER JOIN public.patients pt
            ON pt.id = vac.patient_id
            AND pt.deleted_at IS NULL
            AND pt.is_deceased = false
            AND pt.is_active = true
          WHERE vac.owner_id = v_owner_id
            AND vac.deleted_at IS NULL
            AND vac.next_due_at IS NOT NULL
          ORDER BY vac.patient_id, lower(btrim(vac.vaccine_name)), vac.administered_at DESC, vac.created_at DESC
        ) l
        WHERE l.next_due_at <= v_horizon
        ORDER BY l.next_due_at ASC
        LIMIT 20
      ) v
    ), '[]'::jsonb),
    'invoices', COALESCE((
      SELECT jsonb_agg(row_to_json(i)::jsonb ORDER BY i.issued_at DESC)
      FROM (
        SELECT
          inv.id,
          inv.number,
          inv.status::text AS status,
          inv.currency,
          inv.issued_at,
          inv.due_at,
          inv.total,
          inv.paid_amount,
          inv.balance,
          pt.name AS patient_name
        FROM public.invoices inv
        LEFT JOIN public.patients pt ON pt.id = inv.patient_id
        WHERE inv.owner_id = v_owner_id
          AND inv.deleted_at IS NULL
          AND inv.status IN ('emitida', 'pagada')
        ORDER BY inv.issued_at DESC NULLS LAST, inv.created_at DESC
        LIMIT 20
      ) i
    ), '[]'::jsonb),
    'recent_clinical', COALESCE((
      SELECT jsonb_agg(row_to_json(c)::jsonb ORDER BY c.entry_date DESC)
      FROM (
        SELECT
          ce.id,
          ce.patient_id,
          pt.name AS patient_name,
          ce.entry_date,
          ce.entry_type::text AS entry_type,
          ce.title,
          ce.diagnosis,
          ce.treatment,
          ce.plan,
          ce.weight_kg
        FROM public.clinical_entries ce
        INNER JOIN public.patients pt ON pt.id = ce.patient_id
        WHERE ce.owner_id = v_owner_id
          AND ce.deleted_at IS NULL
        ORDER BY ce.entry_date DESC
        LIMIT 10
      ) c
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_portal_patient(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_today DATE;
BEGIN
  v_owner_id := public.get_portal_owner_id();
  IF v_owner_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id
      AND owner_id = v_owner_id
      AND deleted_at IS NULL
      AND is_active = true
  ) THEN
    RETURN '{}'::jsonb;
  END IF;

  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;

  RETURN jsonb_build_object(
    'patient', (
      SELECT jsonb_build_object(
        'id', pt.id,
        'name', pt.name,
        'species', pt.species::text,
        'breed', pt.breed,
        'sex', pt.sex::text,
        'birth_date', pt.birth_date,
        'color', pt.color,
        'microchip', pt.microchip,
        'is_neutered', pt.is_neutered,
        'is_deceased', pt.is_deceased
      )
      FROM public.patients pt
      WHERE pt.id = p_patient_id
    ),
    'vaccines', COALESCE((
      SELECT jsonb_agg(row_to_json(v)::jsonb ORDER BY v.vaccine_name)
      FROM (
        SELECT
          vac.id,
          vac.vaccine_name,
          vac.administered_at,
          vac.next_due_at,
          CASE
            WHEN vac.next_due_at IS NULL THEN 'sin_fecha'
            WHEN vac.next_due_at < v_today THEN 'vencida'
            WHEN vac.next_due_at <= v_today + 30 THEN 'por_vencer'
            ELSE 'al_dia'
          END AS due_status
        FROM (
          SELECT DISTINCT ON (lower(btrim(vaccinations.vaccine_name)))
            vaccinations.id,
            vaccinations.vaccine_name,
            vaccinations.administered_at,
            vaccinations.next_due_at
          FROM public.vaccinations
          WHERE vaccinations.patient_id = p_patient_id
            AND vaccinations.deleted_at IS NULL
          ORDER BY lower(btrim(vaccinations.vaccine_name)), vaccinations.administered_at DESC, vaccinations.created_at DESC
        ) vac
      ) v
    ), '[]'::jsonb),
    'appointments', COALESCE((
      SELECT jsonb_agg(row_to_json(a)::jsonb ORDER BY a.starts_at DESC)
      FROM (
        SELECT
          ap.id,
          ap.starts_at,
          ap.ends_at,
          ap.status::text AS status,
          ap.appointment_type::text AS appointment_type,
          ap.title
        FROM public.appointments ap
        WHERE ap.patient_id = p_patient_id
          AND ap.owner_id = v_owner_id
          AND ap.deleted_at IS NULL
        ORDER BY ap.starts_at DESC
        LIMIT 20
      ) a
    ), '[]'::jsonb),
    'clinical', COALESCE((
      SELECT jsonb_agg(row_to_json(c)::jsonb ORDER BY c.entry_date DESC)
      FROM (
        SELECT
          ce.id,
          ce.entry_date,
          ce.entry_type::text AS entry_type,
          ce.title,
          ce.diagnosis,
          ce.treatment,
          ce.plan,
          ce.weight_kg
        FROM public.clinical_entries ce
        WHERE ce.patient_id = p_patient_id
          AND ce.owner_id = v_owner_id
          AND ce.deleted_at IS NULL
        ORDER BY ce.entry_date DESC
        LIMIT 20
      ) c
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_clinic_staff TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_owner_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_owner_portal_invite TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_owner_portal_invite TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_owner_portal_invite TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_owner_portal_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_portal_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_portal_home TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_portal_patient TO authenticated;
