import Image from 'next/image';
import Link from 'next/link';
import { APP_NAME } from '@sincvete/shared';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
  href?: string;
  className?: string;
  /** Visual size preset */
  size?: 'sm' | 'md' | 'lg' | 'hero' | 'sidebar';
  /** `onLight` = fondo claro; `onDark` = logo con fondo negro para barras oscuras */
  variant?: 'onLight' | 'onDark';
  priority?: boolean;
};

const SIZE_CLASS: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-10 w-auto',
  md: 'h-12 w-auto',
  lg: 'h-20 w-auto',
  hero: 'h-32 w-auto sm:h-40 lg:h-48',
  sidebar: 'h-auto w-full max-h-36',
};

const SIZE_PX: Record<NonNullable<BrandLogoProps['size']>, { width: number; height: number }> = {
  sm: { width: 140, height: 40 },
  md: { width: 168, height: 48 },
  lg: { width: 240, height: 80 },
  hero: { width: 420, height: 192 },
  sidebar: { width: 512, height: 512 },
};

export function BrandLogo({
  href,
  className,
  size = 'md',
  variant = 'onLight',
  priority = false,
}: BrandLogoProps) {
  const dims = SIZE_PX[size];
  const src = variant === 'onDark' ? '/brand/logo-dark.png' : '/brand/logo.png';
  const image = (
    <Image
      src={src}
      alt={APP_NAME}
      width={dims.width}
      height={dims.height}
      priority={priority}
      className={cn(SIZE_CLASS[size], 'object-contain object-left', className)}
    />
  );

  if (!href) return image;

  return (
    <Link
      href={href}
      className={cn('inline-flex items-center', size === 'sidebar' && 'block w-full')}
      aria-label={APP_NAME}
    >
      {image}
    </Link>
  );
}
