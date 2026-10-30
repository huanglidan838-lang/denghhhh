export const memberNames=['邓海玲','张珂','林姚瑶','韦瑢玲','林晓雪','曾美玲'] as const;
export const roomMembers=memberNames.map((name,i)=>({id:`roommate-${i+1}`,name}));
