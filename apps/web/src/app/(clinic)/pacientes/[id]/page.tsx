import { notFound, redirect } from 'next/navigation';
import { getPatient, canReadPatients, canManagePatients } from '@/actions/patients';
import { getOwner } from '@/actions/owners';
import { canReadClinical, canManageClinical, countPatientClinicalEntries } from '@/actions/clinical-entries';
import { getActiveHospitalizationByPatient } from '@/actions/hospitalizations';
import { listPatientVaccineStatus } from '@/actions/vaccinations';
import { getActiveSurgeryByPatient } from '@/actions/surgeries';
import { canManageBilling } from '@/actions/billing';
import { canSendWhatsApp } from '@/actions/whatsapp';
import { PatientDetail } from '@/components/patients/patient-detail';

interface PatientPageProps {
  params: Promise<{ id: string }>;
}

export default async function PacienteDetailPage({ params }: PatientPageProps) {
  const canRead = await canReadPatients();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [
    patient,
    canWrite,
    canClinical,
    canWriteClinical,
    clinicalEntryCount,
    activeHospitalization,
    activeSurgery,
    vaccineStatus,
    canWriteBilling,
    canWhatsApp,
  ] = await Promise.all([
    getPatient(id),
    canManagePatients(),
    canReadClinical(),
    canManageClinical(),
    countPatientClinicalEntries(id).catch(() => 0),
    getActiveHospitalizationByPatient(id),
    getActiveSurgeryByPatient(id),
    listPatientVaccineStatus(id),
    canManageBilling(),
    canSendWhatsApp(),
  ]);

  if (!patient) notFound();

  const owner = await getOwner(patient.owner_id);

  return (
    <PatientDetail
      patient={patient}
      owner={owner}
      canWrite={canWrite}
      canReadClinical={canClinical}
      canWriteClinical={canWriteClinical}
      clinicalEntryCount={clinicalEntryCount}
      activeHospitalization={activeHospitalization}
      activeSurgery={activeSurgery}
      vaccineStatus={vaccineStatus}
      canWriteBilling={canWriteBilling}
      canSendWhatsApp={canWhatsApp}
    />
  );
}
