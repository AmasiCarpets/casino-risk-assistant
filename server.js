const express = require("express");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let currentServerSeed = randomSeed();
let currentServerSeedHash = sha256(currentServerSeed);
let nonce = 0;

function randomSeed() {
  return crypto.randomBytes(32).toString("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmacHex(serverSeed, clientSeed, nonceValue) {
  const message = `${clientSeed}:${nonceValue}`;
  return crypto.createHmac("sha256", serverSeed).update(message).digest("hex");
}

// يحوّل أول 52 بت إلى رقم بين 0 و1، ثم إلى مضاعف Limbo.
// House edge هنا 1%: chance ≈ 99 / target.
function multiplierFromHmac(hmac) {
  const first13 = hmac.slice(0, 13); // 52 bits
  const intValue = parseInt(first13, 16);
  const max52 = 2 ** 52;
  const r = intValue / max52;

  // floor((0.99 / (1-r)) * 100) / 100
  const raw = Math.floor((0.99 / Math.max(1e-15, 1 - r)) * 100) / 100;
  return Math.max(1.00, Math.min(raw, 1000000));
}

function calculate(serverSeed, clientSeed, nonceValue) {
  const hmac = hmacHex(serverSeed, clientSeed, nonceValue);
  const multiplier = multiplierFromHmac(hmac);
  return { nonce: nonceValue, hmac, multiplier };
}

app.get("/api/state", (req, res) => {
  res.json({
    serverSeedHash: currentServerSeedHash,
    nonce,
  });
});

app.post("/api/batch", (req, res) => {
  const clientSeed = String(req.body.clientSeed || "").trim();
  const requestedCount = Number(req.body.count || 10000);
  const count = Math.max(1, Math.min(10000, Math.floor(requestedCount)));

  if (!clientSeed || clientSeed.length > 200) {
    return res.status(400).json({ error: "Client Seed غير صالح" });
  }

  const startNonce = nonce;
  const results = new Array(count);

  for (let i = 0; i < count; i++) {
    results[i] = calculate(currentServerSeed, clientSeed, startNonce + i);
  }

  nonce += count;

  res.json({
    serverSeedHash: currentServerSeedHash,
    startNonce,
    nextNonce: nonce,
    results,
  });
});

app.post("/api/rotate", (req, res) => {
  const revealedServerSeed = currentServerSeed;
  const revealedServerSeedHash = currentServerSeedHash;

  currentServerSeed = randomSeed();
  currentServerSeedHash = sha256(currentServerSeed);
  nonce = 0;

  res.json({
    revealedServerSeed,
    revealedServerSeedHash,
    newServerSeedHash: currentServerSeedHash,
  });
});

app.post("/api/verify", (req, res) => {
  const serverSeed = String(req.body.serverSeed || "").trim();
  const clientSeed = String(req.body.clientSeed || "").trim();
  const nonceValue = Number(req.body.nonce);

  if (!serverSeed || !clientSeed || !Number.isInteger(nonceValue) || nonceValue < 0) {
    return res.status(400).json({ error: "بيانات التحقق غير صحيحة" });
  }

  const result = calculate(serverSeed, clientSeed, nonceValue);
  res.json({
    serverSeedHash: sha256(serverSeed),
    ...result,
  });
});

app.listen(PORT, () => {
  console.log(`Limbo Provably Fair running on http://localhost:${PORT}`);
});
