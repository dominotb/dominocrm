alter table media_projects alter column address drop not null;
alter table media_projects drop constraint if exists media_projects_address_check;
alter table media_projects add column if not exists map_url text;
alter table media_projects add column if not exists scheduled_at timestamptz;
alter table media_projects add column if not exists status text not null default 'active';
alter table media_projects add column if not exists cancellation_reason text;
alter table media_projects add column if not exists cancelled_at timestamptz;
alter table media_projects drop constraint if exists media_projects_status_check;
alter table media_projects add constraint media_projects_status_check check (status in ('active', 'cancelled'));
alter table media_projects drop constraint if exists media_projects_cancel_reason_check;
alter table media_projects add constraint media_projects_cancel_reason_check check (
  status <> 'cancelled' or nullif(btrim(cancellation_reason), '') is not null
);
create index if not exists media_projects_status_schedule_idx on media_projects (status, scheduled_at);
