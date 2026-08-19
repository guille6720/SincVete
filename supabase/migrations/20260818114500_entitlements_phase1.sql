-- Phase 1 correction (staging already has 20260817180000).
-- Depends on: 20260817180000_entitlements_phase1.sql
-- Do NOT recreate catalog tables/types.
--
-- This patch:
--   * keeps legacy as migration-only (never the signup default)
--   * hardens increment_feature_usage / try_consume_feature_usage
--   * makes the org-create trigger idempotent
--   * blocks accidental legacy assignment
--
-- Trial duration remains configurable (not hardcoded):
--   public.plans.metadata.default_trial_days for key = 'trial'
--   Application mirror: ONBOARDING_TRIAL_DAYS in packages/shared/src/constants/features.ts
--
-- Usage quota sequence (Phase 2+):
--   1. resolve entitlement  2. resolve feature limit
--   3/4/5. try_consume_feature_usage (atomic check + increment)
--   6. execute protected operation
-- Race: app-level "read usage then increment" can over-consume under concurrency.
-- Prefer try_consume_feature_usage. Period is always the current UTC calendar month.

COMMENT ON COLUMN public.plans.is_internal IS
  'True for migration/ops-only plans (e.g. legacy). Exclude from public pricing and auto-assignment.';
COMMENT ON COLUMN public.plans.is_public IS
  'False hides the plan from public pricing selectors. Trial and legacy are not public.';
COMMENT ON COLUMN public.plans.metadata IS
  'trial.default_trial_days (int, optional) sets trial_ends_at on signup. null = open-ended trialing.';

-- ---------------------------------------------------------------------------
-- Guard: legacy cannot be flipped public, and cannot be assigned accidentally
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_legacy_plan_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.key = 'legacy' AND (NEW.is_internal IS NOT TRUE OR NEW.is_public IS TRUE) THEN
    RAISE EXCEPTION 'legacy plan must remain is_internal=true and is_public=false';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plans_protect_legacy ON public.plans;
CREATE TRIGGER trg_plans_protect_legacy
  BEFORE INSERT OR UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_legacy_plan_catalog();

CREATE OR REPLACE FUNCTION public.prevent_unintended_legacy_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT p.key INTO v_key
  FROM public.plans p
  WHERE p.id = NEW.plan_id;

  IF v_key IS DISTINCT FROM 'legacy' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.metadata->>'source', '') = 'phase1_legacy_backfill' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.metadata->>'assign_legacy_explicit', '') IN ('true', '1') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'legacy plan is migration-only; assignment requires metadata.assign_legacy_explicit';
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_subscriptions_protect_legacy ON public.organization_subscriptions;
CREATE TRIGGER trg_organization_subscriptions_protect_legacy
  BEFORE INSERT OR UPDATE OF plan_id, metadata ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unintended_legacy_assignment();

REVOKE ALL ON FUNCTION public.protect_legacy_plan_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_unintended_legacy_assignment() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Usage metering: drop client-controlled period args, lock tenant + canonical month
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.increment_feature_usage(TEXT, BIGINT, DATE, DATE);
DROP FUNCTION IF EXISTS public.try_consume_feature_usage(TEXT, BIGINT, NUMERIC, DATE, DATE);

CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_feature_key TEXT,
  p_amount BIGINT DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_feature_id UUID;
  v_metered BOOLEAN;
  v_period_start DATE;
  v_period_end DATE;
  v_count BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive integer';
  END IF;

  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated to an organization';
  END IF;

  SELECT f.id, f.usage_metered
  INTO v_feature_id, v_metered
  FROM public.features f
  WHERE f.key = p_feature_key
    AND f.is_active = true;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive feature: %', p_feature_key;
  END IF;

  IF COALESCE(v_metered, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'feature is not usage-metered: %', p_feature_key;
  END IF;

  v_period_start := (date_trunc('month', timezone('utc', now())))::date;
  v_period_end := ((date_trunc('month', timezone('utc', now())) + interval '1 month - 1 day'))::date;

  INSERT INTO public.feature_usage AS fu (
    organization_id, feature_id, period_start, period_end, usage_count
  )
  VALUES (v_org_id, v_feature_id, v_period_start, v_period_end, p_amount)
  ON CONFLICT (organization_id, feature_id, period_start, period_end)
  DO UPDATE SET
    usage_count = fu.usage_count + EXCLUDED.usage_count,
    updated_at = now()
  RETURNING fu.usage_count INTO v_count;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.increment_feature_usage(TEXT, BIGINT) IS
  'Atomically increments usage for the caller organization only. Rejects non-positive amounts and non-metered features. Does not accept organization_id. Period is the current UTC month.';

CREATE OR REPLACE FUNCTION public.try_consume_feature_usage(
  p_feature_key TEXT,
  p_amount BIGINT,
  p_limit NUMERIC
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_feature_id UUID;
  v_metered BOOLEAN;
  v_period_start DATE;
  v_period_end DATE;
  v_count BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive integer';
  END IF;

  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated to an organization';
  END IF;

  SELECT f.id, f.usage_metered
  INTO v_feature_id, v_metered
  FROM public.features f
  WHERE f.key = p_feature_key
    AND f.is_active = true;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive feature: %', p_feature_key;
  END IF;

  IF COALESCE(v_metered, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'feature is not usage-metered: %', p_feature_key;
  END IF;

  IF p_limit IS NULL THEN
    RETURN public.increment_feature_usage(p_feature_key, p_amount);
  END IF;

  IF p_limit < 0 THEN
    RAISE EXCEPTION 'limit must be null or >= 0';
  END IF;

  IF p_limit = 0 THEN
    RETURN NULL;
  END IF;

  v_period_start := (date_trunc('month', timezone('utc', now())))::date;
  v_period_end := ((date_trunc('month', timezone('utc', now())) + interval '1 month - 1 day'))::date;

  INSERT INTO public.feature_usage AS fu (
    organization_id, feature_id, period_start, period_end, usage_count
  )
  SELECT v_org_id, v_feature_id, v_period_start, v_period_end, p_amount
  WHERE p_amount <= p_limit
  ON CONFLICT (organization_id, feature_id, period_start, period_end)
  DO UPDATE SET
    usage_count = fu.usage_count + EXCLUDED.usage_count,
    updated_at = now()
  WHERE fu.usage_count + EXCLUDED.usage_count <= p_limit
  RETURNING fu.usage_count INTO v_count;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.try_consume_feature_usage(TEXT, BIGINT, NUMERIC) IS
  'Atomic check-and-consume for metered features. Returns NULL when the increment would exceed p_limit. Period is the current UTC month.';

REVOKE ALL ON FUNCTION public.increment_feature_usage(TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_consume_feature_usage(TEXT, BIGINT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_consume_feature_usage(TEXT, BIGINT, NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- New organizations → trial (NEVER legacy). Idempotent under unique index races.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_default_organization_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan RECORD;
  v_trial_days INT;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  SELECT id, key, is_internal, metadata
  INTO v_plan
  FROM public.plans
  WHERE key = 'trial'
    AND is_active = true
  LIMIT 1;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'onboarding plan "trial" is missing; cannot create organization subscription';
  END IF;

  IF v_plan.is_internal IS TRUE OR v_plan.key = 'legacy' THEN
    RAISE EXCEPTION 'refusing to auto-assign internal/legacy plan on organization create';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_subscriptions s
    WHERE s.organization_id = NEW.id
      AND s.status IN ('trialing', 'active')
      AND s.cancelled_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_trial_days := NULLIF(v_plan.metadata->>'default_trial_days', '')::INT;
  EXCEPTION WHEN others THEN
    v_trial_days := NULL;
  END;

  IF v_trial_days IS NOT NULL AND v_trial_days > 0 THEN
    v_trial_ends := timezone('utc', now()) + make_interval(days => v_trial_days);
  ELSE
    v_trial_ends := NULL;
  END IF;

  BEGIN
    INSERT INTO public.organization_subscriptions (
      organization_id, plan_id, status, starts_at, trial_ends_at, metadata
    )
    VALUES (
      NEW.id,
      v_plan.id,
      'trialing',
      timezone('utc', now()),
      v_trial_ends,
      jsonb_build_object(
        'source', 'signup_default_trial',
        'plan_key', 'trial',
        'trial_days_applied', v_trial_days
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ensure_default_organization_subscription() IS
  'Assigns trial (never legacy) to newly created organizations. Legacy is migration-only via one-time backfill.';

REVOKE ALL ON FUNCTION public.ensure_default_organization_subscription() FROM PUBLIC;

-- Repair: organizations without a current subscription must not stay undefined.
-- Staging currently has zero orgs; this is defensive.
-- Orgs created at or before the original Phase 1 version → legacy backfill.
-- Orgs created after that → trial (same as the INSERT trigger).
INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, starts_at, metadata)
SELECT o.id, p.id, 'active', now(), jsonb_build_object(
  'source', 'phase1_legacy_backfill',
  'note', 'Repair: org existed at original entitlements apply and had no current subscription'
)
FROM public.organizations o
CROSS JOIN public.plans p
WHERE p.key = 'legacy'
  AND o.deleted_at IS NULL
  AND o.created_at <= TIMESTAMPTZ '2026-08-17 18:00:00+00'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_subscriptions s
    WHERE s.organization_id = o.id
      AND s.status IN ('trialing', 'active')
      AND s.cancelled_at IS NULL
  );

INSERT INTO public.organization_subscriptions (
  organization_id, plan_id, status, starts_at, trial_ends_at, metadata
)
SELECT
  o.id,
  p.id,
  'trialing',
  timezone('utc', now()),
  NULL,
  jsonb_build_object('source', 'signup_default_trial', 'plan_key', 'trial', 'repaired', true)
FROM public.organizations o
CROSS JOIN public.plans p
WHERE p.key = 'trial'
  AND o.deleted_at IS NULL
  AND o.created_at > TIMESTAMPTZ '2026-08-17 18:00:00+00'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_subscriptions s
    WHERE s.organization_id = o.id
      AND s.status IN ('trialing', 'active')
      AND s.cancelled_at IS NULL
  );
