(function () {
  "use strict";

  // ---- Vidéo hero pilotée par le défilement ----
  const heroSection = document.getElementById("hero-video");
  const heroSticky = document.querySelector(".hero-video-sticky");
  const heroVideo = document.getElementById("hero-video-el");

  if (heroSection && heroSticky && heroVideo) {
    let duration = 0;
    let smoothedTime = 0;
    let isVisible = true;
    let rafId = null;
    // Une fois le défilement des "slides" terminé, la vidéo passe en
    // lecture bouclée normale et le texte du hero apparaît.
    let loopMode = false;

    heroVideo.addEventListener("loadedmetadata", () => {
      duration = heroVideo.duration || 0;
      // "Amorce" la vidéo pour que le scrubbing fonctionne sur Safari/iOS.
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

            // Lissage : la vidéo glisse vers la position cible au lieu de
            // sauter d'une image à l'autre à chaque événement de scroll.
            smoothedTime += (targetTime - smoothedTime) * 0.1;
            if (Math.abs(targetTime - smoothedTime) < 0.02) smoothedTime = targetTime;

            // On ne redemande une image que si l'écart est perceptible :
            // resolliciter le décodeur à chaque frame pour des micro-écarts
            // est ce qui rend le rendu saccadé plutôt que fluide.
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

    // On ne fait tourner la boucle que lorsque le hero est réellement
    // visible, pour ne pas gaspiller de cycles une fois qu'on l'a dépassé.
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

  // ---- Parallaxe au défilement (visuel de la section "La Maison") ----
  const aboutVisual = document.querySelector(".about-visual");
  const aboutImg = aboutVisual ? aboutVisual.querySelector("img") : null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (aboutVisual && aboutImg && !reduceMotion) {
    let parallaxTicking = false;

    function updateParallax() {
      const rect = aboutVisual.getBoundingClientRect();
      const vh = window.innerHeight;
      // -1 quand le visuel entre juste par le bas, +1 quand il sort par le haut.
      const progress = (vh / 2 - (rect.top + rect.height / 2)) / (vh / 2 + rect.height / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      const offset = clamped * 34;
      aboutImg.style.transform = `translateY(${offset}px) scale(1.18)`;
      parallaxTicking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!parallaxTicking) {
          requestAnimationFrame(updateParallax);
          parallaxTicking = true;
        }
      },
      { passive: true }
    );
    updateParallax();
  }

  // ---- Rendu de la grille collection ----
  const grid = document.getElementById("collection-grid");

  // Une entrée d'image peut être une simple chaîne (utilise le "fit" du
  // produit) ou un objet { src, fit } pour surcharger l'affichage d'une
  // photo précise (ex. une vraie photo ajoutée à côté d'un visuel détouré).
  function imgSrc(entry) {
    return typeof entry === "string" ? entry : entry.src;
  }

  function imgFit(entry, product) {
    return typeof entry === "string" ? product.fit : entry.fit || product.fit;
  }

  function formatPrice(value) {
    return `${value} €`;
  }

  function renderGrid() {
    grid.innerHTML = PRODUCTS.map(
      (p) => `
      <article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="Voir ${p.name}">
        <div class="thumb${imgFit(p.images[0], p) === "contain" ? " thumb-contain" : ""}">
          <img src="${imgSrc(p.images[0])}" alt="${p.name}" loading="lazy" />
          <button type="button" class="card-fav-btn" data-id="${p.id}" aria-label="Ajouter aux favoris" aria-pressed="false">♥</button>
        </div>
        <div class="info">
          <p class="cat">${p.category}</p>
          <h3>${p.name}</h3>
          <p class="desc">${p.description}</p>
          <span class="view-link">${formatPrice(p.price)} — Voir la pièce</span>
        </div>
      </article>`
    ).join("");
  }

  // ---- Modal produit ----
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
    const favActive = getFavorites().includes(product.id);
    modalFavBtn.classList.toggle("is-active", favActive);
    modalFavBtn.setAttribute("aria-pressed", String(favActive));
    modalCat.textContent = `${product.category} — ${product.color}`;
    modalTitle.textContent = product.name;
    modalPrice.textContent = formatPrice(product.price);
    modalDesc.textContent = product.description;
    modalDetails.innerHTML = product.details.map((d) => `<li>${d}</li>`).join("");

    const sizes = product.sizes || [];
    selectedSize = sizes[0] || null;
    modalSizes.innerHTML = sizes
      .map(
        (s, i) =>
          `<button type="button" data-size="${s}" class="${i === 0 ? "active" : ""}">${s}</button>`
      )
      .join("");
    modalSizes.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSize = btn.dataset.size;
        modalSizes.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    modalThumbs.innerHTML =
      product.images.length > 1
        ? product.images
            .map(
              (entry, i) =>
                `<img src="${imgSrc(entry)}" alt="${product.name} — vue ${i + 1}" data-index="${i}" />`
            )
            .join("")
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
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}
  }

  let lastAddedKey = null;

  function bumpCartCount() {
    cartCountEl.classList.remove("is-bumping");
    void cartCountEl.offsetWidth; // force le redémarrage de l'animation
    cartCountEl.classList.add("is-bumping");
  }

  function addToCart(productId, size, qty) {
    const cart = getCart();
    const existing = cart.find((item) => item.id === productId && item.size === size);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id: productId, size, qty });
    }
    saveCart(cart);
    lastAddedKey = `${productId}::${size}`;
    renderCart();
    bumpCartCount();
  }

  function updateCartQty(index, qty) {
    const cart = getCart();
    if (!cart[index]) return;
    if (qty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].qty = qty;
    }
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
    return getCart()
      .map((item, index) => {
        const product = PRODUCTS.find((p) => p.id === item.id);
        if (!product) return null;
        return { index, item, product };
      })
      .filter(Boolean);
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

    cartItemsEl.innerHTML = lines
      .map(({ index, item, product }) => {
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
      })
      .join("");
    lastAddedKey = null;

    cartItemsEl.querySelectorAll(".cart-item").forEach((el) => {
      const index = Number(el.dataset.index);
      const line = lines.find((l) => l.index === index);
      el.querySelector(".cart-qty-minus").addEventListener("click", () =>
        updateCartQty(index, line.item.qty - 1)
      );
      el.querySelector(".cart-qty-plus").addEventListener("click", () =>
        updateCartQty(index, line.item.qty + 1)
      );
      el.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(index));
    });

    renderCartSuggestions(lines);
  }

  function renderCartSuggestions(lines) {
    const suggestBox = document.getElementById("cart-suggestions");
    const suggestList = document.getElementById("cart-suggest-list");
    if (!suggestBox || !suggestList) return;

    const cartIds = new Set(lines.map((l) => l.item.id));
    const cartCategories = new Set(lines.map((l) => l.product.category));
    const pool = PRODUCTS.filter((p) => !cartIds.has(p.id));
    const suggestions = [
      ...pool.filter((p) => cartCategories.has(p.category)),
      ...pool.filter((p) => !cartCategories.has(p.category)),
    ].slice(0, 3);

    if (suggestions.length === 0) {
      suggestBox.hidden = true;
      return;
    }
    suggestBox.hidden = false;

    suggestList.innerHTML = suggestions
      .map(
        (p) => `
        <div class="cart-suggest-item" data-id="${p.id}">
          <img src="${imgSrc(p.images[0])}" alt="${p.name}" />
          <div class="cart-suggest-info">
            <h5>${p.name}</h5>
            <p>${formatPrice(p.price)}</p>
          </div>
          <button type="button" class="cart-suggest-add">Ajouter</button>
        </div>`
      )
      .join("");

    suggestList.querySelectorAll(".cart-suggest-item").forEach((el) => {
      const id = el.dataset.id;
      const btn = el.querySelector(".cart-suggest-add");
      btn.addEventListener("click", () => {
        const product = PRODUCTS.find((p) => p.id === id);
        const size = (product && product.sizes && product.sizes[0]) || null;
        addToCart(id, size, 1);
        btn.textContent = "Ajouté ✓";
        btn.disabled = true;
      });
    });
  }

  function openCart() {
    renderCart();
    cartOverlay.hidden = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => cartOverlay.classList.add("is-open"));
    });
  }

  function closeCart() {
    cartOverlay.classList.remove("is-open");
    setTimeout(() => {
      cartOverlay.hidden = true;
    }, 400);
  }

  cartToggle.addEventListener("click", openCart);
  cartClose.addEventListener("click", closeCart);
  cartOverlay.addEventListener("click", (e) => {
    if (e.target === cartOverlay) closeCart();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !cartOverlay.hidden) closeCart();
  });

  modalAddCart.addEventListener("click", () => {
    if (!currentProduct) return;
    if (currentProduct.sizes && currentProduct.sizes.length && !selectedSize) return;
    addToCart(currentProduct.id, selectedSize, 1);
    openCart();
  });

  cartCheckoutBtn.addEventListener("click", async () => {
    const lines = cartLines();
    if (lines.length === 0) return;

    cartCheckoutBtn.disabled = true;
    cartCheckoutBtn.textContent = "Redirection…";

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map(({ item }) => ({ id: item.id, size: item.size, qty: item.qty })),
        }),
      });

      if (!response.ok) throw new Error("checkout_failed");

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("no_url");
      }
    } catch (err) {
      cartCheckoutBtn.disabled = false;
      cartCheckoutBtn.textContent = "Passer commande";
      alert(
        "Le paiement n'est pas encore configuré sur ce site. Contactez-nous directement pour finaliser votre commande."
      );
    }
  });

  renderCart();

  // ---- Compte client (connexion par lien magique) ----
  const accountToggle = document.getElementById("account-toggle");
  const accountOverlay = document.getElementById("account-overlay");
  const accountClose = document.getElementById("account-close");
  const accountBody = document.getElementById("account-body");
  let accountEmail = null;

  function renderAccountLoggedOut(note) {
    accountBody.innerHTML = `
      <div class="account-login">
        <p class="account-intro">Connectez-vous avec votre adresse e-mail : nous vous envoyons un lien de connexion, sans mot de passe.</p>
        <form id="account-login-form">
          <input type="email" required placeholder="Votre adresse e-mail" aria-label="Adresse e-mail" id="account-login-email" />
          <button type="submit" class="btn btn-solid">Recevoir le lien de connexion</button>
        </form>
        <p class="form-note" id="account-login-note">${note || ""}</p>
      </div>
    `;
    const form = document.getElementById("account-login-form");
    const noteEl = document.getElementById("account-login-note");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("account-login-email").value.trim();
      const btn = form.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Envoi…";
      try {
        const resp = await fetch("/api/auth/request-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await resp.json();
        if (resp.ok && data.ok) {
          noteEl.textContent = "Un lien de connexion vient de vous être envoyé par e-mail.";
          form.reset();
        } else {
          throw new Error((data && data.error) || "error");
        }
      } catch (err) {
        noteEl.textContent =
          "La connexion par e-mail n'est pas encore configurée sur ce site. Contactez-nous directement pour accéder à votre compte.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Recevoir le lien de connexion";
      }
    });
  }

  async function loadOrders() {
    const listEl = document.getElementById("account-orders-list");
    if (!listEl) return;
    try {
      const resp = await fetch("/api/account/orders");
      if (!resp.ok) throw new Error("failed");
      const data = await resp.json();
      if (!data.orders || data.orders.length === 0) {
        listEl.innerHTML = `<p class="cart-empty">Aucune commande pour le moment.</p>`;
        return;
      }
      listEl.innerHTML = data.orders
        .map((order) => {
          const date = new Date(order.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const itemsHtml = order.items
            .map(
              (it) =>
                `<li>${it.qty} × ${it.product_name}${it.size ? ` (taille ${it.size})` : ""}</li>`
            )
            .join("");
          return `
            <div class="account-order">
              <div class="account-order-head">
                <span>${date}</span>
                <strong>${formatPrice(order.amountTotal / 100)}</strong>
              </div>
              <ul class="account-order-items">${itemsHtml}</ul>
              <span class="account-order-status">${order.status === "paid" ? "Payée" : order.status}</span>
            </div>`;
        })
        .join("");
    } catch (err) {
      listEl.innerHTML = `<p class="cart-empty">Impossible de charger vos commandes pour le moment.</p>`;
    }
  }

  function renderAccountLoggedIn(email) {
    accountBody.innerHTML = `
      <div class="account-loggedin">
        <p class="account-email">Connectée en tant que <strong>${email}</strong></p>
        <button type="button" class="btn" id="account-logout">Se déconnecter</button>
        <h4 class="account-orders-title">Historique des commandes</h4>
        <div id="account-orders-list" class="account-orders-list">
          <p class="cart-empty">Chargement…</p>
        </div>
      </div>
    `;
    document.getElementById("account-logout").addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      accountEmail = null;
      renderAccountLoggedOut();
    });
    loadOrders();
  }

  async function checkAccountSession() {
    try {
      const resp = await fetch("/api/account/me");
      accountEmail = resp.ok ? (await resp.json()).email : null;
    } catch (err) {
      accountEmail = null;
    }
  }

  function openAccount(note) {
    if (accountEmail) {
      renderAccountLoggedIn(accountEmail);
    } else {
      renderAccountLoggedOut(note);
    }
    accountOverlay.hidden = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => accountOverlay.classList.add("is-open"));
    });
  }

  function closeAccount() {
    accountOverlay.classList.remove("is-open");
    setTimeout(() => {
      accountOverlay.hidden = true;
    }, 400);
  }

  accountToggle.addEventListener("click", () => openAccount());
  accountClose.addEventListener("click", closeAccount);
  accountOverlay.addEventListener("click", (e) => {
    if (e.target === accountOverlay) closeAccount();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !accountOverlay.hidden) closeAccount();
  });

  checkAccountSession().then(() => {
    const params = new URLSearchParams(window.location.search);
    const accountParam = params.get("account");
    if (accountParam === "1") {
      openAccount();
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    } else if (accountParam === "expired") {
      openAccount("Ce lien de connexion n'est plus valide ou a expiré. Merci d'en demander un nouveau.");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  });

  // ---- Favoris ----
  const FAVORITES_KEY = "aelen-favorites";
  const favToggle = document.getElementById("fav-toggle");
  const favCountEl = document.getElementById("fav-count");
  const favoritesOverlay = document.getElementById("favorites-overlay");
  const favoritesClose = document.getElementById("favorites-close");
  const favoritesItemsEl = document.getElementById("favorites-items");
  const favoritesEmptyEl = document.getElementById("favorites-empty");
  const modalFavBtn = document.getElementById("modal-fav-btn");

  function getFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(list) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function toggleFavorite(id) {
    const list = getFavorites();
    const i = list.indexOf(id);
    if (i === -1) {
      list.push(id);
    } else {
      list.splice(i, 1);
    }
    saveFavorites(list);
    refreshFavoritesUI();
  }

  function refreshFavoritesUI() {
    const list = getFavorites();
    favCountEl.textContent = String(list.length);
    favCountEl.hidden = list.length === 0;

    document.querySelectorAll(".card-fav-btn").forEach((btn) => {
      const active = list.includes(btn.dataset.id);
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    if (currentProduct && modalFavBtn) {
      const active = list.includes(currentProduct.id);
      modalFavBtn.classList.toggle("is-active", active);
      modalFavBtn.setAttribute("aria-pressed", String(active));
    }

    if (!favoritesOverlay.hidden) renderFavoritesDrawer();
  }

  function renderFavoritesDrawer() {
    const list = getFavorites();
    const products = list.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
    favoritesEmptyEl.hidden = products.length > 0;

    favoritesItemsEl.innerHTML = products
      .map(
        (p) => `
        <div class="cart-item" data-id="${p.id}">
          <img src="${imgSrc(p.images[0])}" alt="${p.name}" />
          <div class="cart-item-info">
            <h4>${p.name}</h4>
            <p>${p.category}</p>
            <button type="button" class="cart-item-remove fav-view-btn">Voir la pièce</button>
          </div>
          <div class="cart-item-price">
            ${formatPrice(p.price)}
            <button type="button" class="cart-item-remove fav-remove-btn">Retirer</button>
          </div>
        </div>`
      )
      .join("");

    favoritesItemsEl.querySelectorAll(".cart-item").forEach((el) => {
      const id = el.dataset.id;
      el.querySelector(".fav-view-btn").addEventListener("click", () => {
        closeFavorites();
        openModal(id);
      });
      el.querySelector(".fav-remove-btn").addEventListener("click", () => toggleFavorite(id));
    });
  }

  function openFavorites() {
    renderFavoritesDrawer();
    favoritesOverlay.hidden = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => favoritesOverlay.classList.add("is-open"));
    });
  }

  function closeFavorites() {
    favoritesOverlay.classList.remove("is-open");
    setTimeout(() => {
      favoritesOverlay.hidden = true;
    }, 400);
  }

  favToggle.addEventListener("click", openFavorites);
  favoritesClose.addEventListener("click", closeFavorites);
  favoritesOverlay.addEventListener("click", (e) => {
    if (e.target === favoritesOverlay) closeFavorites();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !favoritesOverlay.hidden) closeFavorites();
  });

  modalFavBtn.addEventListener("click", () => {
    if (!currentProduct) return;
    toggleFavorite(currentProduct.id);
  });

  refreshFavoritesUI();

  grid.addEventListener("click", (e) => {
    const favBtn = e.target.closest(".card-fav-btn");
    if (favBtn) {
      toggleFavorite(favBtn.dataset.id);
      return;
    }
    const card = e.target.closest(".product-card");
    if (card) openModal(card.dataset.id);
  });

  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      if (e.target.closest(".card-fav-btn")) return;
      const card = e.target.closest(".product-card");
      if (card) {
        e.preventDefault();
        openModal(card.dataset.id);
      }
    }
  });

  modalClose.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  // ---- Cabine d'essayage ----
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

  // Les 7 pièces rephotographiées en studio pour la cabine (mannequin
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

  // Rotation à 360° : prises de vue par taille S/M/L, cadrées pour
  // s'enchaîner sans saut de zoom. On glisse directement sur la photo dès
  // l'ouverture de la cabine — pas de bascule "mode 360" séparée.
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
    if (!currentProduct) return;
    preloadSpinFrames(currentProduct.id, size);
    showSpinFrame(spinIndex);
  }

  function preloadSpinFrames(id, size) {
    const key = `${id}_${size}`;
    if (spinFramesCache[key]) return spinFramesCache[key];
    const imgs = SPIN_FRAMES[id][size].map((src) => {
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
    if (!frames) return;
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
    fittingNote.textContent = "";
    spinHint.classList.add("is-visible");
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
    spinHint.classList.remove("is-visible");
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
    spinHint.classList.remove("is-visible");
    showSpinFrame(spinIndex + direction);
  }

  function openFittingRoom(product) {
    fittingTitle.textContent = product.name;
    fittingColorEl.textContent = `${product.category} — ${product.color}`;
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
  fittingControls.addEventListener("click", (e) => {
    const sizeBtn = e.target.closest("button[data-size]");
    if (sizeBtn) setFittingSize(sizeBtn.dataset.size);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !fittingOverlay.hidden) closeFittingRoom();
  });

  fittingFigure.addEventListener("pointerdown", spinPointerDown);
  fittingFigure.addEventListener("pointermove", spinPointerMove);
  fittingFigure.addEventListener("pointerup", spinPointerUp);
  fittingFigure.addEventListener("pointercancel", spinPointerUp);
  spinPrevBtn.addEventListener("click", () => spinStep(-1));
  spinNextBtn.addEventListener("click", () => spinStep(1));

  // ---- Menu mobile ----
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");

  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  // ---- Newsletter (démo front-end uniquement) ----
  const form = document.getElementById("newsletter-form");
  const note = document.getElementById("form-note");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    note.textContent = "Merci ! Vous êtes bien inscrite à la newsletter AElen Paris.";
    form.reset();
  });

  // ---- Formulaire de contact ----
  const contactForm = document.getElementById("contact-form");
  const contactNote = document.getElementById("contact-form-note");

  if (contactForm && contactNote) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector("button");
      const payload = {
        name: contactForm.querySelector('[name="name"]').value.trim(),
        email: contactForm.querySelector('[name="email"]').value.trim(),
        message: contactForm.querySelector('[name="message"]').value.trim(),
      };
      btn.disabled = true;
      btn.textContent = "Envoi…";
      try {
        const resp = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (resp.ok && data.ok) {
          contactNote.textContent = "Merci, votre message a bien été envoyé. Nous vous répondrons rapidement.";
          contactForm.reset();
        } else {
          throw new Error((data && data.error) || "error");
        }
      } catch (err) {
        contactNote.textContent =
          "L'envoi n'est pas encore disponible sur ce site. Écrivez-nous directement à contact@aelenparis.fr.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Envoyer le message";
      }
    });
  }

  // ---- Année footer ----
  document.getElementById("year").textContent = new Date().getFullYear();

  renderGrid();
})();
