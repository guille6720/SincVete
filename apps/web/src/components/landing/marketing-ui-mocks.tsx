import Image from 'next/image';
import type { ReactNode } from 'react';

export function MarketingHeroVisual() {
  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden md:min-h-[560px]">
      <Image
        src="/landing/hero-dog.jpg"
        alt="Perro feliz en consulta veterinaria"
        fill
        priority
        className="object-cover object-[center_30%]"
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[var(--land-ink)]/55 via-[var(--land-ink)]/15 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
        <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
          Cada paciente, en su lugar.
        </p>
        <p className="mt-2 max-w-sm text-sm text-white/80">
          Historias, vacunas y turnos conectados para que el equipo se enfoque en la atención.
        </p>
      </div>
    </div>
  );
}

export function LandingPhotoStrip() {
  const photos = [
    {
      src: '/landing/puppy.jpg',
      alt: 'Cachorro en la clínica',
      label: 'Controles',
    },
    {
      src: '/landing/cat.jpg',
      alt: 'Gato mirando a cámara',
      label: 'Felinos',
    },
    {
      src: '/landing/clinic-care.jpg',
      alt: 'Atención veterinaria a un perro',
      label: 'Consultas',
    },
    {
      src: '/landing/dog-park.jpg',
      alt: 'Perro al aire libre',
      label: 'Bienestar',
    },
    {
      src: '/landing/bunny.jpg',
      alt: 'Conejo doméstico',
      label: 'Exóticos',
    },
    {
      src: '/landing/stethoscope-dog.jpg',
      alt: 'Perro con estetoscopio',
      label: 'Chequeos',
    },
  ] as const;

  return (
    <section
      aria-label="Pacientes que cuidamos"
      className="relative overflow-hidden border-y border-[var(--land-line)]"
    >
      <Image
        src="/landing/hero-vet.jpg"
        alt=""
        fill
        className="scale-110 object-cover blur-md"
        sizes="100vw"
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[var(--land-ink)]/55"
      />
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 sm:gap-5 sm:px-6 sm:py-8 md:grid-cols-3 md:gap-6">
        {photos.map((photo) => (
          <figure
            key={photo.src}
            className="group relative aspect-[4/3] overflow-hidden rounded-sm shadow-lg ring-1 ring-white/15 sm:aspect-[3/4] md:min-h-[280px]"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-cover transition duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12 text-sm font-medium text-white">
              {photo.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function LandingClinicScene() {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden border border-[var(--land-line)]">
      <Image
        src="/landing/hero-vet.jpg"
        alt="Veterinaria atendiendo a un perro"
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 45vw"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-tr from-[var(--land-ink)]/40 to-transparent"
      />
    </div>
  );
}

export function LandingCtaBackdrop({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-t border-[var(--land-line)] py-20 text-white md:py-24">
      <Image
        src="/landing/clinic-care.jpg"
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        aria-hidden
      />
      <div aria-hidden className="absolute inset-0 bg-[var(--land-ink)]/80" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

export function ProductPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden border border-[var(--land-line)] bg-white">
      <div className="border-b border-[var(--land-line)] bg-[var(--land-surface)] px-4 py-2.5">
        <p className="text-xs font-medium text-[var(--land-muted)]">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
