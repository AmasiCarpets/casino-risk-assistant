const HOUSE_EDGE = 0.01;
const STARTING_BALANCE = 1_000_000;

const $ = id => document.getElementById(id);

const balanceEl = $("balance");
const betAmountEl = $("betAmount");
const targetEl = $("target");
const resultEl = $("result");
const statusEl = $("status");
const chanceEl = $("chance");
const profitEl = $("profit");
const historyEl = $("history");
const recentStripEl = $("recentStrip");
const betBtn = $("betBtn");
const stopBtn = $("stopBtn");
const roundHashEl = $("roundHash");
const autoControlsEl = $("autoControls");
const manualTab = $("manualTab");
const autoTab = $("autoTab");
const autoRoundsEl = $("autoRounds");
const speedEl = $("speed");

let balance = STARTING_BALANCE;
let playing = false;
let autoMode = false;
let autoRunning = false;
let nonce = 0;

let stats = {
  rounds: 0,
  wins: 0,
  losses: 0,
  net: 0,
  best: 1,
  streak: 0
};

const clientSeed = crypto.randomUUID();

function money(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function secureRandom() {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  const high = values[0] * 2 ** 21;
  const low = values[1] >>> 11;
  return (high + low) / 2 ** 53;
}

function createMultiplier(randomValue) {
  const raw = (1 - HOUSE_EDGE) / Math.max(1 - randomValue, Number.EPSILON);
  return Math.max(1, Math.floor(raw * 100) / 100);
}

function getBetAndTarget() {
  const bet = Number(betAmountEl.value);
  const target = clamp(Number(targetEl.value), 1.01, 1_000_000);
  return { bet, target };
}

function updateUi() {
  const { bet, target } = getBetAndTarget();
  const chance = ((1 - HOUSE_EDGE) / target) * 100;
  const netProfit = Math.max(bet * target - bet, 0);

  balanceEl.textContent = money(balance);
  chanceEl.textContent = `${chance.toFixed(4)}%`;
  profitEl.textContent = money(netProfit);

  $("roundsStat").textContent = stats.rounds;
  $("winsStat").textContent = stats.wins;
  $("lossesStat").textContent = stats.losses;
  $("netStat").textContent = money(stats.net);
  $("bestStat").textContent = `${stats.best.toFixed(2)}×`;
  $("streakStat").textContent = stats.streak;
}

function addResult(multiplier, won) {
  const item = document.createElement("div");
  item.className = `history-item ${won ? "win" : "lose"}`;
  item.textContent = `${multiplier.toFixed(2)}×`;
  historyEl.prepend(item);

  while (historyEl.children.length > 100) {
    historyEl.lastElementChild.remove();
  }

  const chip = document.createElement("div");
  chip.className = `recent-chip ${won ? "win" : "lose"}`;
  chip.textContent = `${multiplier.toFixed(2)}×`;
  recentStripEl.prepend(chip);

  while (recentStripEl.children.length > 8) {
    recentStripEl.lastElementChild.remove();
  }
}

async function animateTo(finalValue, duration = 550) {
  const start = performance.now();

  return new Promise(resolve => {
    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const shown = 1 + (finalValue - 1) * eased;
      resultEl.textContent = `${shown.toFixed(2)}×`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function validateBet() {
  const { bet, target } = getBetAndTarget();

  if (!Number.isFinite(bet) || bet <= 0) {
    statusEl.textContent = "اكتب مبلغاً صحيحاً أكبر من صفر.";
    return null;
  }

  if (!Number.isFinite(target) || target < 1.01) {
    statusEl.textContent = "المضاعف المستهدف يجب أن يكون 1.01× أو أكثر.";
    return null;
  }

  if (bet > balance) {
    statusEl.textContent = "الرصيد الافتراضي غير كافٍ.";
    return null;
  }

  return { bet, target };
}

async function playOneRound(animationDuration = 550) {
  const values = validateBet();
  if (!values) return false;

  const { bet, target } = values;

  playing = true;
  betBtn.disabled = true;
  resultEl.className = "result";
  statusEl.textContent = "جارٍ إنشاء نتيجة الجولة…";

  balance -= bet;
  stats.net -= bet;
  updateUi();

  nonce += 1;
  const serverSeed = crypto.randomUUID();
  const randomValue = secureRandom();
  const proof = await sha256(`${serverSeed}:${clientSeed}:${nonce}:${randomValue}`);
  const multiplier = createMultiplier(randomValue);
  const won = multiplier >= target;

  await animateTo(multiplier, animationDuration);

  stats.rounds += 1;
  stats.best = Math.max(stats.best, multiplier);

  if (won) {
    const payout = bet * target;
    balance += payout;
    stats.net += payout;
    stats.wins += 1;
    stats.streak += 1;
    resultEl.classList.add("win");
    statusEl.textContent = `فوز! تم إضافة ${money(payout)} نقطة.`;
  } else {
    stats.losses += 1;
    stats.streak = 0;
    resultEl.classList.add("lose");
    statusEl.textContent = `خسارة. كان هدفك ${target.toFixed(2)}×.`;
  }

  roundHashEl.textContent = proof;
  addResult(multiplier, won);
  updateUi();

  playing = false;
  betBtn.disabled = false;
  return true;
}

async function runAutoBet() {
  if (autoRunning) return;

  const totalRounds = clamp(Number(autoRoundsEl.value) || 1, 1, 1000);
  const delay = Number(speedEl.value) || 900;

  autoRunning = true;
  betBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");

  for (let i = 0; i < totalRounds && autoRunning; i++) {
    const ok = await playOneRound(Math.min(delay * 0.65, 550));
    if (!ok) break;
    await wait(Math.max(delay - Math.min(delay * 0.65, 550), 60));
  }

  autoRunning = false;
  stopBtn.classList.add("hidden");
  betBtn.classList.remove("hidden");
  statusEl.textContent = "انتهى Auto Bet.";
}

function setMode(mode) {
  autoMode = mode === "auto";

  manualTab.classList.toggle("active", !autoMode);
  autoTab.classList.toggle("active", autoMode);
  autoControlsEl.classList.toggle("hidden", !autoMode);

  betBtn.textContent = autoMode ? "START AUTO BET" : "BET";
}

betAmountEl.addEventListener("input", updateUi);
targetEl.addEventListener("input", updateUi);

manualTab.addEventListener("click", () => setMode("manual"));
autoTab.addEventListener("click", () => setMode("auto"));

betBtn.addEventListener("click", async () => {
  if (playing || autoRunning) return;
  if (autoMode) {
    await runAutoBet();
  } else {
    await playOneRound();
  }
});

stopBtn.addEventListener("click", () => {
  autoRunning = false;
  statusEl.textContent = "تم طلب إيقاف Auto Bet…";
});

$("halfBtn").addEventListener("click", () => {
  betAmountEl.value = Math.max((Number(betAmountEl.value) || 0) / 2, 0.01).toFixed(2);
  updateUi();
});

$("doubleBtn").addEventListener("click", () => {
  betAmountEl.value = Math.min((Number(betAmountEl.value) || 0) * 2, balance).toFixed(2);
  updateUi();
});

document.querySelectorAll("[data-target]").forEach(button => {
  button.addEventListener("click", () => {
    targetEl.value = Number(button.dataset.target).toFixed(2);
    updateUi();
  });
});

$("resetBalanceBtn").addEventListener("click", () => {
  balance = STARTING_BALANCE;
  statusEl.textContent = "تمت إعادة الرصيد إلى مليون نقطة افتراضية.";
  updateUi();
});

$("resetStatsBtn").addEventListener("click", () => {
  stats = { rounds: 0, wins: 0, losses: 0, net: 0, best: 1, streak: 0 };
  historyEl.innerHTML = "";
  recentStripEl.innerHTML = "";
  resultEl.textContent = "1.00×";
  resultEl.className = "result";
  roundHashEl.textContent = "—";
  statusEl.textContent = "تم تصفير الإحصائيات.";
  updateUi();
});

setMode("manual");
updateUi();
