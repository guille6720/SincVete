import { describe, expect, it } from 'vitest';
import { clinicalAiGenerateSchema } from '../schemas';
import { buildClinicalAiPath } from '../constants/clinical-ai';
import {
  buildClinicalAiUserPrompt,
  extractJsonObject,
  hashClinicalAiPrompt,
  parseOwnerInstructionsOutput,
  parsePatientClinicalContext,
  parsePatientSummaryOutput,
  parseSoapAssistOutput,
  truncateClinicalAiText,
} from '../utils/clinical-ai';
import type { ClinicalAiContext } from '../types/clinical-ai';

const context: ClinicalAiContext = {
  patient: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Luna',
    species: 'Canino',
    breed: 'Mestizo',
    sex: 'Hembra',
    birth_date: '2020-01-01',
    is_neutered: true,
    is_deceased: false,
    owner_id: '22222222-2222-2222-2222-222222222222',
    owner_name: 'Ana',
  },
  entries: [
    {
      id: '33333333-3333-3333-3333-333333333333',
      entry_date: '2026-08-01T12:00:00.000Z',
      entry_type: 'consulta',
      title: 'Vómitos',
      anamnesis: 'Vómitos desde ayer',
      physical_exam: 'Abdomen tenso',
      diagnosis: 'Gastroenteritis',
      treatment: 'Dieta blanda',
      plan: 'Control en 48 h',
      weight_kg: 8.2,
      temperature_c: 38.5,
    },
  ],
  vaccinations: [
    {
      vaccine_name: 'Antirrábica',
      administered_at: '2025-08-01',
      next_due_at: '2026-08-01',
    },
  ],
};

describe('clinicalAiGenerateSchema', () => {
  it('accepts a valid generate payload', () => {
    const result = clinicalAiGenerateSchema.safeParse({
      patientId: '11111111-1111-1111-1111-111111111111',
      kind: 'patient_summary',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid kind', () => {
    const result = clinicalAiGenerateSchema.safeParse({
      patientId: '11111111-1111-1111-1111-111111111111',
      kind: 'radiology',
    });
    expect(result.success).toBe(false);
  });
});

describe('extractJsonObject', () => {
  it('parses fenced JSON', () => {
    const parsed = extractJsonObject('```json\n{"summary":"ok"}\n```');
    expect(parsed?.summary).toBe('ok');
  });

  it('returns null for invalid JSON', () => {
    expect(extractJsonObject('no json here')).toBeNull();
  });
});

describe('parseClinicalAiOutput', () => {
  it('parses a patient summary', () => {
    const parsed = parsePatientSummaryOutput({
      summary: 'Canina adulta con gastroenteritis reciente.',
      alerts: ['Control de hidratación'],
      lastDiagnoses: ['Gastroenteritis'],
      pending: ['Refuerzo antirrábica'],
    });
    expect(parsed?.summary).toContain('gastroenteritis');
    expect(parsed?.alerts).toHaveLength(1);
  });

  it('parses SOAP assist with Spanish keys', () => {
    const parsed = parseSoapAssistOutput({
      diagnostico: 'Gastroenteritis aguda',
      diferenciales: ['Cuerpo extraño'],
      tratamiento: 'Dieta blanda y fluidos',
      plan: 'Reevaluar en 48 h',
    });
    expect(parsed?.diagnosis).toBe('Gastroenteritis aguda');
    expect(parsed?.differentials).toEqual(['Cuerpo extraño']);
  });

  it('parses owner instructions', () => {
    const parsed = parseOwnerInstructionsOutput({
      title: 'Cuidados en casa',
      body: 'Dieta blanda 48 h y consultar si vomita de nuevo.',
    });
    expect(parsed?.title).toBe('Cuidados en casa');
  });
});

describe('buildClinicalAiUserPrompt', () => {
  it('includes patient context and JSON instructions', () => {
    const prompt = buildClinicalAiUserPrompt({
      kind: 'soap_assist',
      context,
      snapshot: { anamnesis: 'Vómitos', physicalExam: 'Abdomen tenso' },
    });
    expect(prompt.user).toContain('Luna');
    expect(prompt.user).toContain('diagnosis');
    expect(prompt.system).toContain('JSON');
  });
});

describe('helpers', () => {
  it('hashes prompts stably', () => {
    expect(hashClinicalAiPrompt('hola')).toBe(hashClinicalAiPrompt('hola'));
    expect(hashClinicalAiPrompt('hola')).not.toBe(hashClinicalAiPrompt('chau'));
    expect(hashClinicalAiPrompt('hola').length).toBe(8);
  });

  it('truncates long text', () => {
    expect(truncateClinicalAiText('abc', 10)).toBe('abc');
    expect(truncateClinicalAiText('abcdefghij', 8).endsWith('…')).toBe(true);
  });

  it('parses clinical context payloads', () => {
    const parsed = parsePatientClinicalContext({
      patient: context.patient,
      entries: context.entries,
      vaccinations: context.vaccinations,
    });
    expect(parsed?.patient?.name).toBe('Luna');
    expect(parsed?.entries).toHaveLength(1);
  });

  it('builds a compose path', () => {
    expect(
      buildClinicalAiPath({
        patientId: 'p1',
        kind: 'patient_summary',
      })
    ).toBe('/ia-clinica?patientId=p1&kind=patient_summary');
  });
});
