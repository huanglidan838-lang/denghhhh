export type TodoItem={text:string;done:boolean};
export function parseTodo(body:string):TodoItem[]{return (body||'').split('\n').map(line=>({done:/^(?:\[x\]|☑|✅)\s*/i.test(line),text:line.replace(/^(?:\[[ x]\]|□|☐|☑|✅)\s*/i,'')}));}
export function serializeTodo(items:TodoItem[]){return items.map(item=>`${item.done?'[x]':'[ ]'} ${item.text}`).join('\n');}
