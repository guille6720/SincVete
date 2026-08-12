import type { InvoiceStatus, PaymentMethod } from '../constants/billing';
import type { PatientSpecies } from '../constants/patients';

export interface Invoice {
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
}

export interface InvoiceItem {
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
}

export interface Payment {
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
}

export interface InvoiceListRow extends Invoice {
  item_count: number;
  owner_full_name: string;
  patient_name: string | null;
  patient_species: PatientSpecies | null;
  created_by_name: string | null;
}

export interface PaymentListRow extends Payment {
  recorded_by_name: string | null;
}
