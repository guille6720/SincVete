-- Phase 15: webhook apply must survive provider retries.
-- Recording an event before apply used to make the retry a no-op (unique event_id).
-- Existing rows are treated as already applied. New rows stay pending until apply/skip finishes.

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

UPDATE public.billing_events
SET applied_at = processed_at
WHERE applied_at IS NULL;

REVOKE ALL ON TABLE public.billing_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.billing_events TO service_role;

CREATE OR REPLACE FUNCTION public.billing_begin_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_organization_id UUID,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_applied TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_provider IS NULL OR p_provider NOT IN ('stripe', 'mercadopago') THEN
    RAISE EXCEPTION 'unknown billing provider';
  END IF;

  IF p_event_id IS NULL OR length(trim(p_event_id)) = 0 THEN
    RAISE EXCEPTION 'event id required';
  END IF;

  INSERT INTO public.billing_events (
    provider, event_id, event_type, organization_id, payload
  )
  VALUES (
    p_provider,
    p_event_id,
    NULLIF(trim(COALESCE(p_event_type, '')), ''),
    p_organization_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (provider, event_id) DO NOTHING
  RETURNING id, applied_at INTO v_id, v_applied;

  IF v_id IS NULL THEN
    SELECT e.id, e.applied_at
    INTO v_id, v_applied
    FROM public.billing_events e
    WHERE e.provider = p_provider
      AND e.event_id = p_event_id;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'billing event missing after claim';
  END IF;

  IF v_applied IS NULL THEN
    UPDATE public.billing_events
    SET
      organization_id = COALESCE(organization_id, p_organization_id),
      event_type = COALESCE(NULLIF(trim(COALESCE(p_event_type, '')), ''), event_type),
      payload = COALESCE(p_payload, payload)
    WHERE id = v_id
      AND applied_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'already_applied', v_applied IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_finish_event(p_event_row_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_event_row_id IS NULL THEN
    RAISE EXCEPTION 'event row required';
  END IF;

  UPDATE public.billing_events
  SET applied_at = timezone('utc', now())
  WHERE id = p_event_row_id
    AND applied_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('finished', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_pending_billing_events()
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN (
    SELECT COUNT(*)::INT
    FROM public.billing_events e
    WHERE e.applied_at IS NULL
  );
END;
$$;

DROP FUNCTION IF EXISTS public.superadmin_list_billing_events(UUID, INT);
DROP FUNCTION IF EXISTS public.list_own_billing_events(INT);

CREATE FUNCTION public.superadmin_list_billing_events(
  p_organization_id UUID,
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  event_id TEXT,
  event_type TEXT,
  processed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INT;
BEGIN
  PERFORM public.require_platform_admin();
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);

  RETURN QUERY
  SELECT e.id, e.provider, e.event_id, e.event_type, e.processed_at, e.applied_at
  FROM public.billing_events e
  WHERE e.organization_id = p_organization_id
  ORDER BY e.processed_at DESC
  LIMIT v_limit;
END;
$$;

CREATE FUNCTION public.list_own_billing_events(p_limit INT DEFAULT 25)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  event_type TEXT,
  processed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org UUID;
  v_limit INT;
BEGIN
  IF NOT public.has_permission('org:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);

  RETURN QUERY
  SELECT e.id, e.provider, e.event_type, e.processed_at, e.applied_at
  FROM public.billing_events e
  WHERE e.organization_id = v_org
  ORDER BY e.processed_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_begin_event(TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_finish_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_pending_billing_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_billing_events(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_own_billing_events(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.billing_begin_event(TEXT, TEXT, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_finish_event(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_pending_billing_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_billing_events(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_own_billing_events(INT) TO authenticated;

COMMENT ON COLUMN public.billing_events.applied_at IS
  'Set after the webhook apply/skip finishes. NULL means a provider retry should replay apply.';
COMMENT ON FUNCTION public.billing_begin_event(TEXT, TEXT, TEXT, UUID, JSONB) IS
  'Service-role only. Claims a provider event. already_applied=true means apply must not run again.';
COMMENT ON FUNCTION public.billing_finish_event(UUID) IS
  'Service-role only. Marks a claimed billing event as applied or skipped.';
COMMENT ON FUNCTION public.superadmin_pending_billing_events() IS
  'Platform-admin count of billing events that were received but not applied.';
