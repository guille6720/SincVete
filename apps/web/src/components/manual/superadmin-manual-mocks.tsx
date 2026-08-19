import type { ReactNode } from 'react';

function Frame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <svg
      className="w-full max-w-3xl rounded-xl border bg-muted/30 shadow-sm"
      viewBox="0 0 840 430"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width="840" height="430" rx="14" fill="#0f172a" />
      <rect x="12" y="12" width="816" height="44" rx="10" fill="#1e293b" />
      <text x="28" y="40" fill="#99f6e4" fontSize="14" fontFamily="Segoe UI, sans-serif" fontWeight="700">
        SyncVete · Superadmin
      </text>
      <text x="250" y="40" fill="#e2e8f0" fontSize="13" fontFamily="Segoe UI, sans-serif">
        Organizaciones
      </text>
      <text x="680" y="40" fill="#94a3b8" fontSize="12" fontFamily="Segoe UI, sans-serif">
        Volver a la clínica
      </text>
      <rect x="12" y="68" width="816" height="350" rx="12" fill="#f8fafc" />
      {children}
    </svg>
  );
}

export function MockSuperadminHome() {
  return (
    <Frame title="Listado Superadmin de clínicas">
      <text x="32" y="98" fill="#0f172a" fontSize="18" fontFamily="Georgia, serif" fontWeight="700">
        Organizaciones
      </text>
      {[
        ['48', 'Clínicas', 32],
        ['6', 'Trial', 168],
        ['31', 'Activas', 304],
        ['4', 'Pago pendiente', 440],
        ['3', 'Sobre cupos', 616],
      ].map(([n, label, x]) => (
        <g key={label}>
          <rect x={Number(x)} y="112" width="124" height="58" rx="10" fill="#ecfdf5" />
          <text x={Number(x) + 12} y="138" fill="#0d9488" fontSize="18" fontFamily="Segoe UI, sans-serif" fontWeight="700">
            {n}
          </text>
          <text x={Number(x) + 12} y="156" fill="#64748b" fontSize="10" fontFamily="Segoe UI, sans-serif">
            {label}
          </text>
        </g>
      ))}
      <rect x="32" y="184" width="220" height="28" rx="8" fill="#fff" stroke="#cbd5e1" />
      <text x="44" y="203" fill="#94a3b8" fontSize="11" fontFamily="Segoe UI, sans-serif">
        Buscar por nombre o slug
      </text>
      <rect x="32" y="228" width="776" height="170" rx="10" fill="#fff" stroke="#e2e8f0" />
      {['Clínica BMW    Pro     activa', 'San Roque      Trial   trialing', 'Huella Norte   Basic   past_due'].map(
        (row, i) => (
          <text key={row} x="48" y={262 + i * 36} fill="#334155" fontSize="13" fontFamily="Segoe UI, sans-serif">
            {row}
          </text>
        )
      )}
      <rect x="620" y="246" width="160" height="26" rx="8" fill="#0d9488" />
      <text x="642" y="264" fill="#fff" fontSize="11" fontFamily="Segoe UI, sans-serif" fontWeight="700">
        Abrir ficha →
      </text>
    </Frame>
  );
}

export function MockSuperadminFeatures() {
  return (
    <Frame title="Ficha de clínica: Features">
      <text x="32" y="98" fill="#0f172a" fontSize="18" fontFamily="Georgia, serif" fontWeight="700">
        Clínica BMW · Features
      </text>
      <text x="32" y="118" fill="#64748b" fontSize="11" fontFamily="Segoe UI, sans-serif">
        Override → extra → plan → default. Activar crea un override para esta clínica.
      </text>
      {[
        ['WhatsApp', 'sí', 'plan', 140],
        ['IA clínica', 'no', 'deny', 188],
        ['Imágenes', 'sí', 'override', 236],
        ['Máx. usuarios', '8 / 10', 'plan', 284],
      ].map(([feat, on, src, y]) => (
        <g key={feat}>
          <rect x="32" y={Number(y)} width="776" height="40" rx="8" fill="#fff" stroke="#e2e8f0" />
          <text x="48" y={Number(y) + 26} fill="#0f172a" fontSize="13" fontFamily="Segoe UI, sans-serif">
            {feat}
          </text>
          <text x="280" y={Number(y) + 26} fill="#0d9488" fontSize="12" fontFamily="Segoe UI, sans-serif">
            On: {on}
          </text>
          <text x="430" y={Number(y) + 26} fill="#64748b" fontSize="12" fontFamily="Segoe UI, sans-serif">
            Fuente: {src}
          </text>
          <rect x="620" y={Number(y) + 8} width="72" height="24" rx="6" fill="#0d9488" />
          <text x="632" y={Number(y) + 25} fill="#fff" fontSize="11" fontFamily="Segoe UI, sans-serif">
            Activar
          </text>
          <rect x="700" y={Number(y) + 8} width="88" height="24" rx="6" fill="#fff" stroke="#94a3b8" />
          <text x="714" y={Number(y) + 25} fill="#334155" fontSize="11" fontFamily="Segoe UI, sans-serif">
            Límite
          </text>
        </g>
      ))}
    </Frame>
  );
}

export function MockEquipoRoles() {
  return (
    <Frame title="Configuración de la clínica: Equipo y Roles">
      <text x="32" y="98" fill="#0f172a" fontSize="18" fontFamily="Georgia, serif" fontWeight="700">
        Configuración · Equipo
      </text>
      <text x="32" y="118" fill="#64748b" fontSize="11" fontFamily="Segoe UI, sans-serif">
        Los permisos de una persona se editan acá, no en Superadmin. Superadmin habilita el módulo a la clínica.
      </text>
      <rect x="32" y="136" width="380" height="250" rx="10" fill="#fff" stroke="#e2e8f0" />
      <text x="48" y="162" fill="#0f766e" fontSize="13" fontFamily="Segoe UI, sans-serif" fontWeight="700">
        Invitar / rol
      </text>
      {['Lucía Pérez  · Veterinario  · Activo', 'Marco Díaz  · Recepcionista · Activo', 'Ana Gómez   · Solo lectura  · Activo'].map(
        (row, i) => (
          <text key={row} x="48" y={198 + i * 36} fill="#334155" fontSize="13" fontFamily="Segoe UI, sans-serif">
            {row}
          </text>
        )
      )}
      <rect x="48" y="318" width="140" height="28" rx="8" fill="#0d9488" />
      <text x="72" y="337" fill="#fff" fontSize="12" fontFamily="Segoe UI, sans-serif" fontWeight="700">
        Guardar rol
      </text>
      <rect x="428" y="136" width="380" height="250" rx="10" fill="#fff" stroke="#e2e8f0" />
      <text x="444" y="162" fill="#0f766e" fontSize="13" fontFamily="Segoe UI, sans-serif" fontWeight="700">
        Roles (solo lectura)
      </text>
      <text x="444" y="198" fill="#334155" fontSize="12" fontFamily="Segoe UI, sans-serif">
        Veterinario: pacientes, clínica, recetas
      </text>
      <text x="444" y="226" fill="#334155" fontSize="12" fontFamily="Segoe UI, sans-serif">
        Recepcionista: agenda y altas
      </text>
      <text x="444" y="254" fill="#334155" fontSize="12" fontFamily="Segoe UI, sans-serif">
        Cajero/a: facturas y caja
      </text>
      <text x="444" y="294" fill="#64748b" fontSize="11" fontFamily="Segoe UI, sans-serif">
        La matriz no se edita. Cambiá el rol en Equipo.
      </text>
    </Frame>
  );
}
