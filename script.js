const BOARD_COUNT = 10;
const HOUSE_EDGE = 0.01;
const STARTING_BALANCE = 1_000_000;

const $ = id => document.getElementById(id);

const boardsContainer = $("boards");
const betAmountEl = $("betAmount");
const targetEl = $("target");
const betBtn = $("betBtn");

let balance = STARTING_BALANCE;
let playing = false;
let stats = { rounds: 0, wins: 0, losses: 0, net: 0 };

const boards = Array.from({ length: BOARD_COUNT }, (_, index) => ({
  id: index + 1,
  clientSeed: crypto.randomUUID(),
  serverSeed: crypto.randomUUID(),
  nonce: 0,
  result: 1
}));

function money(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function shortSeed(seed) {
  return `${seed.slice(0, 6)}…${seed.slice(-4)}`;
}

function secureRandom() {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  const high = values[0] * 2 ** 21;
  const low = values[1] >>> 11;
  return (high + low) / 2 ** 53;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function multiplierFromRandom(randomValue) {
  const raw = (1 - HOUSE_EDGE) / Math.max(1 - randomValue, Number.EPSILON);
  return Math.max(1, Math.floor(raw * 100) / 100);
}

function createBoards() {
  boardsContainer.innerHTML = "";

  boards.forEach(board => {
    const element = document.createElement("article");
    element.className = "board";
    element.id = `board-${board.id}`;
    element.innerHTML = `
      <div class="board-head">
        <span class="board-number">لوحة ${board.id}</span>
        <span class="board-status" id="status-${board.id}">جاهزة</span>
      </div>

      <div class="board-result" id="result-${board.id}">1.00×</div>

      <div class="board-details">
        <div><span>Client</span><code id="client-${board.id}">${shortSeed(board.clientSeed)}</code></div>
        <div><span>Server</span><code id="server-${board.id}">${shortSeed(board.serverSeed)}</code></div>
        <div><span>Nonce</span><code id="nonce-${board.id}">0</code></div>
        <div><span>Hash</span><code id="hash-${board.id}">—</code></div>
      </div>
    `;
    boardsContainer.appendChild(element);
  });
}

function updateUi() {
  const bet = Math.max(Number(betAmountEl.value) || 0, 0);
  const target = Math.max(Number(targetEl.value) || 1.01, 1.01);

  $("balance").textContent = money(balance);
  $("totalCost").textContent = money(bet * BOARD_COUNT);
  $("chance").textContent = `${(((1 - HOUSE_EDGE) / target) * 100).toFixed(4)}%`;
  $("profitPerBoard").textContent = money(bet * target - bet);

  $("roundsStat").textContent = stats.rounds;
  $("winsStat").textContent = stats.wins;
  $("lossesStat").textContent = stats.losses;
  $("netStat").textContent = money(stats.net);
}

async function generateBoardResult(board, bet, target) {
  board.nonce += 1;
  board.serverSeed = crypto.randomUUID();

  // كل لوحة تستخدم مصدر عشوائية مستقل مع Seeds وNonce منفصلة.
  const randomValue = secureRandom();
  const proofInput =
    `${board.serverSeed}:${board.clientSeed}:${board.nonce}:${randomValue}`;
  const hash = await sha256(proofInput);
  const result = multiplierFromRandom(randomValue);
  const won = result >= target;

  return { result, won, hash };
}

async function playAllBoards() {
  if (playing) return;

  const bet = Number(betAmountEl.value);
  const target = Number(targetEl.value);
  const totalCost = bet * BOARD_COUNT;

  if (!Number.isFinite(bet) || bet <= 0) {
    alert("اكتب مبلغ رهان صحيحاً أكبر من صفر.");
    return;
  }

  if (!Number.isFinite(target) || target < 1.01) {
    alert("المضاعف المستهدف يجب أن يكون 1.01× أو أكثر.");
    return;
  }

  if (totalCost > balance) {
    alert(`تحتاج ${money(totalCost)} نقطة لتشغيل اللوحات العشر.`);
    return;
  }

  playing = true;
  betBtn.disabled = true;
  balance -= totalCost;
  stats.net -= totalCost;
  updateUi();

  boards.forEach(board => {
    const card = $(`board-${board.id}`);
    card.className = "board running";
    $(`status-${board.id}`).textContent = "تلعب…";
    $(`result-${board.id}`).textContent = "—";
  });

  // تشغيل جميع اللوحات في نفس اللحظة، لكن كل واحدة بحساب مستقل.
  const generated = await Promise.all(
    boards.map(board => generateBoardResult(board, bet, target))
  );

  await new Promise(resolve => setTimeout(resolve, 550));

  generated.forEach((outcome, index) => {
    const board = boards[index];
    const card = $(`board-${board.id}`);

    board.result = outcome.result;
    card.className = `board ${outcome.won ? "win" : "lose"}`;
    $(`result-${board.id}`).textContent = `${outcome.result.toFixed(2)}×`;
    $(`status-${board.id}`).textContent = outcome.won ? "فوز" : "خسارة";
    $(`server-${board.id}`).textContent = shortSeed(board.serverSeed);
    $(`nonce-${board.id}`).textContent = board.nonce;
    $(`hash-${board.id}`).textContent = `${outcome.hash.slice(0, 8)}…`;

    stats.rounds += 1;

    if (outcome.won) {
      const payout = bet * target;
      balance += payout;
      stats.net += payout;
      stats.wins += 1;
    } else {
      stats.losses += 1;
    }
  });

  updateUi();
  playing = false;
  betBtn.disabled = false;
}

betBtn.addEventListener("click", playAllBoards);
betAmountEl.addEventListener("input", updateUi);
targetEl.addEventListener("input", updateUi);

$("halfBtn").addEventListener("click", () => {
  betAmountEl.value = Math.max((Number(betAmountEl.value) || 0) / 2, 0.01).toFixed(2);
  updateUi();
});

$("doubleBtn").addEventListener("click", () => {
  const maxPerBoard = balance / BOARD_COUNT;
  betAmountEl.value = Math.min((Number(betAmountEl.value) || 0) * 2, maxPerBoard).toFixed(2);
  updateUi();
});

$("resetBalance").addEventListener("click", () => {
  balance = STARTING_BALANCE;
  updateUi();
});

$("resetStats").addEventListener("click", () => {
  stats = { rounds: 0, wins: 0, losses: 0, net: 0 };

  boards.forEach(board => {
    board.clientSeed = crypto.randomUUID();
    board.serverSeed = crypto.randomUUID();
    board.nonce = 0;
    board.result = 1;
  });

  createBoards();
  updateUi();
});

createBoards();
updateUi();
