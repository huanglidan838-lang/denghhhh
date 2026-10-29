import {getChatGPTUser} from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {members,purchases} from '../../../db/schema';
import {env} from 'cloudflare:workers';
import {purchaseList} from '../../../lib/purchases';
import {isNotNull} from 'drizzle-orm';
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function GET(){if(!await getChatGPTUser())return fail('请先登录',401);return Response.json({purchases:await purchaseList()},{headers:{'Cache-Control':'no-store'}})}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return fail('请先登录',401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return fail('请求来源无效',403);
 const db=getDb(),people=await db.select().from(members).where(isNotNull(members.seat));if(!people.some(p=>p.id===user.userId))return fail('请先选座',403);
 let data:any;try{data=await request.json();if(!data||typeof data!=='object')throw Error()}catch{return fail('格式无效')}
 if(data.action==='create'){
 const title=typeof data.title==='string'?data.title.trim():'',reason=typeof data.reason==='string'?data.reason.trim():'',price=String(data.price||'');
 if(!title||title.length>80||!reason||reason.length>1000||!/^\d{1,7}(\.\d{1,2})?$/.test(price))return fail('请填写物品、价格（最多两位小数）和采购原因');
 const [whole,fraction='']=price.split('.'),priceCents=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(priceCents<=0)return fail('价格必须大于 0');
 const id=crypto.randomUUID();await db.insert(purchases).values({id,userId:user.userId,title,priceCents,reason,electorate:JSON.stringify(people.map(p=>p.id)),threshold:Math.floor(people.length/2)+1,created:new Date().toISOString()});return Response.json({ok:true,id});
 }
 if(data.action==='vote'){
 if(typeof data.id!=='string'||!['approve','reject'].includes(data.decision))return fail('请选择同意或拒绝');
 const reason=typeof data.reason==='string'?data.reason.trim():'';if(reason.length>500||(data.decision==='reject'&&!reason))return fail('拒绝审批必须填写原因（最多 500 字）');
 // One atomic INSERT checks eligibility, duplicate ballots and whether a majority is still possible.
 const result=await env.DB!.prepare(`INSERT INTO votes (purchase_id,user_id,decision,reason,created)
 SELECT p.id,?,?,?,? FROM purchases p WHERE p.id=?
 AND EXISTS (SELECT 1 FROM json_each(p.electorate) WHERE value=?)
 AND NOT EXISTS (SELECT 1 FROM votes WHERE purchase_id=p.id AND user_id=?)
 AND (SELECT COUNT(*) FROM votes WHERE purchase_id=p.id AND decision='approve') < p.threshold
 AND (SELECT COUNT(*) FROM votes WHERE purchase_id=p.id AND decision='reject') <= json_array_length(p.electorate)-p.threshold`).bind(user.userId,data.decision,reason,new Date().toISOString(),data.id,user.userId,user.userId).run();
 if(!result.meta.changes)return fail('申请已结束、你已审批，或你不在本次审批名单中',409);
 return Response.json({ok:true});
 }
 return fail('操作无效');
}
