import { notFound, redirect } from 'next/navigation';
import { getClinicalImage, canReadImages, canManageImages } from '@/actions/images';
import { ClinicalImageDetail } from '@/components/images/clinical-image-detail';

interface ImagenDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ImagenDetailPage({ params }: ImagenDetailPageProps) {
  const canRead = await canReadImages();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [image, canWrite] = await Promise.all([getClinicalImage(id), canManageImages()]);

  if (!image) notFound();

  return <ClinicalImageDetail image={image} canWrite={canWrite} />;
}
