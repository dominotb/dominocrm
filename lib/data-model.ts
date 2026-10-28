export type CampaignRow = {
  id: string;
  adAccountId: string | null;
  name: string;
  status: string;
  spend: number;
  messages: number;
  leads: number;
  qualified: number;
  cpl: number;
};

export type AdAccountRow = {id: string; name: string};
export type EntityMetric = {
  spend: number;
  messages: number;
  leads: number;
  qualified: number;
  cpl: number;
};

export type AdSetRow = EntityMetric & {id: string; campaignId: string; name: string; status: string};
export type AdRow = EntityMetric & {id: string; adSetId: string; name: string; status: string};

export type DailyRow = {
  day: string;
  date: string;
  spend: number;
  messages: number;
  leads: number;
  source: 'Supabase' | 'Nhập tay';
};

export type CampaignDailyRow = {
  date: string;
  campaignId: string;
  spend: number;
  messages: number;
  leads: number;
  qualified: number;
};

export type LeadQualitySummary = {
  total: number;
  qualified: number;
  reviewing: number;
  unqualified: number;
  fanpage: number;
  fanpageQualified: number;
  contracts: number;
  fanpageContracts: number;
  revenue: number;
  tiktok: number;
  youtube: number;
  website: number;
};

export type LeadDailyRow = LeadQualitySummary & {date: string};
export type ChannelMessageRow = {date: string; source: string; messages: number};
export type LeadAttributeRow = {date: string; segment: string; sceneCode: string};

export type DashboardData = {
  adAccounts: AdAccountRow[];
  campaigns: CampaignRow[];
  adSets: AdSetRow[];
  ads: AdRow[];
  daily: DailyRow[];
  campaignDaily: CampaignDailyRow[];
  leadQuality: LeadQualitySummary;
  leadDaily: LeadDailyRow[];
  channelMessages: ChannelMessageRow[];
  leadAttributes: LeadAttributeRow[];
  totals: {
    spend: number;
    messages: number;
    leads: number;
    qualified: number;
    cpl: number;
  };
  connected: boolean;
  error?: string;
};

export const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
