import { redirect } from 'next/navigation';
import { getSessionContext } from '@/actions/auth';
import {
  getOrganizationSettingsForm,
  listBranches,
  listPendingInvitations,
  listTeamMembers,
} from '@/actions/settings';
import { SettingsPageClient } from '@/components/settings/settings-page-client';
import type { SettingsTab } from '@/components/settings/settings-tabs';
import { hasPermission } from '@sincvete/shared';
import type { Branch } from '@sincvete/shared';

export default async function ConfiguracionPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const availableTabs: SettingsTab[] = ['roles', 'legal'];
  if (hasPermission(session.permissions, 'org:manage')) availableTabs.unshift('clinica');
  if (hasPermission(session.permissions, 'branch:manage')) availableTabs.push('sucursales');
  if (hasPermission(session.permissions, 'users:manage')) availableTabs.push('equipo');

  const defaultTab = availableTabs.includes('clinica')
    ? 'clinica'
    : availableTabs.includes('sucursales')
      ? 'sucursales'
      : availableTabs[0];

  let clinicData;
  if (hasPermission(session.permissions, 'org:manage')) {
    const result = await getOrganizationSettingsForm();
    if (result.success && result.data) {
      clinicData = {
        organizationName: result.data.organization.name,
        settings: result.data.settings,
      };
    }
  }

  let branchesData;
  if (hasPermission(session.permissions, 'branch:manage')) {
    branchesData = await listBranches({ page: 1, pageSize: 50 });
  }

  let teamData;
  if (hasPermission(session.permissions, 'users:manage')) {
    const [members, invitations, branches] = await Promise.all([
      listTeamMembers({ page: 1, pageSize: 50 }),
      listPendingInvitations(),
      listBranches({ page: 1, pageSize: 100 }),
    ]);

    teamData = {
      members,
      invitations,
      branches: branches.data as Branch[],
    };
  }

  return (
    <SettingsPageClient
      availableTabs={availableTabs}
      defaultTab={defaultTab}
      clinic={clinicData}
      branches={branchesData}
      team={teamData}
    />
  );
}
