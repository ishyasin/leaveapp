/* GRAEMe's Emergency Drop - hidden easter egg for Pharmacy Portal (ED&G).
   Opened by the secret code (Admin > Emergency Drop, Developer only). A top-down driving game:
   GRAEMe races the antidotes to four hospitals. Arrow keys only; Esc or Exit leaves.
   Only the weekly best scores are shared (submit_drop_score / get_drop_weekly). */
(function(){
if(window.PortalDrop)return;
const W=360,H=600,LW=64,RL=84,RR=276,LANE=[116,180,244],VY=470;
let cv,ctx,root,raf=0,closed=true,dpr=1;
const $=s=>root.querySelector(s);
const LEGS=[
 {name:"Worthing Hospital",place:"Worthing Hospital",len:13500,time:51,theme:"sea",traffic:.30,works:.08,cones:.12},
 {name:"St Richard's Hospital",place:"St Richard's Hospital",len:15000,time:56,theme:"town",traffic:.34,works:.10,cones:.14},
 {name:"Princess Royal Hospital",place:"Princess Royal Hospital",len:16500,time:60,theme:"country",traffic:.36,works:.12,cones:.14},
 {name:"Royal Sussex County Hospital",place:"Royal Sussex County Hospital",len:18000,time:65,theme:"works",traffic:.34,works:.24,cones:.20}];
let seed=1;function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646}
function hash(n){let x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x)}
const S={mode:"menu",leg:0,dist:0,speed:0,x:LANE[1],vx:0,time:0,score:0,boxes:0,inv:0,shake:0,flash:0,objs:[],t:0,legScore:0};
const keys={left:0,right:0,gas:0,brake:0};

function build(i){
  const L=LEGS[i];seed=7+i*31;S.objs=[];let y=650;
  while(y<L.len-500){
    const r=rnd();
    if(r<L.works){ // barrier closing two lanes, one gap
      const open=Math.floor(rnd()*3);const lanes=[0,1,2].filter(l=>l!==open);
      lanes.forEach(l=>S.objs.push({t:"barrier",lane:l,x:LANE[l],y,w:60,h:22,v:0}));
      const nx=LANE[open]+(open===1?(rnd()<.5?-1:1)*0:0);
      [-110,-70].forEach((dy,j)=>lanes.forEach(l=>S.objs.push({t:"cone",lane:l,x:LANE[l]+(l<open?18:-18)*(j?0:1),y:y+dy,w:12,h:12,v:0})));
      if(rnd()<.6)S.objs.push({t:"box",x:LANE[open],y:y+60,w:20,h:20,v:0});
      y+=300+rnd()*120;
    }else if(r<L.works+L.cones){
      const l=Math.floor(rnd()*3);for(let k=0;k<3;k++)S.objs.push({t:"cone",lane:l,x:LANE[l]+(k-1)*14,y:y+k*38,w:12,h:12,v:0});
      y+=230+rnd()*100;
    }else if(r<L.works+L.cones+L.traffic){
      const n=rnd()<.4?2:1;const ls=[0,1,2].sort(()=>rnd()-.5).slice(0,n);
      ls.forEach(l=>S.objs.push({t:"car",lane:l,x:LANE[l],y:y+rnd()*40,w:28,h:50,v:[100,150,200][l],col:["#c0392b","#2c7be5","#e8b730","#8e44ad","#16a085","#555"][Math.floor(rnd()*6)],van:rnd()<.25}));
      if(rnd()<.5){const l=[0,1,2].filter(q=>!ls.includes(q))[0];S.objs.push({t:"box",x:LANE[l],y:y+70,w:20,h:20,v:0})}
      y+=240+rnd()*120;
    }else{
      const l=Math.floor(rnd()*3);S.objs.push({t:"box",x:LANE[l],y,w:20,h:20,v:0});y+=200+rnd()*120;
    }
  }
}
function startLeg(i){S.leg=i;S.dist=0;S.speed=0;S.x=LANE[1];S.vx=0;S.time=LEGS[i].time;S.inv=0;S.legScore=0;build(i);S.mode="play"}
function rect(ax,ay,aw,ah,bx,by,bw,bh){return Math.abs(ax-bx)<(aw+bw)/2&&Math.abs(ay-by)<(ah+bh)/2}
function hit(o){
  if(S.inv>0)return;
  if(o.t==="cone"){o.dead=1;S.speed*=.65;S.shake=.2;return}
  S.speed=Math.min(S.speed,70);S.time=Math.max(0,S.time-2);S.inv=1.1;S.shake=.4;S.flash=.25;
  S.x+=(S.x<o.x?-1:1)*14;
}
function update(dt){
  const L=LEGS[S.leg];S.t+=dt;
  const gas=keys.gas||keys.up,brake=keys.brake;
  let target=brake?40:(keys.boost?450:330);
  if(S.dist>L.len-700)target=Math.min(target,45+Math.max(0,L.len-S.dist)/700*285);   // ease off into the arrival bay
  const acc=(target>S.speed?(keys.boost?260:200):420);
  S.speed+=Math.sign(target-S.speed)*Math.min(Math.abs(target-S.speed),acc*dt);
  const steer=(keys.right?1:0)-(keys.left?1:0);
  S.vx+=(steer*230-S.vx)*Math.min(1,dt*9);S.x+=S.vx*dt;
  S.x=Math.max(RL+17,Math.min(RR-17,S.x));
  S.dist+=S.speed*dt;S.inv=Math.max(0,S.inv-dt);S.shake=Math.max(0,S.shake-dt);S.flash=Math.max(0,S.flash-dt);
  S.time-=dt;
  const statics=S.objs.filter(o=>(o.t==="barrier")&&o.y-S.dist<H&&o.y-S.dist>-H);
  for(const o of S.objs){
    if(o.dead)continue;
    if(o.t==="car"){ // cars queue behind roadworks
      let blocked=false;for(const b of statics){if(b.lane===o.lane&&b.y>o.y&&b.y-o.y<80){blocked=true;break}}
      if(!blocked)o.y+=o.v*dt;
    }
    const sy=VY-(o.y-S.dist);if(sy<-80||sy>H+80)continue;
    if(rect(S.x,VY,26,50,o.x,sy,o.w,o.h)){
      if(o.t==="box"){o.dead=1;S.time+=3;S.boxes++;S.score+=50;S.legScore+=50;S.flash=.12}else hit(o);
    }
  }
  if(S.time<=0){S.time=0;S.mode="fail";msg("Too late","The antidotes did not reach "+L.place+" in time. Score "+S.score+".","Try again")}
  else if(S.dist>=L.len){S.speed=0;
    const bank=Math.round(S.time*10);S.score+=bank;
    if(S.leg<LEGS.length-1){S.mode="done";msg("Antidotes delivered to "+L.place,"+"+bank+" for "+S.time.toFixed(1)+"s left. Total "+S.score+".","Next delivery")}
    else{S.mode="won";msg("All antidotes on site","Final score "+S.score+" with "+S.boxes+" vials collected.","Run it again")}
  }
}
function msg(t,p){$("#mT").textContent=t;$("#mP").textContent=p;$("#ovMsg").hidden=false;board($("#mBoard"));if(S.mode==="fail"||S.mode==="won")sendScore()}

/* ---------- drawing ---------- */
function scenery(L){
  const th=L.theme;
  // left side
  if(th==="sea"){
    ctx.fillStyle="#1d6f9c";ctx.fillRect(0,0,RL-22,H);
    ctx.fillStyle="#e3cf9a";ctx.fillRect(RL-22,0,14,H);ctx.fillStyle="#9aa3ad";ctx.fillRect(RL-8,0,8,H);
    ctx.strokeStyle="rgba(255,255,255,.35)";ctx.lineWidth=2;
    for(let i=0;i<14;i++){const wy=((i*95-S.dist*.4+S.t*14)%(H+95)+(H+95))%(H+95)-40;const wx=8+hash(i)*40;ctx.beginPath();ctx.moveTo(wx,wy);ctx.quadraticCurveTo(wx+8,wy-5,wx+16,wy);ctx.stroke()}
    // pier crossing the beach into the sea
    const py=VY-(L.len*.5-S.dist);if(py>-40&&py<H+40){ctx.fillStyle="#7a5a3a";ctx.fillRect(0,py-9,RL-8,18);ctx.fillStyle="#a98355";for(let k=0;k<12;k++)ctx.fillRect(k*7,py-9,2,18);ctx.fillStyle="#19c3e6";ctx.fillRect(2,py-16,18,10)}
  }else if(th!=="country"){
    ctx.fillStyle=th==="works"?"#7a6f5d":"#3d6b3f";ctx.fillRect(0,0,RL,H);ctx.fillStyle="#9aa3ad";ctx.fillRect(RL-8,0,8,H);
    for(let i=-1;i<9;i++){const n=Math.floor((S.dist)/80)+i;const sy=VY-(n*80-S.dist)-40;const bw=34+hash(n)*24;
      if(th==="town"){ctx.fillStyle=["#b8523f","#c9a36a","#8a6bb1","#5e8fb0"][Math.floor(hash(n+9)*4)];ctx.fillRect(RL-14-bw,sy,bw,64);ctx.fillStyle="rgba(0,0,0,.25)";ctx.fillRect(RL-14-bw,sy+60,bw,4)}
      else{ctx.fillStyle="#d9a441";ctx.fillRect(RL-30-hash(n)*14,sy+20,26,30);ctx.fillStyle="#333";ctx.fillRect(RL-30-hash(n)*14,sy+44,26,8)} }
  }
  if(th==="country"){
    for(const side of [0,1]){const x0=side?RR+8:0,w=side?W-RR-8:RL-8;
      for(let i=-1;i<8;i++){const n=Math.floor(S.dist/110)+i,sy=VY-(n*110-S.dist)-110,h=hash(n*2+side);
        ctx.fillStyle=["#6ea04a","#7db356","#9bb24e","#5f9444"][Math.floor(h*4)];ctx.fillRect(x0,sy,w,110);
        ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillRect(x0,sy,w,3);
        if(hash(n+side*7)<.7){const tx=x0+8+hash(n+3)*(w-22);ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.arc(tx+2,sy+36,10,0,7);ctx.fill();ctx.fillStyle="#2f6b32";ctx.beginPath();ctx.arc(tx,sy+34,10,0,7);ctx.fill();ctx.fillStyle="#3d8a3f";ctx.beginPath();ctx.arc(tx-3,sy+31,5,0,7);ctx.fill()}
        if(hash(n+11+side)<.18){ctx.fillStyle="#c9a36a";ctx.fillRect(x0+6,sy+66,28,20);ctx.fillStyle="#9c4a35";ctx.beginPath();ctx.moveTo(x0+3,sy+66);ctx.lineTo(x0+20,sy+55);ctx.lineTo(x0+37,sy+66);ctx.fill()}}
      ctx.fillStyle="#9aa3ad";ctx.fillRect(side?RR:RL-8,0,8,H);}
  }
  if(th==="works"){ // site fencing and a digger on the verge
    for(let i=-1;i<12;i++){const n=Math.floor(S.dist/50)+i;const sy=VY-(n*50-S.dist);ctx.fillStyle=n%2?"#ff7a1a":"#fff";ctx.fillRect(RL-12,sy,4,50)}
    const dn=Math.floor(S.dist/700);for(let k=0;k<2;k++){const sy=VY-((dn+k)*700+260-S.dist);if(sy>-60&&sy<H+60){ctx.fillStyle="#f2b61e";ctx.fillRect(14,sy-18,34,36);ctx.fillStyle="#333";ctx.fillRect(10,sy-20,6,40);ctx.fillRect(46,sy-20,6,40);ctx.fillStyle="#7a5a3a";ctx.fillRect(28,sy-34,6,18)}}
  }
  // right side
  if(th!=="country"){ctx.fillStyle="#9aa3ad";ctx.fillRect(RR,0,8,H);
  ctx.fillStyle=th==="sea"?"#cfc7b8":th==="works"?"#7a6f5d":"#3d6b3f";ctx.fillRect(RR+8,0,W-RR-8,H);}
  if(th!=="country")for(let i=-1;i<9;i++){const n=Math.floor(S.dist/90)+i;const sy=VY-(n*90-S.dist)-45;const bw=40+hash(n+3)*30;
    ctx.fillStyle=th==="sea"?["#f2e8d5","#e8d2c0","#d8e4ea","#f0c9b8"][Math.floor(hash(n+5)*4)]:["#b8523f","#c9a36a","#8a6bb1","#5e8fb0","#a1a1a1"][Math.floor(hash(n+5)*5)];
    ctx.fillRect(RR+16,sy,bw,70);ctx.fillStyle="rgba(0,0,0,.22)";ctx.fillRect(RR+16,sy+66,bw,4);
    if(th==="town"&&hash(n+1)<.5){ctx.fillStyle="#2f7a3a";ctx.beginPath();ctx.arc(RR+14,sy+80,7,0,7);ctx.fill()}}
  // gulls
  if(th==="sea"){ctx.strokeStyle="#fff";ctx.lineWidth=2;for(let i=0;i<4;i++){const gx=20+((S.t*30*(1+i*.2)+i*90)%(W+40))-20,gy=60+i*120+Math.sin(S.t*3+i)*8;ctx.beginPath();ctx.moveTo(gx-6,gy);ctx.quadraticCurveTo(gx-3,gy-6,gx,gy);ctx.quadraticCurveTo(gx+3,gy-6,gx+6,gy);ctx.stroke()}}
}
function road(L){
  ctx.fillStyle="#2c3036";ctx.fillRect(RL,0,RR-RL,H);
  ctx.fillStyle="#e8e8e8";ctx.fillRect(RL,0,3,H);ctx.fillRect(RR-3,0,3,H);
  const off=S.dist%60;ctx.fillStyle="rgba(255,255,255,.7)";
  for(let k=-1;k<12;k++){const y=k*60+off;[RL+LW,RL+LW*2].forEach(x=>ctx.fillRect(x-1.5,y,3,30))}
  // finish bay
  const fy=VY-(L.len-S.dist)-60;if(fy>-120&&fy<H+40){
    for(let i=0;i<12;i++)for(let j=0;j<2;j++){ctx.fillStyle=(i+j)%2?"#fff":"#111";ctx.fillRect(RL+i*16,fy+j*16,16,16)}
    ctx.fillStyle="rgba(25,195,230,.32)";ctx.fillRect(RL,fy+32,RR-RL,80);
    ctx.fillStyle="#fff";ctx.font="700 22px 'Arial Narrow','Roboto Condensed','Barlow Condensed',sans-serif";ctx.textAlign="center";ctx.fillText(L.place.toUpperCase(),W/2,fy+80);}
}
function drawObj(o){
  const sy=VY-(o.y-S.dist);if(sy<-70||sy>H+70)return;
  if(o.dead)return;
  ctx.save();ctx.translate(o.x,sy);
  if(o.t==="car"){
    ctx.fillStyle="rgba(0,0,0,.3)";ctx.fillRect(-14,-23,30,52);
    ctx.fillStyle=o.col;ctx.beginPath();ctx.roundRect(-14,-25,28,50,6);ctx.fill();
    ctx.fillStyle="rgba(180,220,255,.85)";ctx.fillRect(-10,-14,20,10);ctx.fillRect(-10,8,20,7);
    if(o.van){ctx.fillStyle="rgba(255,255,255,.35)";ctx.fillRect(-12,-3,24,10)}
    ctx.fillStyle="#fff7c2";ctx.fillRect(-11,-26,5,3);ctx.fillRect(6,-26,5,3);
  }else if(o.t==="cone"){
    ctx.fillStyle="#ff7a1a";ctx.beginPath();ctx.arc(0,0,6,0,7);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,3,0,7);ctx.fill();ctx.fillStyle="#ff7a1a";ctx.beginPath();ctx.arc(0,0,1.4,0,7);ctx.fill();
  }else if(o.t==="barrier"){
    ctx.fillStyle="#fff";ctx.fillRect(-32,-11,64,22);
    ctx.save();ctx.beginPath();ctx.rect(-32,-11,64,22);ctx.clip();ctx.fillStyle="#e8412a";for(let k=-4;k<8;k++){ctx.beginPath();ctx.moveTo(-32+k*12,-11);ctx.lineTo(-24+k*12,-11);ctx.lineTo(-32+k*12+12,11);ctx.lineTo(-32+k*12+4,11);ctx.fill()}ctx.restore();
    ctx.fillStyle="#222";ctx.fillRect(-30,11,5,5);ctx.fillRect(25,11,5,5);
  }else if(o.t==="box"){
    const bob=Math.sin(S.t*5+o.y)*2;ctx.translate(0,bob);
    ctx.fillStyle="rgba(25,195,230,.28)";ctx.beginPath();ctx.arc(0,0,17,0,7);ctx.fill();
    ctx.fillStyle="#f2f5fa";ctx.beginPath();ctx.roundRect(-4.5,-9,9,18,3);ctx.fill();              // antidote vial
    ctx.fillStyle="#19c3e6";ctx.fillRect(-3.5,-1,7,9);ctx.fillStyle="#0b1220";ctx.fillRect(-4,-11,8,4);
    ctx.fillStyle="#fff";ctx.fillRect(-2.5,-6,2,10);
  }
  ctx.restore();
}
function van(){
  if(S.inv>0&&Math.floor(S.t*14)%2)return;
  const look=Math.max(-1,Math.min(1,S.vx/230));
  ctx.save();ctx.translate(S.x,VY);ctx.rotate(look*.12);ctx.scale(1.15,1.15);
  // underglow
  const fl=Math.floor(S.t*7)%2;ctx.globalAlpha=.3;ctx.fillStyle=fl?"#2f6bff":"#0a2a7a";ctx.beginPath();ctx.roundRect(-20,-31,40,62,13);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle="rgba(0,0,0,.4)";ctx.fillRect(-13,-22,28,50);
  // body
  ctx.fillStyle="#f4f8fb";ctx.beginPath();ctx.roundRect(-14,-26,28,52,7);ctx.fill();
  ctx.fillStyle="#19c3e6";ctx.fillRect(-4,-26,3,22);ctx.fillRect(1,-26,3,22);          // bonnet stripes
  ctx.fillStyle="#10161f";ctx.fillRect(-14,-4,3,10);ctx.fillRect(11,-4,3,10);          // door gaps
  // cockpit
  ctx.fillStyle="#141b27";ctx.beginPath();ctx.roundRect(-10,-9,20,35,5);ctx.fill();
  ctx.fillStyle="#232e41";ctx.fillRect(-9,20,18,4);
  // arms to the wheel
  ctx.strokeStyle="#f4f8fb";ctx.lineWidth=4;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(-9,14);ctx.lineTo(-5.5+look*3,-1);ctx.moveTo(9,14);ctx.lineTo(5.5+look*3,-1);ctx.stroke();
  // steering wheel
  ctx.save();ctx.translate(0,-2);ctx.rotate(look*.9);
  ctx.strokeStyle="#05080d";ctx.lineWidth=2.8;ctx.beginPath();ctx.arc(0,0,6.5,0,7);ctx.stroke();ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-6.5,0);ctx.lineTo(6.5,0);ctx.stroke();
  ctx.fillStyle="#19c3e6";ctx.beginPath();ctx.arc(0,0,1.8,0,7);ctx.fill();ctx.restore();
  // GRAEMe: shoulders, head, visor, ear lights, antenna
  ctx.fillStyle="#e8eef3";ctx.beginPath();ctx.ellipse(0,17,11,5.5,0,0,7);ctx.fill();
  ctx.save();ctx.translate(look*1.6,12);
  ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,9.5,0,7);ctx.fill();
  ctx.strokeStyle="#c9d4dc";ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle="#0a0e14";ctx.beginPath();ctx.ellipse(0,-3.4,7.2,4.4,0,0,7);ctx.fill();   // visor (front of the head)
  [-1,1].forEach(sx=>{ctx.fillStyle="#0a0e14";ctx.beginPath();ctx.arc(sx*9.6,1,3.6,0,7);ctx.fill();ctx.fillStyle="#19c3e6";ctx.beginPath();ctx.arc(sx*9.6,1,2.4,0,7);ctx.fill()});
  ctx.strokeStyle="#c9d4dc";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-5,4.5);ctx.lineTo(5,4.5);ctx.stroke();   // panel line across the back of the head
  ctx.restore();
  // blue light bar (bonnet) and flashing corner lights
  ctx.fillStyle="#0b1220";ctx.fillRect(-11,-17,22,6);
  ctx.fillStyle=fl?"#4d8dff":"#17306e";ctx.fillRect(-10,-16,10,4);ctx.fillStyle=fl?"#17306e":"#4d8dff";ctx.fillRect(0,-16,10,4);
  ctx.fillStyle=fl?"#7fb0ff":"#1b3f9a";ctx.fillRect(-12,-27,6,3);ctx.fillStyle=fl?"#1b3f9a":"#7fb0ff";ctx.fillRect(6,-27,6,3);

  if(keys.brake||S.speed<60){ctx.fillStyle="#ff2d2d";ctx.fillRect(-12,24,7,3);ctx.fillRect(5,24,7,3)}
  ctx.restore();
  if(S.mode==="play"){const f2=Math.floor(S.t*7)%2;ctx.save();ctx.globalAlpha=.20;ctx.fillStyle="#2f6bff";ctx.beginPath();ctx.arc(S.x+(f2?-16:16),VY-16,40,0,7);ctx.fill();ctx.globalAlpha=.07;ctx.fillRect(RL,0,RR-RL,H);ctx.restore()}
}
function hud(L){
  ctx.fillStyle="rgba(8,16,30,.82)";ctx.fillRect(0,0,W,46);
  ctx.textAlign="left";ctx.fillStyle="#9db0c9";ctx.font="600 11px 'Segoe UI',Arial,sans-serif";ctx.fillText("LEVEL "+(S.leg+1)+" OF "+LEGS.length,10,15);
  ctx.fillStyle="#f2f5fa";ctx.font="700 14px 'Arial Narrow','Roboto Condensed','Barlow Condensed',sans-serif";ctx.fillText(L.name.toUpperCase(),10,35);
  ctx.textAlign="right";ctx.font="700 30px 'Arial Narrow','Roboto Condensed','Barlow Condensed',sans-serif";ctx.fillStyle=S.time<8?"#ff4d4d":"#fff";ctx.fillText(S.time.toFixed(1),W-10,34);
  ctx.font="600 11px 'Segoe UI',Arial,sans-serif";ctx.fillStyle="#9db0c9";ctx.fillText("SECONDS",W-10,14);
  // route bar
  ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(W-14,62,6,300);
  const p=Math.min(1,S.dist/L.len);ctx.fillStyle="#19c3e6";ctx.fillRect(W-14,62+300*(1-p),6,300*p);
  ctx.fillStyle="#fff";ctx.fillRect(W-18,58,14,4);
  // speed + score
  ctx.textAlign="left";ctx.font="700 18px 'Arial Narrow','Roboto Condensed','Barlow Condensed',sans-serif";ctx.fillStyle="#fff";
  ctx.fillText(Math.round(S.speed/330*50)+" mph",10,H-34);ctx.fillStyle="#9db0c9";ctx.font="600 12px 'Segoe UI',Arial,sans-serif";ctx.fillText("SCORE "+S.score+"   VIALS "+S.boxes,10,H-14);
  if(S.flash>0){ctx.fillStyle="rgba(255,255,255,"+S.flash*.6+")";ctx.fillRect(0,0,W,H)}
}
function draw(){
  const L=LEGS[S.mode==="menu"?0:S.leg];
  ctx.save();ctx.clearRect(0,0,W,H);
  if(S.shake>0)ctx.translate((Math.random()-.5)*S.shake*14,(Math.random()-.5)*S.shake*14);
  scenery(L);road(L);S.objs.forEach(drawObj);van();ctx.restore();hud(L);
}
var last=0;
function loop(ts){
  if(closed)return;
  const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
  if(S.mode==="play")update(dt);else S.t+=dt;
  draw();raf=requestAnimationFrame(loop);
}
/* ---------- shared weekly high scores ---------- */
function sendScore(){
  if(S.score>0&&typeof sb!=="undefined"){try{Promise.resolve(sb.rpc("submit_drop_score",{p_score:S.score,p_level:S.leg+(S.mode==="won"?1:0)||1,p_vials:S.boxes})).then(()=>{if(root&&!$("#ovMsg").hidden)board($("#mBoard"))}).catch(()=>{})}catch(e){}}
}
function board(el){
  if(!el||typeof sb==="undefined")return;
  try{Promise.resolve(sb.rpc("get_drop_weekly",{p_weeks_ago:0})).then(r=>{
    const rows=(r&&r.data)||[];el.textContent="";
    if(!rows.length)return;
    const h=document.createElement("div");h.className="edh";h.textContent="This week's best";el.appendChild(h);
    rows.slice(0,5).forEach(x=>{const d=document.createElement("div");d.className="edr"+(x.is_me?" me":"");
      const a=document.createElement("span");a.textContent=x.rank+". "+x.display_name;const b=document.createElement("b");b.textContent=Number(x.score).toLocaleString("en-GB");d.appendChild(a);d.appendChild(b);el.appendChild(d)});
  }).catch(()=>{})}catch(e){}
}

/* ---------- input: arrow keys only (Esc leaves the game) ---------- */
const KM={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"boost",ArrowDown:"brake"};
function advance(){
  if(S.mode==="menu"){S.score=0;S.boxes=0;$("#ovStart").hidden=true;startLeg(0)}
  else if(S.mode==="done"){$("#ovMsg").hidden=true;startLeg(S.leg+1)}
  else if(S.mode==="fail"||S.mode==="won"){$("#ovMsg").hidden=true;S.score=0;S.boxes=0;startLeg(S.mode==="won"?0:S.leg)}
  else if(S.mode==="pause")S.mode="play";
}
function kd(e){
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeGame();return}
  const k=KM[e.key];if(!k)return;e.preventDefault();e.stopPropagation();if(e.repeat)return;
  if(S.mode!=="play"){advance();if(S.mode==="play")keys[k]=1;return}
  keys[k]=1;
}
function ku(e){const k=KM[e.key];if(k){keys[k]=0;e.preventDefault()}}
function onBlur(){for(const k in keys)keys[k]=0;if(S.mode==="play")S.mode="pause"}
function stopMouse(e){e.preventDefault();e.stopPropagation()}

const CSS=`#edRoot{position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at 50% 30%,#0d1c30 0,#050a14 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Segoe UI',Arial,sans-serif;color:#f2f7fb}
#edRoot .edx{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.08);color:#cfe9f2;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 14px;font:600 14px 'Segoe UI',Arial,sans-serif;cursor:pointer}
#edRoot .edx:hover{background:rgba(255,255,255,.16)}
#edRoot .edg{position:relative;height:min(94vh,calc(94vw*600/360));aspect-ratio:360/600;max-width:94vw;background:#000;border-radius:14px;overflow:hidden;border:2px solid #173048;box-shadow:0 0 0 1px #000,0 0 40px rgba(25,195,230,.2);cursor:none;user-select:none;-webkit-user-select:none}
#edRoot canvas{display:block;width:100%;height:100%;pointer-events:none}
#edRoot .edo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;background:rgba(4,10,20,.86);pointer-events:none}
#edRoot .edo[hidden]{display:none}
#edRoot .edo h3{font:700 40px/1 'Arial Narrow','Roboto Condensed','Barlow Condensed',sans-serif;text-transform:uppercase;margin:0;letter-spacing:.5px}
#edRoot .edo p{margin:0;color:#8fb6c9;max-width:30ch}
#edRoot .hint{color:#19c3e6!important;font-weight:600}
#edRoot .edb{margin-top:6px;min-width:190px}
#edRoot .edh{color:#8fb6c9;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
#edRoot .edr{display:flex;justify-content:space-between;gap:18px;color:#cfe3ec;font-size:14px;padding:1px 0}
#edRoot .edr.me{color:#19c3e6}`;
function open(){
  if(window.__pdOpen)return;
  window.__pdOpen=true;closed=false;
  for(const k in keys)keys[k]=0;
  Object.assign(S,{mode:"menu",leg:0,dist:0,speed:0,x:LANE[1],vx:0,time:0,score:0,boxes:0,inv:0,shake:0,flash:0,objs:[],t:0});
  const st=document.createElement("style");st.id="edStyle";st.textContent=CSS;document.head.appendChild(st);
  root=document.createElement("div");root.id="edRoot";root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","GRAEMe's Emergency Drop");
  root.innerHTML='<button class="edx" type="button">Exit</button><div class="edg"><canvas width="360" height="600"></canvas>'
    +'<div class="edo" id="ovStart"><h3><span style="text-transform:none">GRAEMe</span>&rsquo;s<br>Emergency Drop</h3><p>The antidotes are needed on site. Fast.</p><div class="edb" id="sBoard"></div><p class="hint">Press an arrow key</p></div>'
    +'<div class="edo" id="ovMsg" hidden><h3 id="mT"></h3><p id="mP"></p><div class="edb" id="mBoard"></div><p class="hint">Press an arrow key</p></div></div>';
  const prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  document.body.appendChild(root);
  root._prev=prevOverflow;root._st=st;
  cv=root.querySelector("canvas");ctx=cv.getContext("2d");
  dpr=Math.min(window.devicePixelRatio||1,2);cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  root.querySelector(".edx").addEventListener("click",closeGame);
  ["mousedown","click","contextmenu","wheel","touchstart"].forEach(ev=>root.querySelector(".edg").addEventListener(ev,stopMouse,{passive:false}));
  document.addEventListener("keydown",kd,true);document.addEventListener("keyup",ku,true);window.addEventListener("blur",onBlur);
  board($("#sBoard"));
  last=performance.now();raf=requestAnimationFrame(loop);
}
function closeGame(){
  if(closed)return;closed=true;cancelAnimationFrame(raf);
  document.removeEventListener("keydown",kd,true);document.removeEventListener("keyup",ku,true);window.removeEventListener("blur",onBlur);
  if(root){document.body.style.overflow=root._prev||"";root._st.remove();root.remove();root=null}
  window.__pdOpen=false;
}
window.PortalDrop={open};
})();
