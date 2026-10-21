import {createServiceClient} from './supabase';

export type TeamTask = {id: string; branch: string; title: string; description: string; assignedTo: string; assigneeName: string; status: string; startsOn: string; dueOn: string};

export async function getTeamTasks(): Promise<TeamTask[]> {
  const {data, error} = await createServiceClient().from('marketing_team_tasks').select('id,branch,title,description,assigned_to,status,starts_on,due_on,profiles!marketing_team_tasks_assigned_to_fkey(full_name)').order('created_at', {ascending: false});
  if (error) return [];
  return (data || []).map((row) => {
    const profile = row.profiles as {full_name?: string} | {full_name?: string}[] | null;
    return {id: row.id, branch: row.branch, title: row.title, description: row.description || '', assignedTo: row.assigned_to || '', assigneeName: (Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name) || 'Chưa giao', status: row.status, startsOn: row.starts_on || '', dueOn: row.due_on || ''};
  });
}
