const SAR = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 2
});

const state = {
  sessions: JSON.parse(localStorage.getItem("cra_sessions") || "[]"),
  limits: JSON.parse(localStorage.getItem("cra_limits") || '{"bankroll":1000,"stopLoss":100,"timeLimit":60}')
};

const el = id => document.getElementById(id);

function saveState() {
  localStorage.setItem("cra_sessions", JSON.stringify(state.sessions));
  localStorage.setItem("cra_limits", JSON.stringify(state.limits));
}

function todayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0, 10);
}

function totals() {
  const deposits = state.sessions.reduce((s, x) => s + x.deposit, 0);
  const withdrawals = state.sessions.reduce((s, x) => s + x.withdrawal, 0);
  return { deposits, withdrawals, net: withdrawals - deposits };
}

function render() {
  const t = totals();
  el("totalDeposits").textContent = SAR.format(t.deposits);
  el("totalWithdrawals").textContent = SAR.format(t.withdrawals);
  el("netResult").textContent = SAR.format(t.net);
  el("netResult").className = t.net >= 0 ? "positive" : "negative";
  el("sessionsCount").textContent = state.sessions.length;

  const tbody = el("sessionsTable");
  tbody.innerHTML = "";
  state.sessions
    .slice()
    .reverse()
    .forEach(session => {
      const net = session.withdrawal - session.deposit;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${session.date}</td>
        <td>${SAR.format(session.deposit)}</td>
        <td>${SAR.format(session.withdrawal)}</td>
        <td class="${net >= 0 ? "positive" : "negative"}">${SAR.format(net)}</td>
        <td>${session.duration} دقيقة</td>
        <td>${escapeHtml(session.notes || "—")}</td>
        <td><button class="danger small" data-id="${session.id}">حذف</button></td>
      `;
      tbody.appendChild(tr);
    });

  el("emptyState").style.display = state.sessions.length ? "none" : "block";
  checkLimits();

  el("bankroll").value = state.limits.bankroll;
  el("stopLoss").value = state.limits.stopLoss;
  el("timeLimit").value = state.limits.timeLimit;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

function checkLimits() {
  const today = todayISO();
  const todays = state.sessions.filter(x => x.date === today);
  const dayDeposits = todays.reduce((s, x) => s + x.deposit, 0);
  const dayWithdrawals = todays.reduce((s, x) => s + x.withdrawal, 0);
  const dayLoss = Math.max(0, dayDeposits - dayWithdrawals);
  const dayTime = todays.reduce((s, x) => s + x.duration, 0);

  const alerts = [];
  if (dayLoss >= state.limits.stopLoss && state.limits.stopLoss > 0) {
    alerts.push(`تجاوزت حد الخسارة اليومي: ${SAR.format(dayLoss)}`);
  }
  if (dayTime >= state.limits.timeLimit && state.limits.timeLimit > 0) {
    alerts.push(`تجاوزت حد الوقت اليومي: ${dayTime} دقيقة`);
  }
  if (dayDeposits > state.limits.bankroll && state.limits.bankroll > 0) {
    alerts.push("إيداعات اليوم تجاوزت الميزانية المخصصة.");
  }

  const box = el("limitStatus");
  if (alerts.length) {
    box.className = "status danger";
    box.innerHTML = "<strong>توقف الآن:</strong><br>" + alerts.join("<br>");
  } else {
    box.className = "status ok";
    box.textContent = "لم يتم تجاوز الحدود المسجلة اليوم.";
  }
}

el("sessionDate").value = todayISO();

el("sessionForm").addEventListener("submit", e => {
  e.preventDefault();
  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    date: el("sessionDate").value,
    deposit: Number(el("deposit").value || 0),
    withdrawal: Number(el("withdrawal").value || 0),
    duration: Number(el("duration").value || 0),
    notes: el("notes").value.trim()
  };
  state.sessions.push(session);
  saveState();
  e.target.reset();
  el("sessionDate").value = todayISO();
  el("deposit").value = 0;
  el("withdrawal").value = 0;
  el("duration").value = 0;
  render();
});

el("sessionsTable").addEventListener("click", e => {
  if (!e.target.matches("button[data-id]")) return;
  state.sessions = state.sessions.filter(x => x.id !== e.target.dataset.id);
  saveState();
  render();
});

el("saveLimits").addEventListener("click", () => {
  state.limits = {
    bankroll: Number(el("bankroll").value || 0),
    stopLoss: Number(el("stopLoss").value || 0),
    timeLimit: Number(el("timeLimit").value || 0)
  };
  saveState();
  render();
});

el("calculateEV").addEventListener("click", () => {
  const bet = Number(el("betAmount").value || 0);
  const pWin = Number(el("winProbability").value || 0) / 100;
  const winProfit = Number(el("winProfit").value || 0);
  const pLose = 1 - pWin;
  const ev = (pWin * winProfit) - (pLose * bet);

  const message = ev >= 0
    ? `القيمة المتوقعة ${SAR.format(ev)} لكل محاولة. النتيجة موجبة حسابيًا بحسب الأرقام المدخلة، لكنها ليست ضمانًا للربح.`
    : `القيمة المتوقعة ${SAR.format(ev)} لكل محاولة. أي أن الخسارة المتوسطة المتوقعة هي ${SAR.format(Math.abs(ev))} لكل محاولة على المدى الطويل.`;

  el("evResult").textContent = message;
  el("evResult").className = `result-box ${ev >= 0 ? "positive" : "negative"}`;
});

el("checkRisk").addEventListener("click", () => {
  const checked = [...document.querySelectorAll("#scamChecklist input:checked")];
  const score = checked.reduce((s, x) => s + Number(x.value), 0);
  let text, cls;
  if (score >= 7) {
    text = "خطر مرتفع جدًا: لا ترسل أموالًا ولا وثائق، وحاول سحب رصيدك إن أمكن.";
    cls = "negative";
  } else if (score >= 4) {
    text = "خطر متوسط إلى مرتفع: تحقق من الترخيص وسياسة السحب قبل أي إيداع.";
    cls = "negative";
  } else {
    text = "المؤشرات المحددة قليلة، لكن هذا لا يثبت أن المنصة آمنة.";
    cls = "positive";
  }
  el("riskResult").textContent = `درجة الخطر ${score}/10 — ${text}`;
  el("riskResult").className = `result-box ${cls}`;
});

el("exportCsv").addEventListener("click", () => {
  if (!state.sessions.length) {
    alert("لا توجد بيانات للتصدير.");
    return;
  }
  const rows = [
    ["التاريخ", "الإيداع", "السحب", "الصافي", "المدة بالدقائق", "الملاحظات"],
    ...state.sessions.map(x => [
      x.date, x.deposit, x.withdrawal, x.withdrawal - x.deposit, x.duration, x.notes
    ])
  ];
  const csv = "\uFEFF" + rows.map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `casino-risk-sessions-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

el("resetAll").addEventListener("click", () => {
  const ok = confirm("هل أنت متأكد من مسح جميع الجلسات والحدود؟");
  if (!ok) return;
  localStorage.removeItem("cra_sessions");
  localStorage.removeItem("cra_limits");
  state.sessions = [];
  state.limits = { bankroll: 1000, stopLoss: 100, timeLimit: 60 };
  render();
});

render();
