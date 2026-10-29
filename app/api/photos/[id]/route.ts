import {getChatGPTUser} from '../../../chatgpt-auth';
import {getDb} from '../../../../db';
import {members,photos,likes,comments} from '../../../../db/schema';
import {eq,and,asc} from 'drizzle-orm';
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 const {id}=await params,db=getDb();const photo=(await db.select().from(photos).where(eq(photos.id,id)))[0];if(!photo)return Response.json({error:'图片不存在'},{status:404});
 const reactions=await db.select().from(likes).where(eq(likes.photoId,id));const notes=await db.select().from(comments).where(eq(comments.photoId,id)).orderBy(asc(comments.id));
 const {key,...item}=photo;return Response.json({...item,likes:reactions.length,liked:reactions.some(l=>l.userId===user.userId),comments:notes},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,{params}:Context){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403});
 const {id}=await params,db=getDb();const member=(await db.select().from(members).where(eq(members.id,user.userId)))[0];if(!member?.seat)return Response.json({error:'请先选座'},{status:403});
 if(!(await db.select().from(photos).where(eq(photos.id,id))).length)return Response.json({error:'图片不存在'},{status:404});
 let data:any;try{data=await request.json();if(!data||typeof data!=='object')throw Error()}catch{return Response.json({error:'格式无效'},{status:400})}
 if(data.action==='like'&&typeof data.liked==='boolean'){
 if(data.liked)await db.insert(likes).values({photoId:id,userId:user.userId}).onConflictDoNothing();
 else await db.delete(likes).where(and(eq(likes.photoId,id),eq(likes.userId,user.userId)));
 }else if(data.action==='comment'){
 const body=typeof data.body==='string'?data.body.trim():'';if(!body||body.length>300)return Response.json({error:'评论为 1～300 字'},{status:400});
 await db.insert(comments).values({photoId:id,userId:user.userId,body,created:new Date().toISOString()});
 }else return Response.json({error:'操作无效'},{status:400});
 return Response.json({ok:true});
}
