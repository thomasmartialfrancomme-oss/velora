/** Notifications: list, mark one read, or mark all read. */
import { api } from '@/lib/http/handler';
import { listNotifications, unreadCount } from '@/lib/data/read';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/data/write';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'notifications:list',
  handler: ({ user }) => ({ items: listNotifications(user.id, 20), unread: unreadCount(user.id) }),
});

const readSchema = z.object({ id: z.string().trim().min(1).optional(), all: z.boolean().optional() });

export const POST = api({
  scope: 'notifications:read',
  schema: readSchema,
  handler: ({ user, body }) => {
    const payload = readSchema.parse(body);
    if (payload.all || !payload.id) return { unread: 0, marked: markAllNotificationsRead(user.id) };
    markNotificationRead(user.id, payload.id);
    return { unread: unreadCount(user.id) };
  },
});
