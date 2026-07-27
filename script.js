const $ = id => document.getElementById(id);

const state = {
  results: JSON.parse(localStorage.getItem("crashLabResults") || "[]")
};

let lastSequence = [];

function saveState() {
  localStorage.setItem("crashLabResults", JSON.stringify(state.results));
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  return hexFromBuffer(await crypto.subtle.digest("SHA-256", textBytes(value)));
}

async function hmacSha256Hex(keyText, messageText) {
  const key = await crypto.subtle.importKey(
    "raw",
    textBytes(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hexFromBuffer(await crypto.subtle.sign("HMAC", key, textBytes(messageText)));
}

function firstFourBytes(hex) {
  return [0, 2, 4, 6].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function bytesToFloat(bytes) {
  return bytes.reduce((sum, value, index) =>
    sum + value / Math.pow(256, index + 1), 0
  );
}

function cleanHex(value) {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

function parseResults(text) {
  return text
    .split(/[\s,;|]+/)
    .map(value => Number(String(value).replace("x", "").replace("X", "")))
    .filter(value => Number.isFinite(value) && value >= 1);
}

function percent(count, total) {
  return total ? `${((count / total) * 100).toFixed(1)}%` : "0%";
}

function renderStats() {
  const values = state.results;
  const count = values.length;
  const average = count ? values.reduce((a, b) => a + b, 0) / count : 0;
  const highest = count ? Math.max(...values) : 0;
  const lowest = count ? Math.min(...values) : 0;

  $("statCount").textContent = count;
  $("statAverage").textContent = `${average.toFixed(2)}x`;
  $("statHighest").textContent = `${highest.toFixed(2)}x`;
  $("statLowest").textContent = `${lowest.toFixed(2)}x`;

  $("under2").textContent = percent(values.filter(v => v < 2).length, count);
  $("over2").textContent = percent(values.filter(v => v >= 2).length, count);
  $("over5").textContent = percent(values.filter(v => v >= 5).length, count);
  $("over10").textContent = percent(values.filter(v => v >= 10).length, count);

  const chips = $("chips");
  chips.innerHTML = "";

  values.slice(-60).reverse().forEach((value, reverseIndex) => {
    const index = values.length - 1 - reverseIndex;
    const chip = document.createElement("button");
    chip.className = `chip ${value < 2 ? "low" : value < 10 ? "mid" : "high"}`;
    chip.textContent = `${value.toFixed(2)}x`;
    chip.title = "اضغط للحذف";
    chip.addEventListener("click", () => {
      state.results.splice(index, 1);
      saveState();
      renderAll();
    });
    chips.appendChild(chip);
  });

  $("emptyResults").style.display = count ? "none" : "block";
}

function drawChart() {
  const canvas = $("resultsChart");
  const ctx = canvas.getContext("2d");
  const limit = Number($("chartLimit").value);
  const cap = Number($("chartCap").value);
  const values = state.results.slice(-limit);

  const w = canvas.width;
  const h = canvas.height;
  const pad = 55;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0e172a";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#2b3a60";
  ctx.lineWidth = 1;
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#aeb8cf";

  [0, .25, .5, .75, 1].forEach(step => {
    const y = h - pad - step * (h - pad * 2);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
    ctx.fillText(`${(cap * step).toFixed(0)}x`, 8, y + 7);
  });

  if (!values.length) {
    ctx.font = "30px sans-serif";
    ctx.fillStyle = "#aeb8cf";
    ctx.textAlign = "center";
    ctx.fillText("لا توجد بيانات للرسم", w / 2, h / 2);
    ctx.textAlign = "start";
    return;
  }

  const usableW = w - pad * 2;
  const barW = Math.max(2, usableW / values.length - 3);

  values.forEach((value, i) => {
    const capped = Math.min(value, cap);
    const barH = (capped / cap) * (h - pad * 2);
    const x = pad + (i / values.length) * usableW;
    const y = h - pad - barH;

    ctx.fillStyle = value < 2 ? "#ff8d8d" : value < 10 ? "#8da8ff" : "#62e6d2";
    ctx.fillRect(x, y, barW, barH);
  });

  ctx.fillStyle = "#aeb8cf";
  ctx.font = "20px sans-serif";
  ctx.fillText(`آخر ${values.length} جولة`, w - 190, 30);
}

function renderAll() {
  renderStats();
  drawChart();
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.tab).classList.add("active");
    if (button.dataset.tab === "chart") drawChart();
  });
});

$("addResults").addEventListener("click", () => {
  const values = parseResults($("resultsInput").value);
  if (!values.length) {
    alert("أدخل نتائج صحيحة مثل 1.20, 2.50, 8.10");
    return;
  }
  state.results.push(...values);
  saveState();
  $("resultsInput").value = "";
  renderAll();
});

$("loadExample").addEventListener("click", () => {
  const sample = [1.12,1.04,2.33,1.50,4.20,1.01,12.40,2.05,1.33,7.80,1.10,3.22,18.50,1.06,2.71,1.44,5.35,1.02,9.10,2.18];
  state.results.push(...sample);
  saveState();
  renderAll();
});

$("clearAll").addEventListener("click", () => {
  if (!confirm("هل تريد مسح جميع النتائج المحفوظة؟")) return;
  state.results = [];
  saveState();
  renderAll();
});

$("chartLimit").addEventListener("change", drawChart);
$("chartCap").addEventListener("change", drawChart);
window.addEventListener("resize", drawChart);

$("exportJson").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ results: state.results }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crash-lab-results.json";
  a.click();
  URL.revokeObjectURL(url);
});

$("exportCsv").addEventListener("click", () => {
  const rows = [["Index","Multiplier"], ...state.results.map((value, index) => [index + 1, value])];
  const csv = "\uFEFF" + rows.map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crash-lab-results.csv";
  a.click();
  URL.revokeObjectURL(url);
});

$("importJson").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const values = Array.isArray(data) ? data : data.results;
    if (!Array.isArray(values)) throw new Error();
    const clean = values.map(Number).filter(v => Number.isFinite(v) && v >= 1);
    state.results = clean;
    saveState();
    renderAll();
  } catch {
    alert("ملف JSON غير صالح.");
  }
  event.target.value = "";
});

$("verifyCommitment").addEventListener("click", async () => {
  const seed = $("revealedSeed").value.trim();
  const expected = cleanHex($("expectedHash").value);
  const result = $("commitmentResult");

  if (!seed || !expected) {
    result.className = "result bad";
    result.textContent = "أدخل Server Seed والهاش السابق.";
    return;
  }

  if (!/^[0-9a-f]{64}$/.test(expected)) {
    result.className = "result bad";
    result.textContent = "الهاش يجب أن يكون 64 حرفًا بنظام hex.";
    return;
  }

  const calculated = await sha256Hex(seed);
  $("calculatedHash").textContent = calculated;

  if (calculated === expected) {
    result.className = "result good";
    result.textContent = "متطابق ✅";
  } else {
    result.className = "result bad";
    result.textContent = "غير متطابق ❌";
  }
});

$("generateHmac").addEventListener("click", async () => {
  const server = $("serverSeed").value;
  const client = $("clientSeed").value;
  const nonce = Number($("nonce").value);
  const round = Number($("round").value);

  if (!server || !client || !Number.isInteger(nonce) || nonce < 0 || !Number.isInteger(round) || round < 0) {
    alert("أدخل بيانات صحيحة.");
    return;
  }

  const message = `${client}:${nonce}:${round}`;
  const hmac = await hmacSha256Hex(server, message);
  const bytes = firstFourBytes(hmac);
  const value = bytesToFloat(bytes);

  $("messageOut").textContent = message;
  $("hmacOut").textContent = hmac;
  $("bytesOut").textContent = bytes.join(", ");
  $("floatOut").textContent = value.toFixed(12);
});

$("generateSequence").addEventListener("click", async () => {
  const server = $("seqServerSeed").value;
  const client = $("seqClientSeed").value;
  const start = Number($("startNonce").value);
  const count = Math.min(200, Math.max(1, Number($("countNonce").value)));

  if (!server || !client || !Number.isInteger(start) || start < 0) {
    alert("أدخل بيانات صحيحة.");
    return;
  }

  const tbody = $("sequenceBody");
  tbody.innerHTML = "";
  lastSequence = [];

  for (let i = 0; i < count; i++) {
    const nonce = start + i;
    const message = `${client}:${nonce}:0`;
    const hmac = await hmacSha256Hex(server, message);
    const value = bytesToFloat(firstFourBytes(hmac));

    lastSequence.push({ nonce, hmac, value });

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${nonce}</td>
      <td><code>${hmac.slice(0, 16)}…</code></td>
      <td>${value.toFixed(10)}</td>
    `;
    tbody.appendChild(tr);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

renderAll();
