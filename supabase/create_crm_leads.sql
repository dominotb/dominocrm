create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  customer_id uuid references customers(id) on delete set null,
  account_name text not null check (btrim(account_name) <> ''),
  source text not null check (source in ('Tiktok','Website','Fanpage','Youtube','Khách tự đến showroom')),
  real_name text,
  phone text,
  has_zalo boolean not null default false,
  address text,
  account_link text,
  status text not null default 'Đang tiếp nhận' check (status in ('Đang tiếp nhận','Gửi báo giá','Lên showroom','Tư vấn tại nhà','Chốt hợp đồng','Giới thiệu khách mới','Sổ quét','Đi khảo sát','Chưa nghe máy')),
  description text,
  segment text,
  scene_code text,
  quote_value numeric check (quote_value >= 0),
  ended_at timestamptz,
  end_reason text,
  created_by uuid references profiles(id),
  check (nullif(btrim(phone), '') is not null or has_zalo)
);

create index if not exists crm_leads_created_at_idx on crm_leads(created_at desc);
create index if not exists crm_leads_phone_idx on crm_leads(phone);
create index if not exists crm_leads_status_idx on crm_leads(status);

alter table crm_leads alter column real_name drop not null;
alter table crm_leads alter column phone drop not null;
