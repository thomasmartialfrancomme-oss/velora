/**
 * Console queries for VELORA staff. These intentionally cross tenants — that is
 * the whole point of /admin — so access is gated twice (role claim in the
 * middleware, `requireApiAdmin`/`requireAdmin` in the page and route).
 */
import { getDb, nowIso } from '@/lib/db';
import { MEMBERSHIP_PLANS, getPlan } from '@/lib/utils/format';

export interface AdminStats {
  principals: number;
  suspended: number;
  invited: number;
  activeSubscriptions: number;
  pastDue: number;
  monthlyRecurringCents: number;
  annualValueCents: number;
  residences: number;
  staff: number;
  aiRequestsToday: number;
  aiRequestsWeek: number;
  openTickets: number;
  newAccessRequests: number;
  tasksAwaitingConfirmation: number;
  planMix: { key: string; name: string; count: number; cents: number }[];
  signupTrend: { day: string; count: number }[];
  aiTrend: { day: string; count: number }[];
}

export function adminStats(): AdminStats {
  const db = getDb();
  const scalar = (sql: string, params: Record<string, unknown> = {}) => Number(db.get<{ n: number | bigint }>(sql, params)?.n ?? 0);

  const principals = scalar(`SELECT COUNT(*) AS n FROM users WHERE role = 'owner'`);
  const monthlyRecurringCents = scalar(
    `SELECT COALESCE(SUM(amount_cents), 0) AS n FROM subscriptions WHERE status IN ('active','trialing') AND billing_cycle = 'monthly'`,
  );
  const annualCents = scalar(`SELECT COALESCE(SUM(amount_cents), 0) AS n FROM subscriptions WHERE status IN ('active','trialing') AND billing_cycle = 'annual'`);

  const planRows = db.all<{ plan: string; count: number | bigint; cents: number | bigint }>(
    `SELECT plan, COUNT(*) AS count, COALESCE(SUM(amount_cents),0) AS cents
       FROM subscriptions GROUP BY plan ORDER BY count DESC`,
  );

  const signupTrend = db
    .all<{ day: string; count: number | bigint }>(
      `SELECT date(created_at) AS day, COUNT(*) AS count FROM users
        WHERE created_at >= date('now','-13 day') GROUP BY day ORDER BY day ASC`,
    )
    .map((row) => ({ day: row.day, count: Number(row.count) }));

  const aiTrend = db
    .all<{ day: string; count: number | bigint }>(
      `SELECT date(created_at) AS day, COUNT(*) AS count FROM ai_messages
        WHERE role = 'user' AND created_at >= date('now','-13 day') GROUP BY day ORDER BY day ASC`,
    )
    .map((row) => ({ day: row.day, count: Number(row.count) }));

  return {
    principals,
    suspended: scalar(`SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'`),
    invited: scalar(`SELECT COUNT(*) AS n FROM users WHERE status = 'invited'`),
    activeSubscriptions: scalar(`SELECT COUNT(*) AS n FROM subscriptions WHERE status IN ('active','trialing')`),
    pastDue: scalar(`SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'past_due'`),
    monthlyRecurringCents: monthlyRecurringCents + Math.round(annualCents / 12),
    annualValueCents: monthlyRecurringCents * 12 + annualCents,
    residences: scalar(`SELECT COUNT(*) AS n FROM properties`),
    staff: scalar(`SELECT COUNT(*) AS n FROM staff`),
    aiRequestsToday: scalar(`SELECT COUNT(*) AS n FROM ai_messages WHERE role = 'user' AND date(created_at) = date('now')`),
    aiRequestsWeek: scalar(`SELECT COUNT(*) AS n FROM ai_messages WHERE role = 'user' AND created_at >= date('now','-7 day')`),
    openTickets: scalar(`SELECT COUNT(*) AS n FROM tickets WHERE status IN ('open','in_review')`),
    newAccessRequests: scalar(`SELECT COUNT(*) AS n FROM access_requests WHERE status = 'new'`),
    tasksAwaitingConfirmation: scalar(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'awaiting_confirmation'`),
    planMix: planRows.map((row) => ({
      key: row.plan,
      name: getPlan(row.plan).name,
      count: Number(row.count),
      cents: Number(row.cents),
    })),
    signupTrend,
    aiTrend,
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  country: string | null;
  plan: string | null;
  planStatus: string | null;
  residences: number;
  staff: number;
  openTasks: number;
  aiRequests: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export function adminUsers(search = ''): AdminUserRow[] {
  const like = search ? `%${search.slice(0, 60)}%` : '%';
  return getDb()
    .all<AdminUserRow>(
      `SELECT u.id, u.email,
              TRIM(u.first_name || ' ' || u.last_name) AS name,
              u.role, u.status, u.country,
              s.plan AS plan, s.status AS planStatus,
              (SELECT COUNT(*) FROM properties p WHERE p.user_id = u.id) AS residences,
              (SELECT COUNT(*) FROM staff st WHERE st.user_id = u.id) AS staff,
              (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id AND t.status != 'done') AS openTasks,
              (SELECT COUNT(*) FROM ai_messages m WHERE m.user_id = u.id AND m.role = 'user') AS aiRequests,
              u.last_login_at AS lastLoginAt, u.created_at AS createdAt
         FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.first_name LIKE @like OR u.last_name LIKE @like OR u.email LIKE @like
        ORDER BY u.created_at DESC`,
      { like },
    )
    .map((row) => ({
      ...row,
      residences: Number(row.residences),
      staff: Number(row.staff),
      openTasks: Number(row.openTasks),
      aiRequests: Number(row.aiRequests),
    }));
}

export function adminUserDetail(userId: string) {
  const db = getDb();
  const user = db.get<Record<string, unknown>>(`SELECT * FROM users WHERE id = @id`, { id: userId });
  if (!user) return null;
  return {
    user,
    properties: db.all(`SELECT id, name, city, country, status FROM properties WHERE user_id = @id ORDER BY name`, { id: userId }),
    subscription: db.get(`SELECT * FROM subscriptions WHERE user_id = @id`, { id: userId }),
    tickets: db.all(`SELECT id, subject, status, priority, created_at FROM tickets WHERE user_id = @id ORDER BY created_at DESC LIMIT 10`, { id: userId }),
    aiRequests: db.all(
      `SELECT id, content, created_at FROM ai_messages WHERE user_id = @id AND role = 'user' ORDER BY created_at DESC LIMIT 15`,
      { id: userId },
    ),
    audit: db.all(`SELECT event, target, created_at FROM audit_events WHERE user_id = @id ORDER BY created_at DESC LIMIT 25`, { id: userId }),
  };
}

export function adminSubscriptions() {
  return getDb()
    .all<{
      id: string;
      user: string;
      email: string;
      plan: string;
      status: string;
      cycle: string;
      amount_cents: number;
      currency: string;
      provider: string;
      current_period_end: string | null;
      cancel_at_period_end: number;
      started_at: string;
    }>(
      `SELECT s.id, TRIM(u.first_name || ' ' || u.last_name) AS user, u.email, s.plan, s.status, s.billing_cycle AS cycle,
              s.amount_cents, s.currency, s.provider, s.current_period_end, s.cancel_at_period_end, s.started_at
         FROM subscriptions s JOIN users u ON u.id = s.user_id
        ORDER BY s.amount_cents DESC, s.started_at DESC`,
    )
    .map((row) => ({ ...row, amountCents: Number(row.amount_cents), planName: getPlan(row.plan).name }));
}

export function adminAccessRequests(status?: string) {
  const rows = getDb()
    .all<Record<string, unknown>>(
      `SELECT * FROM access_requests ${status && status !== 'all' ? 'WHERE status = @status' : ''} ORDER BY created_at DESC LIMIT 100`,
      status && status !== 'all' ? { status } : {},
    )
    .map((row) => ({
      id: String(row.id),
      firstName: String(row.first_name ?? ''),
      lastName: String(row.last_name ?? ''),
      email: String(row.email ?? ''),
      country: String(row.country ?? ''),
      residences: Number(row.residences ?? 0),
      primaryRequirement: String(row.primary_requirement ?? ''),
      message: (row.message as string) ?? null,
      status: String(row.status ?? 'new'),
      reviewerNote: (row.reviewer_note as string) ?? null,
      referrer: (row.referrer as string) ?? null,
      // Paid traffic is only worth buying when the person reviewing the request can
      // see which advert produced it. Null means "came here on their own".
      campaign: row.utm_source ? [row.utm_source, row.utm_medium, row.utm_campaign].filter(Boolean).join(' · ') : null,
      createdAt: String(row.created_at ?? ''),
    }));
  return rows;
}

export function listTickets(userId?: string) {
  const db = getDb();
  const rows = userId
    ? db.all<Record<string, unknown>>(
        `SELECT t.*, TRIM(u.first_name || ' ' || u.last_name) AS requester
           FROM tickets t JOIN users u ON u.id = t.user_id
          WHERE t.user_id = @userId ORDER BY t.created_at DESC LIMIT 30`,
        { userId },
      )
    : db.all<Record<string, unknown>>(
        `SELECT t.*, TRIM(u.first_name || ' ' || u.last_name) AS requester
           FROM tickets t JOIN users u ON u.id = t.user_id
          ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, t.created_at DESC LIMIT 100`,
      );
  return rows.map((row) => ({
    id: String(row.id),
    subject: String(row.subject ?? ''),
    body: (row.body as string) ?? null,
    priority: String(row.priority ?? 'normal'),
    status: String(row.status ?? 'open'),
    assignee: (row.assignee as string) ?? null,
    reply: (row.reply as string) ?? null,
    requester: String(row.requester ?? ''),
    userId: String(row.user_id ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }));
}

export function adminAiRequests(limit = 40) {
  return getDb()
    .all<{
      id: string;
      content: string;
      created_at: string;
      requester: string;
      plan: string | null;
      provider: string | null;
      actions: number | bigint;
      requires: number | bigint;
    }>(
      `SELECT m.id, m.content, m.created_at, TRIM(u.first_name || ' ' || u.last_name) AS requester, s.plan,
              c.provider,
              (SELECT COUNT(*) FROM ai_tasks a WHERE a.conversation_id = c.id) AS actions,
              (SELECT COUNT(*) FROM ai_tasks a WHERE a.conversation_id = c.id AND a.status = 'requires_confirmation') AS requires
         FROM ai_messages m
         JOIN users u ON u.id = m.user_id
         JOIN ai_conversations c ON c.id = m.conversation_id
         LEFT JOIN subscriptions s ON s.user_id = m.user_id
        WHERE m.role = 'user'
        ORDER BY m.created_at DESC LIMIT @limit`,
      { limit },
    )
    .map((row) => ({ ...row, actions: Number(row.actions), requires: Number(row.requires) }));
}

export function adminActivity(limit = 40) {
  return getDb()
    .all<{ id: string; event: string; target: string | null; meta: string | null; created_at: string; requester: string | null }>(
      `SELECT a.id, a.event, a.target, a.meta, a.created_at,
              CASE WHEN a.user_id IS NULL THEN 'system' ELSE TRIM(IFNULL(u.first_name,'') || ' ' || IFNULL(u.last_name,'')) END AS requester
         FROM audit_events a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT @limit`,
      { limit },
    );
}

export function adminProperties(limit = 100) {
  return getDb()
    .all<{ id: string; name: string; city: string; country: string; status: string; owner: string; staff: number | bigint; tasks: number | bigint }>(
      `SELECT p.id, p.name, p.city, p.country, p.status, TRIM(u.first_name || ' ' || u.last_name) AS owner,
              (SELECT COUNT(*) FROM staff s WHERE s.property_id = p.id) AS staff,
              (SELECT COUNT(*) FROM tasks t WHERE t.property_id = p.id AND t.status != 'done') AS tasks
         FROM properties p JOIN users u ON u.id = p.user_id
        ORDER BY CASE p.status WHEN 'attention' THEN 0 WHEN 'maintenance' THEN 1 ELSE 2 END, p.name LIMIT @limit`,
      { limit },
    )
    .map((row) => ({ ...row, staff: Number(row.staff), tasks: Number(row.tasks) }));
}

export function adminSettings() {
  const db = getDb();
  return {
    plans: MEMBERSHIP_PLANS.map((plan) => ({
      key: plan.key,
      name: plan.name,
      priceCents: plan.price_cents_monthly,
      residences: plan.residences_included,
      aiRequests: plan.ai_requests_per_day,
      sla: plan.response_sla,
    })),
    integration: {
      billing: db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM subscriptions WHERE provider = 'stripe'`)?.n ?? 0,
      aiProviders: db.get<{ n: number }>(`SELECT COUNT(DISTINCT provider) AS n FROM ai_conversations`)?.n ?? 0,
    },
    generatedAt: nowIso(),
    note: 'Prices and plan entitlements are code-defined in src/lib/utils/format.ts (MEMBERSHIP_PLANS).',
  };
}

export function setUserStatus(userId: string, status: 'active' | 'suspended' | 'invited'): void {
  getDb().run(`UPDATE users SET status = @status, updated_at = @ts WHERE id = @id`, { status, ts: nowIso(), id: userId });
}

export function setUserRole(userId: string, role: 'owner' | 'admin'): void {
  getDb().run(`UPDATE users SET role = @role, updated_at = @ts WHERE id = @id`, { role, ts: nowIso(), id: userId });
}

export function updateAccessRequest(id: string, status: string, note?: string | null): void {
  getDb().run(`UPDATE access_requests SET status = @status, reviewer_note = COALESCE(@note, reviewer_note), updated_at = @ts WHERE id = @id`, {
    status,
    note: note ?? null,
    ts: nowIso(),
    id,
  });
}

export function updateTicket(id: string, patch: { status?: string; reply?: string | null; assignee?: string | null }): void {
  getDb().run(
    `UPDATE tickets SET status = COALESCE(@status, status), reply = COALESCE(@reply, reply),
            assignee = COALESCE(@assignee, assignee), updated_at = @ts WHERE id = @id`,
    { status: patch.status ?? null, reply: patch.reply ?? null, assignee: patch.assignee ?? null, ts: nowIso(), id },
  );
}

export function platformOverview() {
  const db = getDb();
  return {
    residences: db.all<{ name: string; city: string; status: string; owner: string }>(
      `SELECT p.name, p.city, p.status, TRIM(u.first_name || ' ' || u.last_name) AS owner FROM properties p JOIN users u ON u.id = p.user_id ORDER BY p.status LIMIT 8`,
    ),
    invoices: db.all<{ number: string; amount_cents: number; status: string; issued_at: string; user: string }>(
      `SELECT i.number, i.amount_cents, i.status, i.issued_at, TRIM(u.first_name || ' ' || u.last_name) AS user
         FROM invoices i JOIN users u ON u.id = i.user_id ORDER BY i.issued_at DESC LIMIT 8`,
    ),
  };
}
