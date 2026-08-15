import { notFound, redirect } from 'next/navigation';
import { getPatient } from '@/actions/patients';
import { getOwner } from '@/actions/owners';
import { countPatientClinicalEntries } from '@/actions/clinical-entries';
import { getActiveHospitalizationByPatient } from '@/actions/hospitalizations';
import { listPatientVaccineStatus } from '@/actions/vaccinations';
import { getActiveSurgeryByPatient } from '@/actions/surgeries';
import { PatientDetail } from '@/components/patients/patient-detail';
import { getSessionContext } from '@/lib/session';

interface PatientPageProps {
  params: Promise<{ id: string }>;
}

export default async function PacienteDetailPage({ params }: PatientPageProps) {
  const [session, { id }] = await Promise.all([getSessionContext(), params]);
  if (!session?.permissions.includes('patients:read')) redirect('/dashboard');

  const patient = await getPatient(id);
  if (!patient) notFound();

  const [
    owner,
    clinicalEntryCount,
    activeHospitalization,
    activeSurgery,
    vaccineStatus,
  ] = await Promise.all([
    getOwner(patient.owner_id),
    countPatientClinicalEntries(id).catch(() => 0),
    getActiveHospitalizationByPatient(id),
    getActiveSurgeryByPatient(id),
    listPatientVaccineStatus(id),
  ]);

  return (
    <PatientDetail
      patient={patient}
      owner={owner}
      canWrite={session.permissions.includes('patients:write')}
      canReadClinical={session.permissions.includes('clinical:read')}
      canWriteClinical={session.permissions.includes('clinical:write')}
      clinicalEntryCount={clinicalEntryCount}
      activeHospitalization={activeHospitalization}
      activeSurgery={activeSurgery}
      vaccineStatus={vaccineStatus}
      canWriteBilling={session.permissions.includes('billing:write')}
      canSendWhatsApp={session.permissions.includes('whatsapp:send')}
    />
  );
}
