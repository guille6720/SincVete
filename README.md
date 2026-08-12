# SincVete

Plataforma SaaS profesional de gestión veterinaria multi-tenant.

## Stack

- **Frontend:** Next.js 15, React 19, TypeScript strict, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, RLS, Storage)
- **Estado:** TanStack Query
- **Monorepo:** Turborepo + npm workspaces

## Estructura

```
apps/web          → Aplicación Next.js
packages/shared   → Types, schemas Zod, permisos
packages/db       → Cliente Supabase tipado
supabase/         → Migraciones y config local
```

## Requisitos

- Node.js 20+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para DB local)
- Docker (requerido por Supabase local)

## Setup

```bash
# Instalar dependencias
npm install

# Iniciar Supabase local
npx supabase start

# Copiar keys de Supabase al entorno
npx supabase status -o env >> apps/web/.env.local

# Agregar service role key manualmente a apps/web/.env.local
# SUPABASE_SERVICE_ROLE_KEY=...

# Aplicar migraciones
npx supabase db reset

# Desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint en todos los paquetes |
| `npm run typecheck` | TypeScript check |
| `npm run test:unit` | Tests unitarios |
| `npm run test:integration` | Tests de integración RLS |
| `npm run test:e2e` | Tests E2E con Playwright |

## Módulo 0 — Fundación SaaS ✓

- [x] Monorepo Turborepo
- [x] PostgreSQL: organizations, branches, profiles, branch_members, audit_logs
- [x] Row Level Security multi-tenant
- [x] Soft delete + auditoría
- [x] Auth: registro de clínica + login
- [x] App shell con sidebar responsive
- [x] Command palette (⌘K / Ctrl+K)
- [x] Tests unitarios de permisos
- [x] Tests de integración RLS
- [x] Tests E2E smoke

## Módulo 21 — Configuración ✓

- [x] Datos de clínica (nombre, timezone, moneda, contacto, CUIT)
- [x] CRUD de sucursales con soft delete
- [x] Gestión de equipo (roles, activar/desactivar)
- [x] Invitaciones por email
- [x] Selector de sucursal activa en el shell
- [x] Panel de referencia de roles y permisos
- [x] Validaciones Zod + permisos RLS

## Módulo 4 — Propietarios ✓

- [x] Tabla `owners` con RLS y auditoría
- [x] Búsqueda full-text server-side (`search_owners`)
- [x] Listado paginado con debounce en URL
- [x] Crear / editar / ver / soft delete
- [x] Campos LATAM: DNI, CUIT, WhatsApp, provincias AR
- [x] Permisos `patients:read` / `patients:write`

## Módulo 3 — Pacientes ✓

- [x] Tabla `patients` con FK a propietarios, RLS y auditoría
- [x] Enums `patient_species` y `patient_sex`
- [x] Búsqueda full-text server-side (`search_patients`)
- [x] Listado paginado con filtros por especie y debounce en URL
- [x] Crear / editar / ver / soft delete
- [x] Selector de propietario con autocomplete
- [x] Microchip único por organización

## Módulo 1 — Dashboard operativo ✓

- [x] RPC `get_dashboard_summary` con KPIs y filtro por sucursal activa
- [x] KPIs: pacientes/propietarios activos, altas del mes, citas hoy
- [x] Distribución de pacientes por especie con enlaces a filtros
- [x] Últimos pacientes y propietarios registrados
- [x] Feed de actividad vía `get_dashboard_activity` (permiso `audit:read`)
- [x] Acciones rápidas según permisos del usuario
- [x] Placeholder para Consultas (M6)

## Módulo 2 — Agenda ✓

- [x] Tabla `appointments` con FK a pacientes/propietarios, RLS y auditoría
- [x] Enums `appointment_status` y `appointment_type`
- [x] Vista semanal con navegación por días y contadores
- [x] Filtros por estado y profesional asignado
- [x] Crear / editar / ver / cancelar / cambiar estado / soft delete
- [x] Selector de paciente con autocomplete
- [x] Permisos `appointments:read` / `appointments:write`

## Módulo 5 — Historia clínica ✓

- [x] Tabla `clinical_entries` con FK a pacientes, propietarios y citas
- [x] Enum `clinical_entry_type` (consulta, cirugía, internación, etc.)
- [x] Búsqueda full-text server-side (`search_clinical_entries`)
- [x] Formulario SOAP veterinario: anamnesis, examen, diagnóstico, tratamiento, plan
- [x] Signos vitales: peso y temperatura
- [x] Timeline por paciente en `/pacientes/[id]/historia`
- [x] Permisos `clinical:read` / `clinical:write`

## Módulo 6 — Consultas ✓

- [x] Tabla `consultations` con estados (en espera, en curso, completada, cancelada)
- [x] Cola de hoy: citas del día + walk-ins
- [x] Iniciar consulta desde cita o walk-in
- [x] Workspace SOAP con borrador y cierre
- [x] Completar consulta escribe en historia clínica y marca la cita como completada
- [x] Historial paginado con filtros
- [x] KPI de consultas del mes en el dashboard

## Módulo 7 — Internación ✓

- [x] Tabla `hospitalizations` con estados (internado, observación, alta, fallecido)
- [x] Una internación activa por paciente
- [x] Evoluciones diarias (`hospitalization_notes`) con peso y temperatura
- [x] Admitir desde paciente, consulta o tablero
- [x] Alta o fallecimiento escribe en historia clínica (`entry_type = internacion`)
- [x] Fallecimiento marca al paciente como fallecido
- [x] KPI de internados actuales en el dashboard

## Módulo 8 — Vacunación ✓

- [x] Tabla `vaccinations` con vacuna, laboratorio, lote, vía y próximo refuerzo
- [x] Presets LATAM (antirrábica, séxtuple, triple felina, FeLV, etc.)
- [x] Tablero de vencidas y por vencer (30 días) según última dosis por vacuna
- [x] Registrar dosis escribe en historia clínica (`entry_type = vacunacion`)
- [x] Estado de vacunas en la ficha del paciente
- [x] KPI de vacunas vencidas en el dashboard

## Módulo 9 — Cirugías ✓

- [x] Tabla `surgeries` con estados (programada, en quirófano, recuperación, completada, cancelada)
- [x] Una cirugía activa (en curso o recuperación) por paciente
- [x] Ficha pre / intra / postoperatoria, ASA y anestesia
- [x] Completar escribe en historia clínica (`entry_type = cirugia`) y cierra la cita asociada
- [x] Presets LATAM (castración, OH, dental, cesárea, etc.)
- [x] KPI de pacientes en quirófano en el dashboard

## Módulo 10 — Laboratorio ✓

- [x] Tablas `lab_orders` / `lab_order_items` con estados, prioridad y flags de resultado
- [x] Cola (solicitada / en proceso) e historial con búsqueda
- [x] Presets LATAM (hemograma, bioquímica, orina, copro, parvo, FIV/FeLV)
- [x] Completar escribe en historia clínica (`entry_type = laboratorio`)
- [x] Enlaces desde paciente y consulta; KPI de órdenes pendientes en el dashboard

## Módulo 11 — Inventario ✓

- [x] Tablas `inventory_products` / `inventory_movements` con RLS y auditoría
- [x] Categorías (medicamento, vacuna, insumo, alimento, laboratorio) y unidades
- [x] Movimientos: entrada, salida, ajuste y descarte (stock atómico)
- [x] Tablero de stock bajo + catálogo con búsqueda/filtros
- [x] KPI de stock bajo en el dashboard; permisos `inventory:read` / `inventory:write`

## Módulo 12 — Facturación ✓

- [x] Tablas `invoices` / `invoice_items` / `payments` con RLS y auditoría
- [x] Estados: borrador, emitida, pagada, anulada; numeración `F-000001`
- [x] Medios de pago LATAM (efectivo, transferencia, tarjeta, Mercado Pago)
- [x] Cuentas por cobrar, emisión, cobro parcial/total y anulación
- [x] Enlaces desde paciente y consulta; KPI de facturas abiertas; permisos `billing:read` / `billing:write`

## Módulo 13 — Reportes ✓

- [x] RPC `get_clinic_report` por rango de fechas (máx. 92 días) y sucursal activa
- [x] Operación: pacientes, citas, consultas, internación, vacunas, cirugías, lab
- [x] Caja e inventario según permisos (`billing:read` / `inventory:read`)
- [x] Presets (hoy, semana, mes, 30 días) y actividad diaria
- [x] Permiso `reports:read`

## Módulo 14 — Portal del propietario ✓

- [x] Invitación por enlace desde la ficha del propietario (requiere email)
- [x] Cuenta de tutor separada del staff, sin permisos de clínica
- [x] Portal de solo lectura: mascotas, turnos, vacunas, facturas emitidas e historia resumida
- [x] RLS: el tutor no ve equipo, configuración ni datos de otros clientes
- [x] Activación en `/portal/activar` y enrutado staff → clínica / tutor → portal

## Módulo 15 — WhatsApp ✓

- [x] Click-to-chat `wa.me` con plantillas LATAM (turno, vacuna, factura, lab, portal)
- [x] Normalización de teléfonos AR (+54 9 11…)
- [x] Historial `whatsapp_messages` con RLS y permiso `whatsapp:send`
- [x] Enlaces desde propietario, paciente, cita, factura y laboratorio
- [x] No requiere API de Meta; el envío se confirma en WhatsApp

## Módulo 16 — Recordatorios ✓

- [x] Cola de avisos: turnos (48 h), vacunas vencidas/por vencer y facturas con saldo
- [x] WhatsApp con la plantilla correspondiente u omitir para no insistir
- [x] Historial `reminder_logs` con RLS; no se vuelve a mostrar el mismo ítem
- [x] Tablero en `/recordatorios` y KPI en el dashboard
- [x] Reutiliza permisos existentes (`appointments:read`, `clinical:read`, `billing:read`, `whatsapp:send`)

## Módulo 17 — IA clínica ✓

- [x] Resumen del paciente, asistencia SOAP e indicaciones para el tutor
- [x] Historial `ai_suggestions` con RLS; contexto clínico vía RPC (últimas entradas y vacunas)
- [x] Proveedor OpenAI-compatible (`OPENAI_API_KEY`, opcional `OPENAI_BASE_URL` / `OPENAI_MODEL`)
- [x] Integración en la consulta abierta: sugerir y aplicar diagnóstico / tratamiento / plan
- [x] Reutiliza `clinical:read` / `clinical:write`; la IA no reemplaza el criterio clínico

## Módulo 18 — Farmacia ✓

- [x] Recetas con número `R-000001`, ítems (dosis, frecuencia, vía) y plantillas LATAM
- [x] Dispensar descuenta stock si el ítem está vinculado a inventario (`clinical:write`, sin `inventory:write`)
- [x] Tablero en `/farmacia`, historial y KPI de recetas activas
- [x] Acceso desde paciente, consulta SOAP y paleta de comandos
- [x] Reutiliza `clinical:read` / `clinical:write`

## Módulo 19 — Caja ✓

- [x] Turno de caja por sucursal: abrir con fondo, movimientos y cierre con efectivo contado
- [x] Los cobros de facturas (`register_payment`) entran al turno abierto de esa sucursal
- [x] Ingresos, egresos y retiros manuales; el efectivo esperado ignora tarjeta / transferencia / MP
- [x] Tablero en `/caja`, historial y KPI de cajas abiertas
- [x] Reutiliza `billing:read` / `billing:write` (rol cajero incluido)

## Módulo 20 — Imágenes ✓

- [x] Galería `clinical_images` (foto, radiografía, ecografía, laboratorio, documento, otro)
- [x] Bucket privado `clinical-images` (10 MB; JPG/PNG/WebP/GIF/PDF) con RLS por organización
- [x] Subida, vista con URL firmada y baja; tablero en `/imagenes`
- [x] Acceso desde paciente, consulta SOAP, historia clínica y paleta de comandos
- [x] Reutiliza `clinical:read` / `clinical:write`

## Módulo 22 — Notificaciones ✓

- [x] Bandeja in-app del staff (`notifications` + leídas por usuario)
- [x] Eventos: cita nueva, lab completado, stock bajo, internación, factura emitida, receta
- [x] Campana en el header con no leídas, `/notificaciones` y KPI en el dashboard
- [x] Distinto de Recordatorios (avisos WhatsApp al tutor)
- [x] Acceso de todo el staff clínico; sin permiso nuevo

## Módulo 23 — Auditoría ✓

- [x] Explorador de `audit_logs` en `/auditoria` (búsqueda, acción, entidad y rango de fechas)
- [x] Detalle con diff de campos y enlace al registro
- [x] Resumen de eventos corregido (`create`/`update`/`delete`) y KPI del día
- [x] Campana de actividad del dashboard enlaza al historial
- [x] Reutiliza `audit:read` (dueño y administrador)

## Roadmap inicial

Completo.

## Locale

- Idioma UI: Español (Argentina)
- Timezone default: `America/Argentina/Buenos_Aires`
