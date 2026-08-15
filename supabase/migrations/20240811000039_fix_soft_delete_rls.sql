-- Fix soft-delete blocked by RLS UPDATE policies.
-- Without WITH CHECK, Postgres reuses USING for the new row; setting deleted_at
-- fails `deleted_at IS NULL` and PostgREST returns success with 0 rows updated.

-- Patients
DROP POLICY IF EXISTS "patients_update_tenant" ON public.patients;
CREATE POLICY "patients_update_tenant" ON public.patients
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('patients:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('patients:write')
  );

-- Owners
DROP POLICY IF EXISTS "owners_update_tenant" ON public.owners;
CREATE POLICY "owners_update_tenant" ON public.owners
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('patients:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('patients:write')
  );

-- Appointments
DROP POLICY IF EXISTS "appointments_update_tenant" ON public.appointments;
CREATE POLICY "appointments_update_tenant" ON public.appointments
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('appointments:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('appointments:write')
  );

-- Clinical entries
DROP POLICY IF EXISTS "clinical_entries_update_tenant" ON public.clinical_entries;
CREATE POLICY "clinical_entries_update_tenant" ON public.clinical_entries
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Consultations
DROP POLICY IF EXISTS "consultations_update_tenant" ON public.consultations;
CREATE POLICY "consultations_update_tenant" ON public.consultations
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Hospitalizations
DROP POLICY IF EXISTS "hospitalizations_update_tenant" ON public.hospitalizations;
CREATE POLICY "hospitalizations_update_tenant" ON public.hospitalizations
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "hospitalization_notes_update_tenant" ON public.hospitalization_notes;
CREATE POLICY "hospitalization_notes_update_tenant" ON public.hospitalization_notes
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Vaccinations
DROP POLICY IF EXISTS "vaccinations_update_tenant" ON public.vaccinations;
CREATE POLICY "vaccinations_update_tenant" ON public.vaccinations
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Surgeries
DROP POLICY IF EXISTS "surgeries_update_tenant" ON public.surgeries;
CREATE POLICY "surgeries_update_tenant" ON public.surgeries
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Lab
DROP POLICY IF EXISTS "lab_orders_update_tenant" ON public.lab_orders;
CREATE POLICY "lab_orders_update_tenant" ON public.lab_orders
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "lab_order_items_update_tenant" ON public.lab_order_items;
CREATE POLICY "lab_order_items_update_tenant" ON public.lab_order_items
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Inventory
DROP POLICY IF EXISTS "inventory_products_update_tenant" ON public.inventory_products;
CREATE POLICY "inventory_products_update_tenant" ON public.inventory_products
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('inventory:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('inventory:write')
  );

-- Pharmacy
DROP POLICY IF EXISTS "prescriptions_update_tenant" ON public.prescriptions;
CREATE POLICY "prescriptions_update_tenant" ON public.prescriptions
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "prescription_items_update_tenant" ON public.prescription_items;
CREATE POLICY "prescription_items_update_tenant" ON public.prescription_items
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Clinical images
DROP POLICY IF EXISTS "clinical_images_update_tenant" ON public.clinical_images;
CREATE POLICY "clinical_images_update_tenant" ON public.clinical_images
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

-- Billing
DROP POLICY IF EXISTS "invoices_update_tenant" ON public.invoices;
CREATE POLICY "invoices_update_tenant" ON public.invoices
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

DROP POLICY IF EXISTS "invoice_items_update_tenant" ON public.invoice_items;
CREATE POLICY "invoice_items_update_tenant" ON public.invoice_items
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('billing:write')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('billing:write')
  );

-- Branches / orgs (settings soft-delete)
DROP POLICY IF EXISTS "branches_update_admin" ON public.branches;
CREATE POLICY "branches_update_admin" ON public.branches
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('branch:manage')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('branch:manage')
  );

DROP POLICY IF EXISTS "org_update_admin" ON public.organizations;
CREATE POLICY "org_update_admin" ON public.organizations
  FOR UPDATE
  USING (
    id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('org:manage')
  )
  WITH CHECK (
    id = public.get_user_organization_id()
    AND public.has_permission('org:manage')
  );
