-- Remove interview rows that were automatically backfilled and never configured.
delete from media_project_stages
where stage = 'homeowner_interview'
  and status in ('pending', 'cancelled')
  and scheduled_at is null
  and assigned_to is null
  and shot_list is null
  and notes is null
  and completed_at is null;

-- Earlier versions represented skipped phases as freshly completed rows.
-- Remove only untouched rows completed automatically at creation time.
delete from media_project_stages
where stage in ('survey', 'installation')
  and status = 'completed'
  and scheduled_at is null
  and assigned_to is null
  and shot_list is null
  and notes is null
  and completed_at is not null
  and abs(extract(epoch from (completed_at - created_at))) <= 5;
