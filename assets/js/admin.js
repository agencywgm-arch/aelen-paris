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
    customers: document.getElementById("admin-panel-customers"),
    messages: document.getElementById("admin-panel-messages"),
    products: document.getElementById("admin-panel-products"),
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
    activateTab("stats");
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

  function activateTab(name) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    Object.keys(panels).forEach((k) => panels[k].classList.toggle("active", k === name));
    if (!loaded[name]) {
      loaded[name] = true;
      loadTab(name);
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  function loadTab(name) {
    if (name === "stats") return loadStats();
    if (name === "orders") return loadOrders();
    if (name === "customers") return loadCustomers();
    if (name === "messages") return loadMessages();
    if (name === "products") return loadProducts();
  }

  // ---- Statistiques ----

  async function loadStats() {
    const panel = panels.stats;
    panel.innerHTML = `<h2>Statistiques</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/stats");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Statistiques</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }
      const topRows = data.topProducts
        .map(
          (p) =>
            `<tr><td>${escapeHtml(p.productName)}</td><td>${p.totalQty}</td></tr>`
        )
        .join("");
      panel.innerHTML = `
        <h2>Statistiques</h2>
        <div class="admin-kpis">
          <div class="admin-kpi"><div class="admin-kpi-label">Chiffre d'affaires</div><div class="admin-kpi-value">${formatCents(data.revenue)}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-label">Commandes</div><div class="admin-kpi-value">${data.orderCount}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-label">Panier moyen</div><div class="admin-kpi-value">${formatCents(data.avgOrderValue)}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-label">Commandes (30j)</div><div class="admin-kpi-value">${data.ordersLast30Days}</div></div>
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
      panel.innerHTML = `<h2>Statistiques</h2><p class="admin-empty">${errorMessage()}</p>`;
    }
  }

  // ---- Commandes ----

  const STATUS_LABELS = {
    paid: "Payée",
    unpaid: "Non payée",
    processing: "En préparation",
    shipped: "Expédiée",
    delivered: "Livrée",
    cancelled: "Annulée",
  };

  async function loadOrders() {
    const panel = panels.orders;
    panel.innerHTML = `<h2>Commandes</h2><p class="admin-loading">Chargement…</p>`;
    try {
      const resp = await fetch("/api/staff/orders");
      const data = await resp.json();
      if (!resp.ok) {
        panel.innerHTML = `<h2>Commandes</h2><p class="admin-empty">${errorMessage(data.error)}</p>`;
        return;
      }
      if (data.orders.length === 0) {
        panel.innerHTML = `<h2>Commandes</h2><p class="admin-empty">Aucune commande pour l'instant.</p>`;
        return;
      }

      const rows = data.orders
        .map((o) => {
          const itemsHtml = o.items
            .map(
              (it) =>
                `<div>${it.qty} × ${escapeHtml(it.product_name)}${it.size ? ` (${escapeHtml(it.size)})` : ""}</div>`
            )
            .join("");
          const status = o.status || "paid";
          return `
            <tr class="admin-order-row" data-order-id="${o.id}">
              <td>${formatDate(o.createdAt)}</td>
              <td>${escapeHtml(o.customerEmail)}</td>
              <td class="admin-order-items">${itemsHtml}</td>
              <td>${formatCents(o.amountTotal)}</td>
              <td><span class="admin-badge status-${status}">${STATUS_LABELS[status] || status}</span></td>
              <td>
                <form class="admin-inline-form admin-order-form">
                  <select name="status">
                    ${Object.keys(STATUS_LABELS)
                      .map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${STATUS_LABELS[s]}</option>`)
                      .join("")}
                  </select>
                  <input type="text" name="trackingCarrier" placeholder="Transporteur" value="${escapeHtml(o.trackingCarrier || "")}" />
                  <input type="text" name="trackingNumber" placeholder="N° de suivi" value="${escapeHtml(o.trackingNumber || "")}" />
                  <button type="submit" class="admin-btn-small">Enregistrer</button>
                  <span class="admin-save-note" hidden>Enregistré ✓</span>
                </form>
              </td>
            </tr>
          `;
        })
        .join("");

      panel.innerHTML = `
        <h2>Commandes</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Date</th><th>Client</th><th>Articles</th><th>Montant</th><th>Statut</th><th>Suivi</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;

      panel.querySelectorAll(".admin-order-form").forEach((form) => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const row = form.closest(".admin-order-row");
          const orderId = Number(row.dataset.orderId);
          const btn = form.querySelector("button");
          const note = form.querySelector(".admin-save-note");
          btn.disabled = true;
          try {
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
              note.hidden = false;
              const badge = row.querySelector(".admin-badge");
              badge.className = `admin-badge status-${form.status.value}`;
              badge.textContent = STATUS_LABELS[form.status.value] || form.status.value;
              setTimeout(() => (note.hidden = true), 2500);
            }
          } catch (err) {
            // silencieux : le staff peut réessayer
          } finally {
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      panel.innerHTML = `<h2>Commandes</h2><p class="admin-empty">${errorMessage()}</p>`;
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
          const sizeToggles = p.sizes
            .map((s) => {
              const isOut = p.outOfStockSizes.includes(s);
              return `
                <label class="admin-size-toggle ${isOut ? "is-out" : ""}">
                  <input type="checkbox" value="${s}" ${isOut ? "checked" : ""} />
                  ${s}
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
                  <span class="admin-sizes">${sizeToggles}</span>
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
          Cochez une taille pour la marquer en rupture de stock (elle devient indisponible sur la boutique).
          Laissez le prix vide pour revenir au prix catalogue.
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
          const outOfStockSizes = Array.from(form.querySelectorAll('input[type="checkbox"]:checked')).map(
            (cb) => cb.value
          );
          btn.disabled = true;
          try {
            const resp = await fetch("/api/staff/products", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId,
                price: form.price.value === "" ? null : form.price.value,
                outOfStockSizes,
              }),
            });
            if (resp.ok) {
              note.hidden = false;
              form.querySelectorAll(".admin-size-toggle").forEach((label) => {
                const cb = label.querySelector("input");
                label.classList.toggle("is-out", cb.checked);
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

  checkSession();
})();
