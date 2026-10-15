// Contact material follows the visible body, independently of its voice or AI role.
const SURFACES={
 fur:'wolf frostwolf rimefang snowhare yeti frostking',
 shell:'tidecrab reefturtle clawbeetle dunescorpion webmatriarch cinderdrake',
 rock:'golem lavabrute sandguard moltenrhino obeliskwarden snowtotem icewitch icephoenix',
 wood:'shaman boss thornstag wreckwarden'
};
const MATERIALS=new Map(Object.entries(SURFACES).flatMap(([surface,kinds])=>kinds.split(' ').map(kind=>[kind,surface])));
export const enemySurface=kind=>MATERIALS.get(kind)||'flesh';

// Five small deterministic buffers, shared by every weapon. The weapon's own
// impact remains the lead sound; these short body textures are a quiet layer.
export function surfaceSample(surface,rate){
 if(!['flesh','fur','shell','rock','wood'].includes(surface))return null;
 const duration=surface==='fur'?.115:surface==='flesh'?.14:.18,out=new Float32Array(Math.ceil(rate*duration));
 const cutoff={flesh:1350,fur:650,shell:3500,rock:2300,wood:1500}[surface],resonance={flesh:95,fur:72,shell:920,rock:370,wood:240}[surface];
 let seed=1597,low=0,body=0;
 for(let i=0;i<out.length;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/2147483648-1,t=i/rate;
  low+=(n-low)*(1-Math.exp(-2*Math.PI*cutoff/rate));body+=(n-body)*(1-Math.exp(-2*Math.PI*150/rate));
  const soft=surface==='flesh'||surface==='fur',press=Math.exp(-t*(soft?35:52)),brush=Math.exp(-t*(surface==='fur'?24:70));
  const ring=(Math.sin(t*2*Math.PI*resonance)+.28*Math.sin(t*2*Math.PI*resonance*1.63))*Math.exp(-t*(surface==='shell'?55:36));
  const value=soft?(body*3+low*.48)*press+(n-low)*(surface==='fur'?.055:.10)*brush:
   (body*2+low*.55)*press+(n-low)*(.23*Math.exp(-t*100))+ring*.20;
  out[i]=Math.tanh(value)*Math.min(1,t/.002,(duration-t)/.015)*.56;
 }
 return out;
}
