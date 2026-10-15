// Relics change this expedition only. The journal records discoveries, not permanent power.
export const RELICS={
 wind:{name:'逐风羽',icon:'➶',style:'闪避接连射',text:'闪避后 4 秒内，接下来的 3 次武器攻击的直接伤害 +45%。再次闪避刷新，不叠加。'},
 frost:{name:'霜足印',icon:'❄',style:'撤退控场',text:'闪避起点迸出冰晶，对 3.5 米内可见敌人造成 18 伤害，并减速 2.2 秒。'},
 storm:{name:'蓄雷石',icon:'ϟ',style:'持续射击',text:'每攻击 5 次，向瞄准方向额外放电，击中射程内、无遮挡的最多 2 个敌人，各造成 22 伤害。'},
 ember:{name:'余烬种',icon:'✹',style:'击杀连爆',text:'每击败 5 只怪物，在最后一只的位置爆燃，对 3 米内可见敌人造成 26 伤害。爆炸击杀不积累次数。'},
 blood:{name:'回生芽',icon:'♧',style:'以战续命',text:'每击败 3 只怪物，恢复 5 点生命。需要持续击杀，无法站着回血。'},
 glass:{name:'裂纹棱镜',icon:'◇',style:'高风险强攻',text:'武器直接伤害 +30%，但受到的伤害也增加 25%。'}
};
export function relicChoices(random=Math.random){const pool=Object.keys(RELICS),result=[];while(result.length<3)result.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return result;}
export function equipRelic(p,id){if(p.relic||!Object.hasOwn(RELICS,id))return false;p.relic={id,kills:0,shots:0,charges:0,until:0};return true;}
export function relicEvent(p,event,now){
 const r=p.relic;if(!r)return null;
 if(event==='dodge'){
  if(r.id==='wind'){r.charges=3;r.until=now+4;return{kind:'wind'};}
  if(r.id==='frost')return{kind:'frost',radius:3.5,damage:18,slow:2.2};
 }
 if(event==='shot'){
  if(r.id==='wind'&&r.charges>0&&now<r.until){r.charges--;return{kind:'power',multiplier:1.45};}
  if(r.id==='glass')return{kind:'power',multiplier:1.3};
  if(r.id==='storm'&&++r.shots%5===0)return{kind:'storm',damage:22};
 }
 if(event==='kill'){
  if(r.id==='blood'&&++r.kills%3===0){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+5);return{kind:'heal',amount:p.hp-before};}
  if(r.id==='ember'&&++r.kills%5===0)return{kind:'ember',radius:3,damage:26};
 }
 return null;
}
export function incomingRelicDamage(p,damage){return damage*(p.relic?.id==='glass'?1.25:1);}
// A found preparation is spent by the next relevant actions, never by walking
// or waiting. It shares relic effects but neither equips nor changes a relic.
export const FIELD_SUPPLIES={
 forest:{name:'回生药束',icon:'♧',event:'kill',charges:3,text:'接下来 3 次击杀各恢复 4 点生命。',effect:{kind:'heal',amount:4}},
 snow:{name:'霜晶护符',icon:'❄',event:'dodge',charges:1,text:'下一次闪避在起点释放霜晶：3 米内可见敌人受到 12 伤害并减速 1.6 秒。',effect:{kind:'frost',radius:3,damage:12,slow:1.6}},
 ash:{name:'封存余烬',icon:'✹',event:'kill',charges:1,text:'下一次击杀在目标处爆燃：2.6 米内可见敌人受到 18 伤害；爆燃击杀不连锁。',effect:{kind:'ember',radius:2.6,damage:18}},
 sand:{name:'磨锋砂',icon:'◇',event:'shot',charges:3,text:'接下来 3 次武器攻击的直接伤害 +25%，每次出手消耗一份。',effect:{kind:'power',multiplier:1.25}},
 coast:{name:'潮电贝',icon:'ϟ',event:'shot',charges:2,text:'接下来 2 次武器攻击向瞄准方向放电，对射程内、无遮挡的最多 2 个敌人各造成 18 伤害。',effect:{kind:'storm',damage:18}}
};
export function equipFieldSupply(p,id){if(!Object.hasOwn(FIELD_SUPPLIES,id))return false;p.fieldSupply={id,charges:FIELD_SUPPLIES[id].charges};return true;}
export function fieldSupplyEvent(p,event){
 const supply=p.fieldSupply,info=supply&&FIELD_SUPPLIES[supply.id];if(!info||supply.charges<=0||event!==info.event)return null;
 supply.charges--;if(!supply.charges)p.fieldSupply=null;
 const effect={...info.effect};if(effect.kind==='heal'){const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+effect.amount);effect.amount=p.hp-before;}return effect;
}
export function fieldSupplyLabel(p){const supply=p.fieldSupply,info=supply&&FIELD_SUPPLIES[supply.id];return info&&supply.charges>0?info.name+' · 剩余 '+supply.charges+' 次':'';}
export const JOURNAL_KEY='forest-echoes-next-expedition-v1';
const maps=['forest','snow','ash','sand','coast','confluence'],weapons=['boomerang','harpoon','hammer','rifle','shotgun','fire','crossbow','shuriken','dark','shade','shadowblade','grimoire','sporelantern','miasmalantern'];
const validWins=new Set(maps.flatMap(m=>weapons.map(w=>m+':'+w)));
export function readJournal(storage){
 try{const j=JSON.parse(storage.getItem(JOURNAL_KEY));return{relics:[...new Set((Array.isArray(j?.relics)?j.relics:[]).filter(id=>Object.hasOwn(RELICS,id)))],wins:[...new Set((Array.isArray(j?.wins)?j.wins:[]).filter(id=>validWins.has(id)))]};}catch{return{relics:[],wins:[]};}
}
export function writeJournal(storage,journal){try{storage.setItem(JOURNAL_KEY,JSON.stringify(journal));return true;}catch{return false;}}
export function recordDiscovery(journal,id){if(!Object.hasOwn(RELICS,id)||journal.relics.includes(id))return false;journal.relics.push(id);return true;}
export function recordVictory(journal,map,weapon){const key=map+':'+weapon;if(!validWins.has(key)||journal.wins.includes(key))return false;journal.wins.push(key);return true;}
