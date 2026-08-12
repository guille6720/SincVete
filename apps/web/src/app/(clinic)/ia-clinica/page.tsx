import { redirect } from 'next/navigation';
import { getPatient } from '@/actions/patients';
import {
  canReadClinicalAi,
  getClinicalAiStatus,
  listClinicalAiSuggestions,
} from '@/actions/clinical-ai';
import { ClinicalAiGenerateForm } from '@/components/clinical-ai/clinical-ai-generate-form';
import { ClinicalAiHistory } from '@/components/clinical-ai/clinical-ai-history';
import {
  CLINICAL_AI_KINDS,
  type ClinicalAiKind,
} from '@sincvete/shared';

interface IaClinicaPageProps {
  searchParams: Promise<{
    page?: string;
    patientId?: string;
    kind?: string;
    consultationId?: string;
    clinicalEntryId?: string;
  }>;
}

export default async function IaClinicaPage({ searchParams }: IaClinicaPageProps) {
  const canRead = await canReadClinicalAi();
  if (!canRead) redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const kindParam = params.kind?.trim() ?? '';
  const kind = CLINICAL_AI_KINDS.includes(kindParam as ClinicalAiKind)
    ? (kindParam as ClinicalAiKind)
    : undefined;
  const patientId = params.patientId?.trim() || undefined;

  const [status, history, patient] = await Promise.all([
    getClinicalAiStatus(),
    listClinicalAiSuggestions({
      page,
      pageSize: 10,
      patientId,
      kind,
    }),
    patientId ? getPatient(patientId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IA clínica</h1>
        <p className="text-muted-foreground">
          Resumen del paciente, asistencia SOAP e indicaciones para el tutor.
        </p>
      </div>

      <ClinicalAiGenerateForm
        defaultPatientId={patient?.id}
        defaultPatientName={patient?.name}
        defaultOwnerId={patient?.owner_id}
        defaultKind={kind ?? 'patient_summary'}
        consultationId={params.consultationId?.trim() || undefined}
        clinicalEntryId={params.clinicalEntryId?.trim() || undefined}
        configured={status.configured}
        canGenerate={status.canGenerate}
      />

      <ClinicalAiHistory data={history} />
    </div>
  );
}
