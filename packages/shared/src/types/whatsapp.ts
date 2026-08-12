import type { WhatsAppRelatedType, WhatsAppTemplateKey } from '../constants/whatsapp';

export interface WhatsAppMessage {
  id: string;
  organization_id: string;
  branch_id: string | null;
  owner_id: string;
  patient_id: string | null;
  related_type: WhatsAppRelatedType;
  related_id: string | null;
  template_key: WhatsAppTemplateKey | string;
  phone_e164: string;
  body: string;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WhatsAppMessageListRow {
  id: string;
  organization_id: string;
  branch_id: string | null;
  owner_id: string;
  patient_id: string | null;
  related_type: WhatsAppRelatedType;
  related_id: string | null;
  template_key: string;
  phone_e164: string;
  body: string;
  sent_by: string | null;
  owner_full_name: string;
  patient_name: string | null;
  sent_by_name: string | null;
  created_at: string;
}

export interface WhatsAppRecipient {
  ownerId: string;
  ownerName: string;
  patientId: string | null;
  patientName: string | null;
  phoneE164: string | null;
  phoneRaw: string | null;
}

export interface WhatsAppLoggedMessage {
  id: string;
  phoneE164: string;
  body: string;
  url: string;
}
