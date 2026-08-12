import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManageInventory } from '@/actions/inventory';
import { getSessionContext } from '@/actions/auth';
import { getUserBranches } from '@/actions/settings';
import { InventoryProductForm } from '@/components/inventory/inventory-product-form';
import { Button } from '@/components/ui/button';

export default async function NuevoInventarioPage() {
  const canWrite = await canManageInventory();
  if (!canWrite) redirect('/inventario');

  const session = await getSessionContext();
  const branches = await getUserBranches();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/inventario">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a inventario
        </Link>
      </Button>
      <InventoryProductForm branches={branches} defaultBranchId={session?.branchId} />
    </div>
  );
}
