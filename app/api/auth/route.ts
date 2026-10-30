import {env} from "cloudflare:workers";
import {roomMembers} from "../../../lib/member-names";
import {cookieName,digest} from "../../../lib/room-auth";
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
 if(!env.DB)return fail("小屋正在准备中",503);
 const result=await env.DB.prepare("SELECT a.id, CASE WHEN m.id IS NULL THEN 0 ELSE 1 END AS claimed FROM room_accounts a LEFT JOIN members m ON m.id=a.id WHERE a.enabled=1").all<{id:string;claimed:number}>();
 return Response.json({members:roomMembers.filter(m=>result.results.some(r=>r.id===m.id)).map(m=>({...m,claimed:!!result.results.find(r=>r.id===m.id)?.claimed}))},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail("请求来源无效",403);
 if(!env.DB)return fail("小屋正在准备中",503);
 if(Number(request.headers.get("content-length")||0)>2048)return fail("内容过长");
 let code:string,member:string,mode:string;try{const body=await request.text();if(body.length>2048)return fail("内容过长");const input=JSON.parse(body);code=input.code?.trim();member=input.member;mode=input.mode??"return";}catch{return fail("请输入回家码");}
 if(typeof code!=="string"||!/^\d{6}$/.test(code)||!/^roommate-[1-6]$/.test(member))return fail("回家码不正确",401);
 if(await digest(code)!=="9360f05a8d7d56ee44001d9367dff2e053945a14b19d8fab6c8ec43d3796833c")return fail("回家码不正确",401);
 const user=await env.DB.prepare("SELECT id FROM room_accounts WHERE id=? AND enabled=1").bind(member).first<{id:string}>();
 if(!user)return fail("回家码不正确",401);
 if(mode!=="join"&&mode!=="return")return fail("请选择登录方式");
 if(mode==="join"){
 const name=roomMembers.find(m=>m.id===member)!.name;
 const claimed=await env.DB.prepare("INSERT INTO members(id,name,avatar,status,mood,drink,updated) VALUES(?,?,'🐱','休息','开心','🍵',?) ON CONFLICT(id) DO NOTHING RETURNING id").bind(member,name,new Date().toISOString()).first<{id:string}>();
 if(!claimed)return fail("这个名字已经被选用，请选择自己的名字；本人请使用已入住成员回家",409);
 }else{
 const existing=await env.DB.prepare("SELECT id FROM members WHERE id=?").bind(member).first();
 if(!existing)return fail("这个名字还未入住，请先选择首次入住",409);
 }
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,"0")).join("");
 await env.DB.batch([env.DB.prepare("DELETE FROM room_sessions WHERE expires<?").bind(Date.now()),env.DB.prepare("INSERT INTO room_sessions(token_hash,user_id,expires) VALUES(?,?,?)").bind(await digest(token),user.id,Date.now()+30*86400000)]);
 return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":`${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${new URL(request.url).protocol==="https:"?"; Secure":""}`}});
}
