import { NextResponse } from 'next/server';
import { authorizeCronSecret } from '@sincvete/shared';
import { processNextQueuedExportJobs } from '@/lib/data-migration/export';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
}

async function run(request: Request) {
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

  try {
    const result = await processNextQueuedExportJobs({ maxJobs: 2 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/data-export]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'falló el worker de export' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
