import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function candidates() {
  return [
    path.join(process.cwd(), 'public/manual/manual-uso-syncvete.pdf'),
    path.join(process.cwd(), 'apps/web/public/manual/manual-uso-syncvete.pdf'),
  ];
}

export async function GET() {
  let pdf: Buffer | null = null;
  for (const file of candidates()) {
    try {
      pdf = await readFile(file);
      break;
    } catch {
      /* try next */
    }
  }

  if (!pdf) {
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Manual-de-uso-SyncVete.pdf"',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
