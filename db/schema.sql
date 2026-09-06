-- ============================================================
--  VELORA PRIVATE — schema (SQLite / Postgres-portable subset)
--  All business rows carry user_id: the repository layer filters on it,
--  which is what guarantees tenant isolation.
--  Money is stored as INTEGER cents. Dates as ISO-8601 TEXT (UTC).
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  country           TEXT,
  timezone          TEXT NOT NULL DEFAULT 'Europe/Paris',
  locale            TEXT NOT NULL DEFAULT 'en-GB',
  currency          TEXT NOT NULL DEFAULT 'EUR',
  avatar_initials   TEXT,
  briefing_time     TEXT NOT NULL DEFAULT '07:00',
  notifications_json TEXT NOT NULL DEFAULT '{}',
  sessions_revoked_at TEXT,          -- JWTs issued before this instant are dead
  last_login_at       TEXT,
  utm_source          TEXT,          -- frozen at sign-up from the landing's cookie
  utm_medium          TEXT,
  utm_campaign        TEXT,
  utm_content         TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS properties (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  city                 TEXT NOT NULL,
  country              TEXT NOT NULL,
  kind                 TEXT NOT NULL DEFAULT 'residence'
                         CHECK (kind IN ('residence','apartment','villa','chalet','estate','penthouse','townhouse')),
  status               TEXT NOT NULL DEFAULT 'operational'
                         CHECK (status IN ('operational','attention','maintenance','standby')),
  is_primary           INTEGER NOT NULL DEFAULT 0,
  bedrooms             INTEGER NOT NULL DEFAULT 0,
  bathrooms            INTEGER NOT NULL DEFAULT 0,
  area_sqm             INTEGER NOT NULL DEFAULT 0,
  staff_on_site        INTEGER NOT NULL DEFAULT 0,
  temperature_c        REAL,
  humidity_pct         REAL,
  last_maintenance_at  TEXT,
  next_service_at      TEXT,
  monthly_ops_cents    INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  accent               TEXT NOT NULL DEFAULT 'gold' CHECK (accent IN ('gold','ivory','graphite','sage','steel')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_properties_user ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(user_id, status);

CREATE TABLE IF NOT EXISTS staff (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id     TEXT REFERENCES properties(id) ON DELETE SET NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN
                    ('estate_manager','housekeeper','driver','security','chef','maintenance',
                     'personal_assistant','gardener','butler','nanny')),
  status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('on_site','available','off_duty','on_leave','unreachable')),
  employment      TEXT NOT NULL DEFAULT 'full_time'
                    CHECK (employment IN ('full_time','part_time','daily','agency','on_call')),
  email           TEXT,
  phone           TEXT,
  languages       TEXT NOT NULL DEFAULT '[]',   -- JSON array
  years_with_house INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT,
  last_activity   TEXT,
  next_task       TEXT,
  rating          INTEGER,                       -- internal service score 0-100
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_property ON staff(property_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(user_id, role);

CREATE TABLE IF NOT EXISTS vehicles (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id       TEXT REFERENCES properties(id) ON DELETE SET NULL,
  make              TEXT NOT NULL,
  model             TEXT NOT NULL,
  year              INTEGER NOT NULL,
  plate             TEXT,
  kind              TEXT NOT NULL DEFAULT 'suv' CHECK (kind IN ('suv','gt','sedan','van','sport','limousine','cabriolet')),
  mileage_km        INTEGER NOT NULL DEFAULT 0,
  service_interval_km INTEGER NOT NULL DEFAULT 15000,
  last_service_at   TEXT,
  next_service_at   TEXT,
  next_service_km   INTEGER,
  insurance_provider TEXT,
  insurance_status  TEXT NOT NULL DEFAULT 'active'
                      CHECK (insurance_status IN ('active','expiring','expired','pending')),
  insurance_expires_at TEXT,
  location          TEXT,
  assigned_driver_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'ready'
                      CHECK (status IN ('ready','in_use','in_service','stored','unavailable')),
  fuel_level_pct    INTEGER,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);

CREATE TABLE IF NOT EXISTS trips (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  origin_city    TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  property_id    TEXT REFERENCES properties(id) ON DELETE SET NULL,
  starts_at      TEXT NOT NULL,
  ends_at        TEXT,
  mode           TEXT NOT NULL DEFAULT 'car' CHECK (mode IN ('car','road','train','flight','jet','helicopter','boat')),
  status         TEXT NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('draft','pending','confirmed','in_progress','completed','cancelled')),
  travelers      INTEGER NOT NULL DEFAULT 1,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trips_user_start ON trips(user_id, starts_at);

CREATE TABLE IF NOT EXISTS trip_legs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  kind        TEXT NOT NULL CHECK (kind IN ('transfer','flight','train','arrival','house','dinner','meeting','departure')),
  label       TEXT NOT NULL,
  detail      TEXT,
  at          TEXT,
  provider    TEXT,
  reference   TEXT,
  status      TEXT NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed','requested','pending','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_legs_trip ON trip_legs(trip_id, position);

CREATE TABLE IF NOT EXISTS expense_categories (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  label   TEXT NOT NULL,
  tone    TEXT NOT NULL DEFAULT 'graphite',
  UNIQUE (user_id, key)
);

CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id  TEXT REFERENCES properties(id) ON DELETE SET NULL,
  category_key TEXT NOT NULL,
  description  TEXT NOT NULL,
  vendor       TEXT,
  amount_cents INTEGER NOT NULL,
  spent_on     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'recorded'
                 CHECK (status IN ('recorded','pending','approved','disputed')),
  requires_review INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(user_id, category_key);

CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id   TEXT REFERENCES properties(id) ON DELETE SET NULL,
  staff_id      TEXT REFERENCES staff(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'maintenance' CHECK (category IN
                  ('maintenance','housekeeping','travel','security','lifestyle','finance','staff','vehicles')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','awaiting_confirmation','done','blocked')),
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  due_at        TEXT,
  completed_at  TEXT,
  origin        TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','ai','system','staff')),
  origin_ref    TEXT,
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  detail        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_property ON tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(user_id, due_at);

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id  TEXT REFERENCES properties(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN
                 ('contracts','invoices','insurance','real_estate','maintenance','suppliers','identity','vehicles')),
  file_type    TEXT NOT NULL DEFAULT 'pdf',
  size_kb      INTEGER NOT NULL DEFAULT 0,
  version      INTEGER NOT NULL DEFAULT 1,
  owner        TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  visibility   TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','household','advisers')),
  status       TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','expiring','expired','draft')),
  expires_at   TEXT,
  uploaded_at  TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  notes        TEXT,
  /** relative path under data/uploads — never an absolute client path */
  stored_path  TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_user_cat ON documents(user_id, category);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'command_center'
               CHECK (channel IN ('command_center','briefing','voice')),
  provider   TEXT NOT NULL DEFAULT 'velora-demo',
  model      TEXT NOT NULL DEFAULT 'velora-coordinator',
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON ai_conversations(user_id, updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  payload_json    TEXT,          -- structured blocks rendered by the UI
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  module        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','confirmed','requires_confirmation','done','declined')),
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  confidence    REAL NOT NULL DEFAULT 0.9,
  detail        TEXT,
  task_id       TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks(user_id, status);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan              TEXT NOT NULL CHECK (plan IN ('private','priority','private_office')),
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('trialing','active','past_due','paused','cancelled','incomplete')),
  billing_cycle     TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  provider          TEXT NOT NULL DEFAULT 'demo' CHECK (provider IN ('demo','stripe')),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  started_at        TEXT NOT NULL,
  cancelled_at      TEXT,
  updated_at        TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_single ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  number          TEXT NOT NULL,
  description     TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  status          TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','open','void','refunded')),
  issued_at       TEXT NOT NULL,
  paid_at         TEXT,
  receipt_url     TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, issued_at);

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'system'
                 CHECK (kind IN ('insight','task','travel','property','billing','security','system','ai')),
  title        TEXT NOT NULL,
  body         TEXT,
  severity     TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','attention','critical')),
  action_label TEXT,
  action_href  TEXT,
  read_at      TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at, created_at);

CREATE TABLE IF NOT EXISTS access_requests (
  id                  TEXT PRIMARY KEY,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT NOT NULL,
  country             TEXT NOT NULL,
  residences          INTEGER NOT NULL DEFAULT 1,
  primary_requirement TEXT NOT NULL,
  message             TEXT,
  referrer            TEXT,
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  utm_content         TEXT,
  status              TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','reviewing','invited','declined','archived')),
  reviewer_note       TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_status ON access_requests(status, created_at);

CREATE TABLE IF NOT EXISTS tickets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject    TEXT NOT NULL,
  body       TEXT,
  priority   TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','answered','closed')),
  assignee   TEXT,
  reply      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, created_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  event      TEXT NOT NULL,
  target     TEXT,
  meta       TEXT,
  ip_hash    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);

CREATE TABLE IF NOT EXISTS reservations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id  TEXT REFERENCES properties(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL DEFAULT 'restaurant'
                 CHECK (kind IN ('restaurant','event','experience','yacht','spa','retail','aviation','club')),
  title        TEXT NOT NULL,
  vendor       TEXT,
  city         TEXT,
  starts_at    TEXT,
  guests       INTEGER NOT NULL DEFAULT 2,
  status       TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('requested','pending','confirmed','completed','cancelled','unavailable')),
  reference    TEXT,
  dress_code   TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_res_user ON reservations(user_id, starts_at);
