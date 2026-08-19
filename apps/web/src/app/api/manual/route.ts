import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function candidates() {
  return [
    path.join(process.cwd(), 'public/manual/manual-uso-syncvete.html'),
    path.join(process.cwd(), 'apps/web/public/manual/manual-uso-syncvete.html'),
  ];
}

export async function GET() {
  let html: string | null = null;
  for (const file of candidates()) {
    try {
      html = await readFile(file, 'utf8');
      break;
    } catch {
      /* try next */
    }
  }

  if (!html) {
    return NextResponse.json({ error: 'Manual no disponible' }, { status: 500 });
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Manual-de-uso-SyncVete.html"',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
