import type { NotificationKind } from '../constants/notifications';

export interface StaffNotification {
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
}

export type StaffNotificationListRow = StaffNotification;
