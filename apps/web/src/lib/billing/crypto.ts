import { createHmac, timingSafeEqual } from 'crypto';

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function resolveBillingProvider(): 'stripe' | 'mercadopago' | null {
  const explicit = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  if (explicit === 'stripe' && process.env.STRIPE_SECRET_KEY) return 'stripe';
  if (explicit === 'mercadopago' && process.env.MERCADOPAGO_ACCESS_TOKEN) return 'mercadopago';
  if (process.env.MERCADOPAGO_ACCESS_TOKEN) return 'mercadopago';
  if (process.env.STRIPE_SECRET_KEY) return 'stripe';
  return null;
}

export function billingConfigured(): boolean {
  return resolveBillingProvider() !== null;
}

export function formUrlEncoded(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

export function verifyStripeSignature(params: {
  payload: string;
  header: string | null;
  secret: string;
  toleranceSec?: number;
}): boolean {
  if (!params.header || !params.secret) return false;
  const parts = Object.fromEntries(
    params.header.split(',').map((item) => {
      const [key, ...rest] = item.split('=');
      return [key.trim(), rest.join('=')];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(Number(timestamp)) || age > (params.toleranceSec ?? 300)) return false;

  const expected = createHmac('sha256', params.secret).update(`${timestamp}.${params.payload}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function verifyMercadoPagoSignature(params: {
  dataId: string;
  requestId: string | null;
  ts: string | null;
  headerSignature: string | null;
  secret: string;
}): boolean {
  if (!params.secret || !params.ts || !params.headerSignature) return false;
  const manifest = `id:${params.dataId};request-id:${params.requestId ?? ''};ts:${params.ts};`;
  const expected = createHmac('sha256', params.secret).update(manifest).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(params.headerSignature, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
