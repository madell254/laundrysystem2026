CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  department TEXT,
  location TEXT,
  phone_number TEXT,
  avatar_url TEXT,
  max_active_laundry INTEGER,
  max_items_per_submission INTEGER,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns that may be missing in older installations
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_active_laundry INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_items_per_submission INTEGER;

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laundry_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laundry (
  id SERIAL PRIMARY KEY,
  record_id TEXT NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  laundry_type TEXT NOT NULL DEFAULT 'laundry',
  location TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  staff_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_by TEXT,
  handled_by_user_id INTEGER
);

CREATE INDEX IF NOT EXISTS laundry_employee_id_idx ON laundry (employee_id);
CREATE INDEX IF NOT EXISTS laundry_status_idx ON laundry (status);
CREATE INDEX IF NOT EXISTS laundry_submitted_at_idx ON laundry (submitted_at);
CREATE INDEX IF NOT EXISTS laundry_employee_status_idx ON laundry (employee_id, status);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  record_id INTEGER,
  record_code TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, read);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  record_id INTEGER,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v2.7: new laundry status tracking columns
ALTER TABLE laundry ADD COLUMN IF NOT EXISTS washing_at TIMESTAMPTZ;
ALTER TABLE laundry ADD COLUMN IF NOT EXISTS drying_at TIMESTAMPTZ;
ALTER TABLE laundry ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS laundry_cancelled_at_idx ON laundry (cancelled_at);
