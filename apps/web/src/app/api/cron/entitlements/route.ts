import { NextResponse } from 'next/server';
import { authorizeCronSecret, COMMERCIAL_QUOTA_WARN_RATIO, COMMERCIAL_TRIAL_REMIND_DAYS } from '@sincvete/shared';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
}

async function runLifecycle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = authorizeCronSecret({
    authorizationHeader: request.headers.get('authorization'),
    cronSecretHeader: request.headers.get('x-cron-secret'),
    secret,
  });
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 503 });
  }
  if (!allowed) return unauthorized();

  const service = await createServiceClient();
  const { data, error } = await service.rpc('run_commercial_lifecycle', {
    p_trial_remind_days: COMMERCIAL_TRIAL_REMIND_DAYS,
    p_quota_warn_ratio: COMMERCIAL_QUOTA_WARN_RATIO,
  });
  if (error) {
    console.error('[cron/entitlements]', error.message);
    return NextResponse.json({ error: 'no se pudo ejecutar el ciclo comercial' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}

export async function GET(request: Request) {
  return runLifecycle(request);
}

export async function POST(request: Request) {
  return runLifecycle(request);
}
