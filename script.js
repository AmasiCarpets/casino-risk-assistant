const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const balanceEl = document.getElementById("balance");
const betElButtons = [...document.querySelectorAll(".bet-btn")];
const playerScoreEl = document.getElementById("playerScore");
const aiScoreEl = document.getElementById("aiScore");
const turnEl = document.getElementById("turn");
const messageEl = document.getElementById("message");
const newGameBtn = document.getElementById("newGame");

let balance = Number(localStorage.getItem("bdp_balance") || 1000);
let bet = 25;
let playerScore = 0;
let aiScore = 0;
let turn = "player";
let roundActive = false;
let simulating = false;
let dragging = false;
let dragOrigin = null;
let dragPoint = null;
let balls = [];

const pockets = [
  {x:28,y:28},{x:W/2,y:22},{x:W-28,y:28},
  {x:28,y:H-28},{x:W/2,y:H-22},{x:W-28,y:H-28}
];

function saveBalance(){
  localStorage.setItem("bdp_balance", String(balance));
}

function updateUI(){
  balanceEl.textContent = Math.floor(balance);
  playerScoreEl.textContent = playerScore;
  aiScoreEl.textContent = aiScore;
  turnEl.textContent = turn === "player" ? "أنت" : "النظام";
}

function makeBall(x,y,r,color,id,isCue=false){
  return {x,y,vx:0,vy:0,r,color,id,isCue,pocketed:false};
}

function createRack(){
  balls = [makeBall(230,H/2,16,"#ffffff","cue",true)];
  const colors = ["#ffd43b","#4dabf7","#ff6b6b","#a855f7","#ff922b","#20c997","#f06595"];
  let id=1;
  for(let row=0;row<4;row++){
    for(let col=0;col<=row && id<=7;col++){
      balls.push(makeBall(710+row*31,H/2-row*17+col*34,15,colors[id-1],id));
      id++;
    }
  }
}

function startRound(){
  if(roundActive || simulating){
    messageEl.textContent = "أنهِ الجولة الحالية أولًا.";
    return;
  }
  if(balance < bet){
    messageEl.textContent = "رصيدك الافتراضي غير كافٍ.";
    return;
  }
  balance -= bet;
  saveBalance();
  playerScore=0;
  aiScore=0;
  turn="player";
  roundActive=true;
  simulating=false;
  createRack();
  updateUI();
  messageEl.textContent = "دورك: اسحب من الكرة البيضاء بعكس اتجاه الضربة.";
}

betElButtons.forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(roundActive) return;
    bet = Number(btn.dataset.bet);
    betElButtons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
  });
});

newGameBtn.addEventListener("click",startRound);

function drawTable(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#0b754d";
  ctx.fillRect(0,0,W,H);

  ctx.strokeStyle="#d1a45f";
  ctx.lineWidth=7;
  ctx.strokeRect(12,12,W-24,H-24);

  ctx.beginPath();
  ctx.moveTo(W*.25,20);
  ctx.lineTo(W*.25,H-20);
  ctx.strokeStyle="#ffffff55";
  ctx.lineWidth=2;
  ctx.stroke();

  pockets.forEach(p=>{
    ctx.beginPath();
    ctx.arc(p.x,p.y,25,0,Math.PI*2);
    ctx.fillStyle="#061014";
    ctx.fill();
  });

  balls.forEach(b=>{
    if(b.pocketed) return;
    ctx.save();
    ctx.shadowColor="#0008";
    ctx.shadowBlur=7;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fillStyle=b.color;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle="#0005";
    ctx.lineWidth=2;
    ctx.stroke();

    if(!b.isCue){
      ctx.beginPath();
      ctx.arc(b.x,b.y,7,0,Math.PI*2);
      ctx.fillStyle="#fff";
      ctx.fill();
      ctx.fillStyle="#111";
      ctx.font="9px system-ui";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(String(b.id),b.x,b.y);
    }
  });

  if(dragging && dragOrigin && dragPoint){
    const cue = balls.find(b=>b.isCue && !b.pocketed);
    if(cue){
      ctx.beginPath();
      ctx.moveTo(cue.x,cue.y);
      ctx.lineTo(dragPoint.x,dragPoint.y);
      ctx.strokeStyle="#ffffff";
      ctx.lineWidth=4;
      ctx.stroke();

      const d = Math.min(180,Math.hypot(dragPoint.x-cue.x,dragPoint.y-cue.y));
      ctx.fillStyle="#ffffff33";
      ctx.fillRect(20,H-22,d*2,8);
    }
  }
}

function resolveCollisions(){
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const a=balls[i], b=balls[j];
      if(a.pocketed || b.pocketed) continue;
      const dx=b.x-a.x, dy=b.y-a.y;
      const dist=Math.hypot(dx,dy);
      const minDist=a.r+b.r;
      if(dist>0 && dist<minDist){
        const nx=dx/dist, ny=dy/dist;
        const overlap=minDist-dist;
        a.x-=nx*overlap/2; a.y-=ny*overlap/2;
        b.x+=nx*overlap/2; b.y+=ny*overlap/2;

        const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
        if(rel>0) continue;
        const impulse=rel;
        a.vx-=impulse*nx; a.vy-=impulse*ny;
        b.vx+=impulse*nx; b.vy+=impulse*ny;
      }
    }
  }
}

function handlePockets(){
  balls.forEach(b=>{
    if(b.pocketed) return;
    for(const p of pockets){
      if(Math.hypot(b.x-p.x,b.y-p.y)<25){
        b.pocketed=true;
        b.vx=b.vy=0;
        if(b.isCue){
          setTimeout(()=>{
            b.pocketed=false;
            b.x=230;
            b.y=H/2;
          },500);
        } else {
          if(turn==="player") playerScore++;
          else aiScore++;
          updateUI();
        }
        break;
      }
    }
  });
}

function physics(){
  let moving=false;
  balls.forEach(b=>{
    if(b.pocketed) return;
    b.x+=b.vx;
    b.y+=b.vy;
    b.vx*=0.988;
    b.vy*=0.988;

    if(Math.abs(b.vx)<0.02) b.vx=0;
    if(Math.abs(b.vy)<0.02) b.vy=0;

    if(b.x-b.r<28){ b.x=28+b.r; b.vx=Math.abs(b.vx); }
    if(b.x+b.r>W-28){ b.x=W-28-b.r; b.vx=-Math.abs(b.vx); }
    if(b.y-b.r<28){ b.y=28+b.r; b.vy=Math.abs(b.vy); }
    if(b.y+b.r>H-28){ b.y=H-28-b.r; b.vy=-Math.abs(b.vy); }

    if(Math.hypot(b.vx,b.vy)>0.05) moving=true;
  });

  resolveCollisions();
  handlePockets();

  if(simulating && !moving){
    simulating=false;
    if(playerScore>=4 || aiScore>=4){
      finishRound();
      return;
    }
    turn = turn==="player" ? "ai" : "player";
    updateUI();
    if(turn==="ai"){
      messageEl.textContent="النظام يفكر...";
      setTimeout(aiShot,650);
    }else{
      messageEl.textContent="دورك.";
    }
  }
}

function finishRound(){
  roundActive=false;
  simulating=false;
  if(playerScore>aiScore){
    balance += bet*2;
    messageEl.textContent = `فزت بالجولة وحصلت على ${bet*2} عملة افتراضية.`;
  }else{
    messageEl.textContent = "خسرت الجولة. تستطيع بدء جولة جديدة.";
  }
  saveBalance();
  updateUI();
}

function aiShot(){
  if(!roundActive) return;
  const cue=balls.find(b=>b.isCue && !b.pocketed);
  const targets=balls.filter(b=>!b.isCue && !b.pocketed);
  if(!cue || !targets.length) return;

  let target=targets[0];
  let best=Infinity;
  for(const t of targets){
    const d=Math.hypot(t.x-cue.x,t.y-cue.y);
    if(d<best){ best=d; target=t; }
  }
  const angle=Math.atan2(target.y-cue.y,target.x-cue.x)+(Math.random()-.5)*0.18;
  const power=10+Math.random()*5;
  cue.vx=Math.cos(angle)*power;
  cue.vy=Math.sin(angle)*power;
  simulating=true;
  messageEl.textContent="النظام يلعب...";
}

function pointerPosition(e){
  const rect=canvas.getBoundingClientRect();
  return {
    x:(e.clientX-rect.left)*W/rect.width,
    y:(e.clientY-rect.top)*H/rect.height
  };
}

canvas.addEventListener("pointerdown",e=>{
  if(!roundActive || turn!=="player" || simulating) return;
  const cue=balls.find(b=>b.isCue && !b.pocketed);
  if(!cue) return;
  const p=pointerPosition(e);
  if(Math.hypot(p.x-cue.x,p.y-cue.y)<60){
    dragging=true;
    dragOrigin={x:cue.x,y:cue.y};
    dragPoint=p;
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener("pointermove",e=>{
  if(dragging) dragPoint=pointerPosition(e);
});

canvas.addEventListener("pointerup",e=>{
  if(!dragging) return;
  dragging=false;
  const cue=balls.find(b=>b.isCue && !b.pocketed);
  if(!cue) return;
  const p=pointerPosition(e);
  let dx=dragOrigin.x-p.x;
  let dy=dragOrigin.y-p.y;
  const len=Math.hypot(dx,dy);
  if(len<12){
    messageEl.textContent="اسحب مسافة أكبر للضربة.";
    return;
  }
  const power=Math.min(17,len/12);
  cue.vx=dx/len*power;
  cue.vy=dy/len*power;
  simulating=true;
  messageEl.textContent="الكرات تتحرك...";
});

function loop(){
  physics();
  drawTable();
  requestAnimationFrame(loop);
}

createRack();
updateUI();
loop();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}
