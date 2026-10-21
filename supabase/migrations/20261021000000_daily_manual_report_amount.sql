alter table daily_manual_reports
  add column if not exists amount numeric(14, 0) check (amount >= 0);

alter table daily_manual_reports
  add column if not exists messages bigint check (messages >= 0);

-- Các bản ghi cũ là ghi chú văn bản; giữ lại để không làm mất dữ liệu,
-- nhưng từ phiên bản này biểu mẫu chỉ ghi nhận số tiền theo ngày.
alter table daily_manual_reports
  alter column content drop not null;
