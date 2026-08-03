const HOUSE_EDGE = 0.01;
const START_BALANCE = 1_000_000;

const $ = id => document.getElementById(id);

let balance = START_BALANCE;
let autoMode = false;
let autoRunning = false;
let stats = { rounds:0, wins:0, losses:0, net:0 };
let nonce = 0;

const wallet = $("wallet");
const targetInput = $("targetInput");
const chanceInput = $("chanceInput");
const betInput = $("betInput");
const profitValue = $("profitValue");
const mainResult = $("mainResult");
const recentResults = $("recentResults");
const historyList = $("historyList");
const betButton = $("betButton");
const roundHash = $("roundHash");

function fmt(n){
  return Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function secureRandom(){
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (a[0] * 2**21 + (a[1]>>>11)) / 2**53;
}

function multiplierFromRandom(r){
  return Math.max(1, Math.floor(((1-HOUSE_EDGE)/Math.max(1-r,Number.EPSILON))*100)/100);
}

async function sha256(text){
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

function update(){
  const target = Math.max(Number(targetInput.value)||2,1.01);
  const bet = Math.max(Number(betInput.value)||0,0);
  chanceInput.value = (((1-HOUSE_EDGE)/target)*100).toFixed(8);
  profitValue.textContent = fmt(bet*target-bet);
  wallet.textContent = fmt(balance);
  $("rounds").textContent = stats.rounds;
  $("wins").textContent = stats.wins;
  $("losses").textContent = stats.losses;
  $("net").textContent = fmt(stats.net);
}

function addResult(value, won){
  const chip = document.createElement("div");
  chip.className = `recent-chip ${won?"win":""}`;
  chip.textContent = `${value.toFixed(2)}×`;
  recentResults.prepend(chip);
  while(recentResults.children.length>5) recentResults.lastElementChild.remove();

  const item = document.createElement("div");
  item.className = `history-item ${won?"win":"lose"}`;
  item.textContent = `${value.toFixed(2)}×`;
  historyList.prepend(item);
  while(historyList.children.length>100) historyList.lastElementChild.remove();
}

async function playRound(){
  const bet = Number(betInput.value);
  const target = Number(targetInput.value);

  if(!Number.isFinite(bet)||bet<=0){
    mainResult.textContent="0.00×";
    mainResult.className="main-result lose";
    return false;
  }
  if(bet>balance) return false;

  balance -= bet;
  stats.net -= bet;
  update();

  nonce++;
  const random = secureRandom();
  const result = multiplierFromRandom(random);
  const won = result>=target;

  mainResult.textContent = `${result.toFixed(2)}×`;
  mainResult.className = `main-result ${won?"win":"lose"}`;

  if(won){
    const payout = bet*target;
    balance += payout;
    stats.net += payout;
    stats.wins++;
  }else{
    stats.losses++;
  }

  stats.rounds++;
  roundHash.textContent = await sha256(`${nonce}:${random}:${result}`);
  addResult(result,won);
  update();
  return true;
}

betButton.addEventListener("click", async()=>{
  if(autoMode){
    if(autoRunning){
      autoRunning=false;
      betButton.textContent="Start Auto";
      return;
    }
    autoRunning=true;
    betButton.textContent="Stop Auto";
    const count=Math.min(Math.max(Number($("autoCount").value)||1,1),1000);
    const speed=Number($("autoSpeed").value)||900;
    for(let i=0;i<count&&autoRunning;i++){
      const ok=await playRound();
      if(!ok) break;
      await new Promise(r=>setTimeout(r,speed));
    }
    autoRunning=false;
    betButton.textContent="Start Auto";
  }else{
    await playRound();
  }
});

targetInput.addEventListener("input",update);
betInput.addEventListener("input",update);

$("halfBtn").onclick=()=>{betInput.value=Math.max((Number(betInput.value)||0)/2,.01).toFixed(2);update()};
$("doubleBtn").onclick=()=>{betInput.value=Math.min((Number(betInput.value)||0)*2,balance).toFixed(2);update()};
$("maxBtn").onclick=()=>{betInput.value=balance.toFixed(2);update()};
$("clearTarget").onclick=()=>{targetInput.value="2.00";update()};

$("manualMode").onclick=()=>{
  autoMode=false;
  $("manualMode").classList.add("active");
  $("autoMode").classList.remove("active");
  $("autoSettings").classList.add("hidden");
  betButton.textContent="Bet";
};

$("autoMode").onclick=()=>{
  autoMode=true;
  $("autoMode").classList.add("active");
  $("manualMode").classList.remove("active");
  $("autoSettings").classList.remove("hidden");
  betButton.textContent="Start Auto";
};

$("fairnessBtn").onclick=()=>$("fairnessModal").classList.remove("hidden");
$("closeFairness").onclick=()=>$("fairnessModal").classList.add("hidden");
$("resetBalance").onclick=()=>{balance=START_BALANCE;update()};

[1632.05,1.43,1.09,3.84,5.89].forEach((v,i)=>addResult(v,i===0));
update();
