import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {getDb} from '../../../../../db';
import {photos} from '../../../../../db/schema';
import {eq} from 'drizzle-orm';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 if(!await getChatGPTUser())return new Response('请先登录',{status:401});
 const {id}=await params;const p=(await getDb().select().from(photos).where(eq(photos.id,id)))[0];if(!p)return new Response('图片不存在',{status:404});
 const object=await env.BUCKET?.get(p.key);if(!object)return new Response('图片不存在',{status:404});
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
}
