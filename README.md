# DOMINO Marketing CRM — Ads Management V1

Responsive Next.js CRM foundation for DOMINO Marketing. Desktop uses an analytics workspace; mobile changes to an app-like layout with bottom navigation and campaign cards.

## Included
- Ads overview dashboard: spend, messages, leads, qualified leads, CPL and chart.
- Campaign / Ad Set / Ad hierarchy UI.
- Marketing plan target vs actual foundation.
- Daily Ads Snapshot reporting screen and Vercel cron endpoint.
- Supabase SQL schema for RBAC, Meta entities, daily metrics, plans, conversations/tags, customers and attribution.
- Roles seeded: Giám đốc, Trưởng phòng Marketing, Media, Marketing tổng hợp, Kế toán, Sale Admin.
- Multi-role RBAC data model.
- Meta sync API scaffold. Live Meta calls require credentials and app permissions.
- Responsive breakpoints, mobile bottom nav, table-to-card transformation, hover/transition interactions.

## Run
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000.

## Supabase
Run `supabase/schema.sql` in Supabase SQL Editor. Then configure the `.env.local` values.

## Meta integration
Configure a Meta app and appropriate Marketing API / messaging permissions, then set `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`. The `/api/meta/sync` route is deliberately a safe scaffold rather than shipping a hard-coded token.

Hierarchy must remain: Ad Account -> Campaign -> Ad Set -> Ad. Child dropdowns must be queried by parent ID so entities never mix between campaigns.

## Daily snapshot
`vercel.json` runs `/api/daily-snapshot` at 17:15 UTC (00:15 Vietnam time). For production reporting, add a later D-1 reconciliation job because Meta attribution can be revised after midnight.

## Production next steps
1. Add Supabase Auth and RLS policies.
2. Implement Meta OAuth and token storage/refresh rather than manually storing long-lived tokens.
3. Implement Marketing API pagination and Insights upserts.
4. Add Messenger/Page conversation ingestion and Meta tag -> CRM status mapping according to permissions available to the Meta app.
5. Add audit logs and fine-grained permission guards to routes/actions.
6. Add reconciliation jobs for D-1 / D-2 metrics.
