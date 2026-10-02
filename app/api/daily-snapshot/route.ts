import {NextRequest,NextResponse} from 'next/server';
export async function GET(req:NextRequest){
 const secret=req.headers.get('authorization');
 if(process.env.CRON_SECRET && secret!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ok:false},{status:401});
 // Recommended schedule: 00:15 local snapshot + later reconciliation because attribution can change after midnight.
 return NextResponse.json({ok:true,job:'daily-snapshot',date:new Date().toISOString()});
}
