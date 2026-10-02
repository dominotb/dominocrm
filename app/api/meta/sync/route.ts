import {NextResponse} from 'next/server';
export async function POST(){
 const token=process.env.META_ACCESS_TOKEN; const account=process.env.META_AD_ACCOUNT_ID;
 if(!token||!account) return NextResponse.json({ok:false,message:'Chưa cấu hình META_ACCESS_TOKEN / META_AD_ACCOUNT_ID'},{status:400});
 // Production: call Meta Marketing API, normalize Campaign -> Ad Set -> Ad and upsert Supabase.
 return NextResponse.json({ok:true,message:'Meta sync endpoint ready. Add production Meta credentials to enable live sync.'});
}
