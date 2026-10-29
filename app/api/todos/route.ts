import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {members,todos} from '../../../db/schema';
import {eq,and} from 'drizzle-orm';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403});
 const db=getDb();if(!(await db.select().from(members).where(eq(members.id,user.userId)))[0]?.seat)return Response.json({error:'请先选座'},{status:403});
 let data:any;try{data=await request.json()}catch{return Response.json({error:'格式无效'},{status:400})}
 if(!data||typeof data.body!=='string'||data.body.length>3000||!Number.isInteger(data.version)||data.version<0)return Response.json({error:'便签最多 3000 字'},{status:400});
 if(data.userId&&data.userId!==user.userId)return Response.json({error:'只能编辑自己的便签'},{status:403});
 const now=new Date().toISOString();
 if(data.version===0){try{await db.insert(todos).values({userId:user.userId,body:data.body,version:1,updated:now})}catch(e){if(/constraint|unique/i.test(String(e)+String((e as any)?.cause)))return Response.json({error:'便签已在其他窗口更新，请先重新打开核对'},{status:409});throw e}}
 else {const rows=await db.update(todos).set({body:data.body,version:data.version+1,updated:now}).where(and(eq(todos.userId,user.userId),eq(todos.version,data.version))).returning();if(!rows.length)return Response.json({error:'便签已在其他窗口更新，请先重新打开核对'},{status:409})}
 return Response.json({ok:true,version:data.version+1});
}
