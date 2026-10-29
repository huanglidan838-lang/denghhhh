import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {members,entries,photos,likes,comments,todos} from '../../../db/schema';
import {desc,eq,and,isNull,inArray} from 'drizzle-orm';
import {purchaseList} from '../../../lib/purchases';
import {statuses,moods,avatars} from '../../../lib/home-options';
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return fail('请登录后回家',401);
 const db=getDb();const people=await db.select().from(members);const logs=await db.select().from(entries).orderBy(desc(entries.id)).limit(100);
 const images=await db.select().from(photos).orderBy(desc(photos.created)).limit(30);const ids=images.map(p=>p.id);
 const allLikes=ids.length?await db.select().from(likes).where(inArray(likes.photoId,ids)):[];
 const allComments=ids.length?await db.select({photoId:comments.photoId}).from(comments).where(inArray(comments.photoId,ids)):[];
 const notes=await db.select().from(todos);const requests=await purchaseList();
 return Response.json({me:user.userId,members:people,entries:logs,todos:notes,purchases:requests,photos:images.map(({key,...p})=>({...p,likes:allLikes.filter(l=>l.photoId===p.id).length,liked:allLikes.some(l=>l.photoId===p.id&&l.userId===user.userId),comments:allComments.filter(c=>c.photoId===p.id).length}))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return fail('请先登录',401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return fail('请求来源无效',403);
 let data:Record<string,any>;try{const p=await request.json();if(!p||typeof p!=='object'||Array.isArray(p))throw Error();data=p as Record<string,any>}catch{return fail('内容格式无效')}
 const db=getDb(),now=new Date().toISOString();const person=(await db.select().from(members).where(eq(members.id,user.userId)))[0];
 if(data.action==='profile'){
 const name=typeof data.name==='string'?data.name.trim():'';if(!name||name.length>20)return fail('昵称为 1～20 字');
 const avatar=avatars.includes(data.avatar)?data.avatar:'🐱';
 if(person?.seat!=null){
 if(data.seat!==undefined&&data.seat!==person.seat)return fail('座位已固定，不能更换',409);
 await db.update(members).set({name,avatar}).where(eq(members.id,user.userId));
 }else{
 if(!Number.isInteger(data.seat)||data.seat<1||data.seat>6)return fail('请选择 1～6 号空座位');
 try{
 if(person){const rows=await db.update(members).set({name,avatar,seat:data.seat,status:'休息',mood:'开心',updated:now}).where(and(eq(members.id,user.userId),isNull(members.seat))).returning();if(!rows.length)return fail('已选过座位，请刷新',409)}
 else await db.insert(members).values({id:user.userId,name,avatar,seat:data.seat,status:'休息',mood:'开心',drink:'🍵',updated:now});
 }catch(e){if(/unique|constraint/i.test(String(e)+String((e as {cause?:unknown})?.cause)))return fail('这个位置刚被选走，请刷新后选其他座位',409);throw e}
 }
 }else{
 if(!person?.seat)return fail('请先选择固定座位',403);
 const drink=['🍵','🧋','☕','🍋','🥛','🧃'].includes(data.drink)?data.drink:person.drink;
 if(data.action==='status'){
 if(!statuses.includes(data.status)||!moods.includes(data.mood))return fail('请选择状态和心情');
 await db.batch([db.update(members).set({status:data.status,mood:data.mood,drink,updated:now}).where(eq(members.id,user.userId)),db.insert(entries).values({userId:user.userId,kind:'checkin',body:`${data.status} · ${data.mood}`,mood:data.mood,drink,created:now})]);
 }else if(data.action==='entry'){
 const body=typeof data.body==='string'?data.body.trim():'';if(!body||body.length>500)return fail('请写下 1～500 字');
 const kind=data.kind==='food'?'food':'note';await db.insert(entries).values({userId:user.userId,kind,body,mood:person.mood,drink,created:now});
 }else return fail('不支持的操作');
 }
 return Response.json({ok:true});
}
