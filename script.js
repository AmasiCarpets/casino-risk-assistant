const HOUSE_EDGE = 0.01;
const STARTING_BALANCE = 1000000;

const balanceEl = document.getElementById("balance");
const betAmountEl = document.getElementById("betAmount");
const targetEl = document.getElementById("target");
const resultEl = document.getElementById("result");
const statusEl = document.getElementById("status");
const chanceEl = document.getElementById("chance");
const profitEl = document.getElementById("profit");
const historyEl = document.getElementById("history");
const betBtn = document.getElementById("betBtn");
const roundHashEl = document.getElementById("roundHash");

let balance = STARTING_BALANCE;
let playing = false;
let nonce = 0;
const clientSeed = crypto.randomUUID();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function money(value) {
  return Number(value).toFixed(2);
}

function updateUi() {
  const bet = Math.max(Number(betAmountEl.value) || 0, 0);
  const target = clamp(Number(targetEl.value) || 1.01, 1.01, 1_000_000);
  const chance = ((1 - HOUSE_EDGE) / target) * 100;
  const netProfit = bet * target - bet;

  balanceEl.textContent = money(balance);
  chanceEl.textContent = `${chance.toFixed(4)}%`;
  profitEl.textContent = money(Math.max(netProfit, 0));
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
  // توزيع Limbo-style أصلي: النتائج الصغيرة شائعة والكبيرة نادرة.
  // معامل 0.99 يمثل أفضلية محاكاة قدرها 1%.
  const raw = (1 - HOUSE_EDGE) / Math.max(1 - randomValue, Number.EPSILON);
  return Math.max(1, Math.floor(raw * 100) / 100);
}

function addHistory(multiplier, won) {
  const item = document.createElement("div");
  item.className = `history-item ${won ? "win" : "lose"}`;
  item.textContent = `${multiplier.toFixed(2)}×`;
  historyEl.prepend(item);

  while (historyEl.children.length > 20) {
    historyEl.lastElementChild.remove();
  }
}

async function animateTo(finalValue) {
  const duration = 650;
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

async function placeBet() {
  if (playing) return;

  const bet = Number(betAmountEl.value);
  const target = clamp(Number(targetEl.value), 1.01, 1_000_000);

  if (!Number.isFinite(bet) || bet <= 0) {
    statusEl.textContent = "اكتب مبلغاً صحيحاً أكبر من صفر.";
    return;
  }

  if (!Number.isFinite(target) || target < 1.01) {
    statusEl.textContent = "المضاعف المستهدف يجب أن يكون 1.01× أو أكثر.";
    return;
  }

  if (bet > balance) {
    statusEl.textContent = "الرصيد الافتراضي غير كافٍ.";
    return;
  }

  playing = true;
  betBtn.disabled = true;
  resultEl.className = "result";
  statusEl.textContent = "جارٍ إنشاء نتيجة الجولة…";

  balance -= bet;
  updateUi();

  nonce += 1;
  const serverSeed = crypto.randomUUID();
  const randomValue = secureRandom();
  const proof = await sha256(`${serverSeed}:${clientSeed}:${nonce}:${randomValue}`);
  const multiplier = createMultiplier(randomValue);
  const won = multiplier >= target;

  await animateTo(multiplier);

  if (won) {
    const payout = bet * target;
    balance += payout;
    resultEl.classList.add("win");
    statusEl.textContent = `فوز! تم إضافة ${money(payout)} نقطة إلى الرصيد.`;
  } else {
    resultEl.classList.add("lose");
    statusEl.textContent = `خسارة الجولة. كان هدفك ${target.toFixed(2)}×.`;
  }

  roundHashEl.textContent = proof;
  addHistory(multiplier, won);
  updateUi();

  playing = false;
  betBtn.disabled = false;
}

betAmountEl.addEventListener("input", updateUi);
targetEl.addEventListener("input", updateUi);
betBtn.addEventListener("click", placeBet);

document.getElementById("halfBtn").addEventListener("click", () => {
  betAmountEl.value = Math.max((Number(betAmountEl.value) || 0) / 2, 0.01).toFixed(2);
  updateUi();
});

document.getElementById("doubleBtn").addEventListener("click", () => {
  betAmountEl.value = Math.min((Number(betAmountEl.value) || 0) * 2, balance).toFixed(2);
  updateUi();
});

document.querySelectorAll("[data-target]").forEach(button => {
  button.addEventListener("click", () => {
    targetEl.value = Number(button.dataset.target).toFixed(2);
    updateUi();
  });
});

document.getElementById("resetBtn").addEventListener("click", () => {
  balance = STARTING_BALANCE;
  historyEl.innerHTML = "";
  resultEl.textContent = "1.00×";
  resultEl.className = "result";
  statusEl.textContent = "تمت إعادة الرصيد الافتراضي.";
  roundHashEl.textContent = "—";
  updateUi();
});

updateUi();
