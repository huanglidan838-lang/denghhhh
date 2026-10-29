import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url), manifest=JSON.parse(readFileSync(new URL('font-source/manifest.json',root),'utf8'));
const target=new URL('public/fonts/happy-home.ttf',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
if(!existsSync(target)||hash(readFileSync(target))!==manifest.sha256){
 const bytes=gunzipSync(Buffer.concat(Array.from({length:manifest.parts},(_,i)=>readFileSync(new URL(`font-source/${String(i).padStart(3,'0')}.part`,root)))));
 if(bytes.length!==manifest.bytes||hash(bytes)!==manifest.sha256)throw Error('Font source integrity check failed');
 mkdirSync(new URL('public/fonts/',root),{recursive:true});writeFileSync(target,bytes);
}
