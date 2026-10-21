import {NextRequest, NextResponse} from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ok: false}, {status: 401});
  }

  const response = await fetch(new URL('/api/meta/sync', req.url), {method: 'POST', cache: 'no-store'});
  const payload = await response.json();

  return NextResponse.json({ok: response.ok, job: 'daily-snapshot', date: new Date().toISOString(), meta: payload}, {status: response.status});
}
