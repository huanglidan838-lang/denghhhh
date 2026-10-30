export const corners=['窗边藤椅','奶油沙发','森林书桌','软垫地台','阅读躺椅','云朵摇椅'];
export const companions=['🐧','🧸','🐱','🐶','🐷','🐼','🪴'];
export const snacks=['🍪','🍰','🥐','🍓','🍩','🍟'];
export const beverages=['🍵','🧋','☕','🍋','🥛','🧃'];
export function weekDays(now=Date.now()){const day=new Date(now+8*3600000).toISOString().slice(0,10);return Array.from({length:7},(_,i)=>new Date(Date.parse(day+'T00:00:00Z')+i*86400000).toISOString().slice(0,10))}
export const deskCatalog=[
 ['companion','🐧','企鹅','小企鹅 penguin'],['companion','🧸','小熊','玩偶 熊熊'],['companion','🐱','猫咪','小猫 猫'],['companion','🐶','小狗','狗狗'],['companion','🐷','小猪','猪猪 猪 pig'],['companion','🐼','熊猫','大熊猫'],['companion','🪴','绿植','植物 盆栽'],
 ['snack','🍪','曲奇','饼干'],['snack','🍰','蛋糕','草莓蛋糕 提拉米苏'],['snack','🥐','可颂','面包 牛角包'],['snack','🍓','草莓','水果'],['snack','🍩','甜甜圈','甜品'],['snack','🍟','薯条','炸薯条'],['snack','🍫','巧克力','可可'],['snack','🍿','爆米花','零食'],['snack','🍕','披萨','pizza'],['snack','🍎','苹果','水果'],['snack','🍇','葡萄','水果'],['snack','🍮','布丁','焦糖布丁'],['snack','🍦','冰淇淋','雪糕 冰激凌'],['snack','🥨','椒盐脆饼','饼干'],
 ['drink','🧋','奶茶','珍珠奶茶 波霸 乌龙奶茶 茉莉奶茶'],['drink','☕','咖啡','拿铁 美式 卡布奇诺 澳白 摩卡 coffee'],['drink','🍵','茶','抹茶 乌龙 龙井 绿茶'],['drink','🍋','柠檬茶','柠檬水 果茶'],['drink','🥛','牛奶','热牛奶 燕麦奶'],['drink','🧃','果汁','橙汁 苹果汁'],['drink','🥤','汽水','可乐 苏打 雪碧'],['drink','🧉','马黛茶','茶饮']
] as const;
export const deskFields=['companion','snack','drink'] as const;
export const deskLabels={companion:'陪伴物',snack:'零食',drink:'饮料'};
export function itemName(icon:string){return deskCatalog.find(x=>x[1]===icon)?.[2]||'物品'}
export function searchDesk(query:string){const q=query.trim().toLowerCase();return q?deskCatalog.filter(x=>`${x[2]} ${x[3]}`.toLowerCase().includes(q)||q.includes(x[2])||x[3].split(' ').some(alias=>alias.length>=2&&q.includes(alias))):[]}
