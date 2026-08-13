-- Fix: audit_log_changes assumed every row has organization_id.
-- public.organizations uses id as the tenant key, so signup INSERT failed with:
--   record "new" has no field "organization_id"

CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  branch_id_val UUID;
  action_name TEXT;
  old_row JSONB;
  new_row JSONB;
  row_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_name := 'create';
    new_row := to_jsonb(NEW);
    row_data := new_row;
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'update';
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    row_data := new_row;
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'delete';
    old_row := to_jsonb(OLD);
    row_data := old_row;
  END IF;

  IF TG_TABLE_NAME = 'organizations' THEN
    org_id := (row_data->>'id')::uuid;
  ELSE
    org_id := NULLIF(row_data->>'organization_id', '')::uuid;
  END IF;

  BEGIN
    branch_id_val := NULLIF(row_data->>'branch_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    branch_id_val := NULL;
  END;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    org_id,
    branch_id_val,
    auth.uid(),
    action_name,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    old_row,
    new_row
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
