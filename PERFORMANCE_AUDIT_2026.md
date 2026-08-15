# PERFORMANCE_AUDIT_2026 — SincVete

**Fecha:** 2026-08-15  
**Fase:** 1 — Medición (sin cambios de código de aplicación)  
**Alcance:** rutas críticas clínicas (App Router `apps/web`)  
**Producto:** SaaS veterinario multi-tenant (Supabase + RLS)

---

## 0. Mapeo de estructura (vs. prompt DrFlow)

El prompt menciona `src/features/*`, `src/core/*` y una arquitectura de caché tipo DrFlow. **En SincVete no existen.**

| Pedido (DrFlow) | Realidad en SincVete |
| --- | --- |
| `src/features/pacientes/` | `apps/web/src/app/(clinic)/pacientes/` + `actions/patients.ts` + `components/patients/` |
| `src/features/historias/` | `historia-clinica/` + `pacientes/[id]/historia` + `actions/clinical-entries.ts` |
| `src/features/recetas/` | `farmacia/` + `actions/pharmacy.ts` |
| `src/features/agenda/` | `agenda/` + `actions/appointments.ts` |
| `src/features/dashboard/` | `dashboard/` + `actions/dashboard.ts` |
| `src/features/pami/` | **N/A** — no hay módulo PAMI |
| `src/core/auth/` | `actions/auth.ts` + `lib/permissions.ts` + middleware |
| `src/core/supabase/` | `lib/supabase/*` |
| `React.cache` / `unstable_cache` / tags / TTL | **Ausente** en `apps/web/src` |
| `loading.tsx` | **0 archivos** en `app/` |
| `npm run performance:gate` / lighthouse scripts | Verificar en Fase 12; no asumidos |

---

## 1. Resumen ejecutivo

La lentitud percibida **no** viene principalmente de falta de paginación en pacientes (ya hay RPC `search_patients` con pageSize 25) ni de índices inexistentes (pacientes/historia/agenda/farmacia ya tienen índices por org/patient/fecha).

El cuello de botella dominante es:

1. **`getSessionContext()` sin `React.cache`** → ~3 round-trips por llamada (`auth.getUser` + `profiles.select('*')` + `branch_members`).
2. Cada página llama **múltiples** `canRead*` / `canManage*` / `requirePermission` / `list*` y **cada una** vuelve a resolver la sesión.
3. El layout `(clinic)` ya paga ~11–14 RTs **en cada navegación**, antes del page.
4. **`/pacientes/[id]`** es el peor caso: ~10 `can*`/`get*` en paralelo × sesión completa + `getOwner` secuencial → **~50–60 RTs** con layout.
5. Sin `loading.tsx` ni streaming real → la UI no responde hasta que termina todo el waterfall.
6. Suspense en listas es **cosmético**: el `await` de datos ocurre **antes** del `<Suspense>`.

**Hipótesis de impacto Fase 2–4:** cachear sesión + derivar permisos en memoria + `loading.tsx` debería cortar la mayoría del TTFB y la demora de botones/navegación, sin tocar RLS ni auditoría.

---

## 2. Convención de conteo

| Concepto | Definición |
| --- | --- |
| **1× `getSessionContext`** | ≈ **3 RTs** de red (getUser + profiles + branch_members); portal agrega RPC |
| **`canX` / `requirePermission`** | 1× `getSessionContext` completo (salvo que se cachee) |
| **Queries estimadas** | orden de magnitud de round-trips Supabase/Auth, no microsegundos medidos en prod |
| **+ Layout** | coste del `(clinic)/layout.tsx` sumado a cada ruta bajo ese layout |
| Middleware | +1 `auth.getUser` por request (aceptable si RSC cachea sesión) |

---

## 3. Tabla por ruta (Fase 1)

| Ruta | Queries (est.) | Secuenciales | Datos cargados | Riesgo | Prioridad |
| --- | ---: | ---: | ---: | --- | --- |
| `(clinic)/layout` (todas) | 11–14 | session → branches → unread (± branch name) | sesión + sucursales + badge notif | Multiplica coste de **toda** navegación | **P0** |
| `/pacientes` | 10 page / **21–24** c/layout | `canRead` → `Promise.all(list, canWrite)` | 25 pacientes (RPC paginado) OK | Sesión ×3; Suspense muerto | **P0** |
| `/pacientes/[id]` | 40–45 / **50–60** c/layout | `canRead` → Promise.all(10) → **`getOwner`** | paciente `*` + owner `*` + hosp/cirugía/vacunas/counts + 6× can | Peor página; botones lentos al abrir | **P0** |
| `/pacientes/[id]/historia` | 20–25 / **30–40** | can → patient → Promise.all(list, can, **count**) | 25 entradas + count duplicado | Count redundante vs `total_count` RPC | **P0** |
| `/historia-clinica` | 10–12 / **21–26** | can → Promise.all(list, canWrite) | 25 entradas | Sesión repetida | **P1** |
| `/historia-clinica/[id]` | 12–15 / **23–29** | can → Promise.all(get, can) | entry `*` + patient/owner/profile | `select('*')` | **P1** |
| `/historia-clinica/nuevo` | 18–28 / **30–42** | can → session → patient → owner → branches | form deps | Waterfall total; branches ya en layout | **P1** |
| `/farmacia` | 12–15 / **23–29** | can → Promise.all(actives, history, can) | history 25 + **actives sin LIMIT** | Cola activa unbounded | **P0** |
| `/farmacia/[id]` | 12–16 / **23–30** | can → Promise.all | rx `*` + items `*` + joins | Payload extra | **P1** |
| `/farmacia/nueva` | 18–28 / **30–42** | igual patrón create | form deps | Waterfall | **P1** |
| `/consultas/nueva` | 18–28 / **30–42** | igual patrón create | form deps | Waterfall | **P1** |
| `/consultas` | ~15–20 / **26–34** | can → queue → **luego** history | cola + historial | Waterfall post-parallel | **P1** |
| `/dashboard` | 14–16 / **25–30** | outer session + 3 hijos cada uno con session | summary RPC + activity + context | 4× sesión en 1 página | **P1** |
| `/agenda` | 12–16 / **23–30** | can → Promise.all(week, staff, can) | **semana completa** (sin pageSize) | OK clínicas chicas; riesgo picos | **P2** |
| PAMI | — | — | — | Módulo inexistente | **N/A** |

---

## 4. Hallazgos detallados por área

### 4.1 Sesión y autorización (causa raíz)

**Archivo:** `apps/web/src/actions/auth.ts` (`getSessionContext` ~L188–268)

```
getUser → profiles.select('*') → branch_members → (opcional) get_portal_owner_id
```

- **No** hay `React.cache(() => ...)`.
- `requirePermission` / `canReadPatients` / `canManageClinical` / etc. llaman sesión completa cada vez.
- En `/pacientes/[id]`, `Promise.all` de 10 helpers **multiplica** sesiones en paralelo (más carga, no menos latencia de auth).

**Mantener:** checks de permiso, RLS, tenant.  
**Optimizar:** 1 sesión por request; permisos en memoria (`session.permissions.includes(...)`).

### 4.2 Layout clinic

**Archivo:** `apps/web/src/app/(clinic)/layout.tsx`

```
getSessionContext → getUserBranches (re-sesión) → countUnreadNotifications (re-sesión) → ± branches.name
```

Sidebar usa `<Link>` (prefetch OK). El coste no es el Link: es **re-fetch de layout data** en cada navegación soft/hard.

### 4.3 Pacientes

| Bien | Mal |
| --- | --- |
| `listPatients` → RPC `search_patients`, pageSize **25** | `canRead` antes del `Promise.all` (waterfall) |
| Búsqueda server-side (no filter client de todo el tenant) | Detalle: 10× sesión + owner secuencial |
| Índices org/name/owner/branch/search | `getPatient` usa `select('*')` |

**Índices existentes** (`20240811000003_patients.sql` + foto): suficientes para listado/búsqueda actual. Evaluar `pg_trgm` solo si search por ILIKE degrada con volumen (Fase 8 con `EXPLAIN`).

### 4.4 Historia clínica

| Bien | Mal |
| --- | --- |
| Listas paginadas 25 vía RPC | `countPatientClinicalEntries` **además** del `total_count` del RPC |
| Índices patient+date, org+date | Create form waterfall + `getUserBranches` duplicado |
| | Detalle `select('*')` |

**Objetivo producto (Fase 5):** hub paciente = alertas + últimas N evoluciones; “Ver anteriores” — hoy la historia del paciente ya pagina 25, pero el **detalle del paciente** no carga un resumen liviano (carga muchos módulos laterales).

### 4.5 Recetas (`/farmacia`)

- Historial paginado OK.
- `list_active_prescriptions` (**migration `20240811000027`**) **sin LIMIT** → riesgo P0 en clínicas con muchas activas.
- `revalidatePath` toca `/farmacia`, `/dashboard`, `/pacientes/...`, `/inventario`.

### 4.6 Consultas / evoluciones

- Create pages: cadena secuencial can → session → patient → owner → branches.
- Close consultation: `revalidatePath` amplio (`/consultas`, `/historia-clinica`, `/agenda`, `/dashboard`, ids).

### 4.7 Dashboard

`getDashboardData`:

```
getSessionContext
Promise.all([
  getDashboardContext,   // getSessionContext otra vez
  getDashboardSummary,   // otra vez
  getDashboardActivity,  // otra vez
])
```

RPCs de summary/activity están bien diseñados; el problema es la **sesión ×4**.

### 4.8 Agenda

- RPC por rango semanal (sin paginación numérica) — razonable.
- `getAssignableStaff`: branch_members → profiles secuencial interno.
- `getAppointment` usa `select('*')`.

### 4.9 `select('*')` en rutas críticas

Presente en (entre otros):

- `patients.ts` → `getPatient`
- `owners.ts` → `getOwner`
- `clinical-entries.ts` → `getClinicalEntry` (+ count head)
- `pharmacy.ts` → prescription + items
- `appointments.ts` → `getAppointment`
- `consultations.ts` → detail
- `auth.ts` → `profiles`

**Fase 7:** reemplazar solo en hot paths; no barrer todos los repos a ciegas.

### 4.10 `revalidatePath` (inventario hot path)

| Módulo | Paths típicos | Nota |
| --- | --- | --- |
| `patients.ts` | `/pacientes`, `/pacientes/:id` | OK / razonable |
| `clinical-entries.ts` | `/historia-clinica`, `/:id`, paciente + historia | Amplio pero clínico |
| `pharmacy.ts` | `/farmacia`, `/:id`, `/dashboard`, paciente, `/inventario` | Dashboard casi siempre |
| `consultations.ts` | consultas + agenda + historia + dashboard | Fan-out máximo |
| `appointments.ts` | `/agenda`, `/:id`, `/dashboard` | |
| `settings` branch | `revalidatePath('/', 'layout')` | Correcto al cambiar sucursal |

**Fase 3:** preferir invalidación puntual; evitar `/dashboard` si el widget no depende del cambio (cuando sea seguro).

### 4.11 UX / client / bundles

- Listas y details críticos son `'use client'` (filters + interactions) — aceptable; no es la causa principal.
- Casi no hay `useTransition` en navegación de módulos (sí en algunos boards).
- Forms usan `useActionState` + pending en varios lados (bien para submit).
- **0** `loading.tsx` → navegación se siente “congelada”.
- Dynamic imports / code-split de módulos pesados: no auditado a fondo (P3); priorizar sesión primero.

### 4.12 Caché (Fase 10)

**No inventar** otra arquitectura. SincVete hoy: **cero** `React.cache` / `unstable_cache`.  
Primera pieza segura: `React.cache` alrededor de `getSessionContext` (request-scoped, no cross-tenant).  
Nunca cachear PHI entre pacientes/orgs con TTL compartido inseguro.

### 4.13 RLS / seguridad

- Listados usan RPC `SECURITY DEFINER` + `has_permission` / `get_user_organization_id` — **no debilitar**.
- Optimizaciones deben reducir round-trips **app→DB**, no bypass RLS ni service role en cliente.

---

## 5. Backlog priorizado (próximas fases)

### P0 — crítico (hacer primero)

1. `React.cache(getSessionContext)` (o pasar session desde layout).
2. Colapsar layout: 1 sesión + `Promise.all(branches, unread)`.
3. Reemplazar `can*` remotos en páginas por checks sobre `session.permissions`.
4. `/pacientes/[id]`: un solo session; `getOwner` dentro del `Promise.all`; idealmente RPC/view “patient hub”.
5. Cap / LIMIT a `list_active_prescriptions`.
6. `loading.tsx` en `(clinic)/` y segmentos pacientes/historia/farmacia.

### P1 — alto

7. Streaming real: async child components dentro de Suspense (no await previo).
8. Eliminar `countPatientClinicalEntries` redundante en historia.
9. Deduplicar sesión en `getDashboardData`.
10. Paralelizar waterfalls de páginas `nuevo`.
11. Narrow `revalidatePath` en consultations/pharmacy.
12. Columnas explícitas en `getPatient` / `getClinicalEntry` / `getPrescription`.

### P2 — medio

13. Soft-cap agenda semanal / warning.
14. `getAssignableStaff` en paralelo o join.
15. Botones: `useTransition` + feedback <100 ms donde falte.
16. Evaluar índices/trgm solo con `EXPLAIN` y volumen real.

### P3 — bajo

17. Separar shell client vs filas RSC.
18. Dynamic import de módulos secundarios del detalle.
19. Bundle analysis.

### Fuera de alcance / N/A

- **PAMI:** no existe en el repo.
- Reescritura tipo DrFlow / nueva capa de cache tags: **no**.

---

## 6. Orden de implementación acordado

```text
1. Pacientes (+ layout/sesión — impacto global)
2. Historia Clínica
3. Recetas (farmacia)
4. Botones / server actions / revalidate
5. Dashboard
6. Agenda
7. PAMI → skip
```

Tras cada bloque: funcionalidad intacta, seguridad/RLS/audit intactos, tests OK, performance mejor.

---

## 7. Métricas baseline (a completar en Fase 12)

| Métrica | Objetivo | Baseline prod (pendiente medir) |
| --- | --- | --- |
| Feedback visual botón | <100 ms | TBD (lab) |
| Navegación percibida | <300 ms | TBD — hoy bloqueada por layout+page |
| Pantalla usable | <1 s | TBD |
| TTFB rutas principales | <800 ms | TBD |
| RTs `/pacientes/[id]` | ↓ >70% vs ~50–60 | **~50–60 (est.)** |
| RTs `/pacientes` | ↓ >50% vs ~21–24 | **~21–24 (est.)** |
| Queries DB habituales | <100 ms | Índices OK; medir con EXPLAIN |

**Nota:** esta Fase 1 no ejecuta Lighthouse ni `performance:gate` (documento de auditoría estática + lectura de código). Baseline instrumentada → `PERFORMANCE_RESULTS_2026.md` en Fase 12.

---

## 8. Archivos clave auditados

| Área | Paths |
| --- | --- |
| Layout | `apps/web/src/app/(clinic)/layout.tsx` |
| Pacientes | `.../pacientes/page.tsx`, `.../[id]/page.tsx`, `actions/patients.ts` |
| Historia | `.../pacientes/[id]/historia/page.tsx`, `.../historia-clinica/**`, `actions/clinical-entries.ts` |
| Recetas | `.../farmacia/**`, `actions/pharmacy.ts`, migration `00027` |
| Consultas | `.../consultas/**`, `actions/consultations.ts` |
| Dashboard | `.../dashboard/page.tsx`, `actions/dashboard.ts` |
| Agenda | `.../agenda/page.tsx`, `actions/appointments.ts` |
| Auth | `actions/auth.ts`, `lib/permissions.ts` |
| Índices | migrations `00003`, `00005`, `00007`, `00027`, `00034` |

---

## 9. Confirmaciones Fase 1

- [x] Sin cambios de código de aplicación (solo este documento).
- [x] Sin push a `main` / producción.
- [x] RLS / auditoría / validaciones: no modificadas.
- [x] PAMI documentado como N/A.
- [ ] Fases 2–12: pendientes de aprobación para implementar.

---

## 10. Siguiente paso recomendado

**Implementar P0 #1–#6** empezando por `React.cache(getSessionContext)` + layout paralelo + patient detail permissions locales + `loading.tsx`, midiendo RTs estimados antes/después en el mismo documento de resultados.

Cuando indiques, continúo con **Fase 2+** en ese orden, en rama staging/preview (sin push a `main`).

---

## 11. Fase 2 aplicada (2026-08-15) — rama `staging/perf-phase-2-session`

| Cambio | Efecto estimado |
| --- | --- |
| `React.cache` en `lib/session.ts` (`getSessionContext`) | 1 sesión/request en vez de N×3 RTs |
| `React.cache` en `createServerClient` | 1 client Supabase/request |
| Layout: `Promise.all(branches, unread)` | elimina waterfall post-sesión |
| `getUserBranches` cacheado | reuso layout ↔ formularios nuevo |
| Páginas pacientes/historia/farmacia/agenda/consultas-nueva: permisos en memoria | elimina ráfagas de `can*` |
| `/pacientes/[id]`: owner en paralelo con side-data | menos waterfall |
| Historia paciente: usa `data.total` (sin count extra) | −1 query |
| `list_active_prescriptions` LIMIT 100 (migration `00035`) | cap P0 farmacia |
| `loading.tsx` clinic + pacientes | feedback de navegación inmediato |

## 12. Fase 3 aplicada — `revalidatePath` acotado

Helper: `apps/web/src/lib/cache-revalidate.ts`

| Antes (típico) | Después |
| --- | --- |
| Mutación → `/dashboard` + listas hermanas | Solo entidad + paciente/historia afectados |
| Completar consulta → 6–7 paths | consultas + agenda puntual + entrada clínica + historia del paciente |
| Receta create/dispense/void → dashboard | `/farmacia` (+ inventario solo al dispensar) |
| Draft consulta → lista completa | solo `/consultas/:id` |
| Update cita → dashboard | solo agenda (+ dashboard en create/delete) |
| Notificaciones → dashboard | solo `/notificaciones` |

**Trade-off consciente:** contadores del dashboard pueden quedar un momento desactualizados hasta la próxima visita a `/dashboard`. La historia clínica del paciente y el registro editado se invalidan siempre.

## 13. Fase 4 aplicada — UX instantánea de botones

| Pieza | Cambio |
| --- | --- |
| `Button.isPending` | spinner + disabled inmediato |
| `usePendingAction` | pending síncrono al click |
| Paciente / historia / consulta / agenda / farmacia | acciones async con spinner + texto |
| Formularios críticos | `isPending` en submit |
| Lista pacientes | opacity durante transición de búsqueda |

**Sin optimistic UI clínico** (no se muestran estados médicos falsos).

**Producción (`main`): no modificada.**
