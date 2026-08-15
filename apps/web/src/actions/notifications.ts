'use server';

import { revalidatePath } from 'next/cache';
import {
  buildPaginatedResult,
  isSafeNotificationHref,
  notificationIdSchema,
  notificationListSchema,
  type ActionResult,
  type PaginatedResult,
  type StaffNotificationListRow,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { PermissionError, requireSession } from '@/lib/permissions';
import { getSessionContext } from '@/actions/auth';

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: string }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

function actionError<T = void>(error: unknown): ActionResult<T> {
  if (isNextRedirect(error)) throw error;
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return { success: false, error: 'Ocurrió un error inesperado' };
}

function rpcMessage(error: { message?: string } | null): string {
  const message = error?.message ?? '';
  if (message.includes('permisos') || message.includes('Notificación')) {
    return message;
  }
  return 'Ocurrió un error inesperado';
}

function toNotificationRow(
  row: StaffNotificationListRow & { total_count?: number }
): StaffNotificationListRow {
  const { total_count: _total, ...entry } = row;
  void _total;
  return {
    ...entry,
    read_at: entry.read_at ?? null,
    deleted_at: entry.deleted_at ?? null,
  };
}

function revalidateNotificationPaths() {
  revalidatePath('/notificaciones');
}

export async function canReadNotifications(): Promise<boolean> {
  const session = await getSessionContext();
  return session?.kind === 'staff';
}

export async function countUnreadNotifications(): Promise<number> {
  const session = await getSessionContext();
  if (!session || session.kind !== 'staff') return 0;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('count_unread_notifications');
  if (error) {
    console.error(error);
    return 0;
  }
  return Number(data ?? 0);
}

export async function listNotifications(
  input: {
    page?: number;
    pageSize?: number;
    search?: string;
    kind?: string;
    unreadOnly?: boolean;
  } = {}
): Promise<PaginatedResult<StaffNotificationListRow>> {
  const session = await requireSession();
  if (session.kind !== 'staff') {
    throw new PermissionError();
  }

  const parsed = notificationListSchema.parse(input);
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_notifications', {
    p_search: parsed.search?.trim() || null,
    p_kind: parsed.kind || null,
    p_unread_only: parsed.unreadOnly ?? false,
    p_page: parsed.page,
    p_page_size: parsed.pageSize,
  });

  if (error) throw error;

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const notifications = rows.map((row) => toNotificationRow(row));

  return buildPaginatedResult(notifications, Number(total), parsed.page, parsed.pageSize);
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (session.kind !== 'staff') {
      throw new PermissionError();
    }

    const parsed = notificationIdSchema.safeParse({ id });
    if (!parsed.success) {
      return { success: false, error: 'Notificación inválida' };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.rpc('mark_notification_read', { p_id: parsed.data.id });
    if (error) {
      return { success: false, error: rpcMessage(error) };
    }

    revalidateNotificationPaths();
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (session.kind !== 'staff') {
      throw new PermissionError();
    }

    const supabase = await createServerClient();
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      return { success: false, error: rpcMessage(error) };
    }

    revalidateNotificationPaths();
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function openNotification(id: string): Promise<ActionResult<{ href: string }>> {
  try {
    const session = await requireSession();
    if (session.kind !== 'staff') {
      throw new PermissionError();
    }

    const parsed = notificationIdSchema.safeParse({ id });
    if (!parsed.success) {
      return { success: false, error: 'Notificación inválida' };
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('href')
      .eq('id', parsed.data.id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return { success: false, error: 'Notificación no encontrada' };
    }
    if (!isSafeNotificationHref(data.href)) {
      return { success: false, error: 'Enlace inválido' };
    }

    const { error: readError } = await supabase.rpc('mark_notification_read', {
      p_id: parsed.data.id,
    });
    if (readError) {
      return { success: false, error: rpcMessage(readError) };
    }

    revalidateNotificationPaths();
    return { success: true, data: { href: data.href } };
  } catch (error) {
    return actionError(error);
  }
}
