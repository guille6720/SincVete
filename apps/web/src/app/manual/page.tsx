import type { Metadata } from 'next';
import { MANUAL_CSS } from '@/components/manual/manual-css';
import { MANUAL_DOWNLOAD_HREF, MANUAL_FILENAME, MANUAL_PDF_HREF } from '@/components/manual/manual-constants';
import { PrintManualButton } from '@/components/manual/print-manual-button';
import { UserManual } from '@/components/manual/user-manual';

export const metadata: Metadata = {
  title: 'Manual de uso',
  description: 'Guía práctica de SyncVete para el equipo de la clínica.',
};

export default function ManualPage() {
  return (
    <>
      <style>{MANUAL_CSS}</style>
      <UserManual
        toolbar={
          <div className="sv-toolbar">
            <a className="primary" href={MANUAL_PDF_HREF}>
              Descargar PDF
            </a>
            <a href={MANUAL_DOWNLOAD_HREF} download={MANUAL_FILENAME}>
              Descargar HTML
            </a>
            <PrintManualButton />
          </div>
        }
      />
    </>
  );
}
