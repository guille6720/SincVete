import { redirect } from 'next/navigation';
import { getSessionContext } from '@/actions/auth';
import {
  getOrganizationSettingsForm,
  listBranches,
  listPendingInvitations,
  listTeamMembers,
} from '@/actions/settings';
import { getPlanBillingState, cancelClinicCheckoutIntents } from '@/actions/plan-billing';
import { getSeatUsageMeters } from '@/lib/entitlements';
import { SettingsPageClient } from '@/components/settings/settings-page-client';
import type { SettingsTab } from '@/components/settings/settings-tabs';
import { hasPermission } from '@sincvete/shared';
import type { Branch, SeatUsageMeter } from '@sincvete/shared';

interface PageProps {
  searchParams: Promise<{ tab?: string; checkout?: string }>;
}

export default async function ConfiguracionPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const params = await searchParams;
  const availableTabs: SettingsTab[] = ['roles', 'legal'];
  if (hasPermission(session.permissions, 'org:manage')) availableTabs.unshift('clinica', 'plan');
  if (hasPermission(session.permissions, 'branch:manage')) availableTabs.push('sucursales');
  if (hasPermission(session.permissions, 'users:manage')) availableTabs.push('equipo');

  const requested = params.tab;
  const defaultTab: SettingsTab =
    requested && availableTabs.includes(requested as SettingsTab)
      ? (requested as SettingsTab)
      : availableTabs.includes('clinica')
        ? 'clinica'
        : availableTabs[0];

  let clinicData;
  let planBilling;
  let seats: SeatUsageMeter[] = [];
  if (hasPermission(session.permissions, 'org:manage')) {
    const result = await getOrganizationSettingsForm();
    if (result.success && result.data) {
      clinicData = {
        organizationName: result.data.organization.name,
        settings: result.data.settings,
      };
    }
    try {
      planBilling = await getPlanBillingState();
      if (params.checkout === 'cancel') {
        await cancelClinicCheckoutIntents();
        planBilling = await getPlanBillingState();
      }
    } catch {
      planBilling = undefined;
    }
  }

  if (
    hasPermission(session.permissions, 'users:manage') ||
    hasPermission(session.permissions, 'branch:manage')
  ) {
    try {
      seats = await getSeatUsageMeters(session.organizationId);
    } catch {
      seats = [];
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
      seats={seats}
      planBilling={planBilling}
      checkoutBanner={params.checkout ?? null}
    />
  );
}
