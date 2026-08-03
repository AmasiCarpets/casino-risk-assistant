const $ = (id) => document.getElementById(id);

const state = {
  results: [],
  target: 2,
  cols: 100,
  rows: 100,
  cellW: 14,
  cellH: 9,
  lastBatchClientSeed: "",
};

const canvas = $("board");
const ctx = canvas.getContext("2d");

function randomClientSeed() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

function updateChance() {
  const target = Math.max(1.01, Number($("target").value || 2));
  $("winChance").textContent = `${(99 / target).toFixed(4)}%`;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "حدث خطأ");
  return data;
}

async function loadState() {
  try {
    const data = await api("/api/state");
    $("serverHash").textContent = data.serverSeedHash;
    $("startNonce").textContent = data.nonce;
    $("serverStatus").textContent = "الخادم متصل";
    $("serverStatus").style.background = "#173b27";
  } catch (e) {
    $("serverStatus").textContent = "الخادم غير متصل";
    $("serverStatus").style.background = "#4a2025";
    alert("شغّل الخادم بالأمر: npm install ثم npm start");
  }
}

function renderBoard() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssWidth = canvas.clientWidth || 1200;
  const cssHeight = Math.round(cssWidth * 0.64);
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cols = state.cols;
  const rows = state.rows;
  const gap = 1;
  const cw = cssWidth / cols;
  const ch = cssHeight / rows;
  state.cellW = cw;
  state.cellH = ch;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = "#11171b";
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  for (let i = 0; i < state.results.length; i++) {
    const r = state.results[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cw;
    const y = row * ch;
    ctx.fillStyle = r.multiplier >= state.target ? "#20d46b" : "#ff5d67";
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x + gap, y + gap, Math.max(1, cw - gap * 2), Math.max(1, ch - gap * 2));
  }
  ctx.globalAlpha = 1;
}

function updateStats(results) {
  const wins = results.filter(r => r.multiplier >= state.target).length;
  const losses = results.length - wins;
  const max = results.reduce((m, r) => Math.max(m, r.multiplier), 0);
  const avg = results.reduce((s, r) => s + r.multiplier, 0) / Math.max(1, results.length);
  $("wins").textContent = wins.toLocaleString("en-US");
  $("losses").textContent = losses.toLocaleString("en-US");
  $("maxMult").textContent = `${max.toFixed(2)}×`;
  $("avgMult").textContent = `${avg.toFixed(2)}×`;
}

async function betBatch() {
  const target = Math.max(1.01, Number($("target").value || 2));
  const clientSeed = $("clientSeed").value.trim();
  if (!clientSeed) return alert("اكتب Client Seed");

  $("betBtn").disabled = true;
  $("betBtn").textContent = "جاري توليد 10,000 نتيجة…";
  try {
    const data = await api("/api/batch", {
      method: "POST",
      body: JSON.stringify({ clientSeed, count: 10000 }),
    });
    state.results = data.results;
    state.target = target;
    state.lastBatchClientSeed = clientSeed;
    $("serverHash").textContent = data.serverSeedHash;
    $("startNonce").textContent = data.nextNonce;
    updateStats(data.results);
    renderBoard();
  } catch (e) {
    alert(e.message);
  } finally {
    $("betBtn").disabled = false;
    $("betBtn").textContent = "BET × 10,000";
  }
}

async function rotateSeed() {
  if (!confirm("سيتم كشف Server Seed الحالي وإنشاء Seed جديد. هل تريد المتابعة؟")) return;
  try {
    const data = await api("/api/rotate", { method: "POST", body: "{}" });
    $("revealedSeed").textContent = data.revealedServerSeed;
    $("vServerSeed").value = data.revealedServerSeed;
    $("vClientSeed").value = state.lastBatchClientSeed;
    $("serverHash").textContent = data.newServerSeedHash;
    $("startNonce").textContent = "0";
    alert("تم كشف الـ Server Seed القديم وإنشاء واحد جديد.");
  } catch (e) {
    alert(e.message);
  }
}

function showDetail(index) {
  const r = state.results[index];
  if (!r) return;
  $("dIndex").textContent = index + 1;
  $("dNonce").textContent = r.nonce;
  $("dMultiplier").textContent = `${r.multiplier.toFixed(2)}×`;
  $("dOutcome").textContent = r.multiplier >= state.target ? "فائز" : "خاسر";
  $("dHmac").textContent = r.hmac;
  $("vNonce").value = r.nonce;
}

canvas.addEventListener("click", (ev) => {
  if (!state.results.length) return;
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const col = Math.floor(x / state.cellW);
  const row = Math.floor(y / state.cellH);
  const index = row * state.cols + col;
  showDetail(index);
});

async function verifyRound() {
  const serverSeed = $("vServerSeed").value.trim();
  const clientSeed = $("vClientSeed").value.trim();
  const nonce = Number($("vNonce").value);
  if (!serverSeed || !clientSeed || !Number.isInteger(nonce) || nonce < 0) {
    return alert("أدخل Server Seed وClient Seed وNonce صحيح");
  }
  try {
    const data = await api("/api/verify", {
      method: "POST",
      body: JSON.stringify({ serverSeed, clientSeed, nonce }),
    });
    $("verifyResult").textContent =
      `Hash: ${data.serverSeedHash}\n` +
      `HMAC: ${data.hmac}\n` +
      `Multiplier: ${data.multiplier.toFixed(2)}×`;
  } catch (e) {
    $("verifyResult").textContent = e.message;
  }
}

$("clientSeed").value = randomClientSeed();
$("target").addEventListener("input", () => {
  updateChance();
  if (state.results.length) {
    state.target = Math.max(1.01, Number($("target").value || 2));
    updateStats(state.results);
    renderBoard();
  }
});
$("betBtn").addEventListener("click", betBatch);
$("rotateBtn").addEventListener("click", rotateSeed);
$("verifyBtn").addEventListener("click", verifyRound);
window.addEventListener("resize", () => {
  if (state.results.length) renderBoard();
});

updateChance();
loadState();
