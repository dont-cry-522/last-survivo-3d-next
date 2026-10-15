import{newWeaponSample,NEW_WEAPON_SOUNDS}from'./new-weapon-audio.js?v=208';
import{poisonSample}from'./poison-audio.js?v=208';
import{mirageSample}from'./mirage-audio.js?v=208';
import{surfaceSample}from'./enemy-surfaces.js?v=208';
// Short original material textures synthesized locally; no remote asset load.
const DURATIONS={hammer:[.3,.4,.2],rifle:[.18,.16,.12],shotgun:[.42,.27,.23],crossbow:[.32,.18,.2],shuriken:[.3,.18,.14],fire:[.55,.65,.3],dark:[.58,.52,.35],shade:[.24,.32,.15],shadowblade:[.4,.28,.33],grimoire:[.4,.68,.3],shield:[.21,.3,.15],harpoon:[.24,.32,.18],boomerang:[.32,.19,.18],badger:[.20,.23,.14]};
const pulse=(t,start,decay)=>t<start?0:(1-Math.exp(-(t-start)*900))*Math.exp(-(t-start)*decay);
export const weaponTakeCount=id=>DURATIONS[id]&&!NEW_WEAPON_SOUNDS[id]?3:1;
export function weaponSample(id,event,rate,variant=0,take=0){
  if(id.startsWith('surface:'))return event==='impact'?surfaceSample(id.slice(8),rate):null;
  if(id==='sporelantern')return poisonSample(event,rate,variant);
  if(id==='miasmalantern')return mirageSample(event,rate,variant);
  if(NEW_WEAPON_SOUNDS[id])return newWeaponSample(id,event,rate,variant);
  const durations=DURATIONS[id],index={shot:0,impact:1,mechanism:2}[event];if(!durations||index===undefined)return null;
  const duration=durations[index],data=new Float32Array(Math.ceil(rate*duration));
  let seed=151+Object.keys(DURATIONS).indexOf(id)*173+(Math.abs(Math.trunc(take))%3)*983,low=0,body=0,phase=0,stringBody=0;
  const hit=event==='impact',mechanism=event==='mechanism';
  const string=new Float32Array(Math.round(rate/(168+take*2)));let stringIndex=0;
  for(let i=0;i<data.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/2147483648-1,t=i/rate,u=i/data.length;
    const cutoff=id==='dark'||id==='shade'?240+850*(1-u):id==='fire'?1600-1250*u:id==='shuriken'?3100-2200*u:id==='shadowblade'?1500-1050*u:id==='grimoire'?650+250*Math.sin(t*23):2300;
    low+=(n-low)*(1-Math.exp(-2*Math.PI*cutoff/rate));body+=(n-body)*(1-Math.exp(-2*Math.PI*130/rate));
    const high=n-low,tail=Math.exp(-u*(hit?5:7)),snap=Math.exp(-t*100),flutter=(.5+.5*Math.sin(t*2*Math.PI*(id==='shadowblade'?19:37)))**3;
    phase+=2*Math.PI*(id==='shotgun'?94-58*u:id==='fire'?75-39*u:id==='dark'?52+36*u:id==='grimoire'?41+24*u:140-85*u)/rate;
    let v=0;
    if(mechanism){
      const click=Math.exp(-t*120)+Math.exp(-Math.abs(t-.075)*180)*.65;
      if(id==='boomerang')v=variant?(body*2.3+low*.4)*Math.exp(-t*45)+high*.12*Math.exp(-Math.abs(t-.045)*160):low*.55*Math.sin(Math.PI*u)**2*(.6+.4*Math.sin(t*90));
      else if(id==='crossbow')v=(low*.45+body*1.2)*pulse(t,.014,65)+Math.sin(t*2*Math.PI*430)*pulse(t,.08,95)*.22+high*.055*click;
      else if(id==='shotgun')v=(low*.7+high*.4)*(.35+flutter)*Math.sin(Math.PI*u)+high*click*(variant?1:.5);
      else if(id==='grimoire')v=(low-body)*(.3+flutter)*Math.sin(Math.PI*u)**2*.9;
      else if(id==='fire')v=low*(.4+flutter)*Math.sin(Math.PI*u);
      else if(id==='dark')v=(body*2+low*.5)*Math.sin(Math.PI*u)**2;
      else if(id==='shadowblade')v=low*Math.sin(Math.PI*u)*(1-u)*(.4+flutter);
      else if(id==='rifle')v=low*.6*pulse(t,.006,100)+high*.20*pulse(t,.045,150)+Math.sin(t*2*Math.PI*680)*.12*pulse(t,.046,120);
      else if(id==='shuriken')v=(low-body)*.38*Math.sin(Math.PI*u)**2;
      else v=high*.32*click+body*.6*pulse(t,.01,65);
    }else if(id==='shield')v=hit?(body*3.4+low*.75+Math.sin(t*2*Math.PI*180)*.6)*tail+high*.28*snap:low*Math.sin(Math.PI*u)*.65+high*.13*Math.exp(-t*55);
    else if(id==='boomerang')v=hit?(low*.65+body*2)*tail+Math.sin(t*2*Math.PI*620)*.12*Math.exp(-t*70):(low*.8+high*.10)*Math.sin(Math.PI*u)**2*(.45+.55*Math.sin(t*2*Math.PI*22)**2);
    else if(id==='badger')v=hit?(body*3+low*.5)*tail:Math.sin(phase*1.8)*.35*tail+body*2*Math.sin(Math.PI*u);
    else if(id==='harpoon')v=hit?(low*.85+body*2.4)*tail+Math.sin(t*2*Math.PI*(470-210*u))*.25*tail:(high*.22+low*.6)*Math.sin(Math.PI*u)**2;
    else if(id==='hammer')v=hit?(body*4+Math.sin(phase)*.85+low*.3)*tail+high*.3*snap:low*Math.sin(Math.PI*u)**2*.9;
    // Rifle: a brief dry crack and barrel pressure; the target contact is a separate dull knock.
    else if(id==='rifle')v=hit?(body*2.6+low*.65)*pulse(t,.001,38)+high*.10*pulse(t,.003,140):high*.75*pulse(t,0,230)+low*1.4*pulse(t,0,67)+Math.sin(t*2*Math.PI*(132-50*u))*.38*pulse(t,0,55)+low*.18*pulse(t,.045,95);
    // Shotgun: wider low-end blast and several close pellet contacts, without a tonal bell.
    else if(id==='shotgun')v=hit?(body*2.5+low*.75)*(pulse(t,0,43)+.55*pulse(t,.027,62)+.28*pulse(t,.051,78)):(body*4+low*1.1)*pulse(t,0,17)+high*.43*pulse(t,0,170)+Math.sin(phase)*.5*pulse(t,0,25);
    else if(id==='crossbow'){
      // Damped string delay creates a short bow twang, followed by a wooden knock.
      const next=(stringIndex+1)%string.length;
      const pluck=i<string.length?n:(string[stringIndex]+string[next])*.491;string[stringIndex]=pluck;stringIndex=next;
      stringBody+=(pluck-stringBody)*(1-Math.exp(-2*Math.PI*1900/rate));
      v=hit?(body*2.8+low*.7)*pulse(t,0,42)+Math.sin(t*2*Math.PI*390)*.17*pulse(t,0,72):stringBody*1.15+low*.34*pulse(t,.003,90)+Math.sin(t*2*Math.PI*520)*.12*pulse(t,.017,125);
    // Rotating blades pass twice through the air; metal only speaks for a few milliseconds on contact.
    }else if(id==='shuriken')v=hit?(body*1.4+low*.35)*pulse(t,0,55)+(Math.sin(t*2*Math.PI*970)+.43*Math.sin(t*2*Math.PI*1630)+.22*Math.sin(t*2*Math.PI*2470))*.16*pulse(t,.002,72):(low-body)*1.3*(Math.exp(-(((u-.3)/.17)**2))+.65*Math.exp(-(((u-.72)/.13)**2)));
    else if(id==='fire'){const flame=(.6+.23*Math.sin(t*67)+.17*Math.sin(t*113))*(hit?pulse(t,0,7):Math.sin(Math.PI*u)**.8);v=(body*3.6+low*1.1)*flame+high*.13*(pulse(t,.008,160)+.65*pulse(t,.081,190)+.4*pulse(t,.157,180));}
    // Shadow magic inhales, then closes around a low pressure pulse; no bright oscillator overtone.
    else if(id==='dark')v=hit?(body*3.8+low*.65)*pulse(t,.02,12)+Math.sin(phase)*.42*pulse(t,.012,13):(body*2.5+low*.65)*Math.sin(Math.PI*u)**1.7*(.45+.55*u)+Math.sin(phase)*.22*pulse(t,.24,10);
    else if(id==='shade')v=(body*2.7+low*.75)*(hit?pulse(t,.004,18):Math.sin(Math.PI*u)**1.6)*(.7+.3*flutter);
    else if(id==='shadowblade')v=hit?(body*3+low*.9)*pulse(t,.002,30)+high*.10*pulse(t,.005,100):(low-body)*1.2*Math.exp(-(((u-.47)/.20)**2))+body*1.7*Math.sin(Math.PI*u)**1.6;
    // Grimoire cast is a low paper/breath flutter; impact opens into a longer hollow pressure release.
    else if(id==='grimoire')v=hit?(body*4.4+low*.8)*pulse(t,.015,7)*(.75+.25*Math.sin(t*29)):(low-body)*(.6+flutter)*Math.sin(Math.PI*u)**1.5+body*2.4*pulse(t,.15,14);
    const edge=Math.min(1,t/.003)*Math.min(1,(duration-t)/.02);
    data[i]=Math.tanh(v)*edge*(mechanism?.32:hit?.6:.72);
  }
  return data;
}
