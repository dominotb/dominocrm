create table if not exists daily_manual_reports (
  id uuid primary key default gen_random_uuid(), report_date date not null unique,
  content text not null check (nullif(btrim(content), '') is not null),
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists daily_manual_reports_date_idx on daily_manual_reports (report_date desc);
alter table daily_manual_reports enable row level security;
revoke all on table daily_manual_reports from anon, authenticated;
grant select, insert, update, delete on table daily_manual_reports to service_role;

alter table integration_connections drop constraint if exists integration_connections_provider_check;
alter table integration_connections add constraint integration_connections_provider_check check (provider in ('tiktok', 'meta'));
alter table integration_connections alter column refresh_token_encrypted drop not null;
alter table integration_connections alter column refresh_token_expires_at drop not null;
alter table integration_connections add column if not exists metadata jsonb not null default '{}'::jsonb;
