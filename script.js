const $ = id => document.getElementById(id);
let lastSequence = [];

function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function textBytes(value) {
  return new TextEncoder().encode(value);
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
  const signature = await crypto.subtle.sign("HMAC", key, textBytes(messageText));
  return hexFromBuffer(signature);
}

function firstFourBytes(hex) {
  return [0,2,4,6].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function bytesToFloat(bytes) {
  return bytes.reduce((result, value, index) =>
    result + value / Math.pow(256, index + 1), 0
  );
}

function cleanHex(value) {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.tab).classList.add("active");
  });
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
    result.textContent = "الهاش المتوقع يجب أن يكون 64 حرفًا بنظام hex.";
    return;
  }

  const calculated = await sha256Hex(seed);
  $("calculatedHash").textContent = calculated;

  if (calculated === expected) {
    result.className = "result good";
    result.textContent = "متطابق ✅ البذرة المكشوفة تطابق الالتزام المنشور سابقًا.";
  } else {
    result.className = "result bad";
    result.textContent = "غير متطابق ❌ راجع البذرة والهاش والمسافات.";
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
  const count = Math.min(100, Math.max(1, Number($("countNonce").value)));

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
      <td><code>${hmac.slice(0, 12)}…</code></td>
      <td>${value.toFixed(10)}</td>
    `;
    tbody.appendChild(tr);
  }
});

$("downloadCsv").addEventListener("click", () => {
  if (!lastSequence.length) {
    alert("أنشئ التسلسل أولًا.");
    return;
  }

  const rows = [
    ["Nonce", "HMAC_SHA256", "Educational_Float"],
    ...lastSequence.map(x => [x.nonce, x.hmac, x.value])
  ];

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crash-fairness-sequence.csv";
  a.click();
  URL.revokeObjectURL(url);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
