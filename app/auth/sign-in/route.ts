import {NextRequest, NextResponse} from 'next/server';
import {createAuthClient, upsertCurrentProfile} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=missing', req.url), {status: 303});
  }

  const supabase = await createAuthClient();
  const {data, error} = await supabase.auth.signInWithPassword({email, password});

  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid', req.url), {status: 303});
  }

  if (data.user) {
    await upsertCurrentProfile(data.user);
  }

  return NextResponse.redirect(new URL('/', req.url), {status: 303});
}
