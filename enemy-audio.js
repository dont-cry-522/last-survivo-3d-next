// Original creature foley: textured samples, cached per species/event by GameAudio.
// Texture, articulation and timing distinguish creatures, not just oscillator pitch.
export const ENEMY_VOICES = {
 foamling:{texture:'wet',pitch:230,grain:29,length:.8,color:0x91d6d1,shape:'smoke'},tidecrab:{texture:'wood',pitch:165,grain:41,length:.85,color:0xcfa88a,shape:'crystal'},reefturtle:{texture:'stone',pitch:64,grain:20,length:1.25,color:0x8ba9a4,shape:'smoke'},jellyseer:{texture:'wet',pitch:430,grain:12,length:1.1,color:0x92dce9,shape:'ember'},tidestar:{texture:'wet',pitch:120,grain:17,length:1.3,color:0xd8bd96,shape:'smoke'},wreckwarden:{texture:'wood',pitch:31,grain:33,length:1.8,color:0xabc7bc,shape:'smoke'},
 sandworm:{texture:'wet',pitch:110,grain:34,length:.9,color:0xcbb98b,shape:'smoke'},
 clawbeetle:{texture:'wood',pitch:195,grain:54,length:.8,color:0xd2bd8b,shape:'crystal'},
 sandguard:{texture:'stone',pitch:70,grain:32,length:1.2,color:0xc3b698,shape:'crystal'},
 sandspitter:{texture:'hiss',pitch:190,grain:52,length:1.1,color:0xd3bb86,shape:'smoke'},
 duneoracle:{texture:'hiss',pitch:88,grain:17,length:1.2,color:0xcbb0dd,shape:'smoke'},
 dunescorpion:{texture:'wood',pitch:35,grain:42,length:1.7,color:0xc6aa73,shape:'crystal'},
  mushroom:  {texture:'wet',   pitch:175, grain:23,  length:.82, color:0xc9d589, shape:'smoke'},
  wolf:      {texture:'growl', pitch:105, grain:31,  length:1,   color:0x9caa9b, shape:'smoke'},
  golem:     {texture:'stone', pitch:58,  grain:17,  length:1.1, color:0xb5a68a, shape:'crystal'},
  spitter:   {texture:'wet',   pitch:89,  grain:42,  length:1.2, color:0xc791d4, shape:'smoke'},
  shaman:    {texture:'wood',  pitch:145, grain:11,  length:1.1, color:0x90dba5, shape:'ember'},
  boss:      {texture:'wood',  pitch:47,  grain:19,  length:1.6, color:0xb9b387, shape:'crystal'},
  snowhare:  {texture:'chirp', pitch:620, grain:15,  length:.65, color:0xe0f2f8, shape:'smoke'},
  frostwolf: {texture:'growl', pitch:152, grain:47,  length:1.15,color:0xb4e9f7, shape:'crystal'},
  yeti:      {texture:'growl', pitch:65,  grain:14,  length:1.3, color:0xcfe5ec, shape:'smoke'},
  icewitch:  {texture:'ice',   pitch:910, grain:7,   length:1.2, color:0x8cd3f5, shape:'crystal'},
  snowtotem: {texture:'ice',   pitch:470, grain:27,  length:1.5, color:0xc1efff, shape:'crystal'},
  frostking: {texture:'growl', pitch:39,  grain:9,   length:1.7, color:0xa6d8f3, shape:'crystal'},
  emberling:{texture:'crackle',pitch:255, grain:63,  length:.8,  color:0xffbd60, shape:'ember'},
  ashstalker:{texture:'hiss',  pitch:120, grain:38,  length:1,   color:0xcd8768, shape:'smoke'},
  lavabrute: {texture:'stone', pitch:43,  grain:29,  length:1.3, color:0xff9250, shape:'ember'},
  cinderwisp:{texture:'fire',  pitch:220, grain:73,  length:1.1, color:0xffcf74, shape:'flame'},
  ashseer:   {texture:'hiss',  pitch:72,  grain:13,  length:1.4, color:0xeaac74, shape:'ember'},
  cinderlord:{texture:'fire',  pitch:32,  grain:23,  length:1.7, color:0xff8950, shape:'flame'}
};
const EVENTS={step:[.12,.24],wind:[.37,.7],attack:[.24,.9],impact:[.27,.85],hurt:[.14,.42],death:[.48,.65]};
function forestFootSample(kind,event,sampleRate){
  const wolf=kind==='wolf',landing=event==='impact',duration=landing?(wolf?.23:.30):(wolf?.105:.14),data=new Float32Array(Math.ceil(sampleRate*duration));
  let seed=wolf?197:881,low=0,body=0;
  const filter=1-Math.exp(-2*Math.PI*(wolf?1700:650)/sampleRate),bass=1-Math.exp(-2*Math.PI*140/sampleRate);
  for(let i=0;i<data.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,t=i/sampleRate,u=i/data.length;
    low+=(noise-low)*filter;body+=(noise-body)*bass;
    const press=Math.exp(-t/(landing?.050:.018)),scrape=Math.max(0,t-.012),second=landing?Math.exp(-(((t-.034)/.012)**2)):0;
    // Paw pads press then brush leaf litter; the mushroom lands with a damp, soft body.
    const texture=wolf?(low*.55+body*2.6)*(press+second*.38)+(noise-low)*Math.sin(Math.min(1,scrape/.055)*Math.PI)*.13:
      body*3.6*(press+second*.25)+low*.24*Math.exp(-t/.09)+Math.sin(2*Math.PI*(landing?67:110)*t)*Math.exp(-t/.025)*.07;
    const envelope=Math.min(1,t/.004)*(1-u)**1.5;
    data[i]=Math.tanh(texture)*envelope*(landing?.34:.16);
  }
  return data;
}
export function creatureSample(kind,event,sampleRate){
  const p=ENEMY_VOICES[kind],setting=EVENTS[event];
  if(!p||!setting)return null;
  if(['wolf','mushroom'].includes(kind)&&['step','impact'].includes(event))return forestFootSample(kind,event,sampleRate);
  const duration=setting[0]*p.length,data=new Float32Array(Math.ceil(sampleRate*duration));
  let seed=p.pitch*7919+p.grain*107,low=0,body=0,phase=0;
  const smooth=1-Math.exp(-2*Math.PI*(p.texture==='hiss'?2900:1100)/sampleRate);
  const bodySmooth=1-Math.exp(-2*Math.PI*170/sampleRate);
  const foot=event==='step',fall=event==='death',charge=event==='wind';
  for(let i=0;i<data.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=seed/2147483648-1,t=i/sampleRate,u=i/data.length;
    low+=(noise-low)*smooth;body+=(noise-body)*bodySmooth;
    const sweep=charge?.72+u*.7:fall?1.15-u*.85:1.45-u*.7;
    phase+=2*Math.PI*p.pitch*sweep/sampleRate;
    const pulse=.5+.5*Math.sin(2*Math.PI*p.grain*t),rough=Math.tanh(Math.sin(phase)*3);
    let v;
    switch(p.texture){
      case 'wet': v=Math.sin(phase+2.8*Math.sin(phase*.47))*(.3+.5*pulse**5)+low*.6;break;
      case 'growl': v=rough*(.35+.2*Math.sin(2*Math.PI*27*t))*.6+low*(.35+.4*pulse)+body;break;
      case 'stone': v=low*(.4+1.7*pulse**12)+body*2+Math.sin(phase)*Math.exp(-u*9)*.35;break;
      case 'wood': v=(Math.sin(phase)+.4*Math.sin(phase*2.71))*(.15+.7*pulse**8)+low*.7;break;
      case 'chirp': v=Math.sin(phase+1.5*Math.sin(2*Math.PI*22*t))*(.3+.4*pulse**2)+low*.25;break;
      case 'ice': v=(Math.sin(phase)+.35*Math.sin(phase*2.76)+.2*Math.sin(phase*4.13))*(.18+.55*pulse**7)+ (noise-low)*.6;break;
      case 'crackle': v=low*.65+(noise-low)*pulse**18*1.4+rough*.22;break;
      case 'hiss': v=(noise-low*.4)*(.3+.5*pulse)+rough*.12+body*.7;break;
      case 'fire': v=body*2.5+low*(.7+.6*pulse**3)+Math.sin(phase)*.3;break;
    }
    // Footfalls remain brief material sounds; flying creatures get soft air movement.
    if(foot)v=low*(.8+2*pulse**8)+body*(p.texture==='stone'?5:2.4);
    if(event==='impact')v=v*.55+body*1.5+Math.sin(phase*.55)*Math.exp(-u*10)*.5;
    const envelope=Math.min(1,t/(charge?.065:.008))*Math.pow(1-u,charge?.8:fall?1.3:2.2);
    data[i]=Math.tanh(v)*envelope*setting[1]*.55;
  }
  return data;
}

export function creatureSpatial(event,dx,dz){
  const range=event==='step'?7:event==='hurt'?10:event==='death'?14:22,d=Math.hypot(dx,dz);
  return {gain:d>=range?0:(1-d/range)**1.5,pan:Math.max(-.85,Math.min(.85,(dx-dz)*.7071/Math.max(d,2)))};
}

// New foley keeps the legacy renderer above intact, including weapon/terrain
// callers. Five physical articulations replace its common pitched sweep.
// Values are cavity size, articulation spacing and breath/abrasion balance.
export const CREATURE_FOLEY={
  wolf:['beast',1,.071,.78],frostwolf:['beast',.86,.052,.94],
  yeti:['beast',1.45,.101,.52],frostking:['beast',1.8,.130,.42],
  tidecrab:['shell',1,.055,.65],clawbeetle:['shell',.76,.033,.9],dunescorpion:['shell',1.6,.085,.72],
  mushroom:['spore',1,.080,.38],spitter:['spore',1.27,.056,.78],sandworm:['spore',1.45,.115,.54],
  golem:['stone',1.1,.080,.82],lavabrute:['stone',1.5,.123,.65],sandguard:['stone',.72,.057,.94],
  foamling:['water',.68,.048,.86],reefturtle:['water',1.65,.104,.46],
  jellyseer:['water',1.12,.089,.34],tidestar:['water',1.35,.133,.61]
};
const FOLEY_EVENTS={step:[.115,.020],wind:[.34,.050],attack:[.245,.074],impact:[.28,.074],hurt:[.17,.050],death:[.48,.051]};
// Broad bandpass resonances colour air/noise. They are not sustained notes.
function cavity(rate,frequency,q){
  const w=2*Math.PI*Math.min(rate*.4,frequency)/rate,a=Math.sin(w)/(2*q),b=a/(1+a),c=-2*Math.cos(w)/(1+a),d=(1-a)/(1+a);let x1=0,x2=0,y1=0,y2=0;
  return x=>{const y=b*(x-x2)-c*y1-d*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
function burst(t,start,decay){const x=t-start;return x<0?0:(1-Math.exp(-x/.0025))*Math.exp(-x/decay);}
export function creatureFoleySample(kind,event,sampleRate,take=0,material=null){
  const profile=CREATURE_FOLEY[kind],setting=FOLEY_EVENTS[event];
  if(!profile||!setting)return creatureSample(kind,event,sampleRate);
  // Existing real foot-contact events already have fitted, quiet pad/leaf sounds.
  if(event==='step'&&(kind==='wolf'||kind==='mushroom'))return creatureSample(kind,event,sampleRate);
  const [family,size,spacing,air]=profile,variant=Math.abs(Math.trunc(take))%2;
  const warning=event==='wind',fall=event==='death',foot=event==='step',hurt=event==='hurt';
  const duration=setting[0]*(.86+.20*size),data=new Float32Array(Math.ceil(sampleRate*duration));
  let seed=ENEMY_VOICES[kind].pitch*7919+ENEMY_VOICES[kind].grain*107+variant*104729;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  const filter=f=>1-Math.exp(-2*Math.PI*f/sampleRate),bassFilter=filter(150/size),midFilter=filter(1250/Math.sqrt(size)),airFilter=filter(4100),slowFilter=filter(19);
  let bass=0,mid=0,high=0,slow=0,phase=0,power=0;
  const throat=cavity(sampleRate,460/size,1.4),mouth=cavity(sampleRate,1260/size,1.2),hollow=cavity(sampleRate,330/size,2.6);
  const gap=spacing*(variant?1.11:.94),start=.009+variant*.003;
  // Irregular contacts use fixed deterministic locations, not a periodic grain clock.
  const contacts=Array.from({length:family==='stone'?9:family==='shell'?4:3},(_,i)=>start+i*gap*(.8+Math.abs(random())*.4));
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate,u=i/(data.length-1),n=random();bass+=(n-bass)*bassFilter;mid+=(n-mid)*midFilter;high+=(n-high)*airFilter;slow+=(n-slow)*slowFilter;
    const band=mid-bass,grit=high-mid,pressure=warning?Math.sin(Math.PI*Math.min(1,u/.93))**1.4:Math.exp(-u*(fall?2.6:5.8));
    let v=0;
    if(family==='beast'){
      phase+=2*Math.PI*(hurt?128:fall?70:89)/size*(1+slow*.85)/sampleRate;
      const glottis=Math.max(0,Math.sin(phase))**5,exhale=burst(t,warning?.095:.012,warning?.18:.10),voice=throat(n)+mouth(n)*.32;
      v=voice*(.26+.74*glottis)*pressure*2.0+band*exhale*air*.8+bass*pressure*1.2;
    }else if(family==='shell'){
      let clicks=0;for(let j=0;j<contacts.length;j++)clicks+=burst(t,contacts[j]+(warning?.035:0),.007+size*.003)/(1+j*.34);
      const scrape=burst(t,warning?.018:.045,warning?.13:.055);
      v=(grit*1.9+band*.9)*clicks+band*scrape*air*.42+bass*clicks*2;
    }else if(family==='spore'){
      const inflate=burst(t,.014,warning?.13:.045),split=burst(t,warning?duration*.54:.018,.023),seeds=burst(t,.045+gap,.055);
      v=bass*inflate*3.2+hollow(band)*inflate*.9+grit*split*.54+band*seeds*air*.68;
    }else if(family==='stone'){
      let knocks=0;for(let j=0;j<contacts.length;j++)knocks+=burst(t,contacts[j]*(warning?1:.48),.009+size*.004)/(1+j*.38);
      const drag=burst(t,.010,warning?.16:.09);
      v=bass*(knocks*3.5+drag*1.5)+band*(knocks*.9+drag*air*.9)+grit*knocks*.24;
    }else{
      const cavityPulse=burst(t,.012,warning?.14:.06)+burst(t,.016+gap,warning?.045:.032)*.38;
      const drain=burst(t,warning?duration*.47:.043,.09);
      v=hollow(n)*cavityPulse*2.8+bass*cavityPulse*1.7+band*drain*air*.52;
    }
    if(foot)v=bass*burst(t,.006,.025)*2.5+band*burst(t,.014,.032)*.25;
    const envelope=Math.min(1,t/(warning?.018:.004))*Math.min(1,(duration-t)/.024);
    data[i]=v*envelope;power+=data[i]*data[i];
  }
  // Match the existing mix headroom; neither a quiet sample nor a resonator can
  // turn into an unexpectedly loud warning. This runs once per cached take.
  const level=Math.min(3,setting[1]/Math.max(.001,Math.sqrt(power/data.length)));
  const clip=material?.buffer,pcm=clip?.getChannelData?.(0),rate=clip?.sampleRate;
  const recordedLength=pcm&&Number.isFinite(rate)?Math.min(material.duration,duration):0;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate;let foley=0;
    if(t<recordedLength){
      const at=(material.offset+t)*rate,n=Math.floor(at),fraction=at-n;
      foley=((pcm[n]||0)*(1-fraction)+(pcm[n+1]||0)*fraction)*(material.gain??1)*.38*Math.min(1,t/.005,(recordedLength-t)/.020);
    }
    data[i]=Math.tanh((data[i]*level+foley)/.38)*.38;
  }
  return data;
}
