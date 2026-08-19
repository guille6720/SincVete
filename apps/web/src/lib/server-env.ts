/** Runtime env (dynamic key) so Next.js does not bake `undefined` at build time. */
export function readServerEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}
