import {getDb} from '../db';
import {purchases,votes} from '../db/schema';
import {desc} from 'drizzle-orm';
export async function purchaseList(){
 const db=getDb(),requests=await db.select().from(purchases).orderBy(desc(purchases.created)),ballots=await db.select().from(votes);
 return requests.map(r=>{const electorate:string[]=JSON.parse(r.electorate),decisions=ballots.filter(v=>v.purchaseId===r.id),approvals=decisions.filter(v=>v.decision==='approve').length,rejections=decisions.length-approvals;
 return {...r,electorate,votes:decisions,approvals,rejections,status:approvals>=r.threshold?'approved':rejections>electorate.length-r.threshold?'rejected':'pending'};});
}
