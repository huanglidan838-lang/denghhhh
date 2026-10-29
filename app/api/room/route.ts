import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {members,broadcasts,foods,ratings,meals} from '../../../db/schema';
import {eq,desc,lt,gt,inArray} from 'drizzle-orm';
import {deskCatalog,deskFields,weekDays} from '../../../lib/room-options';
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return fail('请先登录',401);
 const db=getDb(),before=Number(new URL(request.url).searchParams.get('before'));
 const messages=await db.select().from(broadcasts).where(before>0?lt(broadcasts.id,before):undefined).orderBy(desc(broadcasts.id)).limit(50);
 const activeMessages=await db.select().from(broadcasts).where(gt(broadcasts.expires,Date.now())).orderBy(desc(broadcasts.id));
 const allFoods=await db.select().from(foods),allRatings=await db.select().from(ratings),days=weekDays();
 const plans=await db.select().from(meals).where(inArray(meals.day,days));
 return Response.json({serverNow:Date.now(),messages,activeMessages,nextCursor:messages.length===50?messages[49].id:null,days,plans,foods:allFoods.map(f=>{const r=allRatings.filter(x=>x.foodId===f.id);return {...f,ratings:r,count:r.length,average:r.length?r.reduce((a,x)=>a+x.stars,0)/r.length:0,mine:r.find(x=>x.userId===user.userId)?.stars||0}}).sort((a,b)=>b.average-a.average||b.count-a.count||b.created-a.created)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return fail('请先登录',401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return fail('请求来源无效',403);
 const db=getDb();if(!(await db.select().from(members).where(eq(members.id,user.userId)))[0]?.seat)return fail('请先选座',403);
 let d:any;try{d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw Error()}catch{return fail('格式无效')}
 if(d.userId&&d.userId!==user.userId)return fail('只能修改自己的内容',403);
 if(d.action==='decorate'){
 if(!deskFields.includes(d.field))return fail('请选择物品分类');
 if(d.name!==undefined&&(typeof d.name!=='string'||d.name.trim().length>20))return fail('物品名字最多 20 字');
 if(!deskCatalog.some(x=>x[0]===d.field&&x[1]===d.value))return fail('请选择桌面物品');
 await db.update(members).set({[d.field]:d.value,[d.field+'Name']:typeof d.name==='string'?d.name.trim():''}).where(eq(members.id,user.userId));
 }else if(d.action==='rename'){
 if(!deskFields.includes(d.field)||typeof d.name!=='string'||d.name.trim().length>20)return fail('物品名字最多 20 字');
 await db.update(members).set({[d.field+'Name']:d.name.trim()}).where(eq(members.id,user.userId));
 }else if(d.action==='broadcast'){
 if(typeof d.body!=='string'||!d.body.trim()||d.body.trim().length>200)return fail('弹窗为 1～200 字');
 const now=Date.now();await db.insert(broadcasts).values({userId:user.userId,body:d.body.trim(),created:now,expires:now+60000});
 }else if(d.action==='food'){
 const name=typeof d.name==='string'?d.name.trim():'';if(!name||name.length>40)return fail('店名为 1～40 字');
 try{await db.insert(foods).values({id:crypto.randomUUID(),userId:user.userId,name,created:Date.now()})}catch(e){if(/unique|constraint/i.test(String(e)+String((e as any)?.cause)))return fail('这家店已在榜单里，可直接评分',409);throw e}
 }else if(d.action==='rate'){
 if(!Number.isInteger(d.stars)||d.stars<1||d.stars>5)return fail('请选择 1～5 星');
 if(typeof d.foodId!=='string'||!(await db.select().from(foods).where(eq(foods.id,d.foodId)))[0])return fail('美食不存在',404);
 await db.insert(ratings).values({foodId:d.foodId,userId:user.userId,stars:d.stars}).onConflictDoUpdate({target:[ratings.foodId,ratings.userId],set:{stars:d.stars}});
 }else if(d.action==='meal'){
 if(!weekDays().includes(d.day)||!['breakfast','lunch','dinner'].includes(d.slot)||typeof d.body!=='string'||d.body.length>60)return fail('请填写未来七天的餐食，每格最多 60 字');
 await db.insert(meals).values({userId:user.userId,day:d.day,slot:d.slot,body:d.body.trim()}).onConflictDoUpdate({target:[meals.userId,meals.day,meals.slot],set:{body:d.body.trim()}});
 }else return fail('不支持的操作');
 return Response.json({ok:true});
}
