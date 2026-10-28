alter table public.crm_leads
  add column if not exists quote_value numeric
  check (quote_value >= 0);
