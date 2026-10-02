(function () {
  "use strict";

  const loginScreen = document.getElementById("admin-login");
  const loginForm = document.getElementById("admin-login-form");
  const loginError = document.getElementById("admin-login-error");
  const loginNote = document.getElementById("admin-login-note");
  const app = document.getElementById("admin-app");
  const logoutBtn = document.getElementById("admin-logout");
  const tabs = document.querySelectorAll(".admin-tab");

  const panels = {
    stats: document.getElementById("admin-panel-stats"),
    orders: document.getElementById("admin-panel-orders"),
    returns: document.getElementById("admin-panel-returns"),
    customers: document.getElementById("admin-panel-customers"),
    messages: document.getElementById("admin-panel-messages"),
    products: document.getElementById("admin-panel-products"),
    waitlist: document.getElementById("admin-panel-waitlist"),
  };

  const loaded = {};

  function formatCents(cents) {
    return `${(Number(cents) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  function formatEuros(value) {
    return `${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function errorMessage(err) {
    if (err === "db_not_configured") {
      return "La base de données n'est pas encore configurée sur ce déploiement (variable POSTGRES_URL manquante dans Vercel).";
    }
    if (err === "staff_not_configured") {
      return "Aucun mot de passe staff n'est configuré (variable STAFF_PASSWORD manquante dans Vercel).";
    }
    return "Une erreur est survenue. Réessayez dans un instant.";
  }

  // ---- Auth ----

  async function checkSession() {
    try {
      const resp = await fetch("/api/staff/me");
      const data = await resp.json();
      if (data.configured === false) {
        loginNote.textContent =
          "Configuration incomplète : POSTGRES_URL et/ou STAFF_PASSWORD manquants côté Vercel.";
      }
      if (data.authenticated) {
        showApp();
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.hidden = false;
    app.hidden = true;
  }

  function showApp() {
    loginScreen.hidden = true;
    app.hidden = false;
    const { tab, filter } = tabFromHash();
    activateTab(tab, { filter, scrollTop: false });
    refreshTabCounts();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = loginForm.querySelector('[name="password"]').value;
    const btn = loginForm.querySelector("button");
    btn.disabled = true;
    try {
      const resp = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        loginForm.reset();
        showApp();
      } else {
        loginError.textContent =
          data.error === "invalid_password" ? "Mot de passe incorrect." : errorMessage(data.error);
        loginError.hidden = false;
      }
    } catch (err) {
      loginError.textContent = "Connexion impossible. Réessayez.";
      loginError.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/staff/logout", { method: "POST" });
    } catch (err) {}
    Object.keys(loaded).forEach((k) => delete loaded[k]);
    showLogin();
  });

  // ---- Tabs ----

  const TAB_TITLES = {
    stats: "Tableau de bord", orders: "Commandes", returns: "Retours", customers: "Clients",
    messages: "Messages", products: "Produits", waitlist: "Liste d'attente",
  };

  function activateTab(name, options) {
    if (!panels[name]) name = "stats";
    const opts = options || {};
    if (name === "orders" && opts.filter) setOrderFilter(opts.filter);
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
      if (on && t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "center" });
    });
    Object.keys(panels).forEach((k) => panels[k].classList.toggle("active", k === name));
    document.title = `${TAB_TITLES[name]} — Espace Staff Ælen Paris`;
    // Adresse partageable / bouton Retour : #orders, #orders/preorder…
    const hash = name === "orders" && ordersState.filter !== "all" ? `#orders/${ordersState.filter}` : `#${name}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    if (!loaded[name]) {
      loaded[name] = true;
      loadTab(name);
    }
    if (opts.scrollTop !== false) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  tabs.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  // Tuiles cliquables du tableau de bord : « Commandes » ouvre la liste des commandes, etc.
  document.addEventListener("click", (ev) => {
    const link = ev.target.closest("[data-goto]");
    if (link) activateTab(link.dataset.goto, { filter: link.dataset.filter });
  });

  function tabFromHash() {
    const [tab, filter] = location.hash.replace(/^#/, "").split("/");
    return { tab: panels[tab] ? tab : "stats", filter };
  }
  window.addEventListener("hashchange", () => {
    if (app.hidden) return;
    const { tab, filter } = tabFromHash();
    activateTab(tab, { filter, scrollTop: false });
  });

  function loadTab(name) {
    if (name === "stats") return loadStats();
    if (name === "orders") return loadOrders();
    if (name === "returns") return loadReturns();
    if (name === "customers") return loadCustomers();
    if (name === "messages") return loadMessages();
    if (name === "products") return loadProducts();
    if (name === "waitlist") return loadWaitlist();
  }

  // ---- Utilitaires UI ----

  function csvCell(value) {
    const v = value == null ? "" : String(value);
    return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  function downloadCsv(filename, header, lines) {
    const csv = "﻿" + [header, ...lines].map((r) => r.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const toastsEl = document.getElementById("admin-toasts");
  function toast(message, kind) {
    if (!toastsEl) return;
    const el = document.createElement("div");
    el.className = `admin-toast${kind === "error" ? " is-error" : ""}`;
    el.textContent = message;
    toastsEl.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    setTimeout(() => {
      el.classList.remove("is-in");
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  // Compteurs sur les onglets (à traiter), mis à jour toutes les minutes.
  const TAB_COUNT_KEYS = { orders: "toShip", returns: "openReturns", messages: "unreadMessages" };
  function applyTabCounts(stats) {
    tabs.forEach((tab) => {
      const key = TAB_COUNT_KEYS[tab.dataset.tab];
      if (!key) return;
      let badge = tab.querySelector(".admin-tab-count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "admin-tab-count";
        tab.appendChild(badge);
      }
      const n = Number(stats[key]) || 0;
      badge.textContent = n > 99 ? "99+" : String(n);
      badge.hidden = n === 0;
    });
  }
  async function refreshTabCounts() {
    try {
      const resp = await fetch("/api/staff/stats");
      if (resp.ok) applyTabCounts(await resp.json());
    } catch (err) {}
  }
  setInterval(() => {
    if (!app.hidden && !document.hidden) refreshTabCounts();
  }, 60000);

  // ---- Tableau de bord ----

  async function loadStats() {
    const panel = panels.stats;
    panel.innerHTML = `<h2>Tableau de bord</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/stats");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Tableau de bord</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }
      applyTabCounts(data);
      const topRows = data.topProducts
        .map((p) => `<tr><td>${escapeHtml(p.productName)}</td><td>${p.totalQty}</td></tr>`)
        .join("");
      const todo = (n, label, tab, filter, doneText) => `
        <button type="button" class="admin-todo-card${n ? " has-items" : ""}" data-goto="${tab}" ${filter ? `data-filter="${filter}"` : ""}>
          <span class="admin-todo-count">${n}</span>
          <span class="admin-todo-label">${label}</span>
          <span class="admin-todo-hint">${n ? "Voir la liste →" : doneText}</span>
        </button>`;
      panel.innerHTML = `
        <h2>Tableau de bord</h2>
        <div class="admin-kpis">
          <button type="button" class="admin-kpi is-link" data-goto="orders" data-filter="all">
            <div class="admin-kpi-label">Commandes</div>
            <div class="admin-kpi-value">${data.orderCount}</div>
            <div class="admin-kpi-sub">Voir toutes les commandes →</div>
          </button>
          <button type="button" class="admin-kpi is-link" data-goto="orders" data-filter="preorder">
            <div class="admin-kpi-label">Précommandes</div>
            <div class="admin-kpi-value">${data.preorderCount}</div>
            <div class="admin-kpi-sub">${formatCents(data.preorderTotal)} précommandés →</div>
          </button>
          <div class="admin-kpi">
            <div class="admin-kpi-label">Chiffre d'affaires</div>
            <div class="admin-kpi-value">${formatCents(data.revenue)}</div>
            <div class="admin-kpi-sub">Hors tests et annulées</div>
          </div>
          <div class="admin-kpi">
            <div class="admin-kpi-label">Panier moyen</div>
            <div class="admin-kpi-value">${formatCents(data.avgOrderValue)}</div>
            <div class="admin-kpi-sub">${data.ordersLast30Days} commande${data.ordersLast30Days > 1 ? "s" : ""} sur 30 jours</div>
          </div>
        </div>
        <p class="admin-subhead">À traiter</p>
        <div class="admin-todo">
          ${todo(data.toShip, "Commandes à expédier", "orders", "todo", "Tout est expédié ✓")}
          ${todo(data.unreadMessages, "Messages non lus", "messages", "", "Aucun message en attente ✓")}
          ${todo(data.openReturns, "Retours en cours", "returns", "", "Aucun retour en cours ✓")}
        </div>
        <p class="admin-subhead">Produits les plus vendus</p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Produit</th><th>Quantité vendue</th></tr></thead>
            <tbody>${topRows || '<tr><td colspan="2" class="admin-empty">Aucune vente pour l\'instant.</td></tr>'}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      panel.innerHTML = `<h2>Tableau de bord</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  // ---- Commandes (payées + précommandes) ----

  const STATUS_LABELS = {
    preorder: "Précommande",
    paid: "Payée",
    unpaid: "Non payée",
    processing: "En préparation",
    shipped: "Expédiée",
    delivered: "Livrée",
    cancelled: "Annulée",
  };
  const ORDER_STATUS_CHOICES = ["paid", "unpaid", "processing", "shipped", "delivered", "cancelled"];

  const ORDER_FILTERS = [
    { id: "all", label: "Toutes", test: () => true },
    { id: "preorder", label: "Précommandes", test: (e) => e.kind === "preorder" },
    { id: "todo", label: "À traiter", test: (e) => e.kind === "order" && (e.status === "paid" || e.status === "processing") },
    { id: "shipped", label: "Expédiées", test: (e) => e.kind === "order" && (e.status === "shipped" || e.status === "delivered") },
    { id: "cancelled", label: "Annulées", test: (e) => e.kind === "order" && (e.status === "cancelled" || e.status === "unpaid") },
  ];

  const ordersState = { filter: "all", query: "", entries: [] };

  const TEST_ORDER_HINT = "Crée une commande factice (aucun paiement réel) pour tester le suivi et les retours.";

  function normalizeOrders(orders, preorders) {
    const fromOrders = orders.map((o) => ({
      kind: "order",
      id: o.id,
      number: `N° ${o.id}`,
      createdAt: o.createdAt,
      email: o.customerEmail,
      name: o.customerName || "",
      phone: o.customerPhone || "",
      items: o.items.map((it) => ({ qty: it.qty, name: it.product_name, size: it.size })),
      total: o.amountTotal,
      status: o.status || "paid",
      isTest: typeof o.stripeSessionId === "string" && o.stripeSessionId.indexOf("test_") === 0,
      trackingCarrier: o.trackingCarrier || "",
      trackingNumber: o.trackingNumber || "",
    }));
    const fromPreorders = preorders.map((p) => ({
      kind: "preorder",
      id: p.id,
      number: `Pré-${p.id}`,
      createdAt: p.createdAt,
      email: p.email,
      name: "",
      phone: p.phone || "",
      items: p.cart.map((it) => ({ qty: it.qty, name: it.productName, size: it.size })),
      total: p.total,
      status: "preorder",
      isTest: false,
    }));
    return [...fromOrders, ...fromPreorders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function entryMatches(entry, query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [entry.number, entry.email, entry.name, entry.phone, STATUS_LABELS[entry.status], ...entry.items.map((i) => i.name)]
      .join(" ")
      .toLowerCase();
    const digits = q.replace(/\D/g, "");
    return hay.includes(q) || (digits.length >= 3 && entry.phone.replace(/\D/g, "").includes(digits));
  }

  function orderCardHtml(e) {
    const itemsHtml = e.items
      .map((it) => `<li>${it.qty} × ${escapeHtml(it.name)}${it.size ? ` <span class="oc-size">${escapeHtml(it.size)}</span>` : ""}</li>`)
      .join("");
    const tel = e.phone ? e.phone.replace(/[^+\d]/g, "") : "";
    const customer = [
      e.name ? `<div class="oc-name">${escapeHtml(e.name)}</div>` : "",
      `<div><a href="mailto:${escapeHtml(e.email)}">${escapeHtml(e.email)}</a></div>`,
      e.phone ? `<div><a href="tel:${escapeHtml(tel)}">${escapeHtml(e.phone)}</a></div>` : `<div class="admin-muted-text">Téléphone non renseigné</div>`,
    ].join("");

    let manage;
    if (e.kind === "preorder") {
      manage = `
        <p class="admin-hint">Précommande sans paiement : recontactez le client pour finaliser le règlement et la livraison.</p>
        <div class="oc-actions">
          ${e.phone ? `<a class="admin-btn-small is-primary" href="tel:${escapeHtml(tel)}">Appeler</a>` : ""}
          <a class="admin-btn-small${e.phone ? "" : " is-primary"}" href="mailto:${escapeHtml(e.email)}?subject=${encodeURIComponent("Votre précommande Ælen Paris")}">Écrire un e-mail</a>
        </div>`;
    } else {
      manage = `
        <form class="admin-inline-form admin-order-form">
          <select name="status" aria-label="Statut">
            ${ORDER_STATUS_CHOICES.map((s) => `<option value="${s}" ${s === e.status ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}
          </select>
          <input type="text" name="trackingCarrier" placeholder="Transporteur" value="${escapeHtml(e.trackingCarrier)}" />
          <input type="text" name="trackingNumber" placeholder="N° de suivi" value="${escapeHtml(e.trackingNumber)}" />
          <button type="submit" class="admin-btn-small is-primary">Enregistrer</button>
        </form>
        <div class="oc-actions">
          <a class="admin-btn-small" href="/api/staff/invoice?orderId=${e.id}" target="_blank" rel="noopener">Facture (PDF)</a>
          <button type="button" class="admin-btn-small admin-toggle-return">+ Retour</button>
        </div>
        <form class="admin-inline-form admin-return-form" hidden>
          <input type="text" name="reason" placeholder="Motif (optionnel)" />
          <input type="number" step="0.01" min="0" name="refundAmount" placeholder="Montant € (défaut : total)" />
          <button type="submit" class="admin-btn-small is-primary">Créer le retour</button>
        </form>`;
    }

    return `
      <article class="order-card" data-kind="${e.kind}" data-id="${e.id}">
        <div class="oc-head">
          <div class="oc-id">
            <strong>${e.number}</strong>
            <span class="admin-badge status-${e.status}">${STATUS_LABELS[e.status] || e.status}</span>
            ${e.isTest ? `<span class="admin-badge admin-badge-test">Test</span>` : ""}
          </div>
          <div class="oc-total">${formatCents(e.total)}</div>
          <div class="oc-date">${formatDate(e.createdAt)}</div>
        </div>
        <div class="oc-body">
          <div class="oc-customer">${customer}</div>
          <ul class="oc-items">${itemsHtml}</ul>
        </div>
        <details class="oc-manage">
          <summary>${e.kind === "preorder" ? "Contacter le client" : "Gérer la commande"}</summary>
          <div class="oc-manage-body">${manage}</div>
        </details>
      </article>`;
  }

  function renderOrderList() {
    const panel = panels.orders;
    const list = panel.querySelector("#admin-order-list");
    if (!list) return;
    const active = ORDER_FILTERS.find((f) => f.id === ordersState.filter) || ORDER_FILTERS[0];
    const rows = ordersState.entries.filter((e) => active.test(e) && entryMatches(e, ordersState.query));
    list.innerHTML = rows.length
      ? rows.map(orderCardHtml).join("")
      : `<div class="admin-empty-state">
           <p class="admin-empty-title">${ordersState.entries.length ? "Aucun résultat" : "Aucune commande pour l'instant"}</p>
           <p>${ordersState.entries.length ? "Essayez un autre filtre ou une autre recherche." : "Les commandes et précommandes de vos clients apparaîtront ici dès leur validation."}</p>
         </div>`;
    panel.querySelector("#admin-order-count").textContent =
      `${rows.length} résultat${rows.length > 1 ? "s" : ""}`;
    panel.querySelectorAll(".admin-chip").forEach((chip) => {
      const f = ORDER_FILTERS.find((x) => x.id === chip.dataset.filter);
      chip.classList.toggle("is-active", chip.dataset.filter === active.id);
      chip.setAttribute("aria-pressed", String(chip.dataset.filter === active.id));
      chip.querySelector(".admin-chip-count").textContent = String(ordersState.entries.filter(f.test).length);
    });
  }

  function setOrderFilter(id) {
    ordersState.filter = ORDER_FILTERS.some((f) => f.id === id) ? id : "all";
    if (loaded.orders && panels.orders.querySelector("#admin-order-list")) renderOrderList();
  }

  async function createTestOrder(btn) {
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Création…";
    try {
      const resp = await fetch("/api/staff/test-order", { method: "POST" });
      if (resp.ok) {
        toast("Commande de test créée");
        await loadOrders();
        return;
      }
      toast("Impossible de créer la commande de test", "error");
    } catch (err) {
      toast("Erreur réseau, réessayez", "error");
    }
    btn.disabled = false;
    btn.textContent = label;
  }

  async function loadOrders() {
    const panel = panels.orders;
    panel.innerHTML = `<h2>Commandes</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const [ordersResp, preordersResp] = await Promise.all([fetch("/api/staff/orders"), fetch("/api/staff/preorders")]);
      const ordersData = await ordersResp.json();
      if (!ordersResp.ok) {
        panel.innerHTML = `<h2>Commandes</h2><p class="admin-empty">${errorMessage(ordersData.error)}</p>`;
        return;
      }
      // Les précommandes sont un plus : si leur chargement échoue, la liste des commandes reste utilisable.
      let preorders = [];
      try {
        if (preordersResp.ok) preorders = (await preordersResp.json()).preorders || [];
      } catch (err) {}
      ordersState.entries = normalizeOrders(ordersData.orders || [], preorders);

      panel.innerHTML = `
        <div class="admin-panel-head">
          <h2>Commandes</h2>
          <div class="admin-panel-head-actions">
            <button type="button" class="admin-btn-small" id="admin-orders-refresh">Actualiser</button>
            <button type="button" class="admin-btn-small" id="admin-orders-export">Exporter (CSV)</button>
            <button type="button" class="admin-btn-small" id="admin-create-test-order" title="${TEST_ORDER_HINT}">+ Commande de test</button>
          </div>
        </div>
        <div class="admin-toolbar">
          <input type="search" id="admin-order-search" class="admin-search" placeholder="Rechercher : e-mail, téléphone, article, n°…" aria-label="Rechercher une commande" value="${escapeHtml(ordersState.query)}" />
          <span class="admin-toolbar-count" id="admin-order-count"></span>
        </div>
        <div class="admin-chips" role="group" aria-label="Filtrer les commandes">
          ${ORDER_FILTERS.map((f) => `<button type="button" class="admin-chip" data-filter="${f.id}">${f.label} <span class="admin-chip-count">0</span></button>`).join("")}
        </div>
        <div id="admin-order-list" class="order-list"></div>
      `;
      renderOrderList();

      panel.querySelector("#admin-order-search").addEventListener("input", (ev) => {
        ordersState.query = ev.target.value;
        renderOrderList();
      });
      panel.querySelector(".admin-chips").addEventListener("click", (ev) => {
        const chip = ev.target.closest(".admin-chip");
        if (chip) setOrderFilter(chip.dataset.filter);
      });
      panel.querySelector("#admin-orders-refresh").addEventListener("click", () => {
        refreshTabCounts();
        loadOrders();
      });
      panel.querySelector("#admin-create-test-order").addEventListener("click", (ev) => createTestOrder(ev.currentTarget));
      panel.querySelector("#admin-orders-export").addEventListener("click", () => {
        const active = ORDER_FILTERS.find((f) => f.id === ordersState.filter) || ORDER_FILTERS[0];
        const rows = ordersState.entries.filter((e) => active.test(e) && entryMatches(e, ordersState.query));
        downloadCsv(
          `commandes-${new Date().toISOString().slice(0, 10)}.csv`,
          ["N°", "Type", "Date", "Statut", "E-mail", "Téléphone", "Articles", "Total (€)"],
          rows.map((e) => [
            e.number,
            e.kind === "preorder" ? "Précommande" : "Commande",
            new Date(e.createdAt).toLocaleString("fr-FR"),
            STATUS_LABELS[e.status] || e.status,
            e.email,
            e.phone,
            e.items.map((i) => `${i.qty} x ${i.name}${i.size ? ` (${i.size})` : ""}`).join(" | "),
            (e.total / 100).toFixed(2).replace(".", ","),
          ])
        );
      });

      // Actions déléguées : elles survivent aux re-rendus de la liste (filtre / recherche).
      const listEl = panel.querySelector("#admin-order-list");
      listEl.addEventListener("click", (ev) => {
        const toggle = ev.target.closest(".admin-toggle-return");
        if (toggle) toggle.closest(".oc-manage-body").querySelector(".admin-return-form").hidden =
          !toggle.closest(".oc-manage-body").querySelector(".admin-return-form").hidden;
      });
      listEl.addEventListener("submit", async (ev) => {
        const form = ev.target;
        ev.preventDefault();
        const card = form.closest(".order-card");
        const orderId = Number(card.dataset.id);
        const submit = form.querySelector("button[type=submit]");
        submit.disabled = true;
        try {
          if (form.classList.contains("admin-return-form")) {
            const resp = await fetch("/api/staff/returns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                reason: form.reason.value,
                refundAmount: form.refundAmount.value === "" ? null : form.refundAmount.value,
              }),
            });
            if (resp.ok) {
              toast("Retour créé");
              form.hidden = true;
              form.reset();
              delete loaded.returns;
              refreshTabCounts();
            } else toast("Impossible de créer le retour", "error");
          } else {
            const resp = await fetch("/api/staff/orders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                status: form.status.value,
                trackingCarrier: form.trackingCarrier.value,
                trackingNumber: form.trackingNumber.value,
              }),
            });
            if (resp.ok) {
              toast("Commande mise à jour");
              const entry = ordersState.entries.find((x) => x.kind === "order" && x.id === orderId);
              if (entry) {
                entry.status = form.status.value;
                entry.trackingCarrier = form.trackingCarrier.value;
                entry.trackingNumber = form.trackingNumber.value;
              }
              const badge = card.querySelector(".oc-id .admin-badge");
              badge.className = `admin-badge status-${form.status.value}`;
              badge.textContent = STATUS_LABELS[form.status.value] || form.status.value;
              // Compteurs des filtres et de l'onglet, sans recharger ni faire sauter la carte.
              panels.orders.querySelectorAll(".admin-chip").forEach((chip) => {
                const f = ORDER_FILTERS.find((x) => x.id === chip.dataset.filter);
                chip.querySelector(".admin-chip-count").textContent = String(ordersState.entries.filter(f.test).length);
              });
              refreshTabCounts();
            } else toast("Impossible d'enregistrer", "error");
          }
        } catch (err) {
          toast("Erreur réseau, réessayez", "error");
        } finally {
          submit.disabled = false;
        }
      });
    } catch (err) {
      panel.innerHTML = `<h2>Commandes</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  // ---- Retours ----

  const RETURN_STATUS_LABELS = {
    requested: "Demandé",
    received: "Reçu",
    refunded: "Remboursé",
    rejected: "Refusé",
  };

  async function loadReturns() {
    const panel = panels.returns;
    panel.innerHTML = `<h2>Retours</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/returns");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Retours</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }
      if (data.returns.length === 0) {
        panel.innerHTML = `<h2>Retours</h2><p class="admin-empty">Aucun retour pour l'instant. Crée-en un depuis l'onglet Commandes.</p>`;
        return;
      }

      const rows = data.returns
        .map((r) => {
          const status = r.status || "requested";
          return `
            <tr class="admin-return-row" data-return-id="${r.id}">
              <td>${formatDate(r.createdAt)}</td>
              <td>Commande n°${r.orderId}</td>
              <td>${escapeHtml(r.customerEmail)}</td>
              <td>${escapeHtml(r.reason || "—")}</td>
              <td>${formatCents(r.refundAmount)}</td>
              <td><span class="admin-badge status-${status === "refunded" ? "delivered" : status === "rejected" ? "cancelled" : "processing"}">${RETURN_STATUS_LABELS[status] || status}</span></td>
              <td>
                <form class="admin-inline-form admin-return-status-form">
                  <select name="status">
                    ${Object.keys(RETURN_STATUS_LABELS)
                      .map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${RETURN_STATUS_LABELS[s]}</option>`)
                      .join("")}
                  </select>
                  <button type="submit" class="admin-btn-small">Enregistrer</button>
                  <span class="admin-save-note" hidden>Enregistré ✓</span>
                  <span class="admin-error-note" hidden style="color:#b3261e; font-size:12px;"></span>
                </form>
              </td>
            </tr>
          `;
        })
        .join("");

      panel.innerHTML = `
        <h2>Retours</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Date</th><th>Commande</th><th>Client</th><th>Motif</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;

      panel.querySelectorAll(".admin-return-status-form").forEach((form) => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const row = form.closest(".admin-return-row");
          const returnId = Number(row.dataset.returnId);
          const btn = form.querySelector("button");
          const note = form.querySelector(".admin-save-note");
          const errNote = form.querySelector(".admin-error-note");
          errNote.hidden = true;
          btn.disabled = true;
          try {
            const resp = await fetch("/api/staff/returns", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ returnId, status: form.status.value }),
            });
            const data = await resp.json();
            if (resp.ok) {
              note.hidden = false;
              const badge = row.querySelector(".admin-badge");
              const s = form.status.value;
              badge.className = `admin-badge status-${s === "refunded" ? "delivered" : s === "rejected" ? "cancelled" : "processing"}`;
              badge.textContent = RETURN_STATUS_LABELS[s] || s;
              setTimeout(() => (note.hidden = true), 2500);
              refreshTabCounts();
            } else {
              errNote.textContent =
                data.error === "refund_failed"
                  ? "Le remboursement Stripe a échoué (vérifiez STRIPE_SECRET_KEY)."
                  : "Erreur, réessayez.";
              errNote.hidden = false;
            }
          } catch (err) {
            errNote.textContent = "Erreur, réessayez.";
            errNote.hidden = false;
          } finally {
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      panel.innerHTML = `<h2>Retours</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  // ---- Clients ----

  async function loadCustomers() {
    const panel = panels.customers;
    panel.innerHTML = `<h2>Clients</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/customers");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Clients</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }
      if (data.customers.length === 0) {
        panel.innerHTML = `<h2>Clients</h2><p class="admin-empty">Aucun client pour l'instant.</p>`;
        return;
      }
      const rows = data.customers
        .map(
          (c) => `
            <tr>
              <td>${escapeHtml(c.email)}</td>
              <td>${c.orderCount}</td>
              <td>${formatCents(c.totalSpent)}</td>
              <td>${formatDate(c.firstOrderAt)}</td>
              <td>${formatDate(c.lastOrderAt)}</td>
            </tr>
          `
        )
        .join("");
      panel.innerHTML = `
        <h2>Clients</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>E-mail</th><th>Commandes</th><th>Total dépensé</th><th>1ère commande</th><th>Dernière commande</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      panel.innerHTML = `<h2>Clients</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  // ---- Messages ----

  async function loadMessages() {
    const panel = panels.messages;
    panel.innerHTML = `<h2>Messages de contact</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/messages");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Messages de contact</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }
      if (data.messages.length === 0) {
        panel.innerHTML = `<h2>Messages de contact</h2><p class="admin-empty">Aucun message pour l'instant.</p>`;
        return;
      }
      const rows = data.messages
        .map(
          (m) => `
            <tr class="${m.isRead ? "" : "is-unread"}" data-id="${m.id}">
              <td>${formatDate(m.createdAt)}</td>
              <td>${escapeHtml(m.name)}</td>
              <td>${escapeHtml(m.email)}</td>
              <td>${escapeHtml(m.message)}</td>
              <td>${m.isRead ? "" : '<button type="button" class="admin-btn-small admin-mark-read">Marquer lu</button>'}</td>
            </tr>
          `
        )
        .join("");
      panel.innerHTML = `
        <h2>Messages de contact</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Date</th><th>Nom</th><th>E-mail</th><th>Message</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
      panel.querySelectorAll(".admin-mark-read").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const tr = btn.closest("tr");
          const id = Number(tr.dataset.id);
          btn.disabled = true;
          try {
            const resp = await fetch("/api/staff/messages", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
            if (resp.ok) {
              tr.classList.remove("is-unread");
              btn.remove();
              refreshTabCounts();
            }
          } catch (err) {
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      panel.innerHTML = `<h2>Messages de contact</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  // ---- Produits ----

  async function loadProducts() {
    const panel = panels.products;
    panel.innerHTML = `<h2>Produits</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/products");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Produits</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }

      const rows = data.products
        .map((p) => {
          const sizeInputs = p.sizes
            .map((s) => {
              const qty = p.stock[s];
              const isOut = qty !== null && qty <= 0;
              return `
                <label class="admin-size-toggle ${isOut ? "is-out" : ""}" style="flex-direction:column; align-items:flex-start; gap:2px; padding:6px 10px;">
                  <span style="font-size:11px; color:var(--ink-soft);">${s}</span>
                  <input type="number" min="0" step="1" name="stock-${s}" value="${qty === null ? "" : qty}" placeholder="illimité" style="width:64px; border:none; padding:0; font-size:13px;" />
                </label>
              `;
            })
            .join("");
          return `
            <tr class="admin-product-row" data-product-id="${p.id}">
              <td colspan="2">
                <strong>${escapeHtml(p.name)}</strong>
                <p style="color:var(--ink-soft); font-size:12px; margin:2px 0 0;">Prix catalogue : ${formatEuros(p.basePrice)}</p>
                <form class="admin-inline-form admin-product-form">
                  <label style="font-size:12px;">Prix actuel :
                    <input type="number" step="0.01" min="0" name="price" value="${p.price}" style="width:90px;" />
                    €
                  </label>
                  <span class="admin-sizes" style="display:inline-flex; gap:6px;">${sizeInputs}</span>
                  <button type="submit" class="admin-btn-small">Enregistrer</button>
                  <span class="admin-save-note" hidden>Enregistré ✓</span>
                </form>
              </td>
            </tr>
          `;
        })
        .join("");

      panel.innerHTML = `
        <h2>Produits</h2>
        <p style="color:var(--ink-soft); font-size:13px; margin-top:-10px;">
          Indique une quantité par taille pour suivre le stock (0 = rupture, la taille devient indisponible
          sur la boutique et se décrémente automatiquement à chaque vente). Laisse le champ vide pour un
          stock illimité (non suivi). Laisse le prix vide pour revenir au prix catalogue.
        </p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;

      panel.querySelectorAll(".admin-product-form").forEach((form) => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const row = form.closest(".admin-product-row");
          const productId = row.dataset.productId;
          const btn = form.querySelector("button");
          const note = form.querySelector(".admin-save-note");
          const stock = {};
          form.querySelectorAll('input[name^="stock-"]').forEach((input) => {
            const size = input.name.replace("stock-", "");
            stock[size] = input.value === "" ? null : input.value;
          });
          btn.disabled = true;
          try {
            const resp = await fetch("/api/staff/products", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId,
                price: form.price.value === "" ? null : form.price.value,
                stock,
              }),
            });
            if (resp.ok) {
              note.hidden = false;
              form.querySelectorAll('input[name^="stock-"]').forEach((input) => {
                const label = input.closest(".admin-size-toggle");
                const qty = input.value === "" ? null : Number(input.value);
                label.classList.toggle("is-out", qty !== null && qty <= 0);
              });
              setTimeout(() => (note.hidden = true), 2500);
            }
          } catch (err) {
            // silencieux
          } finally {
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      panel.innerHTML = `<h2>Produits</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  // ---- Liste d'attente ----

  async function loadWaitlist() {
    const panel = panels.waitlist;
    panel.innerHTML = `<h2>Liste d'attente</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/waitlist");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Liste d'attente</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }

      const launchValue = data.launchAt ? toLocalDatetimeInputValue(data.launchAt) : "";
      const rows = data.entries
        .map((e) => {
          const cartHtml = e.cart && e.cart.length
            ? e.cart
                .map((it) => `<div>${it.qty} × ${escapeHtml(it.productName)}${it.size ? ` (${escapeHtml(it.size)})` : ""}</div>`)
                .join("")
            : `<span class="admin-muted">—</span>`;
          return `<tr${e.cart && e.cart.length ? ' class="has-preorder"' : ""}>
            <td>${formatDate(e.cartUpdatedAt || e.createdAt)}</td>
            <td>${escapeHtml(e.email)}${e.cart && e.cart.length ? ` <span class="admin-badge status-preorder">Précommande</span>` : ""}</td>
            <td>${e.phone ? escapeHtml(e.phone) : `<span class="admin-muted">—</span>`}</td>
            <td class="admin-order-items">${cartHtml}</td>
            <td>${e.cartTotal ? formatCents(e.cartTotal) : ""}</td>
          </tr>`;
        })
        .join("");
      const preorders = data.entries.filter((e) => e.cart && e.cart.length);
      const preorderTotal = preorders.reduce((sum, e) => sum + (e.cartTotal || 0), 0);

      panel.innerHTML = `
        <h2>Liste d'attente</h2>
        <div class="admin-waitlist-launch">
          <form id="admin-waitlist-launch-form">
            <label for="admin-waitlist-launch-input">Date de lancement (compte à rebours du site)</label>
            <input type="datetime-local" id="admin-waitlist-launch-input" name="launchAt" value="${launchValue}" />
            <button type="submit" class="admin-btn-small">Enregistrer</button>
            <button type="button" class="admin-btn-small" id="admin-waitlist-clear">Effacer</button>
            <span class="admin-save-note" hidden>Enregistré ✓</span>
          </form>
          <p class="admin-hint">${data.launchAt ? "Le compte à rebours est actif sur le site." : "Aucune date définie : le compte à rebours reste masqué sur le site."}</p>
        </div>
        <div class="admin-kpis">
          <div class="admin-kpi"><div class="admin-kpi-label">Inscrits</div><div class="admin-kpi-value">${data.count}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-label">Précommandes (panier joint)</div><div class="admin-kpi-value">${preorders.length}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-label">Montant précommandé</div><div class="admin-kpi-value">${formatCents(preorderTotal)}</div></div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Date</th><th>E-mail</th><th>Téléphone</th><th>Dernier panier</th><th>Total</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5" class="admin-empty">Aucune inscription pour l'instant.</td></tr>`}</tbody>
          </table>
        </div>
      `;

      const launchForm = document.getElementById("admin-waitlist-launch-form");
      const saveWaitlistLaunch = async (launchAt) => {
        const btn = launchForm.querySelector('button[type="submit"]');
        const note = launchForm.querySelector(".admin-save-note");
        btn.disabled = true;
        try {
          const resp = await fetch("/api/staff/waitlist", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ launchAt }),
          });
          if (resp.ok) {
            note.hidden = false;
            delete loaded.waitlist;
            setTimeout(() => (note.hidden = true), 2000);
          }
        } catch (err) {
          // silencieux
        } finally {
          btn.disabled = false;
        }
      };
      launchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("admin-waitlist-launch-input");
        const launchAt = input.value ? new Date(input.value).toISOString() : "";
        saveWaitlistLaunch(launchAt);
      });
      document.getElementById("admin-waitlist-clear").addEventListener("click", () => saveWaitlistLaunch(""));
    } catch (err) {
      panel.innerHTML = `<h2>Liste d'attente</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  function toLocalDatetimeInputValue(isoString) {
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  checkSession();
})();
