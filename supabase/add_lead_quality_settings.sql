alter table crm_leads
  add column if not exists quality text not null default 'Đang đánh giá'
  check (quality in ('Đang đánh giá','Đạt chất lượng','Không phù hợp'));

alter table crm_leads add column if not exists has_zalo boolean not null default false;
alter table crm_leads add column if not exists segment text;
alter table crm_leads add column if not exists scene_code text;
alter table crm_leads add column if not exists quote_value numeric check (quote_value >= 0);
alter table crm_leads add column if not exists ended_at timestamptz;
alter table crm_leads add column if not exists end_reason text;
alter table crm_leads drop constraint if exists crm_leads_source_check;
alter table crm_leads add constraint crm_leads_source_check
  check (source in ('Tiktok','Website','Fanpage','Youtube','Khách tự đến showroom'));
alter table crm_leads alter column status set default 'Đang tiếp nhận';
alter table crm_leads drop constraint if exists crm_leads_status_check;
alter table crm_leads add constraint crm_leads_status_check
  check (status in ('Đang tiếp nhận','Gửi báo giá','Lên showroom','Tư vấn tại nhà','Chốt hợp đồng','Giới thiệu khách mới','Sổ quét','Đi khảo sát','Chưa nghe máy'));
alter table crm_leads drop constraint if exists crm_leads_account_name_required;
alter table crm_leads add constraint crm_leads_account_name_required
  check (nullif(btrim(account_name), '') is not null) not valid;
alter table crm_leads drop constraint if exists crm_leads_phone_or_zalo_required;
alter table crm_leads add constraint crm_leads_phone_or_zalo_required
  check (nullif(btrim(phone), '') is not null or has_zalo) not valid;

create index if not exists crm_leads_quality_idx on crm_leads(quality);
create index if not exists crm_leads_source_idx on crm_leads(source);
create index if not exists crm_leads_segment_idx on crm_leads(segment);
create index if not exists crm_leads_scene_code_idx on crm_leads(scene_code);

create table if not exists crm_checklist_items (
  id uuid primary key default gen_random_uuid(),
  group_key text not null check (group_key in ('segments','scene_codes','lead_statuses','lead_quality','job_positions','work_branches')),
  label text not null,
  value text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_key, label)
);

create index if not exists crm_checklist_items_group_idx on crm_checklist_items(group_key, sort_order, label);

alter table crm_checklist_items drop constraint if exists crm_checklist_items_group_key_check;
alter table crm_checklist_items add constraint crm_checklist_items_group_key_check
  check (group_key in ('segments','scene_codes','lead_statuses','lead_quality','job_positions','work_branches'));

insert into crm_checklist_items(group_key, label, value, sort_order) values
  ('segments', 'BASIC - TIÊU CHUẨN', 'BASIC - TIÊU CHUẨN', 1),
  ('segments', 'SIGNATURE - NÂNG CAO', 'SIGNATURE - NÂNG CAO', 2),
  ('segments', 'PREMIUM- CAO CẤP', 'PREMIUM- CAO CẤP', 3),
  ('segments', 'PREMIUM - CAO CẤP KÍNH NHÁM', 'PREMIUM - CAO CẤP KÍNH NHÁM', 4),
  ('segments', 'VIP 1', 'VIP 1', 5),
  ('segments', 'VIP 3', 'VIP 3', 6),
  ('scene_codes', 'TVT-02', 'TVT-02', 1),
  ('scene_codes', 'TVT-03', 'TVT-03', 2),
  ('scene_codes', 'TVT-01', 'TVT-01', 3),
  ('scene_codes', 'TA - 01', 'TA - 01', 4),
  ('scene_codes', 'TA - 02', 'TA - 02', 5),
  ('scene_codes', 'TA- N-01', 'TA- N-01', 6),
  ('scene_codes', 'TA -N- 02', 'TA -N- 02', 7),
  ('scene_codes', 'TA-B-01', 'TA-B-01', 8),
  ('scene_codes', 'TA -B- 02', 'TA -B- 02', 9),
  ('lead_statuses', 'Gửi báo giá', 'Gửi báo giá', 1),
  ('lead_statuses', 'Đang tiếp nhận', 'Đang tiếp nhận', 0),
  ('lead_statuses', 'Lên showroom', 'Lên showroom', 2),
  ('lead_statuses', 'Tư vấn tại nhà', 'Tư vấn tại nhà', 3),
  ('lead_statuses', 'Chốt hợp đồng', 'Chốt hợp đồng', 4),
  ('lead_statuses', 'Giới thiệu khách mới', 'Giới thiệu khách mới', 5),
  ('lead_statuses', 'Sổ quét', 'Sổ quét', 6),
  ('lead_statuses', 'Đi khảo sát', 'Đi khảo sát', 7),
  ('lead_statuses', 'Chưa nghe máy', 'Chưa nghe máy', 8),
  ('lead_quality', 'Đang đánh giá', 'Đang đánh giá', 1),
  ('lead_quality', 'Đạt chất lượng', 'Đạt chất lượng', 2),
  ('lead_quality', 'Không phù hợp', 'Không phù hợp', 3)
on conflict (group_key, label) do nothing;

-- Số tin nhắn ngoài Fanpage để tổng hợp dashboard theo ngày.
-- Fanpage tiếp tục được đồng bộ tự động từ ad_daily_metrics.
create table if not exists crm_channel_daily_metrics (
  id bigint generated always as identity primary key,
  metric_date date not null,
  source text not null check (source in ('Tiktok','Youtube','Website')),
  messages bigint not null default 0 check (messages >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metric_date, source)
);

create index if not exists crm_channel_daily_metrics_date_idx
  on crm_channel_daily_metrics(metric_date desc, source);

alter table crm_channel_daily_metrics enable row level security;

-- Quản lý nhân sự, kích hoạt tài khoản và công việc Marketing - Truyền thông.
alter table profiles add column if not exists employee_code text unique;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists position text;
alter table profiles add column if not exists must_change_password boolean not null default false;
alter table profiles add column if not exists profile_completed boolean not null default true;
alter table profiles add column if not exists updated_at timestamptz not null default now();

insert into crm_checklist_items(group_key, label, value, sort_order) values
  ('job_positions', 'Trưởng phòng Marketing', 'Trưởng phòng Marketing', 1),
  ('job_positions', 'Nhân viên Marketing', 'Nhân viên Marketing', 2),
  ('job_positions', 'Nhân viên Media', 'Nhân viên Media', 3),
  ('job_positions', 'Editor', 'Editor', 4),
  ('work_branches', 'Content', 'Content', 1),
  ('work_branches', 'Media', 'Media', 2),
  ('work_branches', 'Editor', 'Editor', 3),
  ('work_branches', 'Digital Marketing', 'Digital Marketing', 4)
on conflict (group_key, label) do nothing;

create table if not exists marketing_team_tasks (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  title text not null check (nullif(btrim(title), '') is not null),
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  status text not null default 'Đang thực hiện'
    check (status in ('Chưa bắt đầu','Đang thực hiện','Tạm dừng','Hoàn thành')),
  starts_on date,
  due_on date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_team_tasks_assigned_idx on marketing_team_tasks(assigned_to, status);
create index if not exists marketing_team_tasks_branch_idx on marketing_team_tasks(branch, status);
alter table marketing_team_tasks enable row level security;
grant select, insert, update, delete on table marketing_team_tasks to service_role;
