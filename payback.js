/* Portal Defence: Payback — hidden easter egg 3 for Pharmacy Portal (ED&G).
   Loaded on demand by portal.html, only after the server says the typed code opens this game
   (easter_egg_which = 3). A first-person rail shooter: GRAEMe rides a vehicle with a mounted
   machine gun down a road through the internet, destroying the evil bot farm, with a boss at the
   end of each of four levels. Self-contained: no network requests, fonts or images. Sound is
   synthesised in the browser. The only thing stored is the best score and the sound setting in
   localStorage. Esc exits. */
(function(){
if(window.PortalPayback)return;
const PB_CSS="#pbRoot{position:fixed;inset:0;z-index:99990;background:rgba(3,9,18,.985);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:max(12px,env(safe-area-inset-top,0px)) 16px max(12px,env(safe-area-inset-bottom,0px));font-family:\"Segoe UI\",Arial,sans-serif;color:#e4f1f7} #pbRoot *{box-sizing:border-box} #pbRoot .pb-bar,#pbRoot .pb-help{width:min(100%,calc((100vh - 120px)*1.7778))} #pbRoot .pb-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap} #pbRoot h2.pb-h{font:400 26px/1 Impact,\"Arial Black\",sans-serif;letter-spacing:.06em;text-transform:uppercase;margin:0;color:#e4f1f7} #pbRoot .pb-tools{display:flex;gap:8px} #pbRoot .pb-tools button{font:600 14px/1 \"Segoe UI\",Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#e4f1f7;background:#0f2338;border:1px solid #1d3a56;border-radius:4px;padding:9px 14px;cursor:pointer} #pbRoot .pb-tools button:hover{border-color:#26c6d8} #pbRoot button:focus-visible{outline:2px solid #26c6d8;outline-offset:2px} #pbRoot .pb-tools button[aria-pressed=\"true\"]{background:#0f3a46;border-color:#26c6d8;color:#26c6d8} #pbStage{position:relative;width:min(100%,calc((100vh - 120px)*1.7778));aspect-ratio:16/9;background:#0b1d36;border:1px solid #1d3a56;border-radius:4px;overflow:hidden;user-select:none;-webkit-user-select:none;cursor:none;touch-action:none;line-height:0} #pbStage canvas{position:absolute;inset:0;width:100%;height:100%;display:block} #pbCard{position:absolute;inset:0;display:grid;place-items:center;background:rgba(3,8,16,.62);padding:12px;cursor:default;line-height:1.4;z-index:2;text-align:center} #pbCard>div{max-width:460px;max-height:100%;overflow:auto;background:rgba(12,27,48,.95);border:1px solid #26c6d8;border-radius:6px;padding:16px 24px} #pbCard h2{margin:0 0 6px;color:#26c6d8;font:400 30px/1.1 Impact,\"Arial Black\",sans-serif;letter-spacing:.06em;text-transform:uppercase} #pbCard p{margin:4px 0;color:#9fb6c9;font-size:14px} #pbCard .btn{font:800 15px/1 \"Segoe UI\",Arial,sans-serif;border:0;background:#26c6d8;color:#032028;border-radius:6px;padding:11px 20px;cursor:pointer;margin-top:8px} #pbCard .btn:focus-visible{outline:3px solid #f5b82e;outline-offset:2px} #pbRoot .pb-help{font-size:13px;color:#8fb0c4;margin:0;text-align:center} @media (max-width:520px){#pbRoot h2.pb-h{font-size:20px}#pbCard h2{font-size:24px}}";
function open(){
  if(window.__pdOpen)return;
  window.__pdOpen=true;
  const st=document.createElement('style');st.id='pbStyle';st.textContent=PB_CSS;document.head.appendChild(st);
  const root=document.createElement('div');root.id='pbRoot';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Portal Defence: Payback');
  root.innerHTML='<div class="pb-bar"><h2 class="pb-h">Portal Defence: Payback</h2><div class="pb-tools"><button id="pbSound" aria-pressed="true" type="button">Sound</button><button id="pbExit" type="button">Exit</button></div></div>'
    +'<div id="pbStage"><canvas id="pbCv" width="960" height="540" aria-label="Portal Defence: Payback playfield"></canvas><div id="pbCard">'+"<div><h2>Payback</h2><p>GRAEMe held the line. Now he is taking the fight to the bot farm. Click to shoot. Hit the glowing core for a critical. Change magazine with R or right click. Fill the Overclock meter, then press Space for minigun rapid fire. Don't shoot the green RX friendly processes.</p><button class=\"btn\" id=\"pbGo\" type=\"button\">Start</button></div>"+'</div></div>'
    +'<p class="pb-help">Mouse or touch to aim and shoot, hold to keep firing. R or right click: change magazine. Space: Overclock when the bar is full. M mute, Esc exit.</p>';
  const prevOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  document.body.appendChild(root);
  function onClose(){root.remove();st.remove();document.body.style.overflow=prevOverflow;window.__pdOpen=false}
  run(onClose);
}
function run(onClose){
var closed=false,raf=0;
var cv=document.getElementById('pbCv'),c=cv.getContext('2d'),W=960,H=540,VX=480,VY=235;
var AC=null,MUTE=false,AMASTER=null,NB=null,HUM=null;
try{MUTE=localStorage.getItem('pdRailMute')==='1'}catch(e){}
function au(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();AMASTER=AC.createGain();AMASTER.gain.value=.55;AMASTER.connect(AC.destination);NB=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);var d=NB.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1}catch(e){AC=null}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(ty,f0,f1,dur,vol,dl){if(!AC||MUTE)return;var t0=AC.currentTime+(dl||0),o=AC.createOscillator(),g=AC.createGain();o.type=ty;o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t0+dur);g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.001,t0+dur);o.connect(g);g.connect(AMASTER);o.start(t0);o.stop(t0+dur+.02)}
function nz(dur,vol,ft,fq,dl){if(!AC||MUTE)return;var t0=AC.currentTime+(dl||0),sr=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();sr.buffer=NB;f.type=ft;f.frequency.value=fq;g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.001,t0+dur);sr.connect(f);f.connect(g);g.connect(AMASTER);sr.start(t0,Math.random()*.5);sr.stop(t0+dur+.02)}
function humOn(on){if(!AC)return;if(HUM){try{HUM.o.stop();HUM.o2.stop()}catch(e){}HUM=null}if(!on)return;var o=AC.createOscillator(),o2=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';o.frequency.value=48;o2.type='square';o2.frequency.value=72;f.type='lowpass';f.frequency.value=240;g.gain.value=MUTE?0:.045;o.connect(f);o2.connect(f);f.connect(g);g.connect(AMASTER);o.start();o2.start();HUM={o:o,o2:o2,g:g}}
function setMute(m){MUTE=m;try{localStorage.setItem('pdRailMute',m?'1':'0')}catch(e){}if(HUM)HUM.g.gain.value=m?0:.045}
var sfx={
 shoot:function(){nz(.09,.5,'bandpass',1100);tone('square',150,55,.11,.3);tone('sawtooth',2600,500,.045,.1)},
 hit:function(core){if(core){tone('triangle',1400,2000,.13,.3);tone('sine',2400,2400,.09,.15,.03)}else tone('sine',720,480,.06,.25)},
 miss:function(){tone('sine',3200,1400,.06,.05)},
 kill:function(){nz(.28,.4,'lowpass',1400);tone('sawtooth',320,55,.28,.28)},
 friend:function(){tone('square',210,80,.34,.32)},
 empty:function(){tone('square',950,650,.03,.2)},
 screech:function(){nz(.9,.28,'bandpass',2600);tone('sawtooth',900,500,.8,.06)},
 mini:function(){nz(.035,.32,'bandpass',1500);tone('square',210,95,.04,.18)},
 oc:function(){tone('sawtooth',70,1100,.9,.28);tone('square',140,2000,.9,.1);nz(.5,.2,'highpass',3000)},
 ocEnd:function(){tone('sawtooth',1000,50,.8,.25);nz(.4,.15,'lowpass',600)},
 magOut:function(){nz(.035,.45,'highpass',2500);tone('square',320,180,.05,.2);nz(.05,.3,'bandpass',700,.28)},
 magIn:function(){nz(.04,.5,'highpass',2000);tone('square',260,140,.06,.25);nz(.06,.4,'bandpass',900,.09);tone('triangle',600,900,.05,.15,.09)},
 damage:function(){tone('sawtooth',130,38,.45,.45);nz(.35,.35,'lowpass',800)},
 boss:function(){tone('sawtooth',90,46,.9,.4);tone('square',135,69,.9,.2,.05);nz(.6,.25,'lowpass',500)},
 clear:function(){[523,659,784].forEach(function(f,i){tone('triangle',f,f,.16,.22,i*.09)})},
 level:function(){[392,523,659,784,1046].forEach(function(f,i){tone('triangle',f,f,.2,.22,i*.1)})},
 over:function(){[330,262,196,131].forEach(function(f,i){tone('sawtooth',f,f*.97,.3,.25,i*.18)})},
 win:function(){[523,659,784,1046,784,1046,1318].forEach(function(f,i){tone('triangle',f,f,.22,.24,i*.11)})}
};
var MUZ=[760,330],down=false,fireCd=0,fx=[],bl=[],shotN=0,lastCore=false,FXL={hit:.22,core:.32,miss:.26,boom:.55};
function addFx(k,x,y,sc,dl){fx.push({k:k,x:x,y:y,sc:sc||1,l:FXL[k],m:FXL[k],dl:dl||0,sd:Math.random()*6.283})}
var st='title',t=0,mx=480,my=270,score=0,best=0,lives=3,ammo=30,reload=0,combo=0,room=0,lvl=0,rIn=0,isBoss=false,cardT=0,cardL=[],shots=0,hits=0,phase='move',pt=0,cleared=0,shake=0,flash=0,dmg=0,msg='',msgT=0,scroll=0,recoil=0,ocM=0,ocT=0;
var tr=[],en=[],parts=[],pops=[],queue=[],rain=[];try{best=+localStorage.getItem('pdRailBest')||0}catch(e){}
for(var i=0;i<40;i++)rain.push([Math.random()*W,Math.random()*H,20+Math.random()*60,Math.random()<.5?'0':'1']);
var T={worm:{hp:2,r:44,col:'#e0457b',atk:3.2,pts:100},drone:{hp:2,r:40,col:'#ff6a4a',atk:3,pts:150,air:1},key:{hp:1,r:36,col:'#a55bd6',atk:2.2,pts:120},trojan:{hp:7,r:70,col:'#8a3cc2',atk:4.4,pts:400},env:{hp:1,r:30,col:'#ff9a6a',atk:2.4,pts:50,air:1},spam:{hp:42,r:130,col:'#e8553a',atk:7,pts:3000,air:1,boss:1,minion:'env',mcd:2.6,name:'SPAMLORD'},keyking:{hp:56,r:125,col:'#8e3fcf',atk:7,pts:4000,boss:1,minion:'key',mcd:3.2,name:'KEYLOG KING'},titan:{hp:75,r:140,col:'#a8632b',atk:6.5,pts:5000,boss:1,minion:'worm',mcd:3,name:'TROJAN TITAN'},master:{hp:110,r:150,col:'#c4352c',atk:6,pts:10000,air:1,boss:1,minion:'drone',mcd:2.4,name:'THE BOTMASTER'},friend:{hp:1,r:34,col:'#2fbf71',atk:99,pts:0}};
function add(k,x,delay,z){var d=T[k];en.push({k:k,d:d,x:x,z:z||.95,hp:d.hp,m:d.hp,t:-delay,atk:0,mc:d.mcd||0,ph:Math.random()*6,dead:0,fl:0,sp:.09+(lvl*3+rIn)*.008+Math.random()*.02})}
var LV=[{n:'The Bot Farm Gates',rgb:'38,198,216',top:'#071a33',bot:'#0a2a44',rooms:2,boss:'spam',intro:'The farm\u2019s outer gates. Cheap spam bots swarm here. Their SPAMLORD runs the show.'},
 {n:'Keylogger Alley',rgb:'176,96,230',top:'#150a2e',bot:'#241044',rooms:2,boss:'keyking',intro:'Rows of keyloggers, stealing every password they can reach. Their KEYLOG KING sits at the end.'},
 {n:'Trojan Stables',rgb:'255,150,60',top:'#2a1405',bot:'#3d1d08',rooms:2,boss:'titan',intro:'Big wooden Trojans pour out of the stables. The TROJAN TITAN guards the only way in.'},
 {n:'The Botmaster\u2019s Lair',rgb:'255,80,70',top:'#2a0707',bot:'#400c0c',rooms:2,boss:'master',intro:'The heart of the farm. The BOTMASTER built them all. End it.'}];
function plan(){var L=LV[lvl];room++;pt=0;phase='fight';en=[];shots=0;hits=0;
 if(rIn>=L.rooms){isBoss=true;sfx.boss();add(L.boss,0,.6);say('BOSS: '+T[L.boss].name)}
 else{isBoss=false;var k=lvl+1,n=3+Math.min(6,k+rIn),ks=['worm','worm','drone','key','trojan'],i;for(i=0;i<n;i++)add(ks[Math.floor(Math.random()*Math.min(ks.length,2+k+rIn))],(Math.random()*2-1)*.9,i*.9+Math.random()*.4);if(lvl+rIn>0)add('friend',(Math.random()*2-1)*.8,1.8);say(L.n+', room '+(rIn+1))}}
function card(lines,t){cardL=lines;cardT=t;phase='card'}
function say(s){msg=s;msgT=2}
function proj(e){var s=1.15-e.z*.95,gy=250+(1-e.z)*190,x=VX+e.x*(120+(1-e.z)*330)+CF*CUR*(3+e.z*25)*.007*.5,y=e.d.air?gy-(e.d.boss?190:130)*s:gy;return{x:x,y:y,s:s}}
function bits(x,y,col,n,sp){for(var i=0;i<n;i++){var a=Math.random()*6.283,v=(sp||200)*(.3+Math.random());parts.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:.4+Math.random()*.4,col:col})}}
function pop(x,y,s,col){pops.push({x:x,y:y,s:s,col:col||'#fff',t:0})}
function lose(){sfx.damage();lives--;dmg=.7;shake=14;combo=0;if(lives<=0){sfx.over();st='over';if(score>best){best=score;try{localStorage.setItem('pdRailBest',String(best))}catch(e){}}show('Firewall breached','Score '+score+' · Best '+best+' · Room '+room,'Play again')}}
function show(h,p,b){humOn(false);var cd=document.getElementById('pbCard');cd.style.display='grid';cd.firstChild.innerHTML='<h2>'+h+'</h2><p>'+p+'</p><button class="btn" id="pbGo" type="button">'+b+'</button>';document.getElementById('pbGo').onclick=start;document.getElementById('pbGo').focus()}
function start(){au();humOn(true);ocM=0;ocT=0;score=0;lives=3;ammo=MAG();reload=0;combo=0;room=0;lvl=0;rIn=0;st='play';pt=0;en=[];document.getElementById('pbCard').style.display='none';card(['GRAEMe defended the Pharmacy Portal.','Now it\u2019s payback.','','LEVEL 1: '+LV[0].n,LV[0].intro],5)}
document.getElementById('pbGo').onclick=start;
function pos(e){var r=cv.getBoundingClientRect();mx=(e.clientX-r.left)*W/r.width;my=(e.clientY-r.top)*H/r.height}
function MAG(){return 30+lvl*10}
function overclock(){if(st==='play'&&ocT<=0&&ocM>=100){ocT=8;reload=0;ammo=MAG();sfx.oc();say('OVERCLOCK: MINIGUN ONLINE')}}
function startReload(){if(st==='play'&&ocT<=0&&reload<=0&&ammo<MAG()){reload=1.2;sfx.magOut()}}
function shoot(){if(st==='play'&&phase==='card'){cardT=Math.min(cardT,.01);return}if(st!=='play'||phase!=='fight'&&phase!=='move')return;
 if(mx<300&&my>H-76){startReload();return}
 if(reload>0)return;if(ammo<=0&&ocT<=0){sfx.empty();say('CHANGE MAGAZINE!');return}
 if(ocT>0){sfx.mini()}else{sfx.shoot();ammo--}shots++;shotN++;recoil=ocT>0?.5:1;flash=.05;fireCd=ocT>0?.03:.1;lastCore=false;bl.push({x1:MUZ[0],y1:MUZ[1],x2:mx,y2:my,p:0,T:.08+Math.hypot(mx-MUZ[0],my-MUZ[1])/9000,oc:ocT>0});
 var best=null,bd=1e9;en.forEach(function(e){if(e.dead||e.t<0)return;var p=proj(e),r=e.d.r*p.s,dx=mx-p.x,dy=my-p.y,dd=Math.sqrt(dx*dx+dy*dy);if(dd<r&&e.z<bd){bd=e.z;best={e:e,p:p,r:r,dd:dd}}});
 if(!best){sfx.miss();combo=0;bits(mx,my,'#8fb0cc',5,90);addFx('miss',mx,my,1,.09);return}
 var e=best.e,p=best.p,core=best.dd<best.r*(best.e.d.boss?.26:.32);hits++;sfx.hit(core);if(ocT<=0)ocM=Math.min(100,ocM+(core?2.5:1));
 if(e.k==='friend'){sfx.friend();e.dead=1;score=Math.max(0,score-300);combo=0;lose();pop(p.x,p.y-40,'FRIENDLY! -300','#ff8a80');bits(p.x,p.y,'#2fbf71',16);return}
 lastCore=core;addFx(core?'core':'hit',mx,my,1,.09);e.hp-=core?(e.d.boss?3:2):1;e.fl=.1;bits(mx,my,core?'#ffe08a':'#7ff',core?12:6,core?260:140);
 if(e.hp<=0){sfx.kill();if(ocT<=0)ocM=Math.min(100,ocM+(e.d.boss?35:8));addFx('boom',p.x,p.y,1+e.d.r*p.s/60,.1);e.dead=1;combo++;var mult=1+Math.min(4,Math.floor(combo/3)),pts=e.d.pts*(core&&!e.d.boss?3:1)*mult;score+=pts;pop(p.x,p.y-e.d.r*p.s,(core?'CRITICAL ':'')+'+'+pts,core?'#ffe08a':'#fff');bits(p.x,p.y,e.d.col,e.d.boss?80:26,e.d.boss?380:240);shake=Math.max(shake,e.d.boss?16:4)}
 else if(core)pop(p.x,p.y-30,'CRIT','#ffe08a')}
cv.addEventListener('pointermove',pos);cv.addEventListener('pointerdown',function(e){au();if(e.button===2)return;pos(e);if(st==='play'&&mx>W-150&&my<100){setMute(!MUTE);return}if(st==='play'&&mx>W-250&&my>H-78){overclock();return}down=true;if(cv.setPointerCapture)cv.setPointerCapture(e.pointerId);shoot()});cv.addEventListener('pointerup',function(){down=false});cv.addEventListener('pointercancel',function(){down=false});cv.addEventListener('contextmenu',function(e){e.preventDefault();startReload()});
var KD=function(e){if(e.code==='Escape'){e.preventDefault();closeGame();return}au();if(e.code==='KeyR')startReload();if(e.code==='KeyM')setMute(!MUTE);if(e.code==='Space'||e.code==='KeyE'){if(st==='play'){e.preventDefault();overclock()}}};document.addEventListener('keydown',KD);
function step(d){t+=d;scroll+=d*(phase==='move'?420:230);DIST=scroll/70;CUR=curveAt(DIST);if(st!=='play')return;
 if(ocT>0){ocT-=d;ocM=Math.max(0,ocT/8*100);if(ocT<=0){ocT=0;ocM=0;sfx.ocEnd()}}
 fireCd-=d;if(down&&fireCd<=0&&phase!=='card')shoot();recoil=Math.max(0,recoil-d*8);bl.forEach(function(q){q.p+=d/q.T});bl=bl.filter(function(q){return q.p<1.3});fx.forEach(function(q){if(q.dl>0)q.dl-=d;else q.l-=d});fx=fx.filter(function(q){return q.l>0});flash=Math.max(0,flash-d);dmg=Math.max(0,dmg-d);shake=Math.max(0,shake-d*30);msgT=Math.max(0,msgT-d);
 if(reload>0){reload-=d;if(reload<=0){ammo=MAG();sfx.magIn()}}
 if(phase==='card'){cardT-=d;if(cardT<=0){phase='move';pt=0}}
 else if(phase==='move'){pt+=d;if(pt>2.6)plan()}
 else{pt+=d;en.forEach(function(e){if(e.dead)return;e.t+=d;if(e.t<0)return;e.ph+=d*3;var thr=e.d.boss?.5:.32;
   if(e.z>thr)e.z-=e.sp*d*(e.d.boss?.6:1);
   else{if(e.d.boss&&e.d.minion){e.mc-=d;if(e.mc<=0){e.mc=e.d.mcd;add(e.d.minion,Math.max(-.95,Math.min(.95,e.x+(Math.random()*1.2-.6))),0,.8)}}
    if(e.d.atk<90){e.atk+=d;if(e.atk>=e.d.atk){var p=proj(e);lose();bits(p.x,p.y,'#ff5a4a',20,300);if(e.d.boss)e.atk=0;else e.dead=1}}}
   e.fl=Math.max(0,e.fl-d)});
  en=en.filter(function(e){return !e.dead});
  if(!en.some(function(e){return e.k!=='friend'})&&st==='play'){var acc=shots?Math.round(hits/shots*100):0;score+=acc*5;pop(VX,200,'Room clear. Accuracy '+acc+'% (+'+acc*5+')','#9dffcf');sfx.clear();ammo=MAG();reload=0;
   if(isBoss){score+=1000*(lvl+1);if(lvl>=LV.length-1){st='over';if(score>best){best=score;try{localStorage.setItem('pdRailBest',String(best))}catch(e){}}sfx.win();show('The bot farm is destroyed','GRAEMe got his payback. Score '+score+' \u00B7 Best '+best,'Play again')}else{sfx.level();lvl++;ammo=MAG();say('MAGAZINE UPGRADED: '+MAG()+' ROUNDS');rIn=0;card(['LEVEL '+lvl+' CLEAR','','LEVEL '+(lvl+1)+': '+LV[lvl].n,LV[lvl].intro],4.5)}}
   else{rIn++;phase='move';pt=0}}}
 parts.forEach(function(p){p.l-=d;p.x+=p.vx*d;p.y+=p.vy*d;p.vy+=500*d});parts=parts.filter(function(p){return p.l>0});pops.forEach(function(p){p.t+=d;p.y-=28*d});pops=pops.filter(function(p){return p.t<1.1})}
var WC=['#cfeaff','#ffe7a3','#8fdcff','#ffc2ef'],SKY=null,SKYL=-1,BC=null,BX=null,CUR=0,DIST=0,NEON=['#35e0ff','#ff4fd8','#7dffb0','#ffd24a','#6a8bff'];
var CF=420,CH=1.3,RW=1.85,ZMAX=40,ZS=[];(function(){for(var z=1.2;z<ZMAX*1.05;z*=1.13)ZS.push(z)})();
function hs(n){var v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)}
function xw(Z){var q=Math.min(Z,45);return CUR*q*q*.007}
function PR(x,y,Z){return[VX+CF*(x+xw(Z))/Z,VY+CF*(CH-y)/Z]}
var CP=44,CL=14,CK=-1,CWARN=0,CIN=0;
function cornerInfo(d){var q=d-20,k=Math.floor(q/CP),ph=q-k*CP;if(q<0)return{c:0,warn:0,u:-1,k:-1};var dir=hs(k*7+1)>.5?1:-1,u=ph/CL;if(u<=1)return{c:dir*3.4*Math.pow(Math.sin(Math.PI*u),2),warn:0,u:u,k:k,dir:dir};var nd=hs((k+1)*7+1)>.5?1:-1;return{c:0,warn:ph>CP-8?nd:0,u:-1,k:k}}
function curveAt(d){var ci=cornerInfo(d);CWARN=ci.warn;if(ci.u>=0){CIN=1;if(ci.k!==CK){CK=ci.k;sfx.screech()}return ci.c}CIN=0;return .9*Math.sin(d*.075)*Math.sin(d*.033+.8)}
function bg(){var RGB=LV[lvl].rgb,i,Z;var g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,LV[lvl].top);g.addColorStop(1,LV[lvl].bot);c.fillStyle=g;c.fillRect(0,0,W,H);
 var HG=c.createLinearGradient(0,VY-90,0,VY+30);HG.addColorStop(0,'rgba('+RGB+',0)');HG.addColorStop(.7,'rgba('+RGB+',.28)');HG.addColorStop(1,'rgba('+RGB+',.06)');c.fillStyle=HG;c.fillRect(0,VY-90,W,120);
 // far skyline, drifts against the turn for parallax
 if(SKYL!==lvl){SKYL=lvl;SKY=document.createElement('canvas');SKY.width=W;SKY.height=100;var k2=SKY.getContext('2d');for(i=0;i<46;i++){var bx=i*21-6,bh=18+hs(i+.5)*70,bw=14+hs(i+9)*16;k2.fillStyle='rgb(7,22,44)';k2.fillRect(bx,100-bh,bw,bh);for(var wy=0;wy<bh-6;wy+=7)for(var wx=0;wx<bw-6;wx+=6)if(hs(i*13+wy*3+wx)>.6){k2.fillStyle=hs(i+wy)>.8?'#ffe7a3':'#6fd0ff';k2.fillRect(bx+3+wx,100-bh+wy+3,2,2)}}}
 var so=((-CUR*70-DIST*1.5)%W+W)%W;c.drawImage(SKY,so-W,VY-98);c.drawImage(SKY,so,VY-98);
 // ground verge
 c.lineWidth=1.5;c.strokeStyle='rgba('+RGB+',.15)';
 for(var j=1;j<=9;j++)[-1,1].forEach(function(sd){c.beginPath();ZS.forEach(function(z,k){var a=PR(sd*(RW+j*1.3),0,z);k?c.lineTo(a[0],a[1]):c.moveTo(a[0],a[1])});c.stroke()});
 for(i=0;i<14;i++){Z=i*3-(DIST%3);if(Z<1.4)continue;var a=PR(-30,0,Z),b=PR(30,0,Z);c.globalAlpha=Math.max(0,.5-Z/90);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke()}c.globalAlpha=1;
 // cyber city, true world-space towers that approach as the vehicle drives
 var SP=6.2,DB=4.4,n0=Math.floor((DIST+.45-DB)/SP),n1=Math.ceil((DIST+ZMAX)/SP);
 for(var n=n1;n>=n0;n--)[-1,1].forEach(function(side){
  var zq=n*SP+DB/2-20,kq=Math.floor(zq/CP),phq=zq-kq*CP;if(zq>0&&phq>1&&phq<CL-1&&(hs(kq*7+1)>.5?1:-1)===side)return;var id=n*2+(side>0?1:0),r1=hs(id+3),r2=hs(id+17),r3=hs(id+41),Zf=n*SP-DIST,Zb=Zf+DB;if(Zb<.45||Zf>ZMAX)return;
  var wB=2.4+r1*3.2,hB=5+r2*17,xi=side*(RW+2.3),xo=side*(RW+2.3+wB),nc=NEON[Math.floor(r3*5)],fog=Math.max(0,Math.min(1,(Zf-9)/(ZMAX-12))),Zn=Math.max(Zf,.45);
  var rows=Math.max(4,Math.floor(hB/.8)),cols=Math.max(3,Math.floor(DB/.9));
  // road-facing side (a true receding wall)
  var p1=PR(xi,0,Zn),p2=PR(xi,hB,Zn),p3=PR(xi,hB,Zb),p4=PR(xi,0,Zb);
  var sg=c.createLinearGradient(0,p2[1],0,p1[1]);sg.addColorStop(0,'rgb(6,16,34)');sg.addColorStop(.7,'rgb(12,30,58)');sg.addColorStop(1,'rgb(18,50,86)');c.fillStyle=sg;c.beginPath();c.moveTo(p1[0],p1[1]);c.lineTo(p2[0],p2[1]);c.lineTo(p3[0],p3[1]);c.lineTo(p4[0],p4[1]);c.closePath();c.fill();
  if(Zf<24){for(var rr=0;rr<rows;rr++)for(var cc=0;cc<cols;cc++){var on=hs(id*53+rr*5+cc*11),za=Zf+(cc+.18)*DB/cols,zb=za+DB/cols*.62;if(za<Zn)continue;var ya=hB*(rr+.2)/rows,yb=ya+hB/rows*.5,q1=PR(xi,ya,za),q2=PR(xi,yb,za),q3=PR(xi,yb,zb),q4=PR(xi,ya,zb);c.fillStyle=on>.45?(on>.92?nc:WC[Math.floor(on*17)%4]):'rgb(7,17,34)';c.beginPath();c.moveTo(q1[0],q1[1]);c.lineTo(q2[0],q2[1]);c.lineTo(q3[0],q3[1]);c.lineTo(q4[0],q4[1]);c.closePath();c.fill()}}
  c.strokeStyle=nc;c.lineWidth=Math.max(1,CF*.05/Zn);c.beginPath();c.moveTo(p2[0],p2[1]);c.lineTo(p3[0],p3[1]);c.stroke();
  if(fog>0){c.fillStyle='rgba(10,38,66,'+fog+')';c.beginPath();c.moveTo(p1[0],p1[1]);c.lineTo(p2[0],p2[1]);c.lineTo(p3[0],p3[1]);c.lineTo(p4[0],p4[1]);c.closePath();c.fill()}
  // camera-facing front
  if(Zf>.45){var a1=PR(xi,0,Zf),a2=PR(xo,hB,Zf),fx0=Math.min(a1[0],a2[0]),fw=Math.abs(a2[0]-a1[0]),fy0=a2[1],fh=a1[1]-a2[1];
   var fg=c.createLinearGradient(0,fy0,0,fy0+fh);fg.addColorStop(0,'rgb(10,28,56)');fg.addColorStop(1,'rgb(16,44,78)');c.fillStyle=fg;c.fillRect(fx0,fy0,fw,fh);
   var fc=4+Math.floor(r1*4);if(Zf<24)for(rr=0;rr<rows;rr++)for(cc=0;cc<fc;cc++){var on2=hs(id*31+rr*7+cc*3);c.fillStyle=on2>.42?(on2>.9?nc:WC[Math.floor(on2*17)%4]):'rgb(7,17,34)';c.fillRect(fx0+fw*(.08+cc*.84/fc),fy0+fh*(.04+rr*.92/rows),fw*.84/fc*.62,fh*.92/rows*.5)}
   if(r2>.5){c.fillStyle=fg;c.fillRect(fx0+fw*.2,fy0-fh*.07,fw*.6,fh*.07)}else{c.fillStyle=nc;c.fillRect(fx0+fw*.48,fy0-fh*.14,Math.max(1,fw*.03),fh*.14)}
   c.fillStyle=nc;var ew=Math.max(1.5,fw*.04);c.fillRect(side<0?fx0+fw-ew:fx0,fy0,ew,fh);if(r3>.55)c.fillRect(side<0?fx0+fw*.08:fx0+fw*.82,fy0+fh*.2,Math.max(2,fw*.1),fh*.42);
   c.strokeStyle=nc;c.lineWidth=Math.max(1,fw*.012);c.strokeRect(fx0,fy0,fw,fh);
   if(fog>0){c.fillStyle='rgba(10,38,66,'+fog+')';c.fillRect(fx0,fy0-fh*.14,fw,fh*1.14)}}
 });
 // road surface
 var RG=c.createLinearGradient(0,VY,0,H);RG.addColorStop(0,'#0a2036');RG.addColorStop(1,'#050d18');c.fillStyle=RG;c.beginPath();
 ZS.slice().reverse().forEach(function(z,k){var a=PR(-RW,0,z);k?c.lineTo(a[0],a[1]):c.moveTo(a[0],a[1])});ZS.forEach(function(z){var a=PR(RW,0,z);c.lineTo(a[0],a[1])});c.closePath();c.fill();
 [[12,.18],[3,.95]].forEach(function(w2){c.lineWidth=w2[0];c.strokeStyle='rgba('+RGB+','+w2[1]+')';[-1,1].forEach(function(sd){c.beginPath();ZS.forEach(function(z,k){var a=PR(sd*RW,0,z);k?c.lineTo(a[0],a[1]):c.moveTo(a[0],a[1])});c.stroke()})});
 // lane dashes rushing toward the vehicle
 c.fillStyle='#eaf6ff';for(i=0;i<22;i++){Z=i*3.2-(DIST%3.2);if(Z<1.3||Z>ZMAX-4)continue;[-RW/3,RW/3].forEach(function(lx){var a=PR(lx-.05,0,Z),b=PR(lx+.05,0,Z),cc2=PR(lx+.05,0,Z+1.05),dd=PR(lx-.05,0,Z+1.05);c.globalAlpha=Math.max(0,1-Z/(ZMAX-4));c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(cc2[0],cc2[1]);c.lineTo(dd[0],dd[1]);c.closePath();c.fill()})}c.globalAlpha=1;
 // data packets streaming along the lanes
 var PK=['#35e0ff','#7dffb0','#ff5fd2','#fff3a6'];
 for(i=0;i<9;i++){Z=(((i*6.1-DIST*(1.6+(i%3)*.5))%34)+34)%34+1.4;var pq=PR([-.66,0,.66,-.33,.33][i%5]*RW,.06,Z),ps=CF*.07/Z;c.fillStyle=PK[i%4];c.globalAlpha=Math.min(1,(34-Z)/10)*.25;c.fillRect(pq[0]-ps*2.6,pq[1]-ps*1.2,ps*5.2,ps*2.4);c.globalAlpha=Math.min(1,(34-Z)/10);c.fillRect(pq[0]-ps*1.6,pq[1]-ps*.7,ps*3.2,ps*1.4)}c.globalAlpha=1;
 var fgb=c.createLinearGradient(0,VY-140,0,VY+90);fgb.addColorStop(0,'rgba(10,38,66,0)');fgb.addColorStop(.55,'rgba(10,38,66,.8)');fgb.addColorStop(.7,'rgba(10,38,66,.9)');fgb.addColorStop(1,'rgba(10,38,66,0)');c.fillStyle=fgb;c.fillRect(0,VY-140,W,230);
 var hz=c.createLinearGradient(0,VY-70,0,VY+110);hz.addColorStop(0,'rgba('+RGB+',0)');hz.addColorStop(.45,'rgba('+RGB+',.2)');hz.addColorStop(1,'rgba('+RGB+',0)');c.fillStyle=hz;c.fillRect(0,VY-70,W,180);
 c.font='700 14px Consolas,monospace';rain.forEach(function(r){r[1]+=r[2]*.016;if(r[1]>H)r[1]=0;c.fillStyle='rgba(125,255,176,.14)';c.fillText(r[3],r[0],r[1])});
 var vg=c.createRadialGradient(VX,VY,40,VX,VY,520);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');c.fillStyle=vg;c.fillRect(0,0,W,H)}
function enemy(e){var p=proj(e),s=p.s,r=e.d.r*s,x=p.x,y=p.y,bob=Math.sin(e.ph)*4*s;c.save();c.translate(x,y+bob);if(e.fl>0)c.globalAlpha=.65;
 var col=e.d.col,coff=e.k==='master'?r*.15:0;
 if(e.k==='worm'){for(var i=4;i>=0;i--){c.fillStyle=i?col:'#f06292';c.beginPath();c.arc(Math.sin(e.ph+i)*10*s,i*r*.4,r*(.5-.05*i),0,7);c.fill()}c.fillStyle='#fff';c.fillRect(-r*.25,-r*.1,r*.15,r*.15);c.fillRect(r*.12,-r*.1,r*.15,r*.15)}
 else if(e.k==='drone'){c.fillStyle=col;c.fillRect(-r,-r*.5,r*2,r);c.strokeStyle='#fff';c.lineWidth=2*s;c.beginPath();c.moveTo(-r,-r*.5);c.lineTo(0,r*.1);c.lineTo(r,-r*.5);c.stroke();c.fillStyle='#ffd0c8';c.fillRect(-r*1.4,-r*.7,r*.7,r*.12);c.fillRect(r*.7,-r*.7,r*.7,r*.12)}
 else if(e.k==='key'){c.fillStyle=col;c.fillRect(-r*.7,-r*.7,r*1.4,r*1.2);c.fillStyle='#e8d4f7';c.fillRect(-r*.5,-r*.5,r,r*.8);c.fillStyle='#1a0d2a';c.font='900 '+(r*.8)+'px Consolas';c.textAlign='center';c.fillText('K',0,r*.1);c.fillStyle=col;c.fillRect(-r*.6,r*.5,r*.15,r*.5);c.fillRect(r*.45,r*.5,r*.15,r*.5)}
 else if(e.k==='trojan'){c.fillStyle='#7a4b22';c.fillRect(-r*.8,-r*.3,r*1.6,r*.7);c.fillRect(r*.3,-r*.9,r*.5,r*.7);c.fillRect(r*.6,-r*1.0,r*.4,r*.35);c.fillRect(-r*.7,r*.4,r*.2,r*.55);c.fillRect(-r*.1,r*.4,r*.2,r*.55);c.fillRect(r*.5,r*.4,r*.2,r*.55);c.fillStyle='#d8a05a';c.fillRect(-r*.8,-r*.3,r*1.6,r*.1);c.fillStyle=col;c.fillRect(-r*.3,-r*.1,r*.6,r*.35)}
 else if(e.k==='env'){c.fillStyle=col;c.fillRect(-r,-r*.6,r*2,r*1.2);c.strokeStyle='#fff';c.lineWidth=2*s;c.beginPath();c.moveTo(-r,-r*.6);c.lineTo(0,r*.1);c.lineTo(r,-r*.6);c.stroke()}
 else if(e.k==='spam'){c.fillStyle='#b8321c';c.beginPath();c.moveTo(-r*.9,-r*.55);c.lineTo(-r*.7,-r*1.05);c.lineTo(-r*.35,-r*.6);c.moveTo(r*.9,-r*.55);c.lineTo(r*.7,-r*1.05);c.lineTo(r*.35,-r*.6);c.fill();c.fillStyle=col;c.fillRect(-r*1.1,-r*.65,r*2.2,r*1.3);c.strokeStyle='#fff';c.lineWidth=5*s;c.beginPath();c.moveTo(-r*1.1,-r*.65);c.lineTo(0,r*.15);c.lineTo(r*1.1,-r*.65);c.stroke();c.fillStyle='#ffe3dc';c.fillRect(-r*1.6,-r*.9,r*.5,r*.12);c.fillRect(r*1.1,-r*.9,r*.5,r*.12);c.fillStyle='#240a05';c.fillRect(-r*.45,r*.25,r*.9,r*.12)}
 else if(e.k==='keyking'){c.fillStyle='#f2d36b';c.beginPath();c.moveTo(-r*.7,-r*1.05);c.lineTo(-r*.5,-r*1.4);c.lineTo(-r*.2,-r*1.1);c.lineTo(0,-r*1.5);c.lineTo(r*.2,-r*1.1);c.lineTo(r*.5,-r*1.4);c.lineTo(r*.7,-r*1.05);c.fill();c.fillStyle=col;c.fillRect(-r*.95,-r*.95,r*1.9,r*1.7);c.fillStyle='#e9d4fa';c.fillRect(-r*.8,-r*.8,r*1.6,r*1.3);c.fillStyle='#1a0d2a';c.font='900 '+(r*.38)+'px Consolas';c.textAlign='center';c.fillText('ENTER',0,r*.55);c.fillStyle='#1a0d2a';c.fillRect(-r*.45,-r*.5,r*.2,r*.2);c.fillRect(r*.25,-r*.5,r*.2,r*.2)}
 else if(e.k==='titan'){c.fillStyle='#7a4b22';c.fillRect(-r*.9,-r*.3,r*1.8,r*.8);c.fillRect(r*.3,-r*1.0,r*.6,r*.8);c.fillRect(r*.7,-r*1.1,r*.5,r*.4);c.fillRect(-r*.8,r*.5,r*.25,r*.6);c.fillRect(-r*.15,r*.5,r*.25,r*.6);c.fillRect(r*.55,r*.5,r*.25,r*.6);c.fillStyle='#d8a05a';c.fillRect(-r*.9,-r*.3,r*1.8,r*.12);c.fillStyle='#ff4a3a';c.fillRect(r*.55,-r*.8,r*.14,r*.14);c.fillStyle=col;c.fillRect(-r*.3,-r*.05,r*.6,r*.4)}
 else if(e.k==='friend'){c.fillStyle='#e8fff1';c.beginPath();c.arc(0,0,r*.8,0,7);c.fill();c.strokeStyle=col;c.lineWidth=4*s;c.stroke();c.fillStyle=col;c.font='900 '+(r*.9)+'px system-ui';c.textAlign='center';c.fillText('RX',0,r*.3)}
 else{c.fillStyle=col;c.beginPath();c.arc(0,r*.15,r*.75,0,7);c.fill();c.strokeStyle='#7a1a14';c.lineWidth=r*.18;c.beginPath();c.arc(0,-r*.55,r*.55,Math.PI,0);c.stroke();c.fillStyle='#fff3';c.fillRect(-r*.55,-r*.15,r*1.1,r*.12)}
 // core
 if(e.k!=='friend'){var pu=.6+.4*Math.sin(t*8);c.fillStyle='rgba(255,224,138,'+pu+')';c.beginPath();c.arc(0,coff,r*.18,0,7);c.fill();c.strokeStyle='rgba(255,224,138,.8)';c.lineWidth=2;c.beginPath();c.arc(0,coff,r*.3,0,7);c.stroke()}
 c.restore();
 if(e.z<=(e.d.boss?.5:.32)&&e.d.atk<90){var q=e.atk/e.d.atk;c.strokeStyle='rgba(255,90,74,'+(.5+.5*Math.sin(t*14))+')';c.lineWidth=5;c.beginPath();c.arc(x,y+bob,r*1.15,-Math.PI/2,-Math.PI/2+q*6.283);c.stroke()}
 if(e.m>2&&e.k!=='friend'){c.fillStyle='rgba(0,0,0,.5)';c.fillRect(x-r,y-r*1.25,r*2,5);c.fillStyle=col;c.fillRect(x-r,y-r*1.25,r*2*Math.max(0,e.hp)/e.m,5)}}
var gYaw=0,gPit=0;
function gun(){
 var BK='#0c1320',WH='#f2f7fc',BL='#2f9bff',BD='#1b5fc4',GR='#1d2a3d',GL='#26364d',f=600;
 // hull, rim and mount ring
 c.save();c.lineJoin='round';
 c.beginPath();c.moveTo(0,H);c.lineTo(0,478);c.quadraticCurveTo(W/2,400,W,478);c.lineTo(W,H);c.closePath();c.fillStyle=BK;c.fill();
 c.beginPath();c.moveTo(0,478);c.quadraticCurveTo(W/2,400,W,478);c.lineWidth=7;c.strokeStyle=WH;c.stroke();
 c.beginPath();c.moveTo(0,490);c.quadraticCurveTo(W/2,412,W,490);c.lineWidth=3;c.strokeStyle=BL;c.stroke();
 c.fillStyle=GR;c.beginPath();c.ellipse(VX,446,150,32,0,0,7);c.fill();c.lineWidth=4;c.strokeStyle=WH;c.stroke();c.strokeStyle=BL;c.lineWidth=2;c.beginPath();c.ellipse(VX,446,136,26,0,0,7);c.stroke();
 c.restore();
 var dx=(mx-VX)/f,dy=(VY-my)/f,ty=Math.atan(dx),tp=Math.atan(dy*Math.cos(ty));
 ty=Math.max(-.3,Math.min(.3,ty*.5));tp=Math.max(-.1,Math.min(.2,tp*.45));
 gYaw+=(ty-gYaw)*.3;gPit+=(tp-gPit)*.3;
 var th=gPit+recoil*.035,ps=gYaw,ct=Math.cos(th),st=Math.sin(th),cp=Math.cos(ps),sp=Math.sin(ps),zb=2.15-recoil*.09,yb=-.5;
 function T(x,y,z){var y1=y*ct+z*st,z1=-y*st+z*ct,x2=x*cp+z1*sp,z2=-x*sp+z1*cp;return[x2,y1+yb,z2+zb]}
 function Pj(q){return[VX+f*q[0]/q[2],VY-f*q[1]/q[2]]}
 var boxes=[];
 function B(x0,x1,y0,y1,z0,z1,col){var cs=[];for(var a=0;a<8;a++)cs.push(T(a&1?x1:x0,a&2?y1:y0,a&4?z1:z0));var ctr=T((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);boxes.push({cs:cs,ctr:ctr,col:col})}
 // col: {t,b,l,r,k,f} top, bottom, left, right, back (toward camera), front
 function C(t,sd,k,ft){return{t:t,b:sd,l:sd,r:sd,k:k||sd,f:ft||sd}}
 function sh(col,m){var n=parseInt(col.slice(1),16),R=(n>>16)&255,G=(n>>8)&255,Bc=n&255;return'rgb('+Math.min(255,R*m|0)+','+Math.min(255,G*m|0)+','+Math.min(255,Bc*m|0)+')'}
 var SHD={t:1.12,k:.92,f:.85,l:.7,r:.8,b:.5};
 B(-.11,.11,-.3,-.1,-.1,.3,C(GR,BK));
 B(-.28,.28,-.17,-.08,-.32,.5,C(GL,BK,GL));B(-.2,.2,-.13,-.115,-.335,-.32,C(BL,BL));
 B(-.46,-.24,-.1,.1,.05,.45,C(GL,BK,BD,BK));B(-.52,-.5,0,0,0,0,C(BL,BL));
 B(-.465,-.45,-.04,.07,.08,.42,C(BL,BL));
 B(-.2,.2,-.08,.08,-.3,.6,C(WH,GR,BK,GR));
 B(-.045,.045,.08,.095,-.22,.52,C(BL,BL));
 B(-.18,.18,-.04,.06,-.345,-.3,C(GR,GR,GL));B(-.14,-.04,-.01,.03,-.352,-.345,C(BL,BL));B(.04,.14,-.01,.03,-.352,-.345,C(BL,BL));
 
 B(-.08,.08,.08,.14,-.2,-.1,C(GL,BK,BK));
   B(-.07,.07,.1,.115,.1,.6,C(BK,BK));for(q=0;q<9;q++)B(-.07,.07,.115,.13,.12+q*.055,.145+q*.055,C(WH,WH));
 B(-.075,.075,.115,.2,.0,.26,C(BK,GR,BK,BK));B(-.05,.05,.13,.19,.26,.275,C(BL,BL));B(-.02,.02,.2,.215,.02,.24,C(BL,BL));
 B(-.14,.14,-.02,.04,-.352,-.3,C(BL,BL));B(-.1,.1,.0,.03,-.36,-.352,C(WH,WH));
 B(-.24,-.2,-.0,.09,.12,.5,C(BD,BD,BD,BD));
 for(q=0;q<4;q++)B(-.092,.092,-.012,.172,.78+q*.3,.82+q*.3,C(WH,WH));
 B(-.08,.08,.0,.16,.6,2.1,C(GR,GR,GR,GR));
 for(var q=0;q<8;q++)B(-.045,.045,.16,.172,.7+q*.17,.78+q*.17,C(BL,BL));
 B(-.09,.09,-.01,.17,.6,.66,C(WH,WH));B(-.09,.09,-.01,.17,2.02,2.1,C(WH,WH));
 if(ocT>0){for(var bk=0;bk<3;bk++){var ba=t*26+bk*2.0944,bcx=Math.cos(ba)*.05,bcy=.08+Math.sin(ba)*.05;B(bcx-.022,bcx+.022,bcy-.022,bcy+.022,1.95,2.6,C(GR,BK));B(bcx-.024,bcx+.024,bcy-.024,bcy+.024,2.56,2.62,C('#ff9a3a','#ff9a3a'))}B(-.09,.09,-.012,.172,1.9,1.96,C(WH,WH));B(-.09,.09,-.012,.172,2.5,2.56,C(WH,WH))}else B(-.035,.035,.045,.115,2.1,2.6,C(BK,BK));
 B(-.055,.055,.025,.135,2.6,2.8,C(BK,BK));B(-.058,.058,.022,.138,2.77,2.82,C(BL,BL));
 B(-.012,.012,.115,.22,2.5,2.55,C(WH,WH));
 boxes.sort(function(a,b){return b.ctr[2]-a.ctr[2]});
 var F=[[0,1,3,2,'k'],[4,5,7,6,'f'],[0,2,6,4,'l'],[1,3,7,5,'r'],[2,3,7,6,'t'],[0,1,5,4,'b']];
 c.lineJoin='round';c.lineWidth=2;c.strokeStyle='rgba(6,10,18,.95)';
 boxes.forEach(function(bx){
  F.forEach(function(fc){var ps4=fc[0],pts=[fc[0],fc[1],fc[2],fc[3]].map(function(ii){return bx.cs[ii]});
   var fcx=0,fcy=0,fcz=0;pts.forEach(function(q){fcx+=q[0]/4;fcy+=q[1]/4;fcz+=q[2]/4});
   var ox=fcx-bx.ctr[0],oy=fcy-bx.ctr[1],oz=fcz-bx.ctr[2];
   if(ox*fcx+oy*fcy+oz*fcz>=0)return;
   var a0=Pj(pts[0]),a2=Pj(pts[2]),gr=c.createLinearGradient(a0[0],a0[1],a2[0],a2[1]),bc=bx.col[fc[4]],glow=(bc===BL||bc===WH);gr.addColorStop(0,glow?bc:sh(bc,SHD[fc[4]]*1.15));gr.addColorStop(1,glow?bc:sh(bc,SHD[fc[4]]*.85));c.fillStyle=gr;c.beginPath();pts.forEach(function(q,ii){var a=Pj(q);ii?c.lineTo(a[0],a[1]):c.moveTo(a[0],a[1])});c.closePath();c.fill();c.stroke();
   if(fc[4]==='t'){var e0=Pj(pts[0]),e1=Pj(pts[1]);c.save();c.strokeStyle='rgba(190,230,255,.75)';c.lineWidth=1.5;c.beginPath();c.moveTo(e0[0],e0[1]);c.lineTo(e1[0],e1[1]);c.stroke();c.restore();c.strokeStyle='rgba(6,10,18,.95)';c.lineWidth=2}})});
 MUZ=Pj(T(0,.08,2.84));
 if(flash>0){var ang=Math.atan2(my-MUZ[1],mx-MUZ[0]),fa=Math.min(1,flash/.05),fr=(ocT>0?9:13)*(.7+.3*fa);c.save();c.globalCompositeOperation='lighter';c.translate(MUZ[0],MUZ[1]);var fg=c.createRadialGradient(0,0,1,0,0,fr);fg.addColorStop(0,'rgba(255,250,230,'+fa+')');fg.addColorStop(.45,'rgba(255,190,90,'+fa*.55+')');fg.addColorStop(1,'rgba(255,120,30,0)');c.fillStyle=fg;c.beginPath();c.arc(0,0,fr,0,7);c.fill();c.rotate(ang);c.strokeStyle='rgba(255,225,160,'+fa*.8+')';c.lineWidth=1.6;for(var sp=-1;sp<=1;sp++){c.beginPath();c.moveTo(3,0);c.lineTo(fr*1.5,sp*fr*.35);c.stroke()}c.restore()}}
function glow(x,y,r,rgb,a){var g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+rgb+','+a+')');g.addColorStop(1,'rgba('+rgb+',0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,7);c.fill()}
function sparks(q,n,r0,r1,col,lw){c.strokeStyle=col;c.lineWidth=lw;for(var k=0;k<n;k++){var a=q.sd+k*6.283/n+Math.sin(k*3.1)*.3;c.beginPath();c.moveTo(q.x+Math.cos(a)*r0,q.y+Math.sin(a)*r0);c.lineTo(q.x+Math.cos(a)*r1,q.y+Math.sin(a)*r1);c.stroke()}}
function drawFx(){c.save();c.globalCompositeOperation='lighter';fx.forEach(function(q){if(q.dl>0)return;var u=1-q.l/q.m,a=1-u;
  if(q.k==='hit'){glow(q.x,q.y,8+16*u,'160,235,255',.8*a);sparks(q,6,3+10*u,8+24*u,'rgba(200,245,255,'+a+')',1.5)}
  else if(q.k==='core'){glow(q.x,q.y,14+34*u,'255,220,120',.9*a);c.strokeStyle='rgba(255,235,170,'+a+')';c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,6+30*u,0,7);c.stroke();sparks(q,10,4+12*u,10+34*u,'rgba(255,240,190,'+a+')',1.6)}
  else if(q.k==='miss'){glow(q.x,q.y,6+12*u,'150,185,215',.45*a);sparks(q,4,2+6*u,5+14*u,'rgba(170,200,225,'+a*.8+')',1.2)}
  else if(q.k==='boom'){var z=q.sc;glow(q.x,q.y,(22+80*u)*z,'255,170,70',.85*a);glow(q.x,q.y,(10+30*u)*z,'255,250,230',.9*a);c.strokeStyle='rgba(255,210,140,'+a+')';c.lineWidth=3*a+1;c.beginPath();c.arc(q.x,q.y,(10+70*u)*z,0,7);c.stroke();sparks(q,14,(8+20*u)*z,(16+80*u)*z,'rgba(255,215,150,'+a+')',1.8)}});c.restore();
 // bullets leaving the barrel as tracers
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';bl.forEach(function(q){var pp=Math.min(1,q.p),tp=Math.max(0,pp-.3),hx=q.x1+(q.x2-q.x1)*pp,hy=q.y1+(q.y2-q.y1)*pp,tx=q.x1+(q.x2-q.x1)*tp,ty=q.y1+(q.y2-q.y1)*tp,sc=1-pp*.6,al=q.p>1?Math.max(0,1-(q.p-1)/.3):1,col=q.oc?'255,170,60':'120,225,255';
  var g=c.createLinearGradient(tx,ty,hx,hy);g.addColorStop(0,'rgba('+col+',0)');g.addColorStop(1,'rgba('+col+','+.55*al+')');c.strokeStyle=g;c.lineWidth=6*sc;c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();
  g=c.createLinearGradient(tx,ty,hx,hy);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,'+al+')');c.strokeStyle=g;c.lineWidth=2*sc;c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();if(q.p<1)glow(hx,hy,7*sc,col,.8)});c.restore()}
function crosshair(){c.save();var k=1+recoil*.2,r=20*k;c.translate(mx,my);c.globalAlpha=reload>0&&ocT<=0?.5:1;c.lineCap='round';
 c.globalCompositeOperation='lighter';c.strokeStyle='rgba(60,200,255,.28)';c.lineWidth=7;for(var q=0;q<4;q++){c.beginPath();c.arc(0,0,r,q*1.5708+.35,q*1.5708+1.22);c.stroke()}c.globalCompositeOperation='source-over';
 c.strokeStyle=ocT>0?'#ffc266':'#e8f6ff';c.lineWidth=2.4;for(q=0;q<4;q++){c.beginPath();c.arc(0,0,r,q*1.5708+.35,q*1.5708+1.22);c.stroke()}
 c.fillStyle='#ff4a5a';c.beginPath();c.arc(0,0,2.2,0,7);c.fill();c.strokeStyle='rgba(232,246,255,.9)';c.lineWidth=1.6;[[r+5,r+12],[-r-5,-r-12]].forEach(function(a){c.beginPath();c.moveTo(a[0],0);c.lineTo(a[1],0);c.moveTo(0,a[0]);c.lineTo(0,a[1]);c.stroke()});
 if(reload>0&&ocT<=0){c.strokeStyle='#e8f6ff';c.lineWidth=3;c.beginPath();c.arc(0,0,r+18,-Math.PI/2,-Math.PI/2+(1-reload/1.2)*6.283);c.stroke()}c.restore()}
var BC=null,BX=null;function bloom(){if(!BC){BC=document.createElement('canvas');BC.width=192;BC.height=108;BX=BC.getContext('2d')}BX.globalCompositeOperation='source-over';BX.clearRect(0,0,192,108);BX.drawImage(cv,0,0,192,108);c.save();c.globalCompositeOperation='screen';c.globalAlpha=.3;c.imageSmoothingEnabled=true;c.drawImage(BC,0,0,W,H);c.restore()}
function draw(){c.save();c.translate(shake?(Math.random()-.5)*shake:0,(shake?(Math.random()-.5)*shake:0)+(st==='play'?Math.sin(t*31)*.9+Math.sin(t*9.3)*.7:0));bg();
 en.filter(function(e){return !e.dead&&e.t>=0}).sort(function(a,b){return b.z-a.z}).forEach(enemy);
 parts.forEach(function(p){c.globalAlpha=Math.min(1,p.l*3);c.fillStyle=p.col;c.fillRect(p.x,p.y,5,5)});c.globalAlpha=1;
 c.textAlign='center';c.font='800 20px system-ui';pops.forEach(function(p){c.globalAlpha=Math.max(0,1-p.t);c.fillStyle=p.col;c.fillText(p.s,p.x,p.y)});c.globalAlpha=1;
 if(st==='play')gun();
 
 c.restore();
 drawFx();bloom();
 // HUD
 c.textAlign='left';c.font='800 18px system-ui';c.fillStyle='#fff';c.fillText('SCORE '+score,18,30);c.fillStyle='#9fb6c9';c.font='700 14px system-ui';c.fillText('BEST '+best+'   LEVEL '+(lvl+1),18,50);
 c.textAlign='right';for(var i=0;i<3;i++){c.fillStyle=i<lives?'#26c6d8':'rgba(255,255,255,.15)';c.beginPath();c.moveTo(W-24-i*34,16);c.lineTo(W-42-i*34,22);c.lineTo(W-42-i*34,36);c.quadraticCurveTo(W-33-i*34,48,W-24-i*34,52);c.quadraticCurveTo(W-15-i*34,48,W-6-i*34,36);c.lineTo(W-6-i*34,22);c.closePath();c.fill()}
 c.fillStyle='#9fb6c9';c.font='700 12px system-ui';c.fillText('FIREWALL',W-14,70);

 (function(){var X=18,Y=H-66,Pw=270,Ph=50,empty=ammo<=0&&reload<=0,col=empty?'#ff5a4a':'#2fd0e8';c.save();c.fillStyle=empty?'rgba(60,10,14,.88)':'rgba(8,24,40,.88)';c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(X+10,Y);c.lineTo(X+Pw,Y);c.lineTo(X+Pw,Y+Ph-10);c.lineTo(X+Pw-10,Y+Ph);c.lineTo(X,Y+Ph);c.lineTo(X,Y+10);c.closePath();c.fill();c.stroke();
  (function(){var gx=X+8,gy=Y+7,sc=.98,l=empty?'#ff7a6a':'#7fe3ff',dk=empty?'rgba(120,20,24,.85)':'rgba(10,40,70,.9)',hi=empty?'#ffb0a4':'#eaf9ff';
  c.save();c.translate(gx,gy);c.scale(sc,sc);c.lineJoin='round';c.lineCap='round';c.lineWidth=1.8;c.strokeStyle=l;c.fillStyle=dk;
  function RC(x,y,w,h){c.beginPath();c.rect(x,y,w,h);c.fill();c.stroke()}
  c.beginPath();c.moveTo(60,24);c.lineTo(52,38);c.moveTo(66,24);c.lineTo(66,38);c.moveTo(72,24);c.lineTo(82,38);c.stroke();
  RC(0,12,7,8);c.beginPath();c.moveTo(7,16);c.lineTo(26,16);c.lineWidth=3;c.stroke();c.lineWidth=1.8;
  RC(24,11,36,10);c.fillStyle=l;for(var q=0;q<6;q++)c.fillRect(28+q*5.4,13.5,2.6,5);c.fillStyle=dk;
  RC(58,8,30,16);c.fillStyle=hi;c.fillRect(62,11,18,2.2);c.fillStyle=dk;
  c.beginPath();c.moveTo(63,8);c.lineTo(65,3);c.lineTo(80,3);c.lineTo(82,8);c.stroke();
  RC(60,25,16,10);c.beginPath();c.moveTo(60,29);c.lineTo(52,26);c.lineTo(52,22);c.stroke();
  RC(88,9,4,13);c.beginPath();c.moveTo(92,11);c.lineTo(98,9);c.moveTo(92,20);c.lineTo(98,22);c.stroke();
  c.restore()})();
  c.textAlign='left';c.fillStyle=empty?'#ff7a6a':'#eaf9ff';
  if(reload>0){var pr=1-reload/1.2;c.strokeStyle='#2fd0e8';c.lineWidth=4;c.beginPath();c.arc(X+120,Y+25,13,-Math.PI/2+t*6,-Math.PI/2+t*6+4.6);c.stroke();c.font='800 14px system-ui';c.fillText('CHANGE MAGAZINE',X+144,Y+30);c.fillStyle='rgba(255,255,255,.2)';c.fillRect(X+144,Y+36,110,4);c.fillStyle='#2fd0e8';c.fillRect(X+144,Y+36,110*pr,4)}
  else{c.font='800 26px system-ui';c.fillText(ammo,X+110,Y+34);var nw=c.measureText(String(ammo)).width;c.font='700 15px system-ui';c.fillStyle=empty?'#ff9a8c':'#8fc9dc';c.fillText('/ '+MAG(),X+116+nw,Y+34);c.font='700 11px system-ui';c.textAlign='right';c.fillText('R: CHANGE MAG',X+Pw-12,Y+16)}
  c.restore()})();
 (function(){var X=W-232,Y=H-66,Pw=214,Ph=50,rdy=ocM>=100&&ocT<=0,act=ocT>0,col=act?'#ffb347':rdy?'#ffd24a':'#2fd0e8',pl=rdy?.6+.4*Math.sin(t*9):1;c.save();c.globalAlpha=pl;c.fillStyle=act?'rgba(70,32,6,.9)':'rgba(8,24,40,.88)';c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(X,Y);c.lineTo(X+Pw-10,Y);c.lineTo(X+Pw,Y+10);c.lineTo(X+Pw,Y+Ph);c.lineTo(X+10,Y+Ph);c.lineTo(X,Y+Ph-10);c.closePath();c.fill();c.stroke();c.textAlign='left';c.fillStyle=col;c.font='800 13px system-ui';c.fillText(act?'MINIGUN  '+ocT.toFixed(1)+'s':rdy?'OVERCLOCK READY':'OVERCLOCK',X+14,Y+21);c.fillStyle='rgba(255,255,255,.18)';c.fillRect(X+14,Y+29,Pw-28,7);c.fillStyle=col;c.fillRect(X+14,Y+29,(Pw-28)*Math.min(1,ocM/100),7);c.font='700 10px system-ui';c.fillStyle='#8fc9dc';c.fillText(rdy?'SPACE / TAP TO ACTIVATE':act?'NO RELOAD · RAPID FIRE':'FILL BY DESTROYING VIRUSES',X+14,Y+46);c.restore();if(act){var og=c.createRadialGradient(VX,VY,200,VX,VY,560);og.addColorStop(0,'rgba(255,150,40,0)');og.addColorStop(1,'rgba(255,140,30,'+(.18+.06*Math.sin(t*30))+')');c.fillStyle=og;c.fillRect(0,0,W,H)}})();
 if(st==='play'&&(CWARN||CIN)){var cd2=CWARN||(CUR>0?1:-1),pl2=.55+.45*Math.sin(t*10);c.save();c.globalAlpha=CIN?.9:pl2;c.translate(VX,78);c.fillStyle=CIN?'#ffd24a':'#35e0ff';c.strokeStyle='#04101e';c.lineWidth=3;c.lineJoin='round';for(var ar=0;ar<3;ar++){c.beginPath();var ox=cd2*(ar*20-20);c.moveTo(ox+cd2*14,0);c.lineTo(ox-cd2*8,-16);c.lineTo(ox-cd2*8+cd2*(-0),16);c.closePath();c.globalAlpha=(CIN?.9:pl2)*(.4+.3*ar);c.fill();c.stroke()}c.globalAlpha=CIN?.95:pl2;c.fillStyle='#eaf9ff';c.font='800 15px system-ui';c.textAlign='center';c.fillText(CIN?(cd2<0?'TURNING LEFT':'TURNING RIGHT'):(cd2<0?'LEFT TURN AHEAD':'RIGHT TURN AHEAD'),0,38);c.restore()}
 c.save();c.textAlign='right';c.font='700 11px system-ui';c.fillStyle=MUTE?'#ff9a8c':'#8fc9dc';c.fillText(MUTE?'SOUND OFF (M)':'SOUND ON (M)',W-18,92);c.restore();
 if(combo>=2){c.textAlign='right';c.fillStyle='#ffe08a';c.font='900 26px system-ui';c.fillText('COMBO x'+(1+Math.min(4,Math.floor(combo/3))),W-18,H-24)}
 if(ammo<=0&&reload<=0&&st==='play'){c.textAlign='center';c.fillStyle='rgba(255,90,74,'+(.5+.5*Math.sin(t*14))+')';c.font='900 42px system-ui';c.fillText('CHANGE MAGAZINE!',VX,H-90)}
 if(msgT>0){c.textAlign='center';c.globalAlpha=Math.min(1,msgT);c.fillStyle='#26c6d8';c.font='900 46px system-ui';c.fillText(msg,VX,170);c.globalAlpha=1}
 if(phase==='move'&&st==='play'){c.textAlign='center';c.fillStyle='rgba(255,255,255,.7)';c.font='700 16px system-ui';c.fillText('Moving to the next room…',VX,H-24)}
 var bo=en.filter(function(e){return e.d.boss&&!e.dead&&e.t>=0})[0];if(bo){c.textAlign='center';c.fillStyle='#fff';c.font='800 16px system-ui';c.fillText(bo.d.name,VX,32);c.fillStyle='rgba(255,255,255,.2)';c.fillRect(VX-200,40,400,12);c.fillStyle='#ff5a4a';c.fillRect(VX-200,40,400*Math.max(0,bo.hp)/bo.m,12)}
 if(phase==='card'&&st==='play'){c.fillStyle='rgba(2,6,12,.82)';c.fillRect(0,0,W,H);c.textAlign='center';cardL.forEach(function(l,i){var big=/^LEVEL/.test(l);c.fillStyle=big?'rgb('+LV[lvl].rgb+')':'#e6f2fb';c.font=(big?'900 34px':'600 20px')+' system-ui';c.fillText(l,VX,170+i*44)});c.fillStyle='#8fb0cc';c.font='600 14px system-ui';c.fillText('Click to continue',VX,H-30)}
 if(dmg>0){c.fillStyle='rgba(255,40,40,'+dmg*.5+')';c.fillRect(0,0,W,H)}
 if(st==='play')crosshair()}
var last=0;function loop(ts){var d=Math.min(.05,(ts-last)/1000||.016);last=ts;step(d);draw();if(!closed)raf=requestAnimationFrame(loop)}raf=requestAnimationFrame(loop);
function closeGame(){if(closed)return;closed=true;cancelAnimationFrame(raf);document.removeEventListener('keydown',KD);try{humOn(false)}catch(e){}try{if(AC)AC.close()}catch(e){}onClose()}
var bS=document.getElementById('pbSound');bS.setAttribute('aria-pressed',String(!MUTE));
bS.onclick=function(){au();setMute(!MUTE);bS.setAttribute('aria-pressed',String(!MUTE))};
document.getElementById('pbExit').onclick=closeGame;
var goB=document.getElementById('pbGo');if(goB)goB.focus();

}
window.PortalPayback={open:open};
})();
