export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | 'owner'
  | 'admin'
  | 'veterinarian'
  | 'nurse'
  | 'receptionist'
  | 'cashier'
  | 'lab_tech'
  | 'readonly';

export type OrgPlan = 'trial' | 'basic' | 'professional' | 'enterprise';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export type FeatureValueType = 'boolean' | 'limit';

export type CommercialPlanKey = 'legacy' | 'trial' | 'basic' | 'pro' | 'premium' | 'enterprise';

export type PatientSpecies =
  | 'Canino'
  | 'Felino'
  | 'Ave'
  | 'Roedor'
  | 'Reptil'
  | 'Equino'
  | 'Bovino'
  | 'Otro';

export type PatientSex = 'Macho' | 'Hembra' | 'Desconocido';

export type AppointmentStatus =
  | 'programada'
  | 'confirmada'
  | 'en_curso'
  | 'completada'
  | 'cancelada'
  | 'ausente';

export type AppointmentType =
  | 'consulta'
  | 'vacunacion'
  | 'cirugia'
  | 'control'
  | 'emergencia'
  | 'otro';

export type ClinicalEntryType =
  | 'consulta'
  | 'cirugia'
  | 'internacion'
  | 'laboratorio'
  | 'vacunacion'
  | 'nota'
  | 'otro';

export type ConsultationStatus = 'en_espera' | 'en_curso' | 'completada' | 'cancelada';

export type HospitalizationStatus = 'internado' | 'observacion' | 'alta' | 'fallecido';

export type HospitalizationNoteType = 'evolucion' | 'tratamiento' | 'vitals' | 'otro';

export type VaccinationRoute = 'sc' | 'im' | 'in' | 'oral' | 'otro';

export type SurgeryStatus =
  | 'programada'
  | 'en_curso'
  | 'recuperacion'
  | 'completada'
  | 'cancelada';

export type SurgeryAsa = 'I' | 'II' | 'III' | 'IV' | 'V';

export type SurgeryAnesthesia = 'general' | 'sedacion' | 'local' | 'epidural' | 'otro';

export type LabOrderStatus = 'solicitada' | 'en_proceso' | 'completada' | 'cancelada';

export type LabPriority = 'rutina' | 'urgente';

export type LabSampleType = 'sangre' | 'orina' | 'materia_fecal' | 'hisopado' | 'otro';

export type LabResultFlag = 'pendiente' | 'normal' | 'alto' | 'bajo' | 'anormal';

export type InventoryProductCategory =
  | 'medicamento'
  | 'vacuna'
  | 'insumo'
  | 'alimento'
  | 'laboratorio'
  | 'otro';

export type InventoryUnit =
  | 'unidad'
  | 'caja'
  | 'frasco'
  | 'ml'
  | 'mg'
  | 'g'
  | 'kg'
  | 'dosis'
  | 'otro';

export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste' | 'descarte';

export type InvoiceStatus = 'borrador' | 'emitida' | 'pagada' | 'anulada';

export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta'
  | 'mercadopago'
  | 'otro';

export type WhatsAppRelatedType =
  | 'none'
  | 'appointment'
  | 'invoice'
  | 'lab_order'
  | 'vaccination'
  | 'portal';

export type ReminderType = 'appointment' | 'vaccination' | 'invoice';

export type ReminderStatus = 'enviado' | 'omitido';

export type ReminderChannel = 'whatsapp' | 'omitido';

export type ClinicalAiKind = 'patient_summary' | 'soap_assist' | 'owner_instructions';

export type PrescriptionStatus = 'activa' | 'dispensada' | 'anulada';

export type PrescriptionRoute =
  | 'oral'
  | 'sc'
  | 'im'
  | 'topico'
  | 'oftalmico'
  | 'otico'
  | 'otro';

export type CashSessionStatus = 'abierta' | 'cerrada';

export type CashMovementKind = 'cobro' | 'ingreso' | 'egreso' | 'retiro';

export type ClinicalImageKind =
  | 'foto'
  | 'radiografia'
  | 'ecografia'
  | 'laboratorio'
  | 'documento'
  | 'otro';

export type NotificationKind =
  | 'cita'
  | 'laboratorio'
  | 'stock'
  | 'internacion'
  | 'factura'
  | 'receta'
  | 'plan';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: OrgPlan;
          settings: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: OrgPlan;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: OrgPlan;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          timezone: string;
          is_active: boolean;
          is_main: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          code: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          is_active?: boolean;
          is_main?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          code?: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          is_active?: boolean;
          is_main?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'branches_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          active_branch_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          organization_id: string;
          full_name: string;
          avatar_url?: string | null;
          phone?: string | null;
          active_branch_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          active_branch_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      branch_members: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          user_id: string;
          role: UserRole;
          permissions: Json | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          user_id: string;
          role?: UserRole;
          permissions?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          user_id?: string;
          role?: UserRole;
          permissions?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'branch_members_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'branch_members_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      owners: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          phone_whatsapp: string | null;
          document_type: 'DNI' | 'CUIT' | 'Pasaporte' | 'Otro';
          document_number: string | null;
          address: string | null;
          city: string | null;
          province: string | null;
          postal_code: string | null;
          notes: string | null;
          is_active: boolean;
          portal_user_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          phone_whatsapp?: string | null;
          document_type?: 'DNI' | 'CUIT' | 'Pasaporte' | 'Otro';
          document_number?: string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          notes?: string | null;
          is_active?: boolean;
          portal_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          phone_whatsapp?: string | null;
          document_type?: 'DNI' | 'CUIT' | 'Pasaporte' | 'Otro';
          document_number?: string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          notes?: string | null;
          is_active?: boolean;
          portal_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'owners_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owners_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      owner_portal_invites: {
        Row: {
          id: string;
          organization_id: string;
          owner_id: string;
          email: string;
          token_hash: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          owner_id: string;
          email: string;
          token_hash: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          owner_id?: string;
          email?: string;
          token_hash?: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'owner_portal_invites_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owner_portal_invites_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      whatsapp_messages: {
        Row: {
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
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          owner_id: string;
          patient_id?: string | null;
          related_type?: WhatsAppRelatedType;
          related_id?: string | null;
          template_key: string;
          phone_e164: string;
          body: string;
          sent_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          owner_id?: string;
          patient_id?: string | null;
          related_type?: WhatsAppRelatedType;
          related_id?: string | null;
          template_key?: string;
          phone_e164?: string;
          body?: string;
          sent_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'whatsapp_messages_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'whatsapp_messages_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      reminder_logs: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          reminder_type: ReminderType;
          related_id: string;
          owner_id: string;
          patient_id: string | null;
          channel: ReminderChannel;
          status: ReminderStatus;
          due_on: string | null;
          whatsapp_message_id: string | null;
          sent_by: string | null;
          sent_at: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          reminder_type: ReminderType;
          related_id: string;
          owner_id: string;
          patient_id?: string | null;
          channel?: ReminderChannel;
          status: ReminderStatus;
          due_on?: string | null;
          whatsapp_message_id?: string | null;
          sent_by?: string | null;
          sent_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          reminder_type?: ReminderType;
          related_id?: string;
          owner_id?: string;
          patient_id?: string | null;
          channel?: ReminderChannel;
          status?: ReminderStatus;
          due_on?: string | null;
          whatsapp_message_id?: string | null;
          sent_by?: string | null;
          sent_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reminder_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reminder_logs_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_suggestions: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          kind: ClinicalAiKind;
          prompt_hash: string;
          input_excerpt: string | null;
          output: Json;
          model: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          patient_id: string;
          owner_id: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          kind: ClinicalAiKind;
          prompt_hash: string;
          input_excerpt?: string | null;
          output?: Json;
          model: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          patient_id?: string;
          owner_id?: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          kind?: ClinicalAiKind;
          prompt_hash?: string;
          input_excerpt?: string | null;
          output?: Json;
          model?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_suggestions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_suggestions_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
        ];
      };
      prescriptions: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          prescribed_by: string | null;
          dispensed_by: string | null;
          voided_by: string | null;
          status: PrescriptionStatus;
          number: string | null;
          notes: string | null;
          void_reason: string | null;
          prescribed_at: string;
          dispensed_at: string | null;
          voided_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          prescribed_by?: string | null;
          dispensed_by?: string | null;
          voided_by?: string | null;
          status?: PrescriptionStatus;
          number?: string | null;
          notes?: string | null;
          void_reason?: string | null;
          prescribed_at?: string;
          dispensed_at?: string | null;
          voided_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          prescribed_by?: string | null;
          dispensed_by?: string | null;
          voided_by?: string | null;
          status?: PrescriptionStatus;
          number?: string | null;
          notes?: string | null;
          void_reason?: string | null;
          prescribed_at?: string;
          dispensed_at?: string | null;
          voided_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'prescriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prescriptions_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
        ];
      };
      prescription_items: {
        Row: {
          id: string;
          organization_id: string;
          prescription_id: string;
          inventory_product_id: string | null;
          medication_name: string;
          dose: string;
          frequency: string;
          duration: string | null;
          route: PrescriptionRoute;
          quantity: number;
          instructions: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          prescription_id: string;
          inventory_product_id?: string | null;
          medication_name: string;
          dose: string;
          frequency: string;
          duration?: string | null;
          route?: PrescriptionRoute;
          quantity?: number;
          instructions?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          prescription_id?: string;
          inventory_product_id?: string | null;
          medication_name?: string;
          dose?: string;
          frequency?: string;
          duration?: string | null;
          route?: PrescriptionRoute;
          quantity?: number;
          instructions?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'prescription_items_prescription_id_fkey';
            columns: ['prescription_id'];
            isOneToOne: false;
            referencedRelation: 'prescriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_sessions: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          opened_by: string | null;
          closed_by: string | null;
          status: CashSessionStatus;
          opening_amount: number;
          expected_cash: number | null;
          counted_cash: number | null;
          difference: number | null;
          notes: string | null;
          close_notes: string | null;
          opened_at: string;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          opened_by?: string | null;
          closed_by?: string | null;
          status?: CashSessionStatus;
          opening_amount?: number;
          expected_cash?: number | null;
          counted_cash?: number | null;
          difference?: number | null;
          notes?: string | null;
          close_notes?: string | null;
          opened_at?: string;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          opened_by?: string | null;
          closed_by?: string | null;
          status?: CashSessionStatus;
          opening_amount?: number;
          expected_cash?: number | null;
          counted_cash?: number | null;
          difference?: number | null;
          notes?: string | null;
          close_notes?: string | null;
          opened_at?: string;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_sessions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_movements: {
        Row: {
          id: string;
          organization_id: string;
          cash_session_id: string;
          payment_id: string | null;
          recorded_by: string | null;
          kind: CashMovementKind;
          method: PaymentMethod;
          amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          cash_session_id: string;
          payment_id?: string | null;
          recorded_by?: string | null;
          kind: CashMovementKind;
          method?: PaymentMethod;
          amount: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          cash_session_id?: string;
          payment_id?: string | null;
          recorded_by?: string | null;
          kind?: CashMovementKind;
          method?: PaymentMethod;
          amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_movements_cash_session_id_fkey';
            columns: ['cash_session_id'];
            isOneToOne: false;
            referencedRelation: 'cash_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      clinical_images: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          uploaded_by: string | null;
          kind: ClinicalImageKind;
          title: string | null;
          notes: string | null;
          storage_path: string;
          mime_type: string;
          file_size: number;
          original_name: string | null;
          taken_at: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          patient_id: string;
          owner_id: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          uploaded_by?: string | null;
          kind?: ClinicalImageKind;
          title?: string | null;
          notes?: string | null;
          storage_path: string;
          mime_type: string;
          file_size: number;
          original_name?: string | null;
          taken_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          patient_id?: string;
          owner_id?: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          uploaded_by?: string | null;
          kind?: ClinicalImageKind;
          title?: string | null;
          notes?: string | null;
          storage_path?: string;
          mime_type?: string;
          file_size?: number;
          original_name?: string | null;
          taken_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clinical_images_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clinical_images_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          kind: NotificationKind;
          title: string;
          body: string | null;
          href: string;
          related_type: string | null;
          related_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          kind: NotificationKind;
          title: string;
          body?: string | null;
          href: string;
          related_type?: string | null;
          related_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          kind?: NotificationKind;
          title?: string;
          body?: string | null;
          href?: string;
          related_type?: string | null;
          related_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_reads: {
        Row: {
          notification_id: string;
          user_id: string;
          read_at: string;
        };
        Insert: {
          notification_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: {
          notification_id?: string;
          user_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_reads_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
        ];
      };
      patients: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          owner_id: string;
          name: string;
          species: PatientSpecies;
          breed: string | null;
          sex: PatientSex;
          birth_date: string | null;
          color: string | null;
          microchip: string | null;
          is_neutered: boolean;
          is_deceased: boolean;
          deceased_at: string | null;
          notes: string | null;
          photo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          owner_id: string;
          name: string;
          species?: PatientSpecies;
          breed?: string | null;
          sex?: PatientSex;
          birth_date?: string | null;
          color?: string | null;
          microchip?: string | null;
          is_neutered?: boolean;
          is_deceased?: boolean;
          deceased_at?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          owner_id?: string;
          name?: string;
          species?: PatientSpecies;
          breed?: string | null;
          sex?: PatientSex;
          birth_date?: string | null;
          color?: string | null;
          microchip?: string | null;
          is_neutered?: boolean;
          is_deceased?: boolean;
          deceased_at?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'patients_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patients_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patients_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          assigned_user_id: string | null;
          starts_at: string;
          ends_at: string;
          status: AppointmentStatus;
          appointment_type: AppointmentType;
          title: string | null;
          notes: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          assigned_user_id?: string | null;
          starts_at: string;
          ends_at: string;
          status?: AppointmentStatus;
          appointment_type?: AppointmentType;
          title?: string | null;
          notes?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          assigned_user_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: AppointmentStatus;
          appointment_type?: AppointmentType;
          title?: string | null;
          notes?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      clinical_entries: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id: string | null;
          recorded_by: string | null;
          entry_date: string;
          entry_type: ClinicalEntryType;
          title: string | null;
          anamnesis: string | null;
          physical_exam: string | null;
          diagnosis: string | null;
          treatment: string | null;
          plan: string | null;
          weight_kg: number | null;
          temperature_c: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id?: string | null;
          recorded_by?: string | null;
          entry_date?: string;
          entry_type?: ClinicalEntryType;
          title?: string | null;
          anamnesis?: string | null;
          physical_exam?: string | null;
          diagnosis?: string | null;
          treatment?: string | null;
          plan?: string | null;
          weight_kg?: number | null;
          temperature_c?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          appointment_id?: string | null;
          recorded_by?: string | null;
          entry_date?: string;
          entry_type?: ClinicalEntryType;
          title?: string | null;
          anamnesis?: string | null;
          physical_exam?: string | null;
          diagnosis?: string | null;
          treatment?: string | null;
          plan?: string | null;
          weight_kg?: number | null;
          temperature_c?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clinical_entries_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clinical_entries_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clinical_entries_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clinical_entries_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clinical_entries_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
        ];
      };
      consultations: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          status: ConsultationStatus;
          started_at: string;
          completed_at: string | null;
          title: string | null;
          anamnesis: string | null;
          physical_exam: string | null;
          diagnosis: string | null;
          treatment: string | null;
          plan: string | null;
          weight_kg: number | null;
          temperature_c: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id?: string | null;
          clinical_entry_id?: string | null;
          veterinarian_id?: string | null;
          status?: ConsultationStatus;
          started_at?: string;
          completed_at?: string | null;
          title?: string | null;
          anamnesis?: string | null;
          physical_exam?: string | null;
          diagnosis?: string | null;
          treatment?: string | null;
          plan?: string | null;
          weight_kg?: number | null;
          temperature_c?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          appointment_id?: string | null;
          clinical_entry_id?: string | null;
          veterinarian_id?: string | null;
          status?: ConsultationStatus;
          started_at?: string;
          completed_at?: string | null;
          title?: string | null;
          anamnesis?: string | null;
          physical_exam?: string | null;
          diagnosis?: string | null;
          treatment?: string | null;
          plan?: string | null;
          weight_kg?: number | null;
          temperature_c?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'consultations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'consultations_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'consultations_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'consultations_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'consultations_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'consultations_clinical_entry_id_fkey';
            columns: ['clinical_entry_id'];
            isOneToOne: false;
            referencedRelation: 'clinical_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      hospitalizations: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          status: HospitalizationStatus;
          admitted_at: string;
          discharged_at: string | null;
          cage: string | null;
          reason: string;
          diagnosis: string | null;
          treatment_plan: string | null;
          discharge_summary: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          veterinarian_id?: string | null;
          status?: HospitalizationStatus;
          admitted_at?: string;
          discharged_at?: string | null;
          cage?: string | null;
          reason: string;
          diagnosis?: string | null;
          treatment_plan?: string | null;
          discharge_summary?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          veterinarian_id?: string | null;
          status?: HospitalizationStatus;
          admitted_at?: string;
          discharged_at?: string | null;
          cage?: string | null;
          reason?: string;
          diagnosis?: string | null;
          treatment_plan?: string | null;
          discharge_summary?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hospitalizations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hospitalizations_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hospitalizations_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hospitalizations_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hospitalizations_consultation_id_fkey';
            columns: ['consultation_id'];
            isOneToOne: false;
            referencedRelation: 'consultations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hospitalizations_clinical_entry_id_fkey';
            columns: ['clinical_entry_id'];
            isOneToOne: false;
            referencedRelation: 'clinical_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      hospitalization_notes: {
        Row: {
          id: string;
          organization_id: string;
          hospitalization_id: string;
          recorded_by: string | null;
          recorded_at: string;
          note_type: HospitalizationNoteType;
          content: string;
          weight_kg: number | null;
          temperature_c: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          hospitalization_id: string;
          recorded_by?: string | null;
          recorded_at?: string;
          note_type?: HospitalizationNoteType;
          content: string;
          weight_kg?: number | null;
          temperature_c?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          hospitalization_id?: string;
          recorded_by?: string | null;
          recorded_at?: string;
          note_type?: HospitalizationNoteType;
          content?: string;
          weight_kg?: number | null;
          temperature_c?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hospitalization_notes_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hospitalization_notes_hospitalization_id_fkey';
            columns: ['hospitalization_id'];
            isOneToOne: false;
            referencedRelation: 'hospitalizations';
            referencedColumns: ['id'];
          },
        ];
      };
      vaccinations: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          vaccine_name: string;
          manufacturer: string | null;
          lot_number: string | null;
          administered_at: string;
          next_due_at: string | null;
          route: VaccinationRoute | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          veterinarian_id?: string | null;
          vaccine_name: string;
          manufacturer?: string | null;
          lot_number?: string | null;
          administered_at?: string;
          next_due_at?: string | null;
          route?: VaccinationRoute | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          veterinarian_id?: string | null;
          vaccine_name?: string;
          manufacturer?: string | null;
          lot_number?: string | null;
          administered_at?: string;
          next_due_at?: string | null;
          route?: VaccinationRoute | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vaccinations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vaccinations_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vaccinations_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vaccinations_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vaccinations_consultation_id_fkey';
            columns: ['consultation_id'];
            isOneToOne: false;
            referencedRelation: 'consultations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vaccinations_clinical_entry_id_fkey';
            columns: ['clinical_entry_id'];
            isOneToOne: false;
            referencedRelation: 'clinical_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      surgeries: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id: string | null;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          surgeon_id: string | null;
          status: SurgeryStatus;
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          procedure_name: string;
          diagnosis: string | null;
          anesthesia: SurgeryAnesthesia | null;
          asa: SurgeryAsa | null;
          preop_notes: string | null;
          intraop_notes: string | null;
          postop_notes: string | null;
          complications: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id?: string | null;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          surgeon_id?: string | null;
          status?: SurgeryStatus;
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          procedure_name: string;
          diagnosis?: string | null;
          anesthesia?: SurgeryAnesthesia | null;
          asa?: SurgeryAsa | null;
          preop_notes?: string | null;
          intraop_notes?: string | null;
          postop_notes?: string | null;
          complications?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          appointment_id?: string | null;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          surgeon_id?: string | null;
          status?: SurgeryStatus;
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          procedure_name?: string;
          diagnosis?: string | null;
          anesthesia?: SurgeryAnesthesia | null;
          asa?: SurgeryAsa | null;
          preop_notes?: string | null;
          intraop_notes?: string | null;
          postop_notes?: string | null;
          complications?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'surgeries_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'surgeries_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'surgeries_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'surgeries_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'surgeries_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'surgeries_consultation_id_fkey';
            columns: ['consultation_id'];
            isOneToOne: false;
            referencedRelation: 'consultations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'surgeries_clinical_entry_id_fkey';
            columns: ['clinical_entry_id'];
            isOneToOne: false;
            referencedRelation: 'clinical_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      lab_orders: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          ordered_by: string | null;
          completed_by: string | null;
          status: LabOrderStatus;
          priority: LabPriority;
          sample_type: LabSampleType | null;
          title: string;
          ordered_at: string;
          collected_at: string | null;
          completed_at: string | null;
          interpretation: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          ordered_by?: string | null;
          completed_by?: string | null;
          status?: LabOrderStatus;
          priority?: LabPriority;
          sample_type?: LabSampleType | null;
          title: string;
          ordered_at?: string;
          collected_at?: string | null;
          completed_at?: string | null;
          interpretation?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          patient_id?: string;
          owner_id?: string;
          consultation_id?: string | null;
          clinical_entry_id?: string | null;
          ordered_by?: string | null;
          completed_by?: string | null;
          status?: LabOrderStatus;
          priority?: LabPriority;
          sample_type?: LabSampleType | null;
          title?: string;
          ordered_at?: string;
          collected_at?: string | null;
          completed_at?: string | null;
          interpretation?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lab_orders_organization_id_fkey',
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_orders_branch_id_fkey',
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_orders_patient_id_fkey',
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_orders_owner_id_fkey',
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_orders_consultation_id_fkey',
            columns: ['consultation_id'];
            isOneToOne: false;
            referencedRelation: 'consultations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_orders_clinical_entry_id_fkey',
            columns: ['clinical_entry_id'];
            isOneToOne: false;
            referencedRelation: 'clinical_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      lab_order_items: {
        Row: {
          id: string;
          organization_id: string;
          lab_order_id: string;
          test_name: string;
          result_value: string | null;
          unit: string | null;
          reference_range: string | null;
          flag: LabResultFlag;
          sort_order: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          lab_order_id: string;
          test_name: string;
          result_value?: string | null;
          unit?: string | null;
          reference_range?: string | null;
          flag?: LabResultFlag;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          lab_order_id?: string;
          test_name?: string;
          result_value?: string | null;
          unit?: string | null;
          reference_range?: string | null;
          flag?: LabResultFlag;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lab_order_items_organization_id_fkey',
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lab_order_items_lab_order_id_fkey',
            columns: ['lab_order_id'];
            isOneToOne: false;
            referencedRelation: 'lab_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_products: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          name: string;
          sku: string | null;
          category: InventoryProductCategory;
          unit: InventoryUnit;
          quantity: number;
          min_quantity: number;
          unit_cost: number | null;
          unit_price: number | null;
          manufacturer: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          name: string;
          sku?: string | null;
          category?: InventoryProductCategory;
          unit?: InventoryUnit;
          quantity?: number;
          min_quantity?: number;
          unit_cost?: number | null;
          unit_price?: number | null;
          manufacturer?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          name?: string;
          sku?: string | null;
          category?: InventoryProductCategory;
          unit?: InventoryUnit;
          quantity?: number;
          min_quantity?: number;
          unit_cost?: number | null;
          unit_price?: number | null;
          manufacturer?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_products_organization_id_fkey',
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_products_branch_id_fkey',
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_movements: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          product_id: string;
          movement_type: InventoryMovementType;
          quantity: number;
          quantity_before: number;
          quantity_after: number;
          lot_number: string | null;
          expires_at: string | null;
          reason: string | null;
          performed_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          product_id: string;
          movement_type: InventoryMovementType;
          quantity: number;
          quantity_before: number;
          quantity_after: number;
          lot_number?: string | null;
          expires_at?: string | null;
          reason?: string | null;
          performed_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          product_id?: string;
          movement_type?: InventoryMovementType;
          quantity?: number;
          quantity_before?: number;
          quantity_after?: number;
          lot_number?: string | null;
          expires_at?: string | null;
          reason?: string | null;
          performed_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_organization_id_fkey',
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_movements_branch_id_fkey',
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_movements_product_id_fkey',
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_products';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          owner_id: string;
          patient_id: string | null;
          consultation_id: string | null;
          created_by: string | null;
          issued_by: string | null;
          status: InvoiceStatus;
          number: string | null;
          currency: string;
          issued_at: string | null;
          due_at: string | null;
          paid_at: string | null;
          voided_at: string | null;
          subtotal: number;
          tax_amount: number;
          total: number;
          paid_amount: number;
          balance: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          owner_id: string;
          patient_id?: string | null;
          consultation_id?: string | null;
          created_by?: string | null;
          issued_by?: string | null;
          status?: InvoiceStatus;
          number?: string | null;
          currency?: string;
          issued_at?: string | null;
          due_at?: string | null;
          paid_at?: string | null;
          voided_at?: string | null;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          paid_amount?: number;
          balance?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          owner_id?: string;
          patient_id?: string | null;
          consultation_id?: string | null;
          created_by?: string | null;
          issued_by?: string | null;
          status?: InvoiceStatus;
          number?: string | null;
          currency?: string;
          issued_at?: string | null;
          due_at?: string | null;
          paid_at?: string | null;
          voided_at?: string | null;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          paid_amount?: number;
          balance?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_organization_id_fkey',
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_branch_id_fkey',
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_owner_id_fkey',
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_patient_id_fkey',
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_consultation_id_fkey',
            columns: ['consultation_id'];
            isOneToOne: false;
            referencedRelation: 'consultations';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_items: {
        Row: {
          id: string;
          organization_id: string;
          invoice_id: string;
          inventory_product_id: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          invoice_id: string;
          inventory_product_id?: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          invoice_id?: string;
          inventory_product_id?: string | null;
          description?: string;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_items_organization_id_fkey',
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey',
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_inventory_product_id_fkey',
            columns: ['inventory_product_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_products';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          invoice_id: string;
          recorded_by: string | null;
          method: PaymentMethod;
          amount: number;
          paid_at: string;
          reference: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          invoice_id: string;
          recorded_by?: string | null;
          method?: PaymentMethod;
          amount: number;
          paid_at?: string;
          reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          invoice_id?: string;
          recorded_by?: string | null;
          method?: PaymentMethod;
          amount?: number;
          paid_at?: string;
          reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_organization_id_fkey',
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_invoice_id_fkey',
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string;
          email: string;
          role: UserRole;
          invited_by: string | null;
          status: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id: string;
          email: string;
          role?: UserRole;
          invited_by?: string | null;
          status?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string;
          email?: string;
          role?: UserRole;
          invited_by?: string | null;
          status?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_invitations_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branches';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          branch_id?: string | null;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          branch_id?: string | null;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          is_active: boolean;
          is_public: boolean;
          is_internal: boolean;
          display_order: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          is_public?: boolean;
          is_internal?: boolean;
          display_order?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          is_public?: boolean;
          is_internal?: boolean;
          display_order?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      features: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          feature_type: FeatureValueType;
          default_enabled: boolean;
          default_limit: number | null;
          is_active: boolean;
          usage_metered: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description?: string | null;
          feature_type?: FeatureValueType;
          default_enabled?: boolean;
          default_limit?: number | null;
          is_active?: boolean;
          usage_metered?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          description?: string | null;
          feature_type?: FeatureValueType;
          default_enabled?: boolean;
          default_limit?: number | null;
          is_active?: boolean;
          usage_metered?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_features: {
        Row: {
          id: string;
          plan_id: string;
          feature_id: string;
          enabled: boolean;
          limit_value: number | null;
          value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          feature_id: string;
          enabled?: boolean;
          limit_value?: number | null;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          feature_id?: string;
          enabled?: boolean;
          limit_value?: number | null;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_features_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_features_feature_id_fkey';
            columns: ['feature_id'];
            isOneToOne: false;
            referencedRelation: 'features';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          starts_at: string;
          ends_at: string | null;
          trial_ends_at: string | null;
          cancelled_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          starts_at?: string;
          ends_at?: string | null;
          trial_ends_at?: string | null;
          cancelled_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          starts_at?: string;
          ends_at?: string | null;
          trial_ends_at?: string | null;
          cancelled_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_subscriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_subscriptions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_feature_overrides: {
        Row: {
          id: string;
          organization_id: string;
          feature_id: string;
          enabled: boolean | null;
          limit_value: number | null;
          value: Json;
          reason: string | null;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          feature_id: string;
          enabled?: boolean | null;
          limit_value?: number | null;
          value?: Json;
          reason?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          feature_id?: string;
          enabled?: boolean | null;
          limit_value?: number | null;
          value?: Json;
          reason?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_feature_overrides_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_feature_overrides_feature_id_fkey';
            columns: ['feature_id'];
            isOneToOne: false;
            referencedRelation: 'features';
            referencedColumns: ['id'];
          },
        ];
      };
      addons: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          is_active: boolean;
          is_public: boolean;
          display_order: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          is_public?: boolean;
          display_order?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          is_public?: boolean;
          display_order?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      addon_features: {
        Row: {
          id: string;
          addon_id: string;
          feature_id: string;
          enabled: boolean;
          limit_value: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          addon_id: string;
          feature_id: string;
          enabled?: boolean;
          limit_value?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          addon_id?: string;
          feature_id?: string;
          enabled?: boolean;
          limit_value?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'addon_features_addon_id_fkey';
            columns: ['addon_id'];
            isOneToOne: false;
            referencedRelation: 'addons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'addon_features_feature_id_fkey';
            columns: ['feature_id'];
            isOneToOne: false;
            referencedRelation: 'features';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_addons: {
        Row: {
          id: string;
          organization_id: string;
          addon_id: string;
          status: SubscriptionStatus;
          starts_at: string;
          ends_at: string | null;
          cancelled_at: string | null;
          reason: string | null;
          granted_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          addon_id: string;
          status?: SubscriptionStatus;
          starts_at?: string;
          ends_at?: string | null;
          cancelled_at?: string | null;
          reason?: string | null;
          granted_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          addon_id?: string;
          status?: SubscriptionStatus;
          starts_at?: string;
          ends_at?: string | null;
          cancelled_at?: string | null;
          reason?: string | null;
          granted_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_addons_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_addons_addon_id_fkey';
            columns: ['addon_id'];
            isOneToOne: false;
            referencedRelation: 'addons';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_usage: {
        Row: {
          id: string;
          organization_id: string;
          feature_id: string;
          period_start: string;
          period_end: string;
          usage_count: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          feature_id: string;
          period_start: string;
          period_end: string;
          usage_count?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          feature_id?: string;
          period_start?: string;
          period_end?: string;
          usage_count?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feature_usage_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feature_usage_feature_id_fkey';
            columns: ['feature_id'];
            isOneToOne: false;
            referencedRelation: 'features';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_admins: {
        Row: {
          user_id: string;
          email: string;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email?: string;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_plan_recommendations: {
        Row: {
          organization_id: string;
          status: string;
          current_plan_key: string | null;
          recommended_plan_key: string | null;
          severity: string;
          score: number;
          usage_level: number;
          reasons: Json;
          fingerprint: string | null;
          max_usage_ratio_at_dismiss: number | null;
          recommended_at: string | null;
          reviewed_at: string | null;
          dismissed_at: string | null;
          accepted_at: string | null;
          reviewed_by: string | null;
          dismissed_by: string | null;
          accepted_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          clinic_dismissed_at: string | null;
          clinic_dismissed_fingerprint: string | null;
          clinic_dismissed_by: string | null;
          commercial_note: string | null;
          commercial_note_updated_at: string | null;
          commercial_note_updated_by: string | null;
          last_refreshed_at: string | null;
          follow_up_at: string | null;
          follow_up_by: string | null;
          follow_up_set_at: string | null;
          follow_up_set_by: string | null;
        };
        Insert: {
          organization_id: string;
          status?: string;
          current_plan_key?: string | null;
          recommended_plan_key?: string | null;
          severity?: string;
          score?: number;
          usage_level?: number;
          reasons?: Json;
          fingerprint?: string | null;
          max_usage_ratio_at_dismiss?: number | null;
          recommended_at?: string | null;
          reviewed_at?: string | null;
          dismissed_at?: string | null;
          accepted_at?: string | null;
          reviewed_by?: string | null;
          dismissed_by?: string | null;
          accepted_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          clinic_dismissed_at?: string | null;
          clinic_dismissed_fingerprint?: string | null;
          clinic_dismissed_by?: string | null;
          commercial_note?: string | null;
          commercial_note_updated_at?: string | null;
          commercial_note_updated_by?: string | null;
          last_refreshed_at?: string | null;
          follow_up_at?: string | null;
          follow_up_by?: string | null;
          follow_up_set_at?: string | null;
          follow_up_set_by?: string | null;
        };
        Update: {
          organization_id?: string;
          status?: string;
          current_plan_key?: string | null;
          recommended_plan_key?: string | null;
          severity?: string;
          score?: number;
          usage_level?: number;
          reasons?: Json;
          fingerprint?: string | null;
          max_usage_ratio_at_dismiss?: number | null;
          recommended_at?: string | null;
          reviewed_at?: string | null;
          dismissed_at?: string | null;
          accepted_at?: string | null;
          reviewed_by?: string | null;
          dismissed_by?: string | null;
          accepted_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          clinic_dismissed_at?: string | null;
          clinic_dismissed_fingerprint?: string | null;
          clinic_dismissed_by?: string | null;
          commercial_note?: string | null;
          commercial_note_updated_at?: string | null;
          commercial_note_updated_by?: string | null;
          last_refreshed_at?: string | null;
          follow_up_at?: string | null;
          follow_up_by?: string | null;
          follow_up_set_at?: string | null;
          follow_up_set_by?: string | null;
        };
        Relationships: [];
      };
      organization_plan_recommendation_events: {
        Row: {
          id: string;
          organization_id: string;
          event_type: string;
          actor_kind: string;
          actor_user_id: string | null;
          current_plan_key: string | null;
          recommended_plan_key: string | null;
          severity: string | null;
          score: number | null;
          usage_level: number | null;
          reasons: Json;
          fingerprint: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          event_type: string;
          actor_kind?: string;
          actor_user_id?: string | null;
          current_plan_key?: string | null;
          recommended_plan_key?: string | null;
          severity?: string | null;
          score?: number | null;
          usage_level?: number | null;
          reasons?: Json;
          fingerprint?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          event_type?: string;
          actor_kind?: string;
          actor_user_id?: string | null;
          current_plan_key?: string | null;
          recommended_plan_key?: string | null;
          severity?: string | null;
          score?: number | null;
          usage_level?: number | null;
          reasons?: Json;
          fingerprint?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      commercial_feature_signals: {
        Row: {
          id: string;
          organization_id: string;
          feature_key: string;
          event_type: string;
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          organization_id: string;
          feature_key: string;
          event_type?: string;
          created_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          organization_id?: string;
          feature_key?: string;
          event_type?: string;
          created_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          organization_id: string;
          provider: string;
          customer_id: string;
          email: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          provider: string;
          customer_id: string;
          email?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          provider?: string;
          customer_id?: string;
          email?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          event_type: string | null;
          organization_id: string | null;
          payload: Json;
          processed_at: string;
          applied_at: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          event_id: string;
          event_type?: string | null;
          organization_id?: string | null;
          payload?: Json;
          processed_at?: string;
          applied_at?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          event_id?: string;
          event_type?: string | null;
          organization_id?: string | null;
          payload?: Json;
          processed_at?: string;
          applied_at?: string | null;
        };
        Relationships: [];
      };
      billing_checkout_intents: {
        Row: {
          id: string;
          organization_id: string;
          kind: string;
          target_key: string;
          billing_interval: string;
          provider: string;
          checkout_url: string | null;
          created_at: string;
          expires_at: string;
          consumed_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: string;
          target_key: string;
          billing_interval: string;
          provider: string;
          checkout_url?: string | null;
          created_at?: string;
          expires_at: string;
          consumed_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          kind?: string;
          target_key?: string;
          billing_interval?: string;
          provider?: string;
          checkout_url?: string | null;
          created_at?: string;
          expires_at?: string;
          consumed_at?: string | null;
          cancelled_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_organization_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      has_permission: {
        Args: { required_permission: string };
        Returns: boolean;
      };
      increment_feature_usage: {
        Args: {
          p_feature_key: string;
          p_amount?: number;
        };
        Returns: number;
      };
      try_consume_feature_usage: {
        Args: {
          p_feature_key: string;
          p_amount: number;
          p_limit: number | null;
        };
        Returns: number | null;
      };
      is_platform_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      require_platform_admin: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      superadmin_list_organizations: {
        Args: {
          p_search?: string | null;
          p_page?: number;
          p_page_size?: number;
          p_plan_key?: string | null;
          p_status?: string | null;
        };
        Returns: {
          id: string;
          name: string;
          slug: string;
          plan_key: string | null;
          plan_name: string | null;
          status: SubscriptionStatus | null;
          trial_ends_at: string | null;
          starts_at: string | null;
          created_at: string;
          total_count: number;
        }[];
      };
      superadmin_list_orgs_recommendation_inputs: {
        Args: {
          p_search?: string | null;
          p_page?: number;
          p_page_size?: number;
          p_plan_key?: string | null;
          p_status?: string | null;
          p_recommended_plan?: string | null;
          p_upgrade_filter?: string | null;
          p_sort?: string | null;
          p_organization_id?: string | null;
        };
        Returns: {
          id: string;
          name: string;
          slug: string;
          plan_key: string | null;
          plan_name: string | null;
          status: SubscriptionStatus | null;
          trial_ends_at: string | null;
          starts_at: string | null;
          created_at: string;
          owner_name: string | null;
          users_used: number;
          branches_used: number;
          professionals_used: number;
          patients_used: number;
          ai_used: number;
          whatsapp_used: number;
          storage_used: number;
          has_hospitalization: boolean;
          has_surgery: boolean;
          has_laboratory: boolean;
          has_inventory: boolean;
          has_pharmacy: boolean;
          has_billing: boolean;
          has_cash: boolean;
          has_portal: boolean;
          has_reports: boolean;
          has_ai: boolean;
          has_whatsapp: boolean;
          has_images: boolean;
          has_advanced_reports: boolean;
          access_attempt_features: string[] | null;
          rec_status: string | null;
          rec_recommended_plan_key: string | null;
          rec_fingerprint: string | null;
          rec_dismissed_at: string | null;
          rec_max_usage_ratio_at_dismiss: number | null;
          total_count: number;
        }[];
      };
      superadmin_plan_catalog_matrix: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      superadmin_upsert_plan_recommendation: {
        Args: {
          p_organization_id: string;
          p_status: string;
          p_current_plan_key?: string | null;
          p_recommended_plan_key?: string | null;
          p_severity?: string;
          p_score?: number;
          p_usage_level?: number;
          p_reasons?: Json;
          p_fingerprint?: string | null;
          p_max_usage_ratio_at_dismiss?: number | null;
        };
        Returns: Json;
      };
      record_commercial_feature_signal: {
        Args: {
          p_feature_key: string;
          p_event_type?: string;
        };
        Returns: string;
      };
      list_own_plan_recommendation_notice: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      dismiss_own_plan_recommendation_notice: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      superadmin_recommendation_summary: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      superadmin_list_plan_recommendation_events: {
        Args: {
          p_organization_id: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          event_type: string;
          actor_kind: string;
          actor_user_id: string | null;
          current_plan_key: string | null;
          recommended_plan_key: string | null;
          severity: string | null;
          score: number | null;
          usage_level: number | null;
          reasons: Json;
          fingerprint: string | null;
          note: string | null;
          created_at: string;
        }[];
      };
      superadmin_clear_idle_plan_recommendation: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      superadmin_set_plan_recommendation_note: {
        Args: {
          p_organization_id: string;
          p_note?: string | null;
        };
        Returns: Json;
      };
      superadmin_get_plan_recommendation_note: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      superadmin_touch_plan_recommendation_refresh: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      superadmin_set_plan_recommendation_follow_up: {
        Args: {
          p_organization_id: string;
          p_follow_up_at?: string | null;
        };
        Returns: Json;
      };
      superadmin_list_recommendation_follow_ups: {
        Args: { p_limit?: number };
        Returns: {
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          current_plan_key: string | null;
          recommended_plan_key: string | null;
          status: string;
          severity: string;
          usage_level: number;
          follow_up_at: string;
          commercial_note: string | null;
        }[];
      };
      superadmin_get_org_commercial: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      superadmin_change_plan: {
        Args: {
          p_organization_id: string;
          p_plan_key: string;
          p_reason?: string | null;
          p_allow_legacy?: boolean;
          p_trial_days?: number | null;
        };
        Returns: Json;
      };
      superadmin_start_trial: {
        Args: {
          p_organization_id: string;
          p_trial_days?: number | null;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      superadmin_end_trial: {
        Args: {
          p_organization_id: string;
          p_plan_key?: string | null;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      superadmin_set_feature_override: {
        Args: {
          p_organization_id: string;
          p_feature_key: string;
          p_enabled?: boolean;
          p_limit_value?: number | null;
          p_reason?: string | null;
          p_starts_at?: string | null;
          p_ends_at?: string | null;
        };
        Returns: Json;
      };
      superadmin_clear_feature_override: {
        Args: {
          p_organization_id: string;
          p_feature_key: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      superadmin_grant_addon: {
        Args: {
          p_organization_id: string;
          p_addon_key: string;
          p_reason?: string | null;
          p_starts_at?: string | null;
          p_ends_at?: string | null;
        };
        Returns: Json;
      };
      superadmin_revoke_addon: {
        Args: {
          p_organization_id: string;
          p_addon_key: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      list_own_addons: {
        Args: Record<PropertyKey, never>;
        Returns: {
          addon_key: string;
          addon_name: string;
          description: string | null;
          status: SubscriptionStatus;
          starts_at: string;
          ends_at: string | null;
        }[];
      };
      list_own_addon_features: {
        Args: Record<PropertyKey, never>;
        Returns: {
          feature_key: string;
          enabled: boolean;
          limit_value: number | null;
        }[];
      };
      list_public_plans: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_public_addons: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_own_seat_usage: {
        Args: Record<PropertyKey, never>;
        Returns: {
          feature_key: string;
          used: number;
        }[];
      };
      list_public_plan_limits: {
        Args: {
          p_plan_key: string;
        };
        Returns: {
          feature_key: string;
          enabled: boolean;
          limit_value: number | null;
        }[];
      };
      organization_seat_usage: {
        Args: {
          p_organization_id: string;
        };
        Returns: {
          feature_key: string;
          used: number;
        }[];
      };
      organization_metered_overages: {
        Args: {
          p_organization_id: string;
        };
        Returns: {
          feature_key: string;
          used: number;
          limit_value: number;
        }[];
      };
      superadmin_list_org_seat_usage: {
        Args: {
          p_organization_id: string;
        };
        Returns: {
          feature_key: string;
          used: number;
        }[];
      };
      list_plan_seat_limits: {
        Args: {
          p_plan_key: string;
        };
        Returns: {
          feature_key: string;
          enabled: boolean;
          limit_value: number | null;
        }[];
      };
      billing_apply_paid_plan: {
        Args: {
          p_organization_id: string;
          p_plan_key: string;
          p_provider: string;
          p_external_id: string;
          p_interval?: string;
          p_status?: SubscriptionStatus;
        };
        Returns: Json;
      };
      billing_apply_paid_addon: {
        Args: {
          p_organization_id: string;
          p_addon_key: string;
          p_provider: string;
          p_external_id: string;
          p_interval?: string;
        };
        Returns: Json;
      };
      billing_extend_paid_plan: {
        Args: {
          p_organization_id: string;
          p_interval?: string;
          p_provider?: string | null;
          p_external_id?: string | null;
        };
        Returns: Json;
      };
      billing_begin_event: {
        Args: {
          p_provider: string;
          p_event_id: string;
          p_event_type?: string | null;
          p_organization_id?: string | null;
          p_payload?: Json;
        };
        Returns: Json;
      };
      billing_finish_event: {
        Args: {
          p_event_row_id: string;
        };
        Returns: Json;
      };
      superadmin_pending_billing_events: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      billing_set_subscription_status: {
        Args: {
          p_organization_id: string;
          p_status: SubscriptionStatus;
          p_provider?: string | null;
          p_external_id?: string | null;
        };
        Returns: Json;
      };
      expire_due_subscriptions: {
        Args: {
          p_organization_id?: string | null;
        };
        Returns: number;
      };
      emit_plan_notification: {
        Args: {
          p_organization_id: string;
          p_related_type: string;
          p_related_id?: string | null;
          p_title: string;
          p_body?: string | null;
          p_dedupe_hours?: number;
        };
        Returns: string;
      };
      run_commercial_lifecycle: {
        Args: {
          p_trial_remind_days?: number;
          p_quota_warn_ratio?: number;
          p_dedupe_hours?: number;
        };
        Returns: Json;
      };
      billing_cancel_own_subscription: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      billing_cancel_own_addon: {
        Args: {
          p_addon_key: string;
        };
        Returns: Json;
      };
      superadmin_commercial_summary: {
        Args: {
          p_remind_days?: number;
        };
        Returns: Json;
      };
      superadmin_list_billing_events: {
        Args: {
          p_organization_id: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          provider: string;
          event_id: string;
          event_type: string | null;
          processed_at: string;
          applied_at: string | null;
        }[];
      };
      list_own_billing_events: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          id: string;
          provider: string;
          event_type: string | null;
          processed_at: string;
          applied_at: string | null;
        }[];
      };
      list_own_open_checkout_intents: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          kind: string;
          target_key: string;
          billing_interval: string;
          provider: string;
          checkout_url: string | null;
          expires_at: string;
        }[];
      };
      billing_begin_own_checkout_intent: {
        Args: {
          p_kind: string;
          p_target_key: string;
          p_interval: string;
          p_provider: string;
          p_ttl_hours?: number;
        };
        Returns: Json;
      };
      billing_set_own_checkout_intent_url: {
        Args: {
          p_id: string;
          p_checkout_url: string;
        };
        Returns: Json;
      };
      billing_cancel_own_checkout_intents: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      billing_consume_checkout_intents: {
        Args: {
          p_organization_id: string;
          p_kind: string;
          p_target_key?: string | null;
        };
        Returns: Json;
      };
      billing_release_checkout_intents: {
        Args: {
          p_organization_id: string;
          p_kind?: string | null;
          p_target_key?: string | null;
        };
        Returns: Json;
      };
      billing_reverse_paid_grant: {
        Args: {
          p_organization_id: string;
          p_kind: string;
          p_target_key?: string | null;
          p_provider?: string | null;
          p_external_id?: string | null;
          p_reason?: string | null;
          p_provider_ids?: string[] | null;
        };
        Returns: Json;
      };
      billing_lookup_paid_grant_from_provider_ids: {
        Args: {
          p_provider: string;
          p_ids: string[];
        };
        Returns: Json;
      };
      billing_attach_paid_grant_ids: {
        Args: {
          p_organization_id: string;
          p_kind: string;
          p_target_key: string;
          p_ids: Json;
        };
        Returns: Json;
      };
      superadmin_open_checkout_intents: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      superadmin_list_checkout_intents: {
        Args: {
          p_organization_id: string;
        };
        Returns: {
          id: string;
          kind: string;
          target_key: string;
          billing_interval: string;
          provider: string;
          expires_at: string;
          created_at: string;
        }[];
      };
      superadmin_list_open_checkout_intents: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          kind: string;
          target_key: string;
          billing_interval: string;
          provider: string;
          expires_at: string;
          created_at: string;
        }[];
      };
      superadmin_list_unapplied_billing_events: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          id: string;
          organization_id: string | null;
          organization_name: string | null;
          organization_slug: string | null;
          provider: string;
          event_id: string;
          event_type: string | null;
          processed_at: string;
        }[];
      };
      superadmin_list_plans_ending_soon: {
        Args: {
          p_remind_days?: number;
          p_limit?: number;
        };
        Returns: {
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          plan_key: string;
          plan_name: string;
          status: string;
          ends_at: string;
        }[];
      };
      superadmin_list_addons_ending_soon: {
        Args: {
          p_remind_days?: number;
          p_limit?: number;
        };
        Returns: {
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          addon_key: string;
          addon_name: string;
          ends_at: string;
        }[];
      };
      superadmin_list_orgs_over_seats: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          plan_key: string;
          plan_name: string;
          feature_key: string;
          used: number;
          limit_value: number;
        }[];
      };
      superadmin_cancel_checkout_intents: {
        Args: {
          p_organization_id: string;
        };
        Returns: Json;
      };
      superadmin_get_unapplied_billing_event: {
        Args: {
          p_event_id: string;
        };
        Returns: {
          id: string;
          organization_id: string | null;
          provider: string;
          event_id: string;
          event_type: string | null;
          payload: Json;
          processed_at: string;
        }[];
      };
      superadmin_skip_billing_event: {
        Args: {
          p_event_id: string;
          p_kind?: string | null;
          p_target_key?: string | null;
        };
        Returns: Json;
      };
      handle_new_user_signup: {
        Args: {
          p_full_name: string;
          p_organization_name: string;
          p_organization_slug: string;
          p_branch_name?: string;
        };
        Returns: Json;
      };
      add_team_member: {
        Args: {
          p_user_id: string;
          p_branch_id: string;
          p_role: UserRole;
        };
        Returns: string;
      };
      user_has_branch_access: {
        Args: { p_branch_id: string };
        Returns: boolean;
      };
      search_patients: {
        Args: {
          p_search?: string | null;
          p_owner_id?: string | null;
          p_branch_id?: string | null;
          p_species?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          owner_id: string;
          owner_full_name: string;
          name: string;
          species: PatientSpecies;
          breed: string | null;
          sex: PatientSex;
          birth_date: string | null;
          color: string | null;
          microchip: string | null;
          is_neutered: boolean;
          is_deceased: boolean;
          deceased_at: string | null;
          notes: string | null;
          photo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      search_owners: {
        Args: {
          p_search?: string | null;
          p_branch_id?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          phone_whatsapp: string | null;
          document_type: string;
          document_number: string | null;
          address: string | null;
          city: string | null;
          province: string | null;
          postal_code: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      get_dashboard_summary: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: Json;
      };
      get_dashboard_activity: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          user_full_name: string | null;
          summary: string;
          created_at: string;
        }[];
      };
      get_clinic_report: {
        Args: {
          p_from: string;
          p_to: string;
          p_branch_id?: string | null;
        };
        Returns: Json;
      };
      is_clinic_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_portal_owner_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      preview_owner_portal_invite: {
        Args: {
          p_token: string;
        };
        Returns: Json;
      };
      create_owner_portal_invite: {
        Args: {
          p_owner_id: string;
        };
        Returns: Json;
      };
      accept_owner_portal_invite: {
        Args: {
          p_token: string;
          p_full_name?: string | null;
        };
        Returns: Json;
      };
      revoke_owner_portal_access: {
        Args: {
          p_owner_id: string;
        };
        Returns: undefined;
      };
      get_owner_portal_status: {
        Args: {
          p_owner_id: string;
        };
        Returns: Json;
      };
      get_owner_portal_home: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_owner_portal_patient: {
        Args: {
          p_patient_id: string;
        };
        Returns: Json;
      };
      log_whatsapp_message: {
        Args: {
          p_owner_id: string;
          p_body: string;
          p_phone_e164: string;
          p_template_key: string;
          p_patient_id?: string | null;
          p_related_type?: string | null;
          p_related_id?: string | null;
          p_branch_id?: string | null;
        };
        Returns: Json;
      };
      search_whatsapp_messages: {
        Args: {
          p_search?: string | null;
          p_owner_id?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
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
          total_count: number;
        }[];
      };
      list_clinic_reminders: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: Json;
      };
      count_pending_reminders: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: number;
      };
      mark_reminder: {
        Args: {
          p_reminder_type: string;
          p_related_id: string;
          p_status: string;
          p_whatsapp_message_id?: string | null;
        };
        Returns: Json;
      };
      get_patient_clinical_context: {
        Args: {
          p_patient_id: string;
        };
        Returns: Json;
      };
      save_ai_suggestion: {
        Args: {
          p_patient_id: string;
          p_kind: string;
          p_prompt_hash: string;
          p_output: Json;
          p_model: string;
          p_input_excerpt?: string | null;
          p_consultation_id?: string | null;
          p_clinical_entry_id?: string | null;
          p_branch_id?: string | null;
        };
        Returns: Json;
      };
      search_ai_suggestions: {
        Args: {
          p_patient_id?: string | null;
          p_kind?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          kind: ClinicalAiKind;
          prompt_hash: string;
          input_excerpt: string | null;
          output: Json;
          model: string;
          created_by: string | null;
          patient_name: string;
          owner_full_name: string;
          created_by_name: string | null;
          created_at: string;
          total_count: number;
        }[];
      };
      count_active_prescriptions: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: number;
      };
      list_active_prescriptions: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          prescribed_by: string | null;
          dispensed_by: string | null;
          voided_by: string | null;
          status: PrescriptionStatus;
          number: string | null;
          notes: string | null;
          void_reason: string | null;
          prescribed_at: string;
          dispensed_at: string | null;
          voided_at: string | null;
          item_count: number;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          prescribed_by_name: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        }[];
      };
      search_prescriptions: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          prescribed_by: string | null;
          dispensed_by: string | null;
          voided_by: string | null;
          status: PrescriptionStatus;
          number: string | null;
          notes: string | null;
          void_reason: string | null;
          prescribed_at: string;
          dispensed_at: string | null;
          voided_at: string | null;
          item_count: number;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          prescribed_by_name: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          total_count: number;
        }[];
      };
      create_prescription: {
        Args: {
          p_patient_id: string;
          p_owner_id: string;
          p_branch_id: string;
          p_items: Json;
          p_consultation_id?: string | null;
          p_clinical_entry_id?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      dispense_prescription: {
        Args: {
          p_prescription_id: string;
        };
        Returns: Json;
      };
      void_prescription: {
        Args: {
          p_prescription_id: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      cash_session_expected_amount: {
        Args: {
          p_session_id: string;
        };
        Returns: number;
      };
      count_open_cash_sessions: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: number;
      };
      get_open_cash_session: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          opened_by: string | null;
          closed_by: string | null;
          status: CashSessionStatus;
          opening_amount: number;
          expected_cash: number | null;
          counted_cash: number | null;
          difference: number | null;
          notes: string | null;
          close_notes: string | null;
          opened_at: string;
          closed_at: string | null;
          movement_count: number;
          opened_by_name: string | null;
          closed_by_name: string | null;
          branch_name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        }[];
      };
      search_cash_sessions: {
        Args: {
          p_branch_id?: string | null;
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          opened_by: string | null;
          closed_by: string | null;
          status: CashSessionStatus;
          opening_amount: number;
          expected_cash: number | null;
          counted_cash: number | null;
          difference: number | null;
          notes: string | null;
          close_notes: string | null;
          opened_at: string;
          closed_at: string | null;
          movement_count: number;
          opened_by_name: string | null;
          closed_by_name: string | null;
          branch_name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          total_count: number;
        }[];
      };
      list_cash_movements: {
        Args: {
          p_session_id: string;
        };
        Returns: {
          id: string;
          organization_id: string;
          cash_session_id: string;
          payment_id: string | null;
          recorded_by: string | null;
          kind: CashMovementKind;
          method: PaymentMethod;
          amount: number;
          notes: string | null;
          recorded_by_name: string | null;
          invoice_id: string | null;
          invoice_number: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        }[];
      };
      open_cash_session: {
        Args: {
          p_branch_id: string;
          p_opening_amount?: number;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      add_cash_movement: {
        Args: {
          p_session_id: string;
          p_kind: string;
          p_amount: number;
          p_method?: PaymentMethod;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      close_cash_session: {
        Args: {
          p_session_id: string;
          p_counted_cash: number;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      count_clinical_images_this_month: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: number;
      };
      search_clinical_images: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_kind?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          uploaded_by: string | null;
          kind: ClinicalImageKind;
          title: string | null;
          notes: string | null;
          storage_path: string;
          mime_type: string;
          file_size: number;
          original_name: string | null;
          taken_at: string;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          uploaded_by_name: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          total_count: number;
        }[];
      };
      search_notifications: {
        Args: {
          p_search?: string | null;
          p_kind?: string | null;
          p_unread_only?: boolean;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          kind: NotificationKind;
          title: string;
          body: string | null;
          href: string;
          related_type: string | null;
          related_id: string | null;
          read_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          total_count: number;
        }[];
      };
      count_unread_notifications: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_notification_read: {
        Args: {
          p_id: string;
        };
        Returns: boolean;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: number;
      };
      search_audit_logs: {
        Args: {
          p_search?: string | null;
          p_action?: string | null;
          p_entity_type?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          user_full_name: string | null;
          branch_name: string | null;
          summary: string;
          created_at: string;
          total_count: number;
        }[];
      };
      count_audit_logs_today: {
        Args: Record<string, never>;
        Returns: number;
      };
      audit_event_summary: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_old?: Json | null;
          p_new?: Json | null;
        };
        Returns: string;
      };
      list_appointments_range: {
        Args: {
          p_week_start: string;
          p_branch_id?: string | null;
          p_status?: string | null;
          p_assigned_user_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          assigned_user_id: string | null;
          starts_at: string;
          ends_at: string;
          status: AppointmentStatus;
          appointment_type: AppointmentType;
          title: string | null;
          notes: string | null;
          cancellation_reason: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          assigned_user_name: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      search_clinical_entries: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_entry_type?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id: string | null;
          recorded_by: string | null;
          entry_date: string;
          entry_type: ClinicalEntryType;
          title: string | null;
          anamnesis: string | null;
          physical_exam: string | null;
          diagnosis: string | null;
          treatment: string | null;
          plan: string | null;
          weight_kg: number | null;
          temperature_c: number | null;
          notes: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          recorded_by_name: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      list_consultation_queue: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          queue_kind: string;
          appointment_id: string | null;
          consultation_id: string | null;
          patient_id: string;
          owner_id: string;
          starts_at: string;
          appointment_status: AppointmentStatus | null;
          consultation_status: ConsultationStatus | null;
          appointment_type: AppointmentType | null;
          title: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          veterinarian_name: string | null;
        }[];
      };
      search_consultations: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          status: ConsultationStatus;
          started_at: string;
          completed_at: string | null;
          title: string | null;
          anamnesis: string | null;
          physical_exam: string | null;
          diagnosis: string | null;
          treatment: string | null;
          plan: string | null;
          weight_kg: number | null;
          temperature_c: number | null;
          notes: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          veterinarian_name: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      complete_consultation: {
        Args: {
          p_consultation_id: string;
        };
        Returns: Json;
      };
      list_active_hospitalizations: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          status: HospitalizationStatus;
          admitted_at: string;
          discharged_at: string | null;
          cage: string | null;
          reason: string;
          diagnosis: string | null;
          treatment_plan: string | null;
          discharge_summary: string | null;
          notes: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          veterinarian_name: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      search_hospitalizations: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          status: HospitalizationStatus;
          admitted_at: string;
          discharged_at: string | null;
          cage: string | null;
          reason: string;
          diagnosis: string | null;
          treatment_plan: string | null;
          discharge_summary: string | null;
          notes: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          veterinarian_name: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      discharge_hospitalization: {
        Args: {
          p_hospitalization_id: string;
          p_outcome: string;
          p_summary?: string | null;
        };
        Returns: Json;
      };
      list_vaccination_due: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          vaccine_name: string;
          manufacturer: string | null;
          lot_number: string | null;
          administered_at: string;
          next_due_at: string | null;
          route: VaccinationRoute | null;
          notes: string | null;
          due_status: string;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          veterinarian_name: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      list_patient_vaccine_status: {
        Args: {
          p_patient_id: string;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          vaccine_name: string;
          manufacturer: string | null;
          lot_number: string | null;
          administered_at: string;
          next_due_at: string | null;
          route: VaccinationRoute | null;
          notes: string | null;
          due_status: string;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          veterinarian_name: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      search_vaccinations: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          veterinarian_id: string | null;
          vaccine_name: string;
          manufacturer: string | null;
          lot_number: string | null;
          administered_at: string;
          next_due_at: string | null;
          route: VaccinationRoute | null;
          notes: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          veterinarian_name: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      record_vaccination: {
        Args: {
          p_branch_id: string;
          p_patient_id: string;
          p_owner_id: string;
          p_vaccine_name: string;
          p_administered_at: string;
          p_manufacturer?: string | null;
          p_lot_number?: string | null;
          p_next_due_at?: string | null;
          p_route?: string | null;
          p_notes?: string | null;
          p_consultation_id?: string | null;
        };
        Returns: Json;
      };
      list_surgery_board: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id: string | null;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          surgeon_id: string | null;
          status: SurgeryStatus;
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          procedure_name: string;
          diagnosis: string | null;
          anesthesia: SurgeryAnesthesia | null;
          asa: SurgeryAsa | null;
          preop_notes: string | null;
          intraop_notes: string | null;
          postop_notes: string | null;
          complications: string | null;
          notes: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          surgeon_name: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      search_surgeries: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          appointment_id: string | null;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          surgeon_id: string | null;
          status: SurgeryStatus;
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          procedure_name: string;
          diagnosis: string | null;
          anesthesia: SurgeryAnesthesia | null;
          asa: SurgeryAsa | null;
          preop_notes: string | null;
          intraop_notes: string | null;
          postop_notes: string | null;
          complications: string | null;
          notes: string | null;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          surgeon_name: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      complete_surgery: {
        Args: {
          p_surgery_id: string;
        };
        Returns: Json;
      };
      list_lab_queue: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          ordered_by: string | null;
          completed_by: string | null;
          status: LabOrderStatus;
          priority: LabPriority;
          sample_type: LabSampleType | null;
          title: string;
          ordered_at: string;
          collected_at: string | null;
          completed_at: string | null;
          interpretation: string | null;
          notes: string | null;
          item_count: number;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          ordered_by_name: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      search_lab_orders: {
        Args: {
          p_search?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          patient_id: string;
          owner_id: string;
          consultation_id: string | null;
          clinical_entry_id: string | null;
          ordered_by: string | null;
          completed_by: string | null;
          status: LabOrderStatus;
          priority: LabPriority;
          sample_type: LabSampleType | null;
          title: string;
          ordered_at: string;
          collected_at: string | null;
          completed_at: string | null;
          interpretation: string | null;
          notes: string | null;
          item_count: number;
          patient_name: string;
          patient_species: PatientSpecies;
          owner_full_name: string;
          ordered_by_name: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      complete_lab_order: {
        Args: {
          p_lab_order_id: string;
        };
        Returns: Json;
      };
      search_inventory_products: {
        Args: {
          p_search?: string | null;
          p_branch_id?: string | null;
          p_category?: string | null;
          p_low_stock?: boolean | null;
          p_active_only?: boolean | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          name: string;
          sku: string | null;
          category: InventoryProductCategory;
          unit: InventoryUnit;
          quantity: number;
          min_quantity: number;
          unit_cost: number | null;
          unit_price: number | null;
          manufacturer: string | null;
          notes: string | null;
          is_active: boolean;
          is_low_stock: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          total_count: number;
        }[];
      };
      list_low_stock: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          name: string;
          sku: string | null;
          category: InventoryProductCategory;
          unit: InventoryUnit;
          quantity: number;
          min_quantity: number;
          unit_cost: number | null;
          unit_price: number | null;
          manufacturer: string | null;
          notes: string | null;
          is_active: boolean;
          is_low_stock: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        }[];
      };
      record_inventory_movement: {
        Args: {
          p_product_id: string;
          p_movement_type: InventoryMovementType;
          p_quantity: number;
          p_reason?: string | null;
          p_lot_number?: string | null;
          p_expires_at?: string | null;
        };
        Returns: Json;
      };
      search_invoices: {
        Args: {
          p_search?: string | null;
          p_owner_id?: string | null;
          p_patient_id?: string | null;
          p_branch_id?: string | null;
          p_status?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          owner_id: string;
          patient_id: string | null;
          consultation_id: string | null;
          created_by: string | null;
          issued_by: string | null;
          status: InvoiceStatus;
          number: string | null;
          currency: string;
          issued_at: string | null;
          due_at: string | null;
          paid_at: string | null;
          voided_at: string | null;
          subtotal: number;
          tax_amount: number;
          total: number;
          paid_amount: number;
          balance: number;
          notes: string | null;
          item_count: number;
          owner_full_name: string;
          patient_name: string | null;
          patient_species: PatientSpecies | null;
          created_by_name: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          total_count: number;
        }[];
      };
      list_open_invoices: {
        Args: {
          p_branch_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          branch_id: string;
          owner_id: string;
          patient_id: string | null;
          consultation_id: string | null;
          created_by: string | null;
          issued_by: string | null;
          status: InvoiceStatus;
          number: string | null;
          currency: string;
          issued_at: string | null;
          due_at: string | null;
          paid_at: string | null;
          voided_at: string | null;
          subtotal: number;
          tax_amount: number;
          total: number;
          paid_amount: number;
          balance: number;
          notes: string | null;
          item_count: number;
          owner_full_name: string;
          patient_name: string | null;
          patient_species: PatientSpecies | null;
          created_by_name: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        }[];
      };
      issue_invoice: {
        Args: {
          p_invoice_id: string;
        };
        Returns: Json;
      };
      register_payment: {
        Args: {
          p_invoice_id: string;
          p_amount: number;
          p_method?: PaymentMethod;
          p_reference?: string | null;
          p_notes?: string | null;
          p_paid_at?: string | null;
        };
        Returns: Json;
      };
      void_invoice: {
        Args: {
          p_invoice_id: string;
        };
        Returns: Json;
      };
      recalc_invoice_totals: {
        Args: {
          p_invoice_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      org_plan: OrgPlan;
      patient_species: PatientSpecies;
      patient_sex: PatientSex;
      appointment_status: AppointmentStatus;
      appointment_type: AppointmentType;
      clinical_entry_type: ClinicalEntryType;
      consultation_status: ConsultationStatus;
      hospitalization_status: HospitalizationStatus;
      hospitalization_note_type: HospitalizationNoteType;
      vaccination_route: VaccinationRoute;
      surgery_status: SurgeryStatus;
      surgery_asa: SurgeryAsa;
      surgery_anesthesia: SurgeryAnesthesia;
      lab_order_status: LabOrderStatus;
      lab_priority: LabPriority;
      lab_sample_type: LabSampleType;
      lab_result_flag: LabResultFlag;
      inventory_product_category: InventoryProductCategory;
      inventory_unit: InventoryUnit;
      inventory_movement_type: InventoryMovementType;
      invoice_status: InvoiceStatus;
      payment_method: PaymentMethod;
      whatsapp_related_type: WhatsAppRelatedType;
      reminder_type: ReminderType;
      reminder_status: ReminderStatus;
      reminder_channel: ReminderChannel;
      ai_suggestion_kind: ClinicalAiKind;
      prescription_status: PrescriptionStatus;
      prescription_route: PrescriptionRoute;
      cash_session_status: CashSessionStatus;
      cash_movement_kind: CashMovementKind;
      clinical_image_kind: ClinicalImageKind;
      notification_kind: NotificationKind;
      subscription_status: SubscriptionStatus;
      feature_value_type: FeatureValueType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
