alter table media_project_stages
  drop constraint if exists media_project_stages_stage_check;

alter table media_project_stages
  add constraint media_project_stages_stage_check
  check (stage in ('survey', 'installation', 'handover', 'homeowner_interview'));

insert into media_project_stages (project_id, stage, status)
select
  id,
  'homeowner_interview',
  case when status = 'cancelled' then 'cancelled' else 'pending' end
from media_projects
on conflict (project_id, stage) do nothing;
