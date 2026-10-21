create table if not exists media_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null check (nullif(btrim(project_name), '') is not null),
  customer_name text,
  address text not null check (nullif(btrim(address), '') is not null),
  contact_phone text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references media_projects(id) on delete cascade,
  stage text not null check (stage in ('survey', 'installation', 'handover')),
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  assigned_to uuid references profiles(id) on delete set null,
  shot_list text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, stage)
);

create index if not exists media_project_stages_schedule_idx on media_project_stages (scheduled_at, status) where status in ('pending', 'scheduled');
create index if not exists media_project_stages_project_idx on media_project_stages (project_id, stage);
alter table media_projects enable row level security;
alter table media_project_stages enable row level security;
revoke all on table media_projects, media_project_stages from anon, authenticated;
grant select, insert, update, delete on table media_projects, media_project_stages to service_role;
