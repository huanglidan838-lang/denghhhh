import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {members,photos} from '../../../db/schema';
import {eq} from 'drizzle-orm';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403});
 const db=getDb(),person=(await db.select().from(members).where(eq(members.id,user.userId)))[0];if(!person?.seat)return Response.json({error:'请先选座'},{status:403});
 if(Number(request.headers.get('content-length'))>6*1024*1024)return Response.json({error:'图片不能超过 5 MB'},{status:413});
 let form;try{form=await request.formData()}catch{return Response.json({error:'上传格式无效'},{status:400})}
 const file=form.get('file'),caption=String(form.get('caption')||'').trim();if(!(file instanceof File)||file.size===0||file.size>5*1024*1024||caption.length>200)return Response.json({error:'请选择 5 MB 内的图片，配文不超过 200 字'},{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer());let mime='';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
 else if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))mime='image/png';
 else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')mime='image/webp';
 if(!mime)return Response.json({error:'支持 JPG、PNG、WebP 图片'},{status:400});
 if(!env.BUCKET)return Response.json({error:'图片存储暂不可用'},{status:503});
 const id=crypto.randomUUID(),key=`photos/${id}`;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await db.insert(photos).values({id,userId:user.userId,key,caption,created:new Date().toISOString()})}catch(e){await env.BUCKET.delete(key);throw e}
 return Response.json({ok:true,id});
}
