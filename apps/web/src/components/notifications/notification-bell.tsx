'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellRing } from 'lucide-react';
import {
  listNotifications,
  markAllNotificationsRead,
  openNotification,
} from '@/actions/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  NOTIFICATION_KIND_LABELS,
  formatRelativeTime,
  isNotificationUnread,
  type StaffNotificationListRow,
} from '@sincvete/shared';

interface NotificationBellProps {
  unreadCount: number;
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StaffNotificationListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    listNotifications({ page: 1, pageSize: 8 })
      .then((result) => {
        if (!cancelled) setItems(result.data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = async (notification: StaffNotificationListRow) => {
    const result = await openNotification(notification.id);
    if (!result.success || !result.data) return;
    setOpen(false);
    startTransition(() => {
      router.push(result.data!.href);
      router.refresh();
    });
  };

  const handleMarkAll = async () => {
    const result = await markAllNotificationsRead();
    if (!result.success) return;
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))
    );
    startTransition(() => router.refresh());
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Notificaciones"
        onClick={() => setOpen((value) => !value)}
        className="relative"
      >
        <BellRing className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border bg-popover shadow-md sm:w-96">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-medium">Notificaciones</p>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={handleMarkAll}
              >
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No hay notificaciones.
              </p>
            ) : (
              <ul>
                {items.map((item) => {
                  const unread = isNotificationUnread(item.read_at);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className={cn(
                          'w-full px-3 py-2 text-left hover:bg-accent',
                          unread && 'bg-accent/50'
                        )}
                      >
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {NOTIFICATION_KIND_LABELS[item.kind]} · {formatRelativeTime(item.created_at)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t px-3 py-2">
            <Link
              href="/notificaciones"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
