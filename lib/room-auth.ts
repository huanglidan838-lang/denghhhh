import { env } from "cloudflare:workers";
export const cookieName = "happy_home_session";
export async function digest(value:string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,"0")).join(""); }
export async function sessionUser(cookie:string|null) {
 const token=cookie?.split(";").map(v=>v.trim()).find(v=>v.startsWith(cookieName+"="))?.slice(cookieName.length+1);
 if(!token || !/^[a-f0-9]{64}$/.test(token) || !env.DB)return null;
 return env.DB.prepare("SELECT a.id FROM room_sessions s JOIN room_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND a.enabled=1").bind(await digest(token),Date.now()).first<{id:string}>();
}
