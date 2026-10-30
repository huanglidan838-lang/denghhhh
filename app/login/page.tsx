"use client";
import {useCallback,useEffect,useState} from "react";
import {roomMembers} from "../../lib/member-names";
type Member={id:string;name:string;claimed:boolean};
export default function Login(){
 const [members,setMembers]=useState<Member[]>([]),[member,setMember]=useState(''),[mode,setMode]=useState<'join'|'return'>('join'),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/auth',{cache:'no-store'});const d=await r.json() as {members?:Member[];error?:string};if(!r.ok||!d.members)throw Error(d.error||'暂时无法读取成员');setMembers(d.members);setLoaded(true);}catch(e:any){setError(e.message||'暂时无法读取成员');setLoaded(false);}},[]);
 useEffect(()=>{refresh();const id=setInterval(refresh,5000);return()=>clearInterval(id)},[refresh]);
 const selected=members.find(m=>m.id===member),available=loaded&&selected&&(mode==='return'?selected.claimed:!selected.claimed);
 return <main className="login-screen"><form className="login-card" onSubmit={async e=>{e.preventDefault();if(!available)return;setBusy(true);setError('');try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member,code,mode})});const d=await r.json() as {error?:string};if(!r.ok){await refresh();throw Error(d.error||'暂时无法回家');}location.assign('/');}catch(e:any){setError(e.message||'暂时无法回家，请重试');}finally{setBusy(false);}}}>
 <div className="login-icon">🏡</div><h1>快乐老家</h1><p>{mode==='join'?'选自己的名字，入住小屋。':'选自己的名字，欢迎回家。'}</p>
 <div className="login-tabs" role="group" aria-label="登录方式">{(['join','return'] as const).map(m=><button type="button" key={m} aria-pressed={mode===m} className={mode===m?'selected':''} disabled={busy} onClick={()=>{setMode(m);setMember('');setError('')}}>{m==='join'?'首次入住':'已入住成员回家'}</button>)}</div>
 <div className="login-members" role="group" aria-label="选择成员">{roomMembers.map(m=>{const status=members.find(p=>p.id===m.id),taken=!!status?.claimed,disabled=busy||!loaded||!status||(mode==='join'?taken:!taken);return <button type="button" key={m.id} disabled={disabled} aria-pressed={member===m.id} className={member===m.id&&!disabled?'selected':''} onClick={()=>{setMember(m.id);setError('')}}><strong>{m.name}</strong><small>{!loaded?'读取中…':taken?'已入住':'待入住'}</small></button>})}</div>
 <label>回家码<input aria-label="回家码" type="password" autoComplete="current-password" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label>
 {error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy||!available}>{busy?'开门中…':mode==='join'?'入住':'回家'}</button>
 <p className="login-hint">{mode==='join'?'灰色名字已被选用；本人再次登录请点“已入住成员回家”。':'固定使用自己的名字，回家码仍为原来的六位数字。'}</p>
 </form></main>
}
