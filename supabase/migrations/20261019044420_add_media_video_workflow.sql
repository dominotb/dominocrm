alter table media_project_stages
  add column if not exists workflow_status text not null default 'waiting',
  add column if not exists published_url text,
  add column if not exists published_at timestamptz;

alter table media_project_stages drop constraint if exists media_project_stages_workflow_status_check;
alter table media_project_stages add constraint media_project_stages_workflow_status_check
  check (workflow_status in ('waiting', 'filmed', 'editing', 'ready', 'published'));

update media_project_stages
set workflow_status = 'filmed'
where status = 'completed' and workflow_status = 'waiting';

create index if not exists media_project_stages_workflow_idx
  on media_project_stages (project_id, workflow_status);
