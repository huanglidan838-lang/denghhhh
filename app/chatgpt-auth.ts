import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionUser } from "../lib/room-auth";
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{
 const user=await sessionUser((await headers()).get("cookie"));
 return user?{userId:user.id,displayName:"室友",email:"",fullName:null}:null;
}
export async function requireChatGPTUser(returnTo:string){const u=await getChatGPTUser();if(u)return u;redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(_returnTo="/"){return "/login";}
export function chatGPTSignOutPath(_returnTo="/"){return "/login";}
