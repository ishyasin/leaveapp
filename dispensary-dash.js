/* Dispensary Dash - hidden easter egg for Pharmacy Portal (ED&G).
   Opened by its secret code (Admin > Easter Egg 6, Developer only). Sort prescription slips into the
   Fridge, Shelf or CD cupboard before the queue backs up; GRAEMe watches from behind the counter.
   Arrow keys only; Esc or Exit leaves. Only the weekly best scores are shared (submit_dash_score / get_dash_weekly). */
(function(){
if(window.PortalDash)return;
const W=640,H=420;
let cv,ctx,root,raf=0,closed=true,dpr=1;
const $=s=>root.querySelector(s);
const FN="'Barlow Condensed','Arial Narrow',sans-serif",FB="'Barlow','Segoe UI',Arial,sans-serif";
const BINS=[{n:"Fridge",k:"←",x:120},{n:"Shelf",k:"↓",x:320},{n:"CD cupboard",k:"→",x:520}];
const KEY={ArrowLeft:0,ArrowDown:1,ArrowRight:2};
// bin: 0 fridge, 1 shelf, 2 CD cupboard
const EASY=[
 ["Insulin glargine","100 units/mL pen",0],["Insulin aspart","100 units/mL FlexPen",0],["Rocuronium","50 mg/5 mL injection",0],["Adalimumab","40 mg pen",0],["Octreotide","100 mcg/mL injection",0],["Latanoprost","50 mcg/mL eye drops",0],
 ["Morphine sulfate","10 mg/mL injection",2],["Pethidine","50 mg/mL injection",2],["Temazepam","10 mg tablets",2],["Buprenorphine","400 mcg SL tablets",2],["Oxycodone","5 mg capsules",2],["Methadone","1 mg/mL oral solution",2],
 ["Paracetamol","500 mg tablets",1],["Amoxicillin","500 mg capsules",1],["Ramipril","5 mg capsules",1],["Omeprazole","20 mg capsules",1],["Salbutamol","100 mcg inhaler",1],["Clopidogrel","75 mg tablets",1],["Co-amoxiclav","625 mg tablets",1],["Gliclazide","80 mg tablets",1],["Warfarin","3 mg tablets",1],["Furosemide","40 mg tablets",1],["Prednisolone","5 mg tablets",1],["Enoxaparin","40 mg/0.4 mL syringe",1],["Apixaban","5 mg tablets",1],["Rivaroxaban","20 mg tablets",1],["Edoxaban","60 mg tablets",1],["Dabigatran","150 mg capsules",1],["Levetiracetam","500 mg tablets",1],["Lamotrigine","100 mg tablets",1],["Carbamazepine","200 mg tablets",1],["Sodium valproate","500 mg EC tablets",1],["Phenytoin","100 mg capsules",1],["Topiramate","50 mg tablets",1],["Pregabalin","75 mg capsules",1],["Co-careldopa","25/100 mg tablets",1],["Co-beneldopa","12.5/50 mg capsules",1],["Pramipexole","0.7 mg tablets",1],["Ropinirole","2 mg tablets",1],["Rasagiline","1 mg tablets",1],["Amantadine","100 mg capsules",1],["Rotigotine","4 mg/24 h patch",1],["Trihexyphenidyl","2 mg tablets",1]];
const LASA=[
 [["Buprenorphine","400 mcg SL tablets",2],["Bupropion","150 mg MR tablets",1]],
 [["Ketamine","200 mg/20 mL injection",2],["Ketorolac","30 mg/mL injection",1]],
 [["Oxycodone","5 mg capsules",2],["Oxybutynin","5 mg tablets",1]],
 [["Diamorphine","5 mg injection",2],["Diazepam","5 mg tablets",1]],
 [["Dexamfetamine","5 mg tablets",2],["Dexamethasone","2 mg tablets",1]],
 [["Suxamethonium","100 mg/2 mL injection",0],["Sumatriptan","50 mg tablets",1]],
 [["Liraglutide","6 mg/mL pen",0],["Lisinopril","10 mg tablets",1]],
 [["Lorazepam","4 mg/mL injection",0],["Lorazepam","1 mg tablets",1]],
 [["Etanercept","50 mg pen",0],["Entacapone","200 mg tablets",1]],
 [["Fentanyl","25 mcg/h patch",2],["Fenofibrate","200 mg capsules",1]],
 [["Methadone","1 mg/mL oral solution",2],["Methotrexate","2.5 mg tablets",1]],
 [["Atracurium","50 mg/5 mL injection",0],["Atorvastatin","20 mg tablets",1]]];
const LEVELS=["","","Faster belt","Look-alike names","Look-alike names, faster","Rush hour"];
const SW=112,SH=58,STOP=496,BY=118,BH=76;
const S={mood:"idle",moodT:0,mode:"menu",t:0,slips:[],fx:[],lvl:1,done:0,ok:0,bad:0,strikes:0,score:0,combo:0,best:0,spawn:0,banner:0,flash:[0,0,0],flashC:["","",""],shake:0,seq:0,over:""};
try{S.best=+localStorage.getItem("ddBest")||0}catch(e){}
const rnd=(a)=>a[Math.floor(Math.random()*a.length)];
function speed(){return 70+S.lvl*16+Math.min(S.lvl,8)*2}
function gap(){return Math.max(.85,2.9-S.lvl*.28)}
function pick(){
  if(S.lvl>=3&&Math.random()<Math.min(.7,.35+S.lvl*.08)){const p=rnd(LASA);return rnd(p)}
  return rnd(EASY)
}
function newSlip(){const it=pick();S.slips.push({n:it[0],f:it[1],b:it[2],x:-SW-4,y:BY+(BH-SH)/2,id:++S.seq,qty:[14,28,56,7,30][Math.floor(Math.random()*5)]})}
function reset(){AU.tempo(1);Object.assign(S,{mood:"idle",moodT:0,mode:"play",t:0,slips:[],fx:[],lvl:1,done:0,ok:0,bad:0,strikes:0,score:0,combo:0,spawn:.4,banner:2,shake:0,over:""});newSlip()}
function front(){let f=null;for(const s of S.slips)if(!f||s.x>f.x)f=s;return f}
function sort(bin){
  const s=front();if(!s||s.x<30)return;           // nothing in reach yet
  S.slips.splice(S.slips.indexOf(s),1);
  const good=s.b===bin;
  S.fx.push({s,from:{x:s.x,y:s.y},to:BINS[bin].x,t:0,good});
  S.flash[bin]=.5;S.flashC[bin]=good?"#27c26a":"#ff3b4d";
  if(good){S.ok++;S.mood="happy";S.moodT=.55;S.combo++;S.score+=10*Math.min(5,1+Math.floor(S.combo/5));S.done++;AU.ok(S.combo);
    if(S.done%10===0){S.lvl++;AU.tempo(S.lvl);S.banner=2.2;S.mood="happy";S.moodT=1.3;AU.level()}}
  else{S.bad++;S.strikes++;S.combo=0;S.mood="oops";S.moodT=.9;S.shake=.35;AU.bad();
    if(S.strikes>=3)end("Dispensing errors","Three items went to the wrong place.")}
}
function end(t,p){S.mode="over";AU.over();
  const acc=S.ok+S.bad?Math.round(S.ok/(S.ok+S.bad)*100):0;const nb=S.score>S.best;if(nb){S.best=S.score;try{localStorage.setItem("ddBest",S.best)}catch(e){}}
  $("#eT").textContent=t;$("#eP").textContent=p;$("#eS").textContent=S.score.toLocaleString("en-GB")+" points";
  $("#eB").textContent=(nb&&S.score>0?"New best. ":"Best "+S.best.toLocaleString("en-GB")+". ")+"Level "+S.lvl+", "+acc+"% accuracy.";
  $("#ovEnd").hidden=false;board($("#eBoard"));sendScore()}
function update(dt){
  S.t+=dt;S.banner=Math.max(0,S.banner-dt);S.moodT=Math.max(0,S.moodT-dt);S.shake=Math.max(0,S.shake-dt);for(let i=0;i<3;i++)S.flash[i]=Math.max(0,S.flash[i]-dt);
  const v=speed();
  // belt: slips queue up behind the one at the end
  const order=S.slips.slice().sort((a,b)=>b.x-a.x);
  let prev=null;order.forEach((s,i)=>{let lim=STOP-i*(SW+6);if(prev)lim=Math.min(lim,prev.x-SW-6);s.x=Math.min(s.x+v*dt,lim);prev=s});
  S.spawn-=dt;
  if(S.spawn<=0){
    if(S.slips.length>=5){end("The queue backed up","The belt is full and nothing else can come through.")}
    else if(!S.slips.some(q=>q.x<2)){newSlip();S.spawn=gap()}
  }
  S.fx.forEach(f=>f.t+=dt/.26);S.fx=S.fx.filter(f=>f.t<1);
}
/* ---------- drawing ---------- */
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function text(t,x,y,font,col,al){ctx.font=font;ctx.fillStyle=col;ctx.textAlign=al||"left";ctx.fillText(t,x,y)}
function graeme(){
  const cx=566,cy=80,bob=Math.sin(S.t*2.2)*1.3,fr=front();
  const mood=S.mode==="play"&&S.slips.length>=4&&S.moodT<=0?"panic":(S.moodT>0?S.mood:"idle");
  const lean=mood==="panic"?Math.sin(S.t*18)*1.2:0;
  const NAVY="#0b1630",NAVY2="#1d2f58",CY="#2fe0ff",W1="#ffffff",W2="#dfe8f1";
  ctx.save();ctx.translate(lean,bob);ctx.lineCap="round";ctx.lineJoin="round";
  // waving arm (his right, our left): upper arm, shoulder ring, hand
  const wave=(mood==="happy")?Math.sin(S.t*9)*.38:((S.t%7)<1.6?Math.sin(S.t*9)*.3:0);
  const body=()=>{ctx.fillStyle=W1;ctx.strokeStyle=W2;ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(cx,cy+44,37,22,0,0,7);ctx.fill();ctx.stroke()};
  ctx.save();ctx.translate(cx-36,cy+34);ctx.rotate(-.55);
  ctx.fillStyle=W1;ctx.strokeStyle=W2;rr(-6,-26,12,28,6);ctx.fill();ctx.stroke();
  ctx.fillStyle=CY;ctx.fillRect(-6,-8,12,2);
  ctx.translate(0,-27);ctx.rotate(.55+wave);
  ctx.fillStyle=W1;rr(-8,-17,16,17,6);ctx.fill();ctx.stroke();
  ctx.fillStyle=NAVY;[-6,-2,2,6].forEach((fx,i)=>{rr(fx-1.6,-22+Math.abs(fx)*.35,3.2,6.5,1.6);ctx.fill()});
  ctx.fillStyle=NAVY;rr(7,-12,3.4,7,1.7);ctx.fill();
  ctx.restore();
  body();
  // shoulder joints
  [-1,1].forEach(sx=>{ctx.fillStyle=NAVY;ctx.beginPath();ctx.arc(cx+sx*34,cy+32,7,0,7);ctx.fill();ctx.strokeStyle=CY;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(cx+sx*34,cy+32,4.4,0,7);ctx.stroke()});
  // chest badge with cross
  ctx.fillStyle=NAVY;rr(cx-13,cy+30,26,17,5);ctx.fill();ctx.strokeStyle=NAVY2;ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=CY;ctx.shadowColor=CY;ctx.shadowBlur=6;ctx.fillRect(cx-1.8,cy+33,3.6,11);ctx.fillRect(cx-5.4,cy+36.6,10.8,3.6);ctx.shadowBlur=0;
  // neck
  ctx.fillStyle=NAVY;rr(cx-7,cy+17,14,9,3);ctx.fill();
  // antenna
  ctx.strokeStyle=NAVY;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(cx+1,cy-18);ctx.lineTo(cx+2,cy-28);ctx.stroke();
  const pulse=.5+.5*Math.sin(S.t*4);ctx.fillStyle="rgba(47,224,255,"+(.22+.22*pulse)+")";ctx.beginPath();ctx.arc(cx+2,cy-31,7,0,7);ctx.fill();ctx.fillStyle=CY;ctx.beginPath();ctx.arc(cx+2,cy-31,3.8,0,7);ctx.fill();
  // ear cups
  [-1,1].forEach(sx=>{const ex=cx+sx*26;ctx.fillStyle=W1;ctx.strokeStyle=W2;ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(ex,cy+1,6.5,11,0,0,7);ctx.fill();ctx.stroke();
    ctx.strokeStyle=NAVY;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(ex,cy+1,4.2,8,0,-1.2,1.2+Math.PI*(sx<0?0:0));ctx.stroke();
    ctx.strokeStyle=CY;ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(ex+sx*-.4,cy+1,4.2,8,0,Math.PI*(sx<0?-.55:-.45),Math.PI*(sx<0?.55:.45),sx>0?false:false);ctx.stroke()});
  // head shell
  ctx.fillStyle=W1;ctx.strokeStyle=W2;ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(cx,cy,25,21.5,0,0,7);ctx.fill();ctx.stroke();
  ctx.fillStyle=NAVY;rr(cx-10,cy-20,20,5,2.5);ctx.fill();ctx.fillStyle=CY;rr(cx-5,cy-18.2,10,1.6,.8);ctx.fill();
  // visor
  ctx.fillStyle=NAVY;rr(cx-20,cy-13,40,25,11);ctx.fill();ctx.strokeStyle=NAVY2;ctx.lineWidth=1.2;ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.07)";ctx.beginPath();ctx.ellipse(cx-8,cy-7,9,3,-.3,0,7);ctx.fill();
  // eyes
  const look=fr?Math.max(-3,Math.min(3,(fr.x+SW/2-cx)/90*3)):0,blink=(S.t%4.2)>4.05;
  ctx.strokeStyle=CY;ctx.fillStyle=CY;ctx.lineWidth=2.6;ctx.shadowColor=CY;ctx.shadowBlur=7;
  [-1,1].forEach(sx=>{const x=cx+sx*9.5+(mood==="idle"?look:0),y=cy+1;
    if(mood==="oops"){ctx.beginPath();ctx.moveTo(x-4.6,y-1.5);ctx.quadraticCurveTo(x,y+5,x+4.6,y-1.5);ctx.stroke()}
    else if(mood==="panic"){ctx.beginPath();ctx.ellipse(x,y,3.4,4.8,0,0,7);ctx.fill()}
    else if(blink){ctx.beginPath();ctx.moveTo(x-4.6,y+1.5);ctx.lineTo(x+4.6,y+1.5);ctx.stroke()}
    else{const h=mood==="happy"?6:4.6;ctx.beginPath();ctx.moveTo(x-5,y+2.2);ctx.quadraticCurveTo(x,y+2.2-h*1.9,x+5,y+2.2);ctx.stroke()}});
  ctx.shadowBlur=0;
  if(mood==="panic"){ctx.fillStyle="#7fd8ff";ctx.beginPath();ctx.moveTo(cx+30,cy-14);ctx.quadraticCurveTo(cx+34,cy-8,cx+30,cy-4);ctx.quadraticCurveTo(cx+26,cy-8,cx+30,cy-14);ctx.fill()}
  ctx.restore();
}
function room(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#0f1d33");g.addColorStop(1,"#09111f");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(25,195,230,.07)";for(let i=0;i<9;i++)ctx.fillRect(12+i*74,52,62,4);
  text("DISPENSARY",20,98,"700 15px "+FN,"#19c3e6");
  ctx.fillStyle="#0a121f";ctx.fillRect(0,236,W,H-236);ctx.fillStyle="#173048";ctx.fillRect(0,236,W,2);
}
function belt(){
  ctx.fillStyle="#05080e";rr(8,BY-6,W-16,BH+12,10);ctx.fill();
  ctx.fillStyle="#252d3a";rr(14,BY,W-28,BH,8);ctx.fill();
  ctx.save();rr(14,BY,W-28,BH,8);ctx.clip();ctx.strokeStyle="rgba(255,255,255,.07)";ctx.lineWidth=6;
  const off=(S.t*speed())%40;for(let x=-60;x<W+60;x+=40){ctx.beginPath();ctx.moveTo(x+off,BY);ctx.lineTo(x+off+22,BY+BH/2);ctx.lineTo(x+off,BY+BH);ctx.stroke()}
  ctx.restore();
  ctx.fillStyle="#3b4658";ctx.beginPath();ctx.arc(20,BY+BH/2,10,0,7);ctx.arc(W-20,BY+BH/2,10,0,7);ctx.fill();
  // pick-up marker at the end of the belt
  
}
function slip(s,x,y,sc,a,front){
  ctx.save();ctx.translate(x+SW/2,y+SH/2);ctx.scale(sc,sc);ctx.globalAlpha=a;ctx.translate(-SW/2,-SH/2);
  ctx.fillStyle="rgba(0,0,0,.35)";rr(3,4,SW,SH,4);ctx.fill();
  ctx.fillStyle="#f6f3e8";rr(0,0,SW,SH,4);ctx.fill();
  if(front){ctx.strokeStyle="#19c3e6";ctx.lineWidth=2.5;rr(-1,-1,SW+2,SH+2,5);ctx.stroke()}
  ctx.fillStyle="#d9d3bd";ctx.fillRect(0,0,SW,13);text("Rx",6,10.5,"700 10px "+FB,"#5a5a4a");text("x"+s.qty,SW-6,10.5,"600 10px "+FB,"#5a5a4a","right");
  let fs=17;ctx.font="700 "+fs+"px "+FN;while(ctx.measureText(s.n).width>SW-12&&fs>10){fs--;ctx.font="700 "+fs+"px "+FN}
  text(s.n,6,32,"700 "+fs+"px "+FN,"#12202f");
  let f2=11;ctx.font="400 "+f2+"px "+FB;while(ctx.measureText(s.f).width>SW-12&&f2>8){f2--;ctx.font="400 "+f2+"px "+FB}
  text(s.f,6,48,"400 "+f2+"px "+FB,"#4a5563");
  ctx.restore();
}
function bin(i){
  const b=BINS[i],cx=b.x,top=242,w=150,h=104,x=cx-w/2;
  ctx.save();
  if(S.shake>0&&i===1)ctx.translate((Math.random()-.5)*4,0);
  if(i===0){ // fridge
    ctx.fillStyle="#bfe4ee";rr(x+14,top,w-28,h,8);ctx.fill();ctx.fillStyle="#9ccbd8";rr(x+14,top+h*.34,w-28,3,1);ctx.fill();
    ctx.fillStyle="#eaf8fc";rr(x+20,top+6,w-40,h*.3,5);ctx.fill();ctx.fillStyle="#0b1424";ctx.fillRect(x+w-52,top+12,26,12);text("4°C",x+w-39,top+22,"700 10px "+FB,"#19c3e6","center");
    ctx.fillStyle="#7aa9b8";ctx.fillRect(x+w-26,top+h*.42,4,26);ctx.fillRect(x+w-26,top+10,4,14);
    ctx.strokeStyle="#5fa0b4";ctx.lineWidth=2;const sx=x+50,sy=top+h*.66;for(let a=0;a<3;a++){ctx.beginPath();ctx.moveTo(sx+Math.cos(a*1.047)*13,sy+Math.sin(a*1.047)*13);ctx.lineTo(sx-Math.cos(a*1.047)*13,sy-Math.sin(a*1.047)*13);ctx.stroke()}
  }else if(i===1){ // shelf
    ctx.fillStyle="#8a6a45";rr(x+8,top,w-16,h,5);ctx.fill();ctx.fillStyle="#3a2c1c";ctx.fillRect(x+14,top+6,w-28,h-12);
    ctx.fillStyle="#8a6a45";ctx.fillRect(x+14,top+6+46,w-28,5);
    const cols=["#e9eef2","#cfe0ea","#f2d6a0","#d7e8cf","#e7c9d6"];
    const plank=top+6+46;
    for(let r=0;r<2;r++)for(let k=0;k<5;k++){const bw=17+((k*7+r*3)%6),bx=x+18+k*24,by=(r?top+h-6:plank)-26;ctx.fillStyle=cols[(k+r*2)%5];ctx.fillRect(bx,by,bw,26)}
  }else{ // CD cupboard
    ctx.fillStyle="#434d5c";rr(x+14,top,w-28,h,6);ctx.fill();ctx.fillStyle="#323a47";rr(x+20,top+6,w-40,h-12,4);ctx.fill();
    ctx.fillStyle="#9aa6b6";ctx.beginPath();ctx.arc(cx+14,top+h/2,15,0,7);ctx.fill();ctx.fillStyle="#2b323d";ctx.beginPath();ctx.arc(cx+14,top+h/2,10,0,7);ctx.fill();ctx.strokeStyle="#e9eef5";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx+14,top+h/2);ctx.lineTo(cx+14+6,top+h/2-6);ctx.stroke();
    ctx.fillStyle="#d4202f";rr(x+28,top+14,34,18,3);ctx.fill();text("CD",x+45,top+27,"700 14px "+FN,"#fff","center");
    ctx.fillStyle="#1d232c";ctx.fillRect(x+24,top+h/2-8,3,16);ctx.fillRect(x+w-30,top+h/2-26,3,14);
  }
  if(S.flash[i]>0){ctx.globalAlpha=Math.min(.6,S.flash[i]);ctx.fillStyle=S.flashC[i];rr(x+8,top-4,w-16,h+8,10);ctx.fill();ctx.globalAlpha=1}
  ctx.restore();
  // keycap and label
  const ky=top+h+12;ctx.fillStyle="#1a2a40";rr(cx-16,ky,32,28,6);ctx.fill();ctx.strokeStyle="#2e4766";ctx.lineWidth=2;rr(cx-16,ky,32,28,6);ctx.stroke();
  text(b.k,cx,ky+21,"700 19px "+FB,"#e8f2f8","center");text(b.n,cx,ky+46,"600 15px "+FB,"#9db6c9","center");
}
function hud(){
  ctx.fillStyle="rgba(5,9,16,.88)";ctx.fillRect(0,0,W,42);
  text("LEVEL "+S.lvl,16,17,"600 11px "+FB,"#8fb6c9");text(S.lvl>=3?"Look-alike names":S.lvl===2?"Faster belt":"Easy start",16,36,"700 17px "+FN,"#f2f7fb");
  text("SCORE",W/2-60,17,"600 11px "+FB,"#8fb6c9","center");text(S.score.toLocaleString("en-GB"),W/2-60,37,"700 22px "+FN,"#fff","center");
  if(S.combo>=5){text("x"+Math.min(5,1+Math.floor(S.combo/5)),W/2+10,37,"700 20px "+FN,"#19c3e6","left")}
  // errors
  text("ERRORS",W-130,17,"600 11px "+FB,"#8fb6c9","center");for(let i=0;i<3;i++){ctx.fillStyle=i<S.strikes?"#ff3b4d":"#2a3a52";ctx.beginPath();ctx.arc(W-160+i*30+15,30,9,0,7);ctx.fill();if(i<S.strikes)text("×",W-160+i*30+15,35,"700 14px "+FB,"#fff","center")}
  // queue meter
  const full=Math.min(1,S.slips.length/5);text("QUEUE",W-48,17,"600 11px "+FB,"#8fb6c9","center");
  ctx.fillStyle="#2a3a52";rr(W-76,24,56,10,5);ctx.fill();ctx.fillStyle=full>.8?"#ff3b4d":full>.55?"#ffb020":"#19c3e6";rr(W-76,24,Math.max(6,56*full),10,5);ctx.fill();
}
function draw(){
  ctx.save();if(S.shake>0)ctx.translate((Math.random()-.5)*S.shake*10,(Math.random()-.5)*S.shake*8);
  room();graeme();belt();
  const fr=front();
  S.slips.forEach(s=>slip(s,s.x,s.y,1,1,s===fr));
  S.fx.forEach(f=>{const e=f.t<.5?2*f.t*f.t:1-Math.pow(-2*f.t+2,2)/2;const x=f.from.x+(f.to-SW/2-f.from.x)*e,y=f.from.y+(278-f.from.y)*e;slip(f.s,x,y,1-.55*e,1-.6*Math.max(0,e-.6)/.4,false);
    if(!f.good){text("×",f.to,262,"700 36px "+FN,"#ff3b4d","center")}});
  [0,1,2].forEach(bin);
  hud();
  if(S.banner>0&&S.mode==="play"&&S.lvl>1){ctx.globalAlpha=Math.min(1,S.banner);ctx.fillStyle="rgba(4,10,20,.78)";rr(W/2-170,52,340,34,8);ctx.fill();text("Level "+S.lvl+": "+(LEVELS[Math.min(S.lvl,5)]||"Rush hour"),W/2,77,"700 22px "+FN,"#19c3e6","center");ctx.globalAlpha=1}
  ctx.restore();
}
var last=0;
function loop(ts){if(closed)return;const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(S.mode==="play")update(dt);else S.t+=dt;draw();raf=requestAnimationFrame(loop)}

/* ---------- sound (synthesised in the browser, no files) ---------- */
const AU=(function(){
  let ac=null,master,timer=0,step=0,nextT=0,muted=false,on=false,bpm=116,nz=null;
  try{muted=localStorage.getItem("ddSound")==="0"}catch(e){}
  const hz=m=>440*Math.pow(2,(m-69)/12);
  function tone(type,f,t,dur,vol,to){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02)}
  function burst(t,dur,vol,f0,f1){if(!nz){const n=ac.sampleRate,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;nz=b}const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();s.buffer=nz;fl.type="lowpass";fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(fl);fl.connect(g);g.connect(master);s.start(t);s.stop(t+dur+.02)}
  // upbeat shop-floor groove: bass + plucked arpeggio + soft kick and hat; tempo rises with the level
  const BASS=[0,0,7,0, 5,5,7,5, 3,3,10,3, 7,7,5,7];
  const ARP=[12,16,19,16, 12,17,21,17, 15,19,22,19, 14,19,23,19];
  function sched(){
    if(!ac||!on)return;
    while(nextT<ac.currentTime+.25){
      const i=step%16,t=nextT,q=60/bpm/4;
      if(i%4===0)tone("sine",110,t,.12,.4,42);
      if(i%4===2)burst(t,.035,.07,9000,5000);
      if(i%2===0)tone("triangle",hz(36+BASS[i]),t,q*1.7,.22);
      tone("square",hz(60+ARP[i]),t,q*1.1,.035);
      nextT+=q;step++;
    }
  }
  return{
    start(){if(ac)return;try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){ac=null;return}
      master=ac.createGain();master.gain.value=muted?0:.5;master.connect(ac.destination);if(ac.state==="suspended")ac.resume().catch(()=>{});
      on=true;nextT=ac.currentTime+.1;step=0;timer=setInterval(sched,40)},
    stop(){on=false;clearInterval(timer);try{if(ac)ac.close()}catch(e){}ac=null;nz=null},
    resume(){if(ac&&ac.state==="suspended")ac.resume().catch(()=>{})},
    setMuted(m){muted=m;try{localStorage.setItem("ddSound",m?"0":"1")}catch(e){}if(ac)master.gain.setTargetAtTime(m?0:.5,ac.currentTime,.03)},
    isMuted(){return muted},
    tempo(l){bpm=Math.min(150,112+l*6)},
    ok(c){if(!ac)return;const t=ac.currentTime;tone("triangle",hz(79+Math.min(c,10)),t,.1,.22);tone("triangle",hz(86+Math.min(c,10)),t+.05,.12,.18)},
    bad(){if(!ac)return;const t=ac.currentTime;tone("sawtooth",160,t,.3,.25,60);burst(t,.18,.3,2500,300)},
    level(){if(!ac)return;const t=ac.currentTime;[72,76,79,84].forEach((n,i)=>tone("triangle",hz(n),t+i*.08,.2,.25))},
    go(){if(!ac)return;const t=ac.currentTime;tone("square",hz(72),t,.1,.12);tone("square",hz(79),t+.09,.16,.12)},
    over(){if(!ac)return;const t=ac.currentTime;[67,64,60,55].forEach((n,i)=>tone("sawtooth",hz(n),t+i*.2,.35,.16))},
  };
})();

/* ---------- shared weekly high scores ---------- */
function sendScore(){
  if(S.score>0&&typeof sb!=="undefined"){try{Promise.resolve(sb.rpc("submit_dash_score",{p_score:S.score,p_level:Math.min(S.lvl,99),p_ok:S.ok})).then(()=>{if(root&&!$("#ovEnd").hidden)board($("#eBoard"))}).catch(()=>{})}catch(e){}}
}
function board(el){
  if(!el||typeof sb==="undefined")return;
  try{Promise.resolve(sb.rpc("get_dash_weekly",{p_weeks_ago:0})).then(r=>{
    const rows=(r&&r.data)||[];el.textContent="";if(!rows.length)return;
    const h=document.createElement("div");h.className="edh";h.textContent="This week's best";el.appendChild(h);
    rows.slice(0,5).forEach(x=>{const d=document.createElement("div");d.className="edr"+(x.is_me?" me":"");
      const a=document.createElement("span");a.textContent=x.rank+". "+x.display_name;const b=document.createElement("b");b.textContent=Number(x.score).toLocaleString("en-GB");d.appendChild(a);d.appendChild(b);el.appendChild(d)});
  }).catch(()=>{})}catch(e){}
}

/* ---------- input: arrow keys only (Esc leaves the game) ---------- */
function advance(){
  AU.resume();
  if(S.mode==="menu"||S.mode==="over"){$("#ovStart").hidden=true;$("#ovEnd").hidden=true;reset();AU.go()}
  else if(S.mode==="pause")S.mode="play";
}
function kd(e){
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeGame();return}
  if(!(e.key in KEY)&&e.key!=="ArrowUp")return;e.preventDefault();e.stopPropagation();if(e.repeat)return;
  if(S.mode!=="play"){advance();return}
  if(e.key in KEY)sort(KEY[e.key]);
}
function onBlur(){if(S.mode==="play")S.mode="pause"}
function stopMouse(e){e.preventDefault();e.stopPropagation()}
const CSS=`#ddRoot{position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at 50% 30%,#0d1c30 0,#050a14 70%);display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',Arial,sans-serif;color:#f2f7fb}
#ddRoot .ddx{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.08);color:#cfe9f2;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 14px;font:600 14px 'Segoe UI',Arial,sans-serif;cursor:pointer}
#ddRoot .ddx:hover{background:rgba(255,255,255,.16)}#ddRoot .dds{right:92px}
#ddRoot .ddg{position:relative;width:min(94vw,calc(88vh*640/420));aspect-ratio:640/420;background:#0b1424;border-radius:14px;overflow:hidden;border:2px solid #173048;box-shadow:0 0 0 1px #000,0 0 40px rgba(25,195,230,.2);cursor:none;user-select:none;-webkit-user-select:none}
#ddRoot canvas{display:block;width:100%;height:100%;pointer-events:none}
#ddRoot .ddo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px;background:rgba(4,10,20,.88);pointer-events:none}
#ddRoot .ddo[hidden]{display:none}
#ddRoot .ddo h3{font:700 44px/1 'Arial Narrow','Roboto Condensed','Barlow Condensed',sans-serif;text-transform:uppercase;margin:0;letter-spacing:.5px}
#ddRoot .ddo p{margin:0;color:#8fb6c9;max-width:36ch}
#ddRoot .big{font:700 30px/1.1 'Arial Narrow','Roboto Condensed','Barlow Condensed',sans-serif;color:#f2f7fb}
#ddRoot .hint{color:#19c3e6!important;font-weight:600}
#ddRoot .edb{min-width:200px}
#ddRoot .edh{color:#8fb6c9;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
#ddRoot .edr{display:flex;justify-content:space-between;gap:18px;color:#cfe3ec;font-size:14px;padding:1px 0}
#ddRoot .edr.me{color:#19c3e6}`;
function open(){
  if(window.__pdOpen)return;
  window.__pdOpen=true;closed=false;
  Object.assign(S,{mode:"menu",slips:[],fx:[],lvl:1,done:0,ok:0,bad:0,strikes:0,score:0,combo:0,t:0,mood:"idle",moodT:0});
  const st=document.createElement("style");st.id="ddStyle";st.textContent=CSS;document.head.appendChild(st);
  root=document.createElement("div");root.id="ddRoot";root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Dispensary Dash");
  root.innerHTML='<button class="ddx" type="button">Exit</button><button class="ddx dds" type="button">Sound on</button><div class="ddg"><canvas width="640" height="420"></canvas>'
    +'<div class="ddo" id="ovStart"><h3>Dispensary Dash</h3><p>Scripts are piling up. Get every item to the right place.</p><div class="edb" id="sBoard"></div><p class="hint">Press an arrow key</p></div>'
    +'<div class="ddo" id="ovEnd" hidden><h3 id="eT"></h3><p id="eP"></p><div class="big" id="eS"></div><p id="eB"></p><div class="edb" id="eBoard"></div><p class="hint">Press an arrow key</p></div></div>';
  const prev=document.body.style.overflow;document.body.style.overflow="hidden";document.body.appendChild(root);root._prev=prev;root._st=st;
  cv=root.querySelector("canvas");ctx=cv.getContext("2d");dpr=Math.min(window.devicePixelRatio||1,2);cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  const mb=root.querySelector(".dds");mb.textContent=AU.isMuted()?"Sound off":"Sound on";mb.addEventListener("click",()=>{AU.setMuted(!AU.isMuted());mb.textContent=AU.isMuted()?"Sound off":"Sound on";mb.blur()});
  root.querySelector(".ddx").addEventListener("click",closeGame);
  ["mousedown","click","contextmenu","wheel","touchstart"].forEach(ev=>root.querySelector(".ddg").addEventListener(ev,stopMouse,{passive:false}));
  document.addEventListener("keydown",kd,true);window.addEventListener("blur",onBlur);
  AU.tempo(1);AU.start();board($("#sBoard"));
  last=performance.now();raf=requestAnimationFrame(loop);
}
function closeGame(){
  if(closed)return;closed=true;cancelAnimationFrame(raf);AU.stop();
  document.removeEventListener("keydown",kd,true);window.removeEventListener("blur",onBlur);
  if(root){document.body.style.overflow=root._prev||"";root._st.remove();root.remove();root=null}
  window.__pdOpen=false;
}
window.PortalDash={open};
})();
