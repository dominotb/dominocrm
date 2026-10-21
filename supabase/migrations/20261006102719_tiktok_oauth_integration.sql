create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('tiktok')),
  external_account_id text not null,
  display_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  connected_by uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_account_id)
);

create index if not exists integration_connections_provider_status_idx on integration_connections (provider, status);
alter table integration_connections enable row level security;
revoke all on table integration_connections from anon, authenticated;
grant select, insert, update, delete on table integration_connections to service_role;
