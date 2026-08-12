import { notFound, redirect } from 'next/navigation';
import {
  canManageInventory,
  canReadInventory,
  getInventoryProduct,
} from '@/actions/inventory';
import { InventoryProductDetail } from '@/components/inventory/inventory-product-detail';

interface InventarioDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InventarioDetailPage({ params }: InventarioDetailPageProps) {
  const canRead = await canReadInventory();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [data, canWrite] = await Promise.all([getInventoryProduct(id), canManageInventory()]);

  if (!data) notFound();

  return (
    <InventoryProductDetail
      product={data.product}
      movements={data.movements}
      canWrite={canWrite}
    />
  );
}
