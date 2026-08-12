'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setActiveBranch } from '@/actions/settings';
import { Select } from '@/components/ui/select';

interface BranchSelectorProps {
  branches: Array<{ id: string; name: string; is_active: boolean }>;
  activeBranchId: string | null;
}

export function BranchSelector({ branches, activeBranchId }: BranchSelectorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (branches.length <= 1) {
    return null;
  }

  return (
    <Select
      value={activeBranchId ?? branches[0]?.id ?? ''}
      disabled={pending}
      aria-label="Seleccionar sucursal"
      onChange={(e) => {
        const branchId = e.target.value;
        startTransition(async () => {
          await setActiveBranch(branchId);
          router.refresh();
        });
      }}
      className="h-9 max-w-[220px] text-sm"
    >
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id} disabled={!branch.is_active}>
          {branch.name}
          {!branch.is_active ? ' (inactiva)' : ''}
        </option>
      ))}
    </Select>
  );
}
