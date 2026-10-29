import {env} from "cloudflare:workers";
import {cookieName,digest} from "../../../lib/room-auth";
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail("请求来源无效",403);
 if(!env.DB)return fail("小屋正在准备中",503);
 if(Number(request.headers.get("content-length")||0)>2048)return fail("内容过长");
 let code:string,member:string;try{const body=await request.text();if(body.length>2048)return fail("内容过长");const input=JSON.parse(body);code=input.code?.trim();member=input.member;}catch{return fail("请输入回家码");}
 if(typeof code!=="string"||!/^\d{6}$/.test(code)||!/^roommate-[1-6]$/.test(member))return fail("回家码不正确",401);
 if(await digest(code)!=="9360f05a8d7d56ee44001d9367dff2e053945a14b19d8fab6c8ec43d3796833c")return fail("回家码不正确",401);
 const user=await env.DB.prepare("SELECT id FROM room_accounts WHERE id=? AND enabled=1").bind(member).first<{id:string}>();
 if(!user)return fail("回家码不正确",401);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,"0")).join("");
 await env.DB.batch([env.DB.prepare("DELETE FROM room_sessions WHERE expires<?").bind(Date.now()),env.DB.prepare("INSERT INTO room_sessions(token_hash,user_id,expires) VALUES(?,?,?)").bind(await digest(token),user.id,Date.now()+30*86400000)]);
 return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":`${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${new URL(request.url).protocol==="https:"?"; Secure":""}`}});
}
