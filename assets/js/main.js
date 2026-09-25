(async function () {
  "use strict";

  // ---- Surcharges prix/stock (dashboard staff) ----
  async function applyProductOverrides() {
    try {
      const resp = await fetch("/api/product-overrides");
      if (!resp.ok) return;
      const data = await resp.json();
      const overrides = (data && data.overrides) || {};
      PRODUCTS.forEach((product) => {
        const o = overrides[product.id];
        if (!o) return;
        if (o.price != null) product.price = o.price;
        product.outOfStockSizes = Array.isArray(o.outOfStockSizes) ? o.outOfStockSizes : [];
      });
    } catch (err) {}
  }

  // ---- Vidéo hero : poster + scrub scroll ----
  const heroSection = document.getElementById("hero-video");
  const heroSticky = document.querySelector(".hero-video-sticky");
  const heroVideo = document.getElementById("hero-video-el");

  if (heroSection && heroSticky && heroVideo) {
    const reduceMotionHero = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 860px)").matches;

    if (!reduceMotionHero) {
      if (!heroVideo.querySelector("source")) {
        const source = document.createElement("source");
        source.src = isMobile ? "assets/video/hero-mobile.mp4" : "assets/video/hero-pc-hq.mp4";
        source.type = "video/mp4";
        heroVideo.appendChild(source);
        heroVideo.preload = "auto";
        heroVideo.load();
      }

      heroVideo.addEventListener("canplay", () => heroVideo.classList.add("is-ready"), { once: true });
      heroVideo.addEventListener("playing", () => heroVideo.classList.add("is-ready"), { once: true });

      let duration = 0;
      let smoothedTime = 0;
      let isVisible = true;
      let rafId = null;
      let loopMode = false;

      heroVideo.addEventListener("loadedmetadata", () => {
        duration = heroVideo.duration || 0;
        const playAttempt = heroVideo.play();
        if (playAttempt && typeof playAttempt.then === "function") {
          playAttempt.then(() => heroVideo.pause()).catch(() => {});
        }
      });

      function enterLoopMode() {
        loopMode = true;
        heroVideo.loop = true;
        const p = heroVideo.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }

      function exitLoopMode() {
        loopMode = false;
        heroVideo.loop = false;
        heroVideo.pause();
      }

      function tick() {
        if (duration) {
          const rect = heroSection.getBoundingClientRect();
          const scrollable = heroSection.offsetHeight - heroSticky.offsetHeight;
          if (scrollable > 0) {
            const scrolled = Math.min(Math.max(-rect.top, 0), scrollable);
            const progress = scrolled / scrollable;
            if (progress >= 1) {
              if (!loopMode) enterLoopMode();
            } else {
              if (loopMode) exitLoopMode();
              const targetTime = progress * duration;
              smoothedTime += (targetTime - smoothedTime) * 0.1;
              if (Math.abs(targetTime - smoothedTime) < 0.02) smoothedTime = targetTime;
              if (Math.abs(heroVideo.currentTime - smoothedTime) > 0.033) {
                heroVideo.currentTime = smoothedTime;
              }
            }
          }
        }
        if (isVisible) {
          rafId = requestAnimationFrame(tick);
        } else {
          rafId = null;
        }
      }

      const observer = new IntersectionObserver(
        (entries) => {
          isVisible = entries[0].isIntersecting;
          if (isVisible && rafId === null) {
            rafId = requestAnimationFrame(tick);
          }
        },
        { threshold: 0 }
      );
      observer.observe(heroSection);
      rafId = requestAnimationFrame(tick);
    }
  }

  await applyProductOverrides();

  // ---- Parallaxe ----
  const aboutVisual = document.querySelector(".about-visual");
  const aboutImg = aboutVisual ? aboutVisual.querySelector("img") : null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (aboutVisual && aboutImg && !reduceMotion) {
    let parallaxTicking = false;
    function updateParallax() {
      const rect = aboutVisual.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = (vh / 2 - (rect.top + rect.height / 2)) / (vh / 2 + rect.height / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      const offset = clamped * 34;
      aboutImg.style.transform = `translateY(${offset}px) scale(1.18)`;
      parallaxTicking = false;
    }
    window.addEventListener("scroll", () => {
      if (!parallaxTicking) {
        requestAnimationFrame(updateParallax);
        parallaxTicking = true;
      }
    }, { passive: true });
    updateParallax();
  }

  // ---- Grille collection ----
  const grid = document.getElementById("collection-grid");
  function imgSrc(entry) { return typeof entry === "string" ? entry : entry.src; }
  function imgFit(entry, product) { return typeof entry === "string" ? product.fit : entry.fit || product.fit; }
  function formatPrice(value) { return `${value} €`; }

  function renderGrid() {
    if (!grid || typeof PRODUCTS === "undefined") return;
    grid.innerHTML = PRODUCTS.map((p) => `
      <article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="Voir ${p.name}">
        <div class="thumb${imgFit(p.images[0], p) === "contain" ? " thumb-contain" : ""}">
          <img src="${imgSrc(p.images[0])}" alt="${p.name}" loading="lazy" />
        </div>
        <div class="info">
          <p class="cat">${p.category}</p>
          <h3>${p.name}</h3>
          <p class="desc">${p.description}</p>
          <span class="view-link">${formatPrice(p.price)} — Voir la pièce</span>
        </div>
      </article>`).join("");
  }

  // ---- Modal ----
  const overlay = document.getElementById("modal-overlay");
  const modalImage = document.getElementById("modal-image");
  const modalCat = document.getElementById("modal-cat");
  const modalTitle = document.getElementById("modal-title");
  const modalDesc = document.getElementById("modal-desc");
  const modalDetails = document.getElementById("modal-details");
  const modalThumbs = document.getElementById("modal-thumbs");
  const modalClose = document.getElementById("modal-close");
  const modalFittingBtn = document.getElementById("modal-fitting-btn");
  const modalPrice = document.getElementById("modal-price");
  const modalSizes = document.getElementById("modal-sizes");
  const modalAddCart = document.getElementById("modal-add-cart");
  let currentProduct = null;
  let selectedSize = null;

  function selectImage(product, index) {
    const entry = product.images[index];
    modalImage.src = imgSrc(entry);
    modalImage.alt = product.name;
    modalImage.parentElement.classList.toggle("modal-image-contain", imgFit(entry, product) === "contain");
    modalThumbs.querySelectorAll("img").forEach((img, i) => {
      img.classList.toggle("active", i === index);
    });
  }

  function openModal(id) {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) return;
    currentProduct = product;
    modalCat.textContent = `${product.category} — ${product.color}`;
    modalTitle.textContent = product.name;
    modalPrice.textContent = formatPrice(product.price);
    modalDesc.textContent = product.description;
    modalDetails.innerHTML = product.details.map((d) => `<li>${d}</li>`).join("");
    const sizes = product.sizes || [];
    const outOfStock = product.outOfStockSizes || [];
    const firstAvailable = sizes.find((s) => !outOfStock.includes(s)) || sizes[0] || null;
    selectedSize = firstAvailable;
    modalSizes.innerHTML = sizes.map((s) => {
      const isOut = outOfStock.includes(s);
      const cls = [s === firstAvailable ? "active" : "", isOut ? "is-unavailable" : ""].filter(Boolean).join(" ");
      return `<button type="button" data-size="${s}" class="${cls}" ${isOut ? "disabled" : ""}>${s}</button>`;
    }).join("");
    modalSizes.querySelectorAll("button:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSize = btn.dataset.size;
        modalSizes.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
    modalThumbs.innerHTML = product.images.length > 1
      ? product.images.map((entry, i) => `<img src="${imgSrc(entry)}" alt="${product.name} — vue ${i + 1}" data-index="${i}" />`).join("")
      : "";
    selectImage(product, 0);
    modalThumbs.querySelectorAll("img").forEach((img) => {
      img.addEventListener("click", () => selectImage(product, Number(img.dataset.index)));
    });
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    const fittingOverlayEl = document.getElementById("fitting-overlay");
    if (fittingOverlayEl && !fittingOverlayEl.hidden) {
      fittingOverlayEl.classList.remove("is-open");
      fittingOverlayEl.hidden = true;
    }
  }

  // ---- Panier ----
  const CART_KEY = "aelen-cart";
  const cartOverlay = document.getElementById("cart-overlay");
  const cartClose = document.getElementById("cart-close");
  const cartToggle = document.getElementById("cart-toggle");
  const cartItemsEl = document.getElementById("cart-items");
  const cartEmptyEl = document.getElementById("cart-empty");
  const cartSubtotalEl = document.getElementById("cart-subtotal");
  const cartCountEl = document.getElementById("cart-count");
  const cartCheckoutBtn = document.getElementById("cart-checkout");

  function getCart() {
    try { const raw = localStorage.getItem(CART_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  }
  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  let lastAddedKey = null;
  function bumpCartCount() {
    cartCountEl.classList.remove("is-bumping");
    void cartCountEl.offsetWidth;
    cartCountEl.classList.add("is-bumping");
  }
  function addToCart(productId, size, qty) {
    const cart = getCart();
    const existing = cart.find((item) => item.id === productId && item.size === size);
    if (existing) existing.qty += qty;
    else cart.push({ id: productId, size, qty });
    saveCart(cart);
    lastAddedKey = `${productId}::${size}`;
    renderCart();
    bumpCartCount();
  }
  function updateCartQty(index, qty) {
    const cart = getCart();
    if (!cart[index]) return;
    if (qty <= 0) cart.splice(index, 1);
    else cart[index].qty = qty;
    saveCart(cart);
    renderCart();
  }
  function removeFromCart(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCart();
  }
  function cartLines() {
    return getCart().map((item, index) => {
      const product = PRODUCTS.find((p) => p.id === item.id);
      if (!product) return null;
      return { index, item, product };
    }).filter(Boolean);
  }
  function renderCart() {
    const lines = cartLines();
    const totalCount = lines.reduce((sum, l) => sum + l.item.qty, 0);
    const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.item.qty, 0);
    cartCountEl.textContent = String(totalCount);
    cartCountEl.hidden = totalCount === 0;
    cartSubtotalEl.textContent = formatPrice(subtotal);
    cartCheckoutBtn.disabled = lines.length === 0;
    cartEmptyEl.hidden = lines.length > 0;
    cartItemsEl.innerHTML = lines.map(({ index, item, product }) => {
      const isNew = lastAddedKey === `${item.id}::${item.size}`;
      return `
        <div class="cart-item${isNew ? " is-new" : ""}" data-index="${index}">
          <img src="${imgSrc(product.images[0])}" alt="${product.name}" />
          <div class="cart-item-info">
            <h4>${product.name}</h4>
            <p>Taille ${item.size}</p>
            <div class="cart-item-qty">
              <button type="button" class="cart-qty-minus">−</button>
              <span>${item.qty}</span>
              <button type="button" class="cart-qty-plus">+</button>
            </div>
            <button type="button" class="cart-item-remove">Retirer</button>
          </div>
          <div class="cart-item-price">${formatPrice(product.price * item.qty)}</div>
        </div>`;
    }).join("");
    lastAddedKey = null;
    cartItemsEl.querySelectorAll(".cart-item").forEach((el) => {
      const index = Number(el.dataset.index);
      const line = lines.find((l) => l.index === index);
      el.querySelector(".cart-qty-minus").addEventListener("click", () => updateCartQty(index, line.item.qty - 1));
      el.querySelector(".cart-qty-plus").addEventListener("click", () => updateCartQty(index, line.item.qty + 1));
      el.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(index));
    });
  }
  function openCart() {
    renderCart();
    cartOverlay.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => cartOverlay.classList.add("is-open")));
  }
  function closeCart() {
    cartOverlay.classList.remove("is-open");
    setTimeout(() => { cartOverlay.hidden = true; }, 400);
  }
  if (cartToggle) cartToggle.addEventListener("click", openCart);
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", (e) => { if (e.target === cartOverlay) closeCart(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cartOverlay && !cartOverlay.hidden) closeCart();
  });
  if (modalAddCart) modalAddCart.addEventListener("click", () => {
    if (!currentProduct) return;
    if (currentProduct.sizes && currentProduct.sizes.length && !selectedSize) return;
    addToCart(currentProduct.id, selectedSize, 1);
    openCart();
  });
  if (cartCheckoutBtn) cartCheckoutBtn.addEventListener("click", async () => {
    const lines = cartLines();
    if (lines.length === 0) return;
    cartCheckoutBtn.disabled = true;
    cartCheckoutBtn.textContent = "Redirection…";
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map(({ item }) => ({ id: item.id, size: item.size, qty: item.qty })) }),
      });
      if (!response.ok) throw new Error("checkout_failed");
      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else throw new Error("no_url");
    } catch (err) {
      cartCheckoutBtn.disabled = false;
      cartCheckoutBtn.textContent = "Passer commande";
      alert("Le paiement n'est pas encore configuré. Contactez-nous pour finaliser votre commande.");
    }
  });
  renderCart();

  // ---- Compte client (connexion par lien magique) ----
  const accountOverlay = document.getElementById("account-overlay");
  const accountBody = document.getElementById("account-body");
  const accountClose = document.getElementById("account-close");
  const accountToggle = document.getElementById("account-toggle");
  const navAccountToggle = document.getElementById("nav-account-toggle");

  const ACCOUNT_STATUS_LABELS = {
    paid: "Payée", unpaid: "Non payée", processing: "En préparation",
    shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée",
  };

  function renderAccountLoggedOut(note) {
    if (!accountBody) return;
    accountBody.innerHTML = `
      <p class="account-intro">Connectez-vous avec votre e-mail pour retrouver votre historique de commandes. Nous vous envoyons un lien de connexion, sans mot de passe.</p>
      <form id="account-login-form">
        <input type="email" name="email" required placeholder="Votre adresse e-mail" aria-label="Adresse e-mail" />
        <button type="submit" class="btn btn-solid">Recevoir mon lien de connexion</button>
      </form>
      <p class="form-note" id="account-login-note">${note ? note : ""}</p>
    `;
    const form = document.getElementById("account-login-form");
    const noteEl = document.getElementById("account-login-note");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const btn = form.querySelector("button");
      btn.disabled = true;
      noteEl.textContent = "Envoi en cours…";
      try {
        const resp = await fetch("/api/auth/request-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await resp.json();
        if (resp.ok && data.ok) {
          noteEl.textContent = "Un e-mail vient de vous être envoyé. Cliquez sur le lien pour vous connecter.";
          form.reset();
        } else if (data.error === "email_not_configured" || data.error === "db_not_configured") {
          noteEl.textContent = "La connexion n'est pas encore disponible sur ce site. Contactez-nous à contact@aelenparis.fr.";
        } else {
          noteEl.textContent = "Une erreur est survenue, réessayez.";
        }
      } catch (err) {
        noteEl.textContent = "Erreur réseau, réessayez.";
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function renderAccountLoggedIn(email) {
    if (!accountBody) return;
    accountBody.innerHTML = `
      <div class="account-loggedin">
        <p class="account-email">Connecté·e en tant que <strong>${email}</strong></p>
        <button type="button" class="btn" id="account-logout-btn">Se déconnecter</button>
        <h4 class="account-orders-title">Historique de commandes</h4>
        <div id="account-orders-list"><p class="account-intro">Chargement…</p></div>
      </div>
    `;
    document.getElementById("account-logout-btn").addEventListener("click", async () => {
      try { await fetch("/api/auth/logout", { method: "POST" }); } catch (err) {}
      renderAccountLoggedOut();
    });

    const list = document.getElementById("account-orders-list");
    try {
      const resp = await fetch("/api/account/orders");
      const data = resp.ok ? await resp.json() : { orders: [] };
      const orders = data.orders || [];
      if (orders.length === 0) {
        list.innerHTML = `<p class="account-intro">Vous n'avez pas encore de commande.</p>`;
        return;
      }
      list.innerHTML = orders
        .map(
          (o) => `
            <div class="account-order">
              <div class="account-order-head">
                <span>Commande n°${o.id} — ${new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
                <span>${(o.amountTotal / 100).toFixed(2)} €</span>
              </div>
              <ul class="account-order-items">
                ${o.items.map((it) => `<li>${it.qty} × ${it.product_name}${it.size ? ` (${it.size})` : ""}</li>`).join("")}
              </ul>
              <span class="account-order-status">${ACCOUNT_STATUS_LABELS[o.status] || o.status}</span>
              <a class="account-order-invoice" href="/api/account/invoice?orderId=${o.id}" target="_blank" rel="noopener">Télécharger la facture</a>
            </div>
          `
        )
        .join("");
    } catch (err) {
      list.innerHTML = `<p class="account-intro">Impossible de charger vos commandes pour le moment.</p>`;
    }
  }

  async function checkAccountSession() {
    try {
      const resp = await fetch("/api/account/me");
      if (resp.ok) {
        const data = await resp.json();
        if (data.email) {
          await renderAccountLoggedIn(data.email);
          return;
        }
      }
    } catch (err) {}
    renderAccountLoggedOut();
  }

  function openAccount(forceLoggedOutNote) {
    if (!accountOverlay) return;
    if (forceLoggedOutNote) renderAccountLoggedOut(forceLoggedOutNote);
    else checkAccountSession();
    accountOverlay.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => accountOverlay.classList.add("is-open")));
  }
  function closeAccount() {
    if (!accountOverlay) return;
    accountOverlay.classList.remove("is-open");
    setTimeout(() => { accountOverlay.hidden = true; }, 400);
  }
  if (accountToggle) accountToggle.addEventListener("click", () => openAccount());
  if (navAccountToggle) navAccountToggle.addEventListener("click", () => openAccount());
  if (accountClose) accountClose.addEventListener("click", closeAccount);
  if (accountOverlay) accountOverlay.addEventListener("click", (e) => { if (e.target === accountOverlay) closeAccount(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && accountOverlay && !accountOverlay.hidden) closeAccount();
  });

  // Retour depuis le lien magique reçu par e-mail (?account=1 ou =expired).
  const acctParam = new URLSearchParams(window.location.search).get("account");
  if (acctParam === "1") {
    openAccount();
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  } else if (acctParam === "expired") {
    openAccount("Votre lien de connexion a expiré ou est invalide. Redemandez-en un ci-dessous.");
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  }

  // ---- Liste d'attente + compte à rebours ----
  const countdownEl = document.getElementById("countdown");
  const waitlistForm = document.getElementById("waitlist-form");
  const waitlistNote = document.getElementById("waitlist-note");
  const waitlistInner = document.getElementById("waitlist-inner");
  const waitlistPreviewGrid = document.getElementById("waitlist-preview-grid");

  if (waitlistPreviewGrid && typeof PRODUCTS !== "undefined") {
    waitlistPreviewGrid.innerHTML = PRODUCTS.map(
      (p) => `<img src="${imgSrc(p.images[0])}" alt="" loading="lazy" />`
    ).join("");
  }

  if (waitlistInner) {
    if (reduceMotion) {
      waitlistInner.classList.add("is-visible");
    } else {
      const waitlistObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            waitlistInner.classList.add("is-visible");
            waitlistObserver.disconnect();
          }
        },
        { threshold: 0.25 }
      );
      waitlistObserver.observe(waitlistInner);
    }
  }

  function startCountdown(targetMs) {
    if (!countdownEl) return;
    countdownEl.hidden = false;
    const daysEl = document.getElementById("cd-days");
    const hoursEl = document.getElementById("cd-hours");
    const minutesEl = document.getElementById("cd-minutes");
    const secondsEl = document.getElementById("cd-seconds");
    function tick() {
      const diff = Math.max(0, targetMs - Date.now());
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (daysEl) daysEl.textContent = String(days).padStart(2, "0");
      if (hoursEl) hoursEl.textContent = String(hours).padStart(2, "0");
      if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, "0");
      if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, "0");
      if (diff > 0) setTimeout(tick, 1000);
    }
    tick();
  }

  async function initWaitlist() {
    if (!countdownEl && !waitlistForm) return;
    try {
      const resp = await fetch("/api/waitlist");
      const data = await resp.json();
      if (data.launchAt) {
        const targetMs = new Date(data.launchAt).getTime();
        if (!Number.isNaN(targetMs) && targetMs > Date.now()) startCountdown(targetMs);
      }
    } catch (err) {}
  }
  initWaitlist();

  if (waitlistForm) {
    waitlistForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = waitlistForm.email.value.trim();
      const btn = waitlistForm.querySelector("button");
      btn.disabled = true;
      if (waitlistNote) waitlistNote.textContent = "Inscription en cours…";
      try {
        const resp = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await resp.json();
        if (resp.ok && data.ok) {
          if (waitlistNote) waitlistNote.textContent = "Merci ! Vous êtes inscrit·e sur la liste d'attente.";
          waitlistForm.reset();
        } else {
          if (waitlistNote) waitlistNote.textContent = "Une erreur est survenue, réessayez.";
        }
      } catch (err) {
        if (waitlistNote) waitlistNote.textContent = "Erreur réseau, réessayez.";
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---- Events ----
  if (grid) {
    renderGrid();
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".product-card");
      if (card) openModal(card.dataset.id);
    });
    grid.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".product-card");
        if (card) { e.preventDefault(); openModal(card.dataset.id); }
      }
    });
  }
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && !overlay.hidden) closeModal();
  });

  // ---- Cabine d'essayage (rotation 360°) ----
  const fittingOverlay = document.getElementById("fitting-overlay");
  const fittingClose = document.getElementById("fitting-close");
  const fittingFigure = document.getElementById("fitting-figure");
  const fittingPhoto = document.getElementById("fitting-photo");
  const fittingPhotoB = document.getElementById("fitting-photo-b");
  const fittingTitle = document.getElementById("fitting-title");
  const fittingColorEl = document.getElementById("fitting-color");
  const fittingNote = document.getElementById("fitting-note");
  const fittingControls = document.getElementById("fitting-controls");
  const spinHint = document.getElementById("spin-hint");
  const spinPrevBtn = document.getElementById("spin-prev");
  const spinNextBtn = document.getElementById("spin-next");

  if (fittingOverlay && fittingClose && fittingFigure && fittingPhoto && fittingPhotoB) {
    // Les pièces rephotographiées en studio pour la cabine (mannequin
    // virtuel, 3 carrures S/M/L). Chacune a son jeu de frames à 360°.
    const FITTING_PRODUCT_IDS = [
      "trench-chocolat",
      "trench-beige",
      "veste-croco-beige",
      "cardigan-bordeaux",
      "veste-foulard-marron",
      "pull-raye-beige",
      "pull-raye-rouge",
    ];

    const SPIN_FRAME_COUNT = 32;
    const SPIN_SIZES = ["s", "m", "l"];
    const SPIN_FRAMES = {};
    FITTING_PRODUCT_IDS.forEach((id) => {
      SPIN_FRAMES[id] = {};
      SPIN_SIZES.forEach((size) => {
        SPIN_FRAMES[id][size] = Array.from(
          { length: SPIN_FRAME_COUNT },
          (_, i) => `assets/img/spin360/${id}/${size}/frame_${String(i).padStart(2, "0")}.webp`
        );
      });
    });

    let fittingSize = "m";
    let spinIndex = 0;
    let spinFramesCache = {};
    let spinFrontEl = null; // calque image actuellement au premier plan
    let spinDragging = false;
    let spinDragStartX = 0;
    let spinDragStartIndex = 0;
    let spinIntroTimer = null;
    let spinInertiaTimer = null;
    let spinLastMoveX = 0;
    let spinLastMoveT = 0;
    let spinVelocity = 0; // frames par seconde, signé
    const SPIN_FRAMES_PER_STEP = 8; // px de glisse pour avancer d'une frame

    function setFittingSize(size) {
      fittingSize = size;
      fittingControls.querySelectorAll("button[data-size]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.size === size);
      });
      if (!currentProduct || !SPIN_FRAMES[currentProduct.id]) return;
      preloadSpinFrames(currentProduct.id, size);
      showSpinFrame(spinIndex);
    }

    function preloadSpinFrames(id, size) {
      const key = `${id}_${size}`;
      if (spinFramesCache[key]) return spinFramesCache[key];
      const imgs = (SPIN_FRAMES[id][size] || []).map((src) => {
        const img = new Image();
        img.src = src;
        return img;
      });
      spinFramesCache[key] = imgs;
      return imgs;
    }

    // Fait défiler vers `index` en faisant apparaître la nouvelle frame en
    // fondu (~90ms) sur un second calque, plutôt qu'un remplacement net du
    // src — ça gomme la coupure "flipbook" entre deux angles.
    function showSpinFrame(index) {
      const frames = spinFramesCache[`${currentProduct.id}_${fittingSize}`];
      if (!frames || frames.length === 0) return;
      spinIndex = ((index % frames.length) + frames.length) % frames.length;
      const back = spinFrontEl === fittingPhoto ? fittingPhotoB : fittingPhoto;
      back.src = frames[spinIndex].src;
      back.classList.add("is-visible", "is-active");
      if (spinFrontEl) spinFrontEl.classList.remove("is-active");
      spinFrontEl = back;
    }

    function stopSpinIntro() {
      if (spinIntroTimer) {
        clearInterval(spinIntroTimer);
        spinIntroTimer = null;
      }
    }

    function stopSpinInertia() {
      if (spinInertiaTimer) {
        cancelAnimationFrame(spinInertiaTimer);
        spinInertiaTimer = null;
      }
    }

    function playSpinIntro() {
      stopSpinIntro();
      let step = 0;
      spinIntroTimer = setInterval(() => {
        step += 1;
        showSpinFrame(step);
        if (step >= SPIN_FRAME_COUNT) stopSpinIntro();
      }, 45);
    }

    function openFittingSpin(product) {
      fittingPhoto.classList.remove("is-visible", "is-active");
      fittingPhotoB.classList.remove("is-visible", "is-active");
      fittingPhoto.alt = product.name;
      fittingPhotoB.alt = product.name;
      spinFrontEl = null;
      spinIndex = 0;
      if (fittingNote) fittingNote.textContent = "";
      if (spinHint) spinHint.classList.add("is-visible");
      preloadSpinFrames(product.id, fittingSize);
      showSpinFrame(0);
      playSpinIntro();
    }

    function spinPointerDown(e) {
      if (e.target.closest(".spin-arrow")) return;
      spinDragging = true;
      spinDragStartX = e.clientX;
      spinDragStartIndex = spinIndex;
      spinLastMoveX = e.clientX;
      spinLastMoveT = performance.now();
      spinVelocity = 0;
      stopSpinIntro();
      stopSpinInertia();
      if (spinHint) spinHint.classList.remove("is-visible");
      fittingFigure.classList.add("is-dragging");
      fittingFigure.setPointerCapture(e.pointerId);
    }

    function spinPointerMove(e) {
      if (!spinDragging) return;
      const dx = e.clientX - spinDragStartX;
      const delta = Math.round(-dx / SPIN_FRAMES_PER_STEP);
      showSpinFrame(spinDragStartIndex + delta);

      const now = performance.now();
      const dt = now - spinLastMoveT;
      if (dt > 0) {
        const framesMoved = -(e.clientX - spinLastMoveX) / SPIN_FRAMES_PER_STEP;
        spinVelocity = (framesMoved / dt) * 1000; // frames/s, lissé par le dernier segment
      }
      spinLastMoveX = e.clientX;
      spinLastMoveT = now;
    }

    function spinPointerUp() {
      spinDragging = false;
      fittingFigure.classList.remove("is-dragging");

      // Inertie courte façon "flick" : la rotation continue un instant puis
      // ralentit, pour un rendu plus fluide qu'un arrêt net au relâchement.
      if (Math.abs(spinVelocity) > 0.5) {
        let velocity = Math.max(-14, Math.min(14, spinVelocity));
        let position = spinIndex;
        let lastT = performance.now();
        const friction = 0.94; // décroissance par frame d'animation

        const step = () => {
          const now = performance.now();
          const dt = Math.min(48, now - lastT);
          lastT = now;
          position += (velocity * dt) / 1000;
          showSpinFrame(Math.round(position));
          velocity *= friction;
          if (Math.abs(velocity) > 0.4) {
            spinInertiaTimer = requestAnimationFrame(step);
          } else {
            spinInertiaTimer = null;
          }
        };
        spinInertiaTimer = requestAnimationFrame(step);
      }
    }

    function spinStep(direction) {
      stopSpinIntro();
      stopSpinInertia();
      if (spinHint) spinHint.classList.remove("is-visible");
      showSpinFrame(spinIndex + direction);
    }

    function openFittingRoom(product) {
      if (!SPIN_FRAMES[product.id]) return;
      if (fittingTitle) fittingTitle.textContent = product.name;
      if (fittingColorEl) fittingColorEl.textContent = `${product.category} — ${product.color}`;
      openFittingSpin(product);
      fittingOverlay.hidden = false;
      // Reflow avant d'ajouter la classe pour que la transition de rideau joue.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => fittingOverlay.classList.add("is-open"));
      });
    }

    function closeFittingRoom() {
      stopSpinIntro();
      stopSpinInertia();
      fittingOverlay.classList.remove("is-open");
      setTimeout(() => {
        fittingOverlay.hidden = true;
      }, 700);
    }

    if (modalFittingBtn) {
      modalFittingBtn.addEventListener("click", () => {
        if (currentProduct) openFittingRoom(currentProduct);
      });
    }

    fittingClose.addEventListener("click", closeFittingRoom);
    fittingOverlay.addEventListener("click", (e) => {
      if (e.target === fittingOverlay) closeFittingRoom();
    });
    if (fittingControls) {
      fittingControls.addEventListener("click", (e) => {
        const sizeBtn = e.target.closest("button[data-size]");
        if (sizeBtn) setFittingSize(sizeBtn.dataset.size);
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !fittingOverlay.hidden) closeFittingRoom();
    });

    fittingFigure.addEventListener("pointerdown", spinPointerDown);
    fittingFigure.addEventListener("pointermove", spinPointerMove);
    fittingFigure.addEventListener("pointerup", spinPointerUp);
    fittingFigure.addEventListener("pointercancel", spinPointerUp);
    if (spinPrevBtn) spinPrevBtn.addEventListener("click", () => spinStep(-1));
    if (spinNextBtn) spinNextBtn.addEventListener("click", () => spinStep(1));
  }

  // ---- Nav mobile ----
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const open = mainNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // ---- Year ----
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---- Newsletter / contact forms ----
  const newsletterForm = document.getElementById("newsletter-form");
  const formNote = document.getElementById("form-note");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = newsletterForm.querySelector("input[type=email]").value;
      if (formNote) formNote.textContent = "Inscription en cours…";
      try {
        const r = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (formNote) formNote.textContent = r.ok ? "Merci, vous êtes inscrit·e." : "Erreur, réessayez.";
        if (r.ok) newsletterForm.reset();
      } catch (err) {
        if (formNote) formNote.textContent = "Erreur réseau.";
      }
    });
  }
  const contactForm = document.getElementById("contact-form");
  const contactNote = document.getElementById("contact-form-note");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(contactForm);
      if (contactNote) contactNote.textContent = "Envoi…";
      try {
        const r = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: fd.get("name"), email: fd.get("email"), message: fd.get("message") }),
        });
        if (contactNote) contactNote.textContent = r.ok ? "Message envoyé." : "Erreur, réessayez.";
        if (r.ok) contactForm.reset();
      } catch (err) {
        if (contactNote) contactNote.textContent = "Erreur réseau.";
      }
    });
  }
})();
