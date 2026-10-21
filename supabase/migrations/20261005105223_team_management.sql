alter table profiles add column if not exists employee_code text unique;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists position text;
alter table profiles add column if not exists must_change_password boolean not null default false;
alter table profiles add column if not exists profile_completed boolean not null default true;
alter table profiles add column if not exists updated_at timestamptz not null default now();

alter table crm_checklist_items drop constraint if exists crm_checklist_items_group_key_check;
alter table crm_checklist_items add constraint crm_checklist_items_group_key_check
  check (group_key in ('segments','scene_codes','lead_statuses','lead_quality','job_positions','work_branches'));

insert into crm_checklist_items(group_key,label,value,sort_order) values
  ('job_positions','Trưởng phòng Marketing','Trưởng phòng Marketing',1),
  ('job_positions','Nhân viên Marketing','Nhân viên Marketing',2),
  ('job_positions','Nhân viên Media','Nhân viên Media',3),
  ('job_positions','Editor','Editor',4),
  ('work_branches','Content','Content',1),
  ('work_branches','Media','Media',2),
  ('work_branches','Editor','Editor',3),
  ('work_branches','Digital Marketing','Digital Marketing',4)
on conflict (group_key,label) do nothing;

create table if not exists marketing_team_tasks (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  title text not null check (nullif(btrim(title),'') is not null),
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  status text not null default 'Đang thực hiện' check (status in ('Chưa bắt đầu','Đang thực hiện','Tạm dừng','Hoàn thành')),
  starts_on date,
  due_on date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_team_tasks_assigned_idx on marketing_team_tasks(assigned_to,status);
create index if not exists marketing_team_tasks_branch_idx on marketing_team_tasks(branch,status);
alter table marketing_team_tasks enable row level security;
grant select, insert, update, delete on table marketing_team_tasks to service_role;
