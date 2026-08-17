# PERFORMANCE_RESULTS_2026 — SyncVete

**Fecha:** 2026-08-15  
**Rama:** `staging/perf-phase-2-session`  
**Baseline:** [PERFORMANCE_AUDIT_2026.md](./PERFORMANCE_AUDIT_2026.md) (Fase 1)  
**Producción (`main`):** no actualizada en este ciclo

---

## 1. Gates ejecutados

| Comando | Resultado |
| --- | --- |
| `npm run typecheck --workspace=@sincvete/web` | **PASS** |
| `npm run lint --workspace=@sincvete/web` | **PASS** |
| `npm run test:unit --workspace=@sincvete/web` | **PASS** (0 tests; `passWithNoTests`) |
| `npm run test:unit --workspace=@sincvete/shared` | **PASS** (26 files / 158 tests) |
| `npm run build --workspace=@sincvete/web` | **PASS** (Next.js 15.5.23, ~11s compile) |
| `npm run performance:gate` | **N/A** — script no existe en el monorepo |
| `npm run performance:audit` / `lighthouse:audit` | **N/A** — no configurados |

Bundle (build): First Load JS compartido ~**103 kB**; rutas clínicas dinámicas típicas ~**144–147 kB** first load. Middleware ~**93.4 kB**.

---

## 2. Metodología de comparación

- **Antes:** conteo estimado de round-trips (RT) en Fase 1 (sesión sin `React.cache`, waterfalls, payloads `*`).
- **Después:** reconteo estructural del código en staging (sesión/metadata cacheada por request, permisos en memoria, paginación/caps, selects explícitos, streaming dashboard).
- **TTFB / Lighthouse:** no medidos en prod/staging live en este entorno. La mejora de RT es el proxy principal; validar TTFB en Vercel preview tras aplicar migraciones `00035`–`00038`.

Convención: **1× `getSessionContext` cacheado ≈ 3 RT** una sola vez por request; llamadas posteriores = 0 RT extra.

---

## 3. Tabla antes / después (queries est. c/layout)

| Ruta | Antes (Fase 1) | Después (est.) | Mejora | Notas |
| --- | ---: | ---: | ---: | --- |
| `(clinic)/layout` | 11–14 | **~5–7** | ~50%+ | 1 sesión + branches + unread en paralelo; sin query extra de branch name |
| `/pacientes` | 21–24 | **~7–10** | ~60% | 1 sesión; permisos locales; lista 25–50 + trgm |
| `/pacientes/[id]` | **50–60** | **~12–18** | **~70%** | sin 10× `can*`; owner en paralelo; historia reciente 5 |
| `/pacientes/[id]/historia` | 30–40 | **~10–14** | ~65% | page 20; lista liviana (sin SOAP completo); sin count redundante |
| `/historia-clinica` | 21–26 | **~8–12** | ~55% | misma sesión + lista light |
| `/historia-clinica/[id]` | 23–29 | **~8–12** | ~55% | columnas explícitas |
| `/farmacia` | 23–29 | **~8–12** | ~55% | activas **LIMIT 100** |
| `/farmacia/[id]` | 23–30 | **~8–12** | ~55% | select explícito Rx + items |
| `/dashboard` | 25–30 | **~8–12** (+ stream) | ~60% + UX | header/acciones primero; activity diferida |
| `/agenda` | 23–30 | **~9–14** | ~50% | staff cacheado; week nav con `Link` |
| PAMI | N/A | N/A | — | módulo inexistente |

*Los rangos “después” incluyen layout; la página sola suele ser 2–8 RT adicionales sobre la sesión ya pagada.*

---

## 4. Mejoras por dimensión (no solo queries)

| Dimensión | Antes | Después |
| --- | --- | --- |
| Sesión / auth | N× `getSessionContext` por página | `React.cache` request-scoped |
| Metadata clínica | org/branches/staff repetidos | cache org, branches, staff, unread |
| Payload lista historia | SOAP completo | campos largos null / truncados en lista |
| Payload detalle | muchos `select('*')` | `db-columns.ts` en hot paths |
| Invalidación | `revalidatePath` amplio | paths acotados (`cache-revalidate.ts`) |
| Botones | sin pending visual | `Button.isPending` + spinner |
| Navegación | pocos `loading.tsx` | skeletons + prefetch + barra progreso |
| Índices | base org/patient | + trgm pacientes/dueños + owner FKs + Rx activa + walk-in (`00037`/`00038`) |
| Dashboard UX | bloqueo total | streaming KPIs del día → secundarios |

---

## 5. Migraciones a aplicar en Supabase (staging → prod)

| Migration | Qué hace |
| --- | --- |
| `00035_cap_active_prescriptions.sql` | LIMIT 100 en board farmacia |
| `00036_clinical_list_light_payload.sql` | lista clínica liviana |
| `00037_patients_search_perf.sql` | pg_trgm + species + cap page 50 |
| `00038_performance_hot_path_indexes.sql` | owner FKs, Rx activa, walk-in, doc/phone trgm |

Sin estas migraciones, parte del beneficio DB no aplica aunque el código Next sí.

---

## 6. Commits de este ciclo (staging)

```
perf: reduce session round-trips on critical clinical routes
perf: narrow revalidatePath on clinical mutations
perf: instant button pending feedback on clinical actions
perf: bound clinical history to server-side pages and light list payload
perf: harden patients list pagination, trgm search indexes, and lean selects
perf: replace select(*) with explicit columns on critical clinical detail reads
perf: add hot-path indexes for owner lookups, active Rx, and walk-in queue
perf: instant clinic navigation with loading skeletons and prefetch
perf: request-scope cache for clinic metadata, staff, and dashboard context
perf: stream dashboard primary ops before secondary widgets
```

---

## 7. Riesgos / no regresión

- RLS, auditoría, tenant isolation y validaciones clínicas **no** se debilitaron.
- No hay `unstable_cache` cross-request con PHI.
- Service role no se expuso al cliente.
- Dashboard widgets secundarios pueden llegar unos cientos de ms después del header (intencional).

---

## 8. Siguiente validación recomendada (humano)

1. Aplicar migraciones `00035`–`00038` en el proyecto Supabase de staging.
2. Abrir preview Vercel de `staging/perf-phase-2-session`.
3. Medir Network: RTs a Supabase en `/pacientes`, `/pacientes/[id]`, `/farmacia`, `/dashboard`.
4. Comparar TTFB Vercel Analytics / Web Vitals vs `main` actual.
5. Solo entonces merge a `main` / producción.

---

## 9. Veredicto

El cuello de botella dominante de Fase 1 (**sesión repetida + waterfalls + payloads**) está mitigado en staging. La ruta peor caso `/pacientes/[id]` pasa de ~50–60 RT estimados a ~12–18. Gates de calidad (typecheck, lint, tests shared, build) pasan. Falta medición live de TTFB/Lighthouse (herramientas no presentes en el repo) antes de declarar victoria en producción.
