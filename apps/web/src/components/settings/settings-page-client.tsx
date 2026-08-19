'use client';

import { useState } from 'react';
import { SettingsTabs, type SettingsTab } from '@/components/settings/settings-tabs';
import { ClinicSettingsForm } from '@/components/settings/clinic-settings-form';
import { BranchesPanel } from '@/components/settings/branches-panel';
import { TeamPanel } from '@/components/settings/team-panel';
import { RolesPanel } from '@/components/settings/roles-panel';
import { SettingsLegalPanel } from '@/components/settings/settings-legal-panel';
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
}

export function SettingsPageClient({
  availableTabs,
  defaultTab,
  clinic,
  branches,
  team,
}: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administrá tu clínica, sucursales, equipo, permisos y documentos legales
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
      {activeTab === 'legal' && <SettingsLegalPanel />}
    </div>
  );
}
