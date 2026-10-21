import {createServiceClient} from './supabase';

export type MarketingPlan = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  budget: number;
  targetMessages: number;
  targetLeads: number;
  targetQualifiedLeads: number;
  targetCpl: number;
  entityType: 'campaign' | 'adset' | 'ad' | null;
  entityId: string | null;
};

export async function getMarketingPlans(): Promise<MarketingPlan[]> {
  const service = createServiceClient();
  const {data, error} = await service
    .from('marketing_plans')
    .select('id,name,starts_on,ends_on,budget,target_messages,target_leads,target_qualified_leads,target_cpl,marketing_plan_entities(entity_type,entity_id)')
    .order('starts_on', {ascending: false});

  if (error) throw error;

  return (data || []).map((row) => {
    const rawEntities = row.marketing_plan_entities as {entity_type: 'campaign' | 'adset' | 'ad'; entity_id: string}[] | null;
    const entity = rawEntities?.[0];
    return {
      id: row.id,
      name: row.name,
      startsOn: row.starts_on || '',
      endsOn: row.ends_on || '',
      budget: Number(row.budget || 0),
      targetMessages: Number(row.target_messages || 0),
      targetLeads: Number(row.target_leads || 0),
      targetQualifiedLeads: Number(row.target_qualified_leads || 0),
      targetCpl: Number(row.target_cpl || 0),
      entityType: entity?.entity_type || null,
      entityId: entity?.entity_id || null,
    };
  });
}
