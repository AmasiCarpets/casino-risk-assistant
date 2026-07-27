const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,$=i=>document.getElementById(i);
const STORAGE='bd4_';
let balance=+localStorage.getItem(STORAGE+'balance')||1000,xp=+localStorage.getItem(STORAGE+'xp')||0,wins=+localStorage.getItem(STORAGE+'wins')||0,losses=+localStorage.getItem(STORAGE+'losses')||0,streak=+localStorage.getItem(STORAGE+'streak')||0,best=+localStorage.getItem(STORAGE+'best')||0;
let bet=25,difficulty='medium',mode='ai',playerScore=0,aiScore=0,turn='player',roundActive=false,simulating=false,dragging=false,dragStart=null,dragNow=null,soundOn=true,aimOn=true,balls=[];
const TABLE={left:34,right:W-34,top:34,bottom:H-34};
const pockets=[{x:34,y:34},{x:W/2,y:26},{x:W-34,y:34},{x:34,y:H-34},{x:W/2,y:H-26},{x:W-34,y:H-34}];
const SUBSTEPS=4,REST=0.96,FRICTION=0.9945,STOP=0.025;

function save(){[['balance',balance],['xp',xp],['wins',wins],['losses',losses],['streak',streak],['best',best]].forEach(([k,v])=>localStorage.setItem(STORAGE+k,v))}
function rank(){return xp>=3000?'Master':xp>=1500?'Diamond':xp>=700?'Gold':xp>=250?'Silver':'Bronze'}
function ui(){$('balance').textContent=Math.floor(balance);$('playerScore').textContent=playerScore;$('aiScore').textContent=aiScore;$('turn').textContent=turn==='player'?(mode==='local'?'اللاعب 1':'أنت'):(mode==='local'?'اللاعب 2':'النظام');$('wins').textContent=wins;$('losses').textContent=losses;$('bestStreak').textContent=best;$('xpStat').textContent=xp;$('rank').textContent=rank();$('xpText').textContent=xp+' XP';$('leftName').textContent=mode==='local'?'اللاعب 1':'أنت';$('rightName').textContent=mode==='local'?'اللاعب 2':'النظام'}
function tone(f=440,d=.05){if(!soundOn)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const a=new A(),o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=.035;o.connect(g);g.connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.stop(a.currentTime+d)}
function Ball(x,y,r,color,id,isCue=false){return{x,y,px:x,py:y,vx:0,vy:0,r,color,id,isCue,pocketed:false}}
function rack(){balls=[Ball(250,H/2,17,'#fff','cue',true)];const colors=['#ffd43b','#4dabf7','#ff6b6b','#a855f7','#ff922b','#20c997','#f06595'];let id=1;for(let row=0;row<4;row++)for(let col=0;col<=row&&id<=7;col++,id++)balls.push(Ball(830+row*34,H/2-row*19+col*38,16,colors[id-1],id))}
document.querySelectorAll('[data-bet]').forEach(b=>b.onclick=()=>{if(roundActive)return;bet=+b.dataset.bet;document.querySelectorAll('[data-bet]').forEach(v=>v.classList.remove('active'));b.classList.add('active')});
document.querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>{if(roundActive)return;difficulty=b.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(v=>v.classList.remove('active'));b.classList.add('active')});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(roundActive)return;mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(v=>v.classList.remove('active'));b.classList.add('active');ui()});
$('soundBtn').onclick=()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'🔊':'🔇'};$('aimBtn').onclick=()=>{aimOn=!aimOn;$('aimBtn').textContent=aimOn?'🎯':'🚫'};
$('newGame').onclick=()=>{if(roundActive||simulating)return;if(balance<bet){$('message').textContent='الرصيد الافتراضي غير كافٍ.';return}balance-=bet;playerScore=aiScore=0;turn='player';roundActive=true;rack();save();ui();$('message').textContent='اسحب من الكرة البيضاء بعكس اتجاه الضربة.';tone(520)};

function draw(){
 ctx.clearRect(0,0,W,H);
 const g=ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,760);g.addColorStop(0,'#11895c');g.addColorStop(1,'#07563b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#d6ab64';ctx.lineWidth=9;ctx.strokeRect(15,15,W-30,H-30);
 pockets.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,30,0,Math.PI*2);ctx.fillStyle='#050e11';ctx.fill()});
 balls.forEach(b=>{if(b.pocketed)return;ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=9;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fillStyle=b.color;ctx.fill();ctx.restore();ctx.strokeStyle='#0004';ctx.lineWidth=2;ctx.stroke();if(!b.isCue){ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.fillStyle='#111';ctx.font='9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.id,b.x,b.y)}});
 if(dragging&&dragStart&&dragNow){const cue=balls.find(b=>b.isCue&&!b.pocketed);if(cue){let dx=cue.x-dragNow.x,dy=cue.y-dragNow.y,l=Math.hypot(dx,dy)||1,nx=dx/l,ny=dy/l;if(aimOn){ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(cue.x+nx*540,cue.y+ny*540);ctx.strokeStyle='#ffffffaa';ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([])}$('powerFill').style.width=Math.min(100,l/2)+'%'}}else $('powerFill').style.width='0';
}

function integrate(dt){
 for(const b of balls){
  if(b.pocketed)continue;
  b.px=b.x;b.py=b.y;
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  const f=Math.pow(FRICTION,dt);
  b.vx*=f;b.vy*=f;
  if(Math.abs(b.vx)<STOP)b.vx=0;
  if(Math.abs(b.vy)<STOP)b.vy=0;
 }
}

function wallCollision(b){
 if(b.pocketed)return;
 if(b.x-b.r<TABLE.left){b.x=TABLE.left+b.r;b.vx=Math.abs(b.vx)*REST}
 if(b.x+b.r>TABLE.right){b.x=TABLE.right-b.r;b.vx=-Math.abs(b.vx)*REST}
 if(b.y-b.r<TABLE.top){b.y=TABLE.top+b.r;b.vy=Math.abs(b.vy)*REST}
 if(b.y+b.r>TABLE.bottom){b.y=TABLE.bottom-b.r;b.vy=-Math.abs(b.vy)*REST}
}

function ballCollisions(){
 for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
  const a=balls[i],b=balls[j];
  if(a.pocketed||b.pocketed)continue;
  let dx=b.x-a.x,dy=b.y-a.y;
  let dist2=dx*dx+dy*dy;
  const minD=a.r+b.r;
  if(dist2>=minD*minD)continue;
  let dist=Math.sqrt(dist2);
  if(dist<0.0001){dx=0.001;dy=0;dist=0.001}
  const nx=dx/dist,ny=dy/dist;
  const overlap=minD-dist;

  // Positional correction prevents sinking/sticking.
  const percent=0.82,slop=0.01;
  const correction=Math.max(overlap-slop,0)*percent/2;
  a.x-=nx*correction;a.y-=ny*correction;
  b.x+=nx*correction;b.y+=ny*correction;

  const rvx=b.vx-a.vx,rvy=b.vy-a.vy;
  const velN=rvx*nx+rvy*ny;
  if(velN>0)continue;

  const impulse=-(1+REST)*velN/2;
  const ix=impulse*nx,iy=impulse*ny;
  a.vx-=ix;a.vy-=iy;b.vx+=ix;b.vy+=iy;

  // Small tangential damping approximates cloth/contact losses.
  const tx=-ny,ty=nx;
  const velT=rvx*tx+rvy*ty;
  const frictionImpulse=-velT*0.015;
  a.vx-=frictionImpulse*tx;a.vy-=frictionImpulse*ty;
  b.vx+=frictionImpulse*tx;b.vy+=frictionImpulse*ty;
  tone(245,.022);
 }
}

function pocketCheck(){
 for(const b of balls){
  if(b.pocketed)continue;
  for(const p of pockets){
   if(Math.hypot(b.x-p.x,b.y-p.y)<30){
    b.pocketed=true;b.vx=b.vy=0;tone(720,.08);
    if(b.isCue)setTimeout(()=>{b.pocketed=false;b.x=250;b.y=H/2;b.vx=b.vy=0},450);
    else{turn==='player'?playerScore++:aiScore++;ui()}
    break;
   }
  }
 }
}

function anyMoving(){return balls.some(b=>!b.pocketed&&Math.hypot(b.vx,b.vy)>.06)}
function physicsFrame(){
 for(let s=0;s<SUBSTEPS;s++){
  integrate(1/SUBSTEPS);
  balls.forEach(wallCollision);
  ballCollisions();
  pocketCheck();
 }
 if(simulating&&!anyMoving()){
  balls.forEach(b=>{b.vx=0;b.vy=0});
  simulating=false;
  if(playerScore>=4||aiScore>=4){finish();return}
  turn=turn==='player'?'ai':'player';ui();
  if(turn==='ai'&&mode==='ai')setTimeout(aiShot,650);
  else $('message').textContent='الدور التالي.';
 }
}

function finish(){
 roundActive=false;
 if(playerScore>aiScore){balance+=bet*2;wins++;streak++;best=Math.max(best,streak);xp+=difficulty==='pro'?120:difficulty==='medium'?70:40;$('message').textContent=`فزت وحصلت على ${bet*2} عملة افتراضية.`;tone(900,.16)}
 else{losses++;streak=0;$('message').textContent='خسرت الجولة.';tone(150,.18)}
 save();ui();
}

function aiShot(){
 if(!roundActive)return;
 const cue=balls.find(b=>b.isCue&&!b.pocketed),targets=balls.filter(b=>!b.isCue&&!b.pocketed);
 if(!cue||!targets.length)return;
 let target=targets.reduce((a,b)=>Math.hypot(b.x-cue.x,b.y-cue.y)<Math.hypot(a.x-cue.x,a.y-cue.y)?b:a);
 const err=difficulty==='easy'?.30:difficulty==='medium'?.13:.045;
 const angle=Math.atan2(target.y-cue.y,target.x-cue.x)+(Math.random()-.5)*err;
 const power=(difficulty==='pro'?14:difficulty==='medium'?12.5:10.5)+Math.random()*3.5;
 cue.vx=Math.cos(angle)*power;cue.vy=Math.sin(angle)*power;simulating=true;$('message').textContent='النظام يلعب...';
}

function pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.onpointerdown=e=>{if(!roundActive||simulating)return;if(mode==='ai'&&turn!=='player')return;const cue=balls.find(b=>b.isCue&&!b.pocketed),p=pos(e);if(cue&&Math.hypot(p.x-cue.x,p.y-cue.y)<72){dragging=true;dragStart={x:cue.x,y:cue.y};dragNow=p;canvas.setPointerCapture(e.pointerId)}}
canvas.onpointermove=e=>{if(dragging)dragNow=pos(e)}
canvas.onpointerup=e=>{if(!dragging)return;dragging=false;const cue=balls.find(b=>b.isCue&&!b.pocketed),p=pos(e),dx=dragStart.x-p.x,dy=dragStart.y-p.y,l=Math.hypot(dx,dy);if(l<12)return;const power=Math.min(19.5,l/11);cue.vx=dx/l*power;cue.vy=dy/l*power;simulating=true;tone(430);$('message').textContent='الكرات تتحرك...'}

function loop(){physicsFrame();draw();requestAnimationFrame(loop)}
rack();ui();loop();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
