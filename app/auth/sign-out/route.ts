import {NextRequest, NextResponse} from 'next/server';
import {createAuthClient} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/login', req.url), {status: 303});
}
