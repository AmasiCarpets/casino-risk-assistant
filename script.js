const c=document.getElementById('game'),ctx=c.getContext('2d'),W=c.width,H=c.height,$=i=>document.getElementById(i);
let data={coins:+localStorage.getItem('r8_coins')||2500,xp:+localStorage.getItem('r8_xp')||0,wins:+localStorage.getItem('r8_wins')||0,losses:+localStorage.getItem('r8_losses')||0,best:+localStorage.getItem('r8_best')||0,streak:+localStorage.getItem('r8_streak')||0,cue:localStorage.getItem('r8_cue')||'classic',reward:localStorage.getItem('r8_reward')||''};
let stake=100,diff='medium',mode='ai',balls=[],turn=1,active=false,moving=false,drag=false,start=null,now=null,sound=true,spin={x:0,y:0},groups={1:null,2:null},pocketedThisTurn=[],foul=false;
const table={l:46,r:W-46,t:46,b:H-46};
const pockets=[[46,46],[W/2,34],[W-46,46],[46,H-46],[W/2,H-34],[W-46,H-46]];
const SUB=7,REST=.965,FR=.995;
const POCKET_RADIUS=40,POCKET_CAPTURE=50;
const colors=['#f4d03f','#2980b9','#c0392b','#8e44ad','#e67e22','#27ae60','#7f1d1d','#111','#f4d03f','#2980b9','#c0392b','#8e44ad','#e67e22','#27ae60','#7f1d1d'];
const cues=[{id:'classic',name:'Classic',price:0,color:'linear-gradient(90deg,#7b4a20,#e2b66d)'},{id:'ice',name:'Ice',price:800,color:'linear-gradient(90deg,#dff7ff,#55b6d9)'},{id:'royal',name:'Royal',price:1800,color:'linear-gradient(90deg,#4c2a85,#f4ca62)'}];

function save(){Object.entries(data).forEach(([k,v])=>localStorage.setItem('r8_'+k,v))}
function level(){return Math.floor(data.xp/100)+1}
function ui(){$('coins').textContent=data.coins;$('level').textContent=level();$('xp').textContent=(data.xp%100)+' / 100 XP';$('wins').textContent=data.wins;$('losses').textContent=data.losses;$('best').textContent=data.best;$('matches').textContent=data.wins+data.losses}
function screen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active')}
document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>{stake=+b.dataset.stake;document.querySelectorAll('[data-stake]').forEach(v=>v.classList.remove('active'));b.classList.add('active')});
document.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{diff=b.dataset.diff;document.querySelectorAll('[data-diff]').forEach(v=>v.classList.remove('active'));b.classList.add('active')});
document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>{mode=b.dataset.start;startMatch()});
document.querySelectorAll('.back').forEach(b=>b.onclick=()=>screen('home'));
$('shopBtn').onclick=()=>{renderShop();screen('shop')};$('statsBtn').onclick=()=>{ui();screen('stats')};
$('rewardBtn').onclick=()=>{const d=new Date().toISOString().slice(0,10);if(data.reward===d)alert('استلمت مكافأة اليوم بالفعل.');else{data.reward=d;data.coins+=250;save();ui();alert('حصلت على 250 عملة افتراضية!')}};
$('quitBtn').onclick=()=>{active=false;exitFullscreen();screen('home')};
$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=sound?'🔊':'🔇'};
$('spinBtn').onclick=()=>$('spinModal').classList.add('open');$('spinDone').onclick=()=>$('spinModal').classList.remove('open');
$('fullscreenBtn').onclick=toggleFullscreen;

function toggleFullscreen(){
 const shell=$('gameShell');
 shell.classList.toggle('fullscreen');
 document.body.style.overflow=shell.classList.contains('fullscreen')?'hidden':'';
 setTimeout(()=>window.scrollTo(0,0),50);
}
function exitFullscreen(){
 $('gameShell').classList.remove('fullscreen');
 document.body.style.overflow='';
}
$('spinPad').onpointerdown=e=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width/2))),y=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/(r.height/2)));spin={x,y};$('spinDot').style.left=(79+x*70)+'px';$('spinDot').style.top=(79+y*70)+'px'};

function renderShop(){const el=$('cueShop');el.innerHTML='';cues.forEach(q=>{const d=document.createElement('div');d.className='cue-item';d.innerHTML=`<b>${q.name}</b><div class="cue-stick" style="background:${q.color}"></div><button>${data.cue===q.id?'مستخدم':q.price?('شراء '+q.price):'استخدام'}</button>`;d.querySelector('button').onclick=()=>{if(data.cue===q.id)return;if(q.price&&data.coins<q.price)return alert('العملات غير كافية');if(q.price)data.coins-=q.price;data.cue=q.id;save();ui();renderShop()};el.appendChild(d)})}
function tone(f=440,d=.05){if(!sound)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const a=new A(),o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=.035;o.connect(g);g.connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.stop(a.currentTime+d)}
function B(x,y,r,n,cue=false){return{x,y,vx:0,vy:0,r,n,cue,p:false,striped:n>8}}
function rack(){balls=[B(265,H/2,18,0,true)];let nums=[1,9,2,10,8,3,11,4,12,5,13,6,14,7,15],k=0;for(let row=0;row<5;row++)for(let col=0;col<=row;col++){let n=nums[k++];balls.push(B(845+row*35,H/2-row*20+col*40,17,n))}}
function startMatch(){if(data.coins<stake)return alert('العملات الافتراضية غير كافية');data.coins-=stake;save();turn=1;active=true;moving=false;groups={1:null,2:null};pocketedThisTurn=[];rack();$('p1Name').textContent=mode==='local'?'اللاعب 1':'أنت';$('p2Name').textContent=mode==='local'?'اللاعب 2':'النظام';updateTurn();screen('gameScreen')}
function updateTurn(){$('turnText').textContent=turn===1?(mode==='local'?'اللاعب 1':'أنت'):(mode==='local'?'اللاعب 2':'النظام');$('p1Type').textContent=groups[1]||'—';$('p2Type').textContent=groups[2]||'—';renderBallStatus()}
function renderBallStatus(){for(let p=1;p<=2;p++){let el=$(p===1?'p1Balls':'p2Balls');el.innerHTML='';balls.filter(b=>!b.cue&&!b.p&&b.n!==8&&(groups[p]?(groups[p]==='مصمت'?b.n<8:b.n>8):true)).slice(0,7).forEach(b=>{let s=document.createElement('i');s.className='ball-mini';s.style.background=colors[b.n-1];el.appendChild(s)})}}

function draw(){
 ctx.clearRect(0,0,W,H);
 let g=ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,760);g.addColorStop(0,'#11895c');g.addColorStop(1,'#07563b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#d6ab64';ctx.lineWidth=10;ctx.strokeRect(18,18,W-36,H-36);
 pockets.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],POCKET_RADIUS,0,Math.PI*2);ctx.fillStyle='#050e11';ctx.fill()});
 balls.forEach(b=>{if(b.p)return;ctx.save();ctx.shadowColor='#0008';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fillStyle=b.cue?'#fff':colors[b.n-1];ctx.fill();ctx.restore();if(b.striped){ctx.strokeStyle='#fff';ctx.lineWidth=7;ctx.stroke()}if(!b.cue){ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.fillStyle='#111';ctx.font='9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.n,b.x,b.y)}});
 if(drag&&now){
  let q=balls.find(b=>b.cue&&!b.p),dx=q.x-now.x,dy=q.y-now.y,l=Math.hypot(dx,dy)||1,nx=dx/l,ny=dy/l;
  ctx.setLineDash([12,9]);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+nx*620,q.y+ny*620);ctx.strokeStyle='#ffffffcc';ctx.lineWidth=4;ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(q.x-now.x+q.x,q.y-now.y+q.y);ctx.lineTo(now.x,now.y);ctx.strokeStyle='#ffffff55';ctx.lineWidth=8;ctx.stroke();
  $('powerFill').style.width=Math.min(100,l/2)+'%';
 }else $('powerFill').style.width='0';
}

function attractToPocket(b){
 let nearest=null,nd=Infinity;
 for(const p of pockets){
  const d=Math.hypot(b.x-p[0],b.y-p[1]);
  if(d<nd){nd=d;nearest=p}
 }
 if(nd<POCKET_CAPTURE && nearest){
  const strength=(POCKET_CAPTURE-nd)/POCKET_CAPTURE;
  b.vx+=(nearest[0]-b.x)*0.0025*strength;
  b.vy+=(nearest[1]-b.y)*0.0025*strength;
 }
}

function step(){
 for(let s=0;s<SUB;s++){
  balls.forEach(b=>{
   if(b.p)return;
   b.x+=b.vx/SUB;b.y+=b.vy/SUB;
   b.vx*=Math.pow(FR,1/SUB);b.vy*=Math.pow(FR,1/SUB);
   attractToPocket(b);
   if(Math.abs(b.vx)<.02)b.vx=0;if(Math.abs(b.vy)<.02)b.vy=0;
   if(b.x-b.r<table.l){b.x=table.l+b.r;b.vx=Math.abs(b.vx)*REST}
   if(b.x+b.r>table.r){b.x=table.r-b.r;b.vx=-Math.abs(b.vx)*REST}
   if(b.y-b.r<table.t){b.y=table.t+b.r;b.vy=Math.abs(b.vy)*REST}
   if(b.y+b.r>table.b){b.y=table.b-b.r;b.vy=-Math.abs(b.vy)*REST}
  });

  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
   let a=balls[i],b=balls[j];if(a.p||b.p)continue;
   let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),m=a.r+b.r;
   if(d<m){
    if(d<.001){dx=.001;d=.001}
    let nx=dx/d,ny=dy/d,o=m-d,corr=o*.55;
    a.x-=nx*corr;a.y-=ny*corr;b.x+=nx*corr;b.y+=ny*corr;
    let rvx=b.vx-a.vx,rvy=b.vy-a.vy,v=rvx*nx+rvy*ny;
    if(v<0){
     let imp=-(1+REST)*v/2;
     a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;
    }
   }
  }

  balls.forEach(b=>{
   if(b.p)return;
   for(let p of pockets){
    if(Math.hypot(b.x-p[0],b.y-p[1])<POCKET_RADIUS-4){
     b.p=true;b.vx=b.vy=0;tone(720,.08);
     if(b.cue){foul=true;setTimeout(()=>{b.p=false;b.x=265;b.y=H/2;b.vx=b.vy=0},450)}
     else pocketedThisTurn.push(b);
     break;
    }
   }
  });
 }

 if(moving&&!balls.some(b=>!b.p&&Math.hypot(b.vx,b.vy)>.05)){
  balls.forEach(b=>b.vx=b.vy=0);moving=false;resolveTurn();
 }
}

function resolveTurn(){
 let eight=pocketedThisTurn.find(b=>b.n===8);
 if(!groups[turn]){
  let first=pocketedThisTurn.find(b=>b.n!==8);
  if(first){groups[turn]=first.n<8?'مصمت':'مخطط';groups[turn===1?2:1]=first.n<8?'مخطط':'مصمت'}
 }
 if(eight){
  let remain=balls.some(b=>!b.p&&!b.cue&&b.n!==8&&(groups[turn]==='مصمت'?b.n<8:b.n>8));
  finish(!remain);return;
 }
 let own=pocketedThisTurn.some(b=>b.n!==8&&(!groups[turn]||(groups[turn]==='مصمت'?b.n<8:b.n>8)));
 if(foul||!own)turn=turn===1?2:1;
 pocketedThisTurn=[];foul=false;updateTurn();
 if(mode==='ai'&&turn===2)setTimeout(aiShot,650);
}
function finish(win){active=false;data.wins+=win?1:0;data.losses+=win?0:1;if(win){data.coins+=stake*2;data.xp+=60;data.streak++;data.best=Math.max(data.best,data.streak);alert('فزت بالمباراة!')}else{data.streak=0;alert('خسرت المباراة.')}save();ui();exitFullscreen();screen('home')}
function aiShot(){let q=balls.find(b=>b.cue&&!b.p),ts=balls.filter(b=>!b.cue&&!b.p&&b.n!==8&&(!groups[2]||(groups[2]==='مصمت'?b.n<8:b.n>8)));if(!ts.length)ts=balls.filter(b=>b.n===8&&!b.p);let t=ts[0],err=diff==='easy'?.3:diff==='medium'?.13:.045,a=Math.atan2(t.y-q.y,t.x-q.x)+(Math.random()-.5)*err,p=12+Math.random()*4;q.vx=Math.cos(a)*p;q.vy=Math.sin(a)*p;moving=true}
function pos(e){let r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}

c.onpointerdown=e=>{
 if(!active||moving||(mode==='ai'&&turn===2))return;
 let q=balls.find(b=>b.cue&&!b.p),p=pos(e);
 // التحكم الآن من أي مكان على الطاولة
 drag=true;start={x:q.x,y:q.y};now=p;c.setPointerCapture(e.pointerId);
}
c.onpointermove=e=>{if(drag)now=pos(e)}
c.onpointerup=e=>{
 if(!drag)return;drag=false;
 let q=balls.find(b=>b.cue&&!b.p),p=pos(e),dx=start.x-p.x,dy=start.y-p.y,l=Math.hypot(dx,dy);
 if(l<18){$('message').textContent='اسحب مسافة أكبر قليلًا.';return}
 let power=Math.min(21,l/10.5);
 q.vx=dx/l*power+spin.x*.45;q.vy=dy/l*power+spin.y*.45;
 moving=true;pocketedThisTurn=[];foul=false;$('message').textContent='الكرات تتحرك...';
}

function loop(){step();draw();requestAnimationFrame(loop)}
rack();ui();loop();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
