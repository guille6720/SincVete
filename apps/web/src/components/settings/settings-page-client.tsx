'use client';

import { useState } from 'react';
import { SettingsTabs, type SettingsTab } from '@/components/settings/settings-tabs';
import { ClinicSettingsForm } from '@/components/settings/clinic-settings-form';
import { BranchesPanel } from '@/components/settings/branches-panel';
import { TeamPanel } from '@/components/settings/team-panel';
import { RolesPanel } from '@/components/settings/roles-panel';
import { PlanBillingPanel } from '@/components/settings/plan-billing-panel';
import type { PlanBillingState } from '@/actions/plan-billing';
import type {
  Branch,
  OrganizationInvitation,
  OrganizationSettings,
  PaginatedResult,
  TeamMemberRow,
} from '@sincvete/shared';

interface SettingsPageClientProps {
  availableTabs: SettingsTab[];
  defaultTab: SettingsTab;
  clinic?: {
    organizationName: string;
    settings: OrganizationSettings;
  };
  branches?: PaginatedResult<Branch>;
  team?: {
    members: PaginatedResult<TeamMemberRow>;
    invitations: OrganizationInvitation[];
    branches: Branch[];
  };
  planBilling?: PlanBillingState;
  checkoutBanner?: string | null;
}

export function SettingsPageClient({
  availableTabs,
  defaultTab,
  clinic,
  branches,
  team,
  planBilling,
  checkoutBanner,
}: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administrá tu clínica, plan, sucursales, equipo y permisos
        </p>
      </div>

      <SettingsTabs active={activeTab} onChange={setActiveTab} availableTabs={availableTabs} />

      {activeTab === 'clinica' && clinic && (
        <ClinicSettingsForm
          organizationName={clinic.organizationName}
          settings={clinic.settings}
        />
      )}

      {activeTab === 'sucursales' && branches && <BranchesPanel initialData={branches} />}

      {activeTab === 'equipo' && team && (
        <TeamPanel
          members={team.members}
          invitations={team.invitations}
          branches={team.branches}
        />
      )}

      {activeTab === 'roles' && <RolesPanel />}
      {activeTab === 'plan' && planBilling ? (
        <PlanBillingPanel state={planBilling} checkoutBanner={checkoutBanner} />
      ) : activeTab === 'plan' ? (
        <p className="text-sm text-muted-foreground">
          No se pudo cargar el plan. Superadmin puede asignarlo mientras tanto.
        </p>
      ) : null}
    </div>
  );
}
