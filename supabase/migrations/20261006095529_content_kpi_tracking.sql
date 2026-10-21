create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('tiktok', 'fanpage', 'youtube', 'website')),
  content_type text not null default 'post' check (content_type in ('post', 'video', 'article', 'short', 'reel')),
  title text not null check (nullif(btrim(title), '') is not null),
  content_url text,
  external_id text,
  published_at timestamptz not null,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_id)
);

create table if not exists content_metric_snapshots (
  id bigint generated always as identity primary key,
  content_id uuid not null references content_items(id) on delete cascade,
  metric_date date not null default current_date,
  views bigint not null default 0 check (views >= 0),
  reach bigint not null default 0 check (reach >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  shares bigint not null default 0 check (shares >= 0),
  saves bigint not null default 0 check (saves >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  leads bigint not null default 0 check (leads >= 0),
  watch_time_seconds bigint not null default 0 check (watch_time_seconds >= 0),
  source text not null default 'manual' check (source in ('manual', 'api')),
  synced_at timestamptz not null default now(),
  unique (content_id, metric_date)
);

create table if not exists content_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  month date not null check (month = date_trunc('month', month)::date),
  platform text not null check (platform in ('tiktok', 'fanpage', 'youtube', 'website')),
  posts_target int not null default 0 check (posts_target >= 0),
  views_target bigint not null default 0 check (views_target >= 0),
  engagement_rate_target numeric(8,4) not null default 0 check (engagement_rate_target >= 0),
  leads_target int not null default 0 check (leads_target >= 0),
  created_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (month, platform)
);

create index if not exists content_items_platform_published_idx on content_items (platform, published_at desc);
create index if not exists content_metric_snapshots_content_date_idx on content_metric_snapshots (content_id, metric_date desc);
create index if not exists content_kpi_targets_month_idx on content_kpi_targets (month, platform);

alter table content_items enable row level security;
alter table content_metric_snapshots enable row level security;
alter table content_kpi_targets enable row level security;
revoke all on table content_items, content_metric_snapshots, content_kpi_targets from anon, authenticated;
grant select, insert, update, delete on table content_items, content_metric_snapshots, content_kpi_targets to service_role;
grant usage, select on sequence content_metric_snapshots_id_seq to service_role;
