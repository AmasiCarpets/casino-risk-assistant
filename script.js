const c=document.getElementById('game'),ctx=c.getContext('2d'),W=c.width,H=c.height,$=i=>document.getElementById(i);
let state={balance:+localStorage.getItem('bd3_balance')||1000,xp:+localStorage.getItem('bd3_xp')||0,wins:+localStorage.getItem('bd3_wins')||0,losses:+localStorage.getItem('bd3_losses')||0,best:+localStorage.getItem('bd3_best')||0,streak:+localStorage.getItem('bd3_streak')||0,trophies:+localStorage.getItem('bd3_trophies')||0};
let bet=25,diff='medium',mode='ai',ps=0,as=0,turn='player',active=false,moving=false,drag=false,start=null,now=null,sound=true,aim=true,balls=[],round=1;
const pockets=[[32,32],[W/2,24],[W-32,32],[32,H-32],[W/2,H-24],[W-32,H-32]];
const achievements=[
 {id:'first',name:'أول فوز',desc:'اربح جولة واحدة',ok:()=>state.wins>=1},
 {id:'streak3',name:'سلسلة 3',desc:'حقق 3 انتصارات متتالية',ok:()=>state.best>=3},
 {id:'gold',name:'الرتبة الذهبية',desc:'صل إلى 700 XP',ok:()=>state.xp>=700},
 {id:'champ',name:'بطل بطولة',desc:'افز ببطولة واحدة',ok:()=>state.trophies>=1},
 {id:'rich',name:'رصيد 2000',desc:'اجمع 2000 عملة افتراضية',ok:()=>state.balance>=2000},
 {id:'master',name:'الماستر',desc:'صل إلى 3000 XP',ok:()=>state.xp>=3000}
];
function tone(f=440,d=.06){if(!sound)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const a=new A(),o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=.04;o.connect(g);g.connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.stop(a.currentTime+d)}
function rank(){return state.xp>=3000?'Master':state.xp>=1500?'Diamond':state.xp>=700?'Gold':state.xp>=250?'Silver':'Bronze'}
function save(){Object.entries(state).forEach(([k,v])=>localStorage.setItem('bd3_'+k,v))}
function renderAchievements(){const el=$('achievementsList');el.innerHTML='';achievements.forEach(a=>{const d=document.createElement('div');d.className='achievement '+(a.ok()?'':'locked');d.innerHTML=`<b>${a.ok()?'🏆':'🔒'} ${a.name}</b><small>${a.desc}</small>`;el.appendChild(d)})}
function ui(){$('balance').textContent=Math.floor(state.balance);$('playerScore').textContent=ps;$('aiScore').textContent=as;$('wins').textContent=state.wins;$('losses').textContent=state.losses;$('bestStreak').textContent=state.best;$('trophies').textContent=state.trophies;$('rank').textContent=rank();$('xpText').textContent=state.xp+' XP';$('turn').textContent=turn==='player'?(mode==='local'?'اللاعب 1':'أنت'):(mode==='local'?'اللاعب 2':'النظام');$('roundText').textContent=mode==='tournament'?'جولة البطولة '+round:'الجولة 1';$('leftName').textContent=mode==='local'?'اللاعب 1':'أنت';$('rightName').textContent=mode==='local'?'اللاعب 2':'النظام';renderAchievements()}
function B(x,y,r,col,id,q=false){return{x,y,vx:0,vy:0,r,col,id,q,p:false}}
function rack(){balls=[B(245,H/2,17,'#fff','cue',true)];const cs=['#ffd43b','#4dabf7','#ff6b6b','#a855f7','#ff922b','#20c997','#f06595'];let id=1;for(let r=0;r<4;r++)for(let j=0;j<=r&&id<=7;j++,id++)balls.push(B(825+r*33,H/2-r*18+j*36,16,cs[id-1],id))}
document.querySelectorAll('[data-bet]').forEach(b=>b.onclick=()=>{if(active)return;bet=+b.dataset.bet;document.querySelectorAll('[data-bet]').forEach(v=>v.classList.remove('active'));b.classList.add('active')});
document.querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>{if(active)return;diff=b.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(v=>v.classList.remove('active'));b.classList.add('active')});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(active)return;mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(v=>v.classList.remove('active'));b.classList.add('active');ui()});
$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=sound?'🔊':'🔇'};$('aimBtn').onclick=()=>{aim=!aim;$('aimBtn').textContent=aim?'🎯':'🚫'};
$('newGame').onclick=()=>{if(active||moving)return;if(state.balance<bet){$('message').textContent='الرصيد الافتراضي غير كافٍ.';return}state.balance-=bet;ps=as=0;turn='player';active=true;round=1;rack();save();ui();$('message').textContent='اسحب من الكرة البيضاء لبدء الضربة.';tone(520)};
function draw(){ctx.clearRect(0,0,W,H);let g=ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,760);g.addColorStop(0,'#11895c');g.addColorStop(1,'#07563b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle='#d6ab64';ctx.lineWidth=9;ctx.strokeRect(14,14,W-28,H-28);pockets.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],29,0,7);ctx.fillStyle='#050e11';ctx.fill()});balls.forEach(b=>{if(b.p)return;ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=9;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fillStyle=b.col;ctx.fill();ctx.restore();if(!b.q){ctx.beginPath();ctx.arc(b.x,b.y,7,0,7);ctx.fillStyle='#fff';ctx.fill();ctx.fillStyle='#111';ctx.font='9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.id,b.x,b.y)}});if(drag&&start&&now){const q=balls.find(b=>b.q&&!b.p);if(q){let dx=q.x-now.x,dy=q.y-now.y,l=Math.hypot(dx,dy)||1,nx=dx/l,ny=dy/l;if(aim){ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+nx*520,q.y+ny*520);ctx.strokeStyle='#ffffffaa';ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([]);let tx=q.x+nx*520,ty=q.y+ny*520;if(tx<30||tx>W-30){nx*=-1}if(ty<30||ty>H-30){ny*=-1}ctx.beginPath();ctx.moveTo(Math.max(30,Math.min(W-30,tx)),Math.max(30,Math.min(H-30,ty)));ctx.lineTo(Math.max(30,Math.min(W-30,tx+nx*180)),Math.max(30,Math.min(H-30,ty+ny*180)));ctx.strokeStyle='#ffd86faa';ctx.stroke()}$('powerFill').style.width=Math.min(100,l/2)+'%'}}else $('powerFill').style.width='0'}
function physics(){let mv=false;balls.forEach(b=>{if(b.p)return;b.x+=b.vx;b.y+=b.vy;b.vx*=.992;b.vy*=.992;if(Math.abs(b.vx)<.02)b.vx=0;if(Math.abs(b.vy)<.02)b.vy=0;if(b.x-b.r<32){b.x=32+b.r;b.vx=Math.abs(b.vx)}if(b.x+b.r>W-32){b.x=W-32-b.r;b.vx=-Math.abs(b.vx)}if(b.y-b.r<32){b.y=32+b.r;b.vy=Math.abs(b.vy)}if(b.y+b.r>H-32){b.y=H-32-b.r;b.vy=-Math.abs(b.vy)}if(Math.hypot(b.vx,b.vy)>.05)mv=true});for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
  let a=balls[i],b=balls[j];
  if(a.p||b.p)continue;

  let dx=b.x-a.x,dy=b.y-a.y;
  let d=Math.hypot(dx,dy);
  let minD=a.r+b.r;

  if(d===0){
    dx=0.01;dy=0;d=0.01;
  }

  if(d<minD){
    const nx=dx/d,ny=dy/d;
    const overlap=minD-d;

    // فصل الكرتين قليلًا حتى لا تبقيا ملتصقتين
    const correction=Math.max(0,overlap-0.02)*0.52;
    a.x-=nx*correction;
    a.y-=ny*correction;
    b.x+=nx*correction;
    b.y+=ny*correction;

    // سرعة كل كرة على محور التصادم
    const rvx=b.vx-a.vx;
    const rvy=b.vy-a.vy;
    const velAlongNormal=rvx*nx+rvy*ny;

    // لا نكرر الدفع إذا كانت الكرتان تبتعدان عن بعض
    if(velAlongNormal<0){
      const restitution=0.96;
      const impulse=-(1+restitution)*velAlongNormal/2;

      a.vx-=impulse*nx;
      a.vy-=impulse*ny;
      b.vx+=impulse*nx;
      b.vy+=impulse*ny;

      tone(250,.025);
    }
  }
}balls.forEach(b=>{if(b.p)return;for(const p of pockets)if(Math.hypot(b.x-p[0],b.y-p[1])<29){b.p=true;b.vx=b.vy=0;tone(700,.08);if(b.q)setTimeout(()=>{b.p=false;b.x=245;b.y=H/2},400);else{turn==='player'?ps++:as++;ui()}break}});if(moving&&!mv){moving=false;if(ps>=4||as>=4){finish();return}turn=turn==='player'?'ai':'player';ui();if(turn==='ai'&&mode!=='local')setTimeout(ai,600);else $('message').textContent='الدور التالي.'}}
function finish(){active=false;const win=ps>as;if(mode==='tournament'){if(win&&round<3){round++;ps=as=0;turn='player';active=true;rack();ui();$('message').textContent='فزت بالجولة. تبدأ الجولة التالية.';return}if(win&&round===3){state.trophies++;state.balance+=bet*4;state.wins++;state.streak++;state.best=Math.max(state.best,state.streak);state.xp+=250;$('message').textContent='🏆 فزت بالبطولة وحصلت على جائزة كبيرة!'}else{state.losses++;state.streak=0;$('message').textContent='انتهت البطولة بخسارتك.'}}else if(win){state.balance+=bet*2;state.wins++;state.streak++;state.best=Math.max(state.best,state.streak);state.xp+=diff==='pro'?120:diff==='medium'?70:40;$('message').textContent=`فزت وحصلت على ${bet*2} عملة افتراضية.`}else{state.losses++;state.streak=0;$('message').textContent='خسرت الجولة.'}save();ui()}
function ai(){const q=balls.find(b=>b.q&&!b.p),ts=balls.filter(b=>!b.q&&!b.p);if(!q||!ts.length)return;let t=ts.reduce((a,b)=>Math.hypot(b.x-q.x,b.y-q.y)<Math.hypot(a.x-q.x,a.y-q.y)?b:a),err=diff==='easy'?.34:diff==='medium'?.16:.05,ang=Math.atan2(t.y-q.y,t.x-q.x)+(Math.random()-.5)*err,p=(diff==='pro'?13.5:diff==='medium'?12:10)+Math.random()*4;q.vx=Math.cos(ang)*p;q.vy=Math.sin(ang)*p;moving=true;$('message').textContent='النظام يلعب...'}
function pos(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
c.onpointerdown=e=>{if(!active||moving)return;if(mode!=='local'&&turn!=='player')return;const q=balls.find(b=>b.q&&!b.p),p=pos(e);if(q&&Math.hypot(p.x-q.x,p.y-q.y)<70){drag=true;start={x:q.x,y:q.y};now=p;c.setPointerCapture(e.pointerId)}}
c.onpointermove=e=>{if(drag)now=pos(e)}
c.onpointerup=e=>{if(!drag)return;drag=false;const q=balls.find(b=>b.q&&!b.p),p=pos(e),dx=start.x-p.x,dy=start.y-p.y,l=Math.hypot(dx,dy);if(l<12)return;const pw=Math.min(19,l/11);q.vx=dx/l*pw;q.vy=dy/l*pw;moving=true;tone(420);$('message').textContent='الكرات تتحرك...'}
function loop(){physics();draw();requestAnimationFrame(loop)}rack();ui();loop();if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));