document.addEventListener("DOMContentLoaded", () => {

  /* =============================================
     HELPERS
     ============================================= */

  const $ = id => document.getElementById(id);

  /* =============================================
     DOM REFS
     ============================================= */

  const els = {
    accountFilter:    $("accountFilter"),
    totalIncome:      $("totalIncome"),
    totalExpense:     $("totalExpense"),
    netBalance:       $("netBalance"),
    balanceHint:      $("balanceHint"),
    pendingCredit:    $("pendingCredit"),       // dashboard stat
    pendingCreditTab: $("pendingCreditTab"),    // credit tab stat
    totalCredit:      $("totalCredit"),
    receivedCredit:   $("receivedCredit"),
    transactionList:  $("transactionList"),
    txEmpty:          $("txEmpty"),
    recentList:       $("recentList"),
    recentEmpty:      $("recentEmpty"),
    creditList:       $("creditList"),
    creditEmpty:      $("creditEmpty"),
    exportBtn:        $("exportBtn"),
    viewAllBtn:       $("viewAllBtn"),
    themeToggle:      $("themeToggle"),
    toggleLabel:      $("toggleLabel"),
    transactionModal: $("transactionModal"),
    creditModal:      $("creditModal"),
    transactionForm:  $("transactionForm"),
    creditForm:       $("creditForm"),
    toastContainer:   $("toastContainer"),
    confirmOverlay:   $("confirmOverlay"),
    confirmMsg:       $("confirmMsg"),
    confirmOk:        $("confirmOk"),
    confirmCancel:    $("confirmCancel"),
  };

  /* =============================================
     STATE
     ============================================= */

  let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
  let credits      = JSON.parse(localStorage.getItem("credits"))      || [];
  let activeFilter = "All";

  /* =============================================
     PERSISTENCE
     ============================================= */

  const save = () => {
    localStorage.setItem("transactions", JSON.stringify(transactions));
    localStorage.setItem("credits",      JSON.stringify(credits));
  };

  /* =============================================
     FORMATTING
     ============================================= */

  const formatINR = n =>
    "₹\u202f" + Math.abs(n).toLocaleString("en-IN");

  const today = () =>
    new Date().toISOString().split("T")[0];

  const formatDate = str => {
    if (!str) return "";
    const d = new Date(str + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  /* =============================================
     ANIMATED COUNTER
     ============================================= */

  const timers = new WeakMap();

  function animateTo(el, target, duration = 400) {
    if (timers.has(el)) clearInterval(timers.get(el));
    const start = parseFloat(el.dataset.cur || 0) || 0;
    const steps = Math.ceil(duration / 16);
    const inc   = (target - start) / steps;
    let cur = start, count = 0;

    const t = setInterval(() => {
      count++;
      cur += inc;
      if (count >= steps) { cur = target; clearInterval(t); timers.delete(el); }
      el.dataset.cur = cur;
      el.textContent = formatINR(Math.round(cur));
    }, 16);

    timers.set(el, t);
  }

  /* =============================================
     TOAST
     ============================================= */

  function toast(msg, type = "success") {
    const icons = { success: "✓", error: "✕", info: "i" };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    els.toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add("hide");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, 3000);
  }

  /* =============================================
     CONFIRM DIALOG
     ============================================= */

  function confirm(msg) {
    return new Promise(resolve => {
      els.confirmMsg.textContent = msg;
      els.confirmOverlay.classList.add("open");
      const close = result => {
        els.confirmOverlay.classList.remove("open");
        els.confirmOk.removeEventListener("click", onOk);
        els.confirmCancel.removeEventListener("click", onCancel);
        resolve(result);
      };
      const onOk     = () => close(true);
      const onCancel = () => close(false);
      els.confirmOk.addEventListener("click",     onOk,     { once: true });
      els.confirmCancel.addEventListener("click", onCancel, { once: true });
    });
  }

  /* =============================================
     THEME
     ============================================= */

  function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    els.toggleLabel.textContent = dark ? "Dark" : "Light";
  }

  function initTheme() {
    const saved = localStorage.getItem("theme");
    const sys   = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved ? saved === "dark" : sys);
  }

  els.themeToggle.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
    els.toggleLabel.textContent = dark ? "Dark" : "Light";
  });

  initTheme();

  /* =============================================
     TABS
     ============================================= */

  const tabBtns     = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  function activateTab(name) {
    tabBtns.forEach(b => {
      b.classList.toggle("active", b.dataset.tab === name);
      b.setAttribute("aria-selected", b.dataset.tab === name);
    });
    tabContents.forEach(c => c.classList.toggle("active", c.id === name));
  }

  tabBtns.forEach(btn =>
    btn.addEventListener("click", () => activateTab(btn.dataset.tab))
  );

  // "View all" button on dashboard → go to Transactions tab
  els.viewAllBtn.addEventListener("click", () => activateTab("transactions"));

  /* =============================================
     FILTER
     ============================================= */

  els.accountFilter.addEventListener("change", () => {
    activeFilter = els.accountFilter.value;
    renderAll();
  });

  const filtered = arr =>
    activeFilter === "All" ? arr : arr.filter(i => i.account === activeFilter);

  /* =============================================
     ENTRY BADGE HELPERS
     ============================================= */

  const INCOME_TYPES = ["Income", "Sale"];

  const isIncome  = t => INCOME_TYPES.includes(t.type);
  const badgeClass = t => isIncome(t) ? "badge-income" : "badge-expense";
  const amtClass   = t => isIncome(t) ? "amount-income" : "amount-expense";
  const prefix     = t => isIncome(t) ? "+" : "−";

  const INITIALS = { Income: "In", Expense: "Ex", Purchase: "Pu", Sale: "Sa" };
  const initial  = t => INITIALS[t.type] || t.type[0];

  /* =============================================
     RENDER DASHBOARD
     ============================================= */

  function renderDashboard() {
    let income = 0, expense = 0, pending = 0, given = 0, received = 0;

    filtered(transactions).forEach(t => {
      isIncome(t) ? (income += t.amount) : (expense += t.amount);
    });

    filtered(credits).forEach(c => {
      given += c.amount;
      c.status === "Pending" ? (pending += c.amount) : (received += c.amount);
    });

    const net = income - expense;

    animateTo(els.totalIncome,   income);
    animateTo(els.totalExpense,  expense);
    animateTo(els.pendingCredit, pending);

    // Net balance — override text after animation for sign
    animateTo(els.netBalance, Math.abs(net));
    setTimeout(() => {
      els.netBalance.textContent = (net < 0 ? "−\u202f" : "") + formatINR(net);
      els.netBalance.className = "balance-amount" +
        (net > 0 ? " positive" : net < 0 ? " negative" : "");
      els.balanceHint.textContent = net > 0 ? "Healthy balance ↑" :
                                    net < 0 ? "Expenses exceed income" : "Break even";
    }, 420);

    // Recent: last 5 transactions
    const recent = [...filtered(transactions)].reverse().slice(0, 5);
    renderEntryList(els.recentList, recent, transactions, "tx", true);
    els.recentEmpty.hidden = recent.length > 0;
  }

  /* =============================================
     RENDER ENTRY LIST (shared for tx & recent)
     ============================================= */

  function renderEntryList(listEl, items, sourceArr, type, readonly = false) {
    listEl.innerHTML = "";

    items.forEach(item => {
      const realIdx = sourceArr.indexOf(item);
      const li = document.createElement("li");
      li.className = "entry-item";

      li.innerHTML = `
        <div class="entry-left">
          <div class="entry-badge ${badgeClass(item)}">${initial(item)}</div>
          <div class="entry-info">
            <div class="entry-title">${item.type}${item.notes ? " · " + item.notes : ""}</div>
            <div class="entry-sub">
              <span>${item.account}</span><span>·</span><span>${formatDate(item.date)}</span>
            </div>
          </div>
        </div>
        <div class="entry-right">
          <span class="entry-amount ${amtClass(item)}">
            ${prefix(item)} ${formatINR(item.amount)}
          </span>
          ${readonly ? "" : `<button class="btn-icon btn-delete js-del-tx" data-index="${realIdx}" aria-label="Delete">✕</button>`}
        </div>
      `;

      listEl.appendChild(li);
    });
  }

  /* =============================================
     RENDER TRANSACTIONS TAB
     ============================================= */

  function renderTransactions() {
    const items = filtered(transactions);
    renderEntryList(els.transactionList, items, transactions, "tx", false);
    els.txEmpty.hidden = items.length > 0;
  }

  /* =============================================
     RENDER CREDITS TAB
     ============================================= */

  function renderCredits() {
    els.creditList.innerHTML = "";

    let given = 0, pending = 0, received = 0;
    const items = filtered(credits);

    items.forEach(cr => {
      const realIdx = credits.indexOf(cr);
      given    += cr.amount;
      cr.status === "Pending" ? (pending += cr.amount) : (received += cr.amount);

      const li = document.createElement("li");
      li.className = "entry-item";

      li.innerHTML = `
        <div class="entry-left">
          <div class="entry-badge badge-credit">Cr</div>
          <div class="entry-info">
            <div class="entry-title">${cr.customer}${cr.notes ? " · " + cr.notes : ""}</div>
            <div class="entry-sub">
              <span>${cr.account}</span><span>·</span><span>${formatDate(cr.date)}</span>
              <span class="status-badge ${cr.status === "Pending" ? "status-pending" : "status-paid"}">${cr.status}</span>
            </div>
          </div>
        </div>
        <div class="entry-right">
          <span class="entry-amount amount-neutral">${formatINR(cr.amount)}</span>
          ${cr.status === "Pending"
            ? `<button class="btn-icon btn-paid js-mark-paid" data-index="${realIdx}" aria-label="Mark paid">Paid</button>`
            : ""}
          <button class="btn-icon btn-delete js-del-credit" data-index="${realIdx}" aria-label="Delete">✕</button>
        </div>
      `;

      els.creditList.appendChild(li);
    });

    animateTo(els.totalCredit,      given);
    animateTo(els.pendingCreditTab, pending);
    animateTo(els.receivedCredit,   received);

    els.creditEmpty.hidden = items.length > 0;
  }

  /* =============================================
     RENDER ALL
     ============================================= */

  function renderAll() {
    renderDashboard();
    renderTransactions();
    renderCredits();
  }

  /* =============================================
     FORM VALIDATION
     ============================================= */

  function clearErrors(ids) {
    ids.forEach(id => {
      const err = $(id + "Err"), inp = $(id);
      if (err) err.textContent = "";
      if (inp) inp.classList.remove("error");
    });
  }

  function setError(id, msg) {
    const err = $(id + "Err"), inp = $(id);
    if (err) err.textContent = msg;
    if (inp) inp.classList.add("error");
    return false;
  }

  function validate(rules) {
    let ok = true;
    rules.forEach(([id, cond, msg]) => { if (!cond) ok = setError(id, msg); });
    return ok;
  }

  /* =============================================
     ADD TRANSACTION
     ============================================= */

  els.transactionForm.addEventListener("submit", e => {
    e.preventDefault();
    clearErrors(["account", "type", "amount", "date"]);

    const account = $("account").value;
    const type    = $("type").value;
    const amount  = parseFloat($("amount").value);
    const date    = $("date").value;
    const notes   = $("notes").value.trim();

    if (!validate([
      ["account", account,    "Select an account."],
      ["type",    type,       "Select a type."],
      ["amount",  amount > 0, "Enter a valid amount."],
      ["date",    date,       "Select a date."],
    ])) return;

    transactions.push({ account, type, amount, date, notes });
    save();
    renderAll();

    els.transactionForm.reset();
    $("date").value = today();
    closeModal(els.transactionModal);
    toast("Transaction added.");
  });

  /* =============================================
     ADD CREDIT
     ============================================= */

  els.creditForm.addEventListener("submit", e => {
    e.preventDefault();
    clearErrors(["creditAccount", "customerName", "creditAmount", "creditDate"]);

    const account  = $("creditAccount").value;
    const customer = $("customerName").value.trim();
    const amount   = parseFloat($("creditAmount").value);
    const date     = $("creditDate").value;
    const notes    = $("creditNotes").value.trim();

    if (!validate([
      ["creditAccount",  account,    "Select an account."],
      ["customerName",   customer,   "Enter customer name."],
      ["creditAmount",   amount > 0, "Enter a valid amount."],
      ["creditDate",     date,       "Select a date."],
    ])) return;

    credits.push({ account, customer, amount, date, notes, status: "Pending" });
    save();
    renderAll();

    els.creditForm.reset();
    $("creditDate").value = today();
    closeModal(els.creditModal);
    toast("Credit entry added.");
  });

  /* =============================================
     EVENT DELEGATION — DELETE & MARK PAID
     ============================================= */

  document.addEventListener("click", async e => {
    if (e.target.classList.contains("js-del-tx")) {
      const idx = +e.target.dataset.index;
      if (!await confirm("Delete this transaction?")) return;
      transactions.splice(idx, 1);
      save(); renderAll();
      toast("Deleted.", "info");
    }

    if (e.target.classList.contains("js-del-credit")) {
      const idx = +e.target.dataset.index;
      if (!await confirm("Delete this credit entry?")) return;
      credits.splice(idx, 1);
      save(); renderAll();
      toast("Deleted.", "info");
    }

    if (e.target.classList.contains("js-mark-paid")) {
      const idx = +e.target.dataset.index;
      const cr  = credits[idx];
      cr.status = "Paid";
      transactions.push({
        account: cr.account,
        type:    "Income",
        amount:  cr.amount,
        date:    today(),
        notes:   `Credit received from ${cr.customer}`,
      });
      save(); renderAll();
      toast(`₹${cr.amount.toLocaleString("en-IN")} received from ${cr.customer}.`);
    }
  });

  /* =============================================
     EXPORT CSV
     ============================================= */

  els.exportBtn.addEventListener("click", () => {
    const data = filtered(transactions);
    if (!data.length) { toast("No transactions to export.", "error"); return; }

    const rows = [
      ["Account", "Date", "Type", "Amount", "Notes"],
      ...data.map(t => [t.account, t.date, t.type, t.amount, `"${(t.notes || "").replace(/"/g, '""')}"`]),
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: `digica-${today()}.csv`
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`${data.length} transaction${data.length > 1 ? "s" : ""} exported.`);
  });

  /* =============================================
     MODAL HELPERS
     ============================================= */

  // Inject close animation keyframe once
  const s = document.createElement("style");
  s.textContent = `@keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }`;
  document.head.appendChild(s);

  function openModal(modal) {
    modal.classList.add("open");
    modal.style.display = "flex";
    setTimeout(() => { const f = modal.querySelector("select, input"); if (f) f.focus(); }, 80);
  }

  function closeModal(modal) {
    const mc = modal.querySelector(".modal-content");
    mc.style.animation = "slideDown 0.2s cubic-bezier(0.32, 0.72, 0, 1) both";
    setTimeout(() => {
      modal.style.display = "none";
      modal.classList.remove("open");
      mc.style.animation = "";
    }, 190);
  }

  $("openTransactionBtn").addEventListener("click", () => openModal(els.transactionModal));
  $("openCreditBtn")     .addEventListener("click", () => openModal(els.creditModal));

  $("closeTransactionBtn") .addEventListener("click", () => closeModal(els.transactionModal));
  $("closeTransactionBtn2").addEventListener("click", () => closeModal(els.transactionModal));
  $("closeCreditBtn")      .addEventListener("click", () => closeModal(els.creditModal));
  $("closeCreditBtn2")     .addEventListener("click", () => closeModal(els.creditModal));

  [els.transactionModal, els.creditModal].forEach(m =>
    m.addEventListener("click", e => { if (e.target === m) closeModal(m); })
  );

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (els.transactionModal.classList.contains("open")) closeModal(els.transactionModal);
    if (els.creditModal.classList.contains("open"))      closeModal(els.creditModal);
  });

  /* =============================================
     INIT
     ============================================= */

  $("date").value       = today();
  $("creditDate").value = today();

  renderAll();
});