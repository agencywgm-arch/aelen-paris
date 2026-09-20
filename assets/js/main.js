(function () {
  "use strict";

  // ---- Vidéo hero pilotée par le défilement ----
  const heroSection = document.getElementById("hero-video");
  const heroSticky = document.querySelector(".hero-video-sticky");
  const heroVideo = document.getElementById("hero-video-el");
  const heroInner = document.querySelector(".hero-inner");

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
      if (heroInner) heroInner.classList.add("is-visible");
    }

    function exitLoopMode() {
      loopMode = false;
      heroVideo.loop = false;
      heroVideo.pause();
      if (heroInner) heroInner.classList.remove("is-visible");
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

  function addToCart(productId, size, qty) {
    const cart = getCart();
    const existing = cart.find((item) => item.id === productId && item.size === size);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id: productId, size, qty });
    }
    saveCart(cart);
    renderCart();
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
      .map(
        ({ index, item, product }) => `
        <div class="cart-item" data-index="${index}">
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
        </div>`
      )
      .join("");

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
  }

  function openCart() {
    renderCart();
    cartOverlay.hidden = false;
  }

  function closeCart() {
    cartOverlay.hidden = true;
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

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (card) openModal(card.dataset.id);
  });

  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
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
  const fittingTitle = document.getElementById("fitting-title");
  const fittingColorEl = document.getElementById("fitting-color");
  const fittingControls = document.getElementById("fitting-controls");

  // Vêtements réellement détourés (fond transparent) : ils sont plaqués tels
  // quels sur le mannequin. Les pièces absentes de cette liste retombent sur
  // une silhouette colorée — il suffit d'ajouter le fichier ici pour les
  // basculer sur la vraie photo.
  const FITTING_CUTOUTS = {
    "veste-croco-beige": "assets/img/fitting/veste-croco-beige.webp",
    "cardigan-bordeaux": "assets/img/fitting/cardigan-bordeaux.webp",
    "veste-foulard-marron": "assets/img/fitting/veste-foulard-marron.webp",
    "pull-raye-beige": "assets/img/fitting/pull-raye-beige.webp",
    "pull-raye-rouge": "assets/img/fitting/pull-raye-rouge.webp",
  };

  // Zone d'habillage par catégorie, dans le repère du mannequin (300x760).
  // Plus large que le buste : les manches débordent sur les bras.
  const GARMENT_BOX = {
    Manteaux: { x: 34, y: 128, w: 232, h: 470 },
    Vestes: { x: 37, y: 128, w: 226, h: 300 },
    Mailles: { x: 37, y: 128, w: 226, h: 300 },
  };

  // Silhouettes de repli, pour les pièces sans photo détourée.
  const GARMENT_SHAPES = {
    Manteaux:
      "M90,156 C90,144 114,137 150,137 C186,137 210,144 210,156 L226,250 L222,560 L176,560 L176,320 L124,320 L124,560 L78,560 L74,250 Z",
    Vestes:
      "M90,156 C90,144 114,137 150,137 C186,137 210,144 210,156 L224,232 L218,332 L82,332 L76,232 Z",
    Mailles:
      "M92,150 C92,138 114,132 150,132 C186,132 208,138 208,150 L228,222 L198,236 L198,350 L102,350 L102,236 L72,222 Z",
  };

  const COLOR_HEX = {
    Chocolat: "#4a2f22",
    Camel: "#b98a52",
    Marron: "#5c4033",
    "Beige doré": "#c9a876",
    Bordeaux: "#5c1f2e",
    Beige: "#cbb9a0",
    Rouge: "#a83232",
  };

  // Carrure (largeur du corps), stature (hauteur) et carnation.
  const BUILD_SCALE = { s: 0.9, m: 1, l: 1.12 };
  const HEIGHT_SCALE = { petite: 0.94, moyenne: 1, grande: 1.06 };
  const TONES = {
    clair: ["#f7efe3", "#e8d9c4", "#c9b49a"],
    hale: ["#efd9bd", "#d9b992", "#b28d63"],
    fonce: ["#c08f62", "#96684a", "#63402a"],
  };

  const fittingState = { build: "m", height: "moyenne", tone: "clair" };

  function garmentMarkup(product) {
    const box = GARMENT_BOX[product.category] || GARMENT_BOX.Vestes;
    const cutout = FITTING_CUTOUTS[product.id];
    if (cutout) {
      return `<image class="fitting-garment" href="${cutout}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMin meet" filter="url(#fit-garment-shadow)" />`;
    }
    const shape = GARMENT_SHAPES[product.category] || GARMENT_SHAPES.Vestes;
    const color = COLOR_HEX[product.color] || "#8a7860";
    return `
      <g class="fitting-garment" filter="url(#fit-garment-shadow)">
        <path d="${shape}" fill="${color}" />
        <path d="${shape}" fill="url(#fit-fabric)" />
        <path d="M150,143 L134,145 L150,192 L166,145 Z" fill="rgba(0,0,0,0.22)" />
        <rect x="76" y="270" width="148" height="15" fill="rgba(0,0,0,0.2)" />
      </g>`;
  }

  function buildFittingSVG(product) {
    return `
      <svg viewBox="0 0 300 760" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mannequin portant ${product.name}">
        <defs>
          <!-- Repère absolu : la lumière traverse tout le corps d'un bloc,
               sinon chaque membre reçoit son propre dégradé et les
               raccords entre les formes se voient. -->
          <linearGradient id="fit-skin" gradientUnits="userSpaceOnUse" x1="64" y1="80" x2="248" y2="520">
            <stop offset="0" stop-color="var(--mq-1)" />
            <stop offset="0.5" stop-color="var(--mq-2)" />
            <stop offset="1" stop-color="var(--mq-3)" />
          </linearGradient>
          <linearGradient id="fit-sheen" gradientUnits="userSpaceOnUse" x1="84" y1="0" x2="220" y2="0">
            <stop offset="0" stop-color="rgba(255,255,255,0.3)" />
            <stop offset="0.35" stop-color="rgba(255,255,255,0.04)" />
            <stop offset="1" stop-color="rgba(0,0,0,0.18)" />
          </linearGradient>
          <linearGradient id="fit-fabric" x1="0" y1="0" x2="1" y2="0.2">
            <stop offset="0" stop-color="rgba(255,255,255,0.18)" />
            <stop offset="0.45" stop-color="rgba(255,255,255,0)" />
            <stop offset="1" stop-color="rgba(0,0,0,0.25)" />
          </linearGradient>
          <radialGradient id="fit-floor">
            <stop offset="0" stop-color="rgba(0,0,0,0.5)" />
            <stop offset="1" stop-color="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="fit-glow">
            <stop offset="0" stop-color="rgba(203,183,151,0.22)" />
            <stop offset="1" stop-color="rgba(203,183,151,0)" />
          </radialGradient>
          <filter id="fit-garment-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000" flood-opacity="0.42" />
          </filter>
        </defs>

        <ellipse cx="150" cy="370" rx="150" ry="330" fill="url(#fit-glow)" />

        <g class="fitting-stature">
          <ellipse cx="150" cy="706" rx="78" ry="14" fill="url(#fit-floor)" />

          <g class="fitting-head">
            <path d="M136,108 L134,152 L166,152 L164,108 Z" fill="url(#fit-skin)" />
            <path d="M136,108 L134,152 L166,152 L164,108 Z" fill="rgba(0,0,0,0.18)" />
            <ellipse cx="150" cy="77" rx="30" ry="43" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.16)" stroke-width="1.2" />
            <ellipse cx="150" cy="77" rx="30" ry="43" fill="url(#fit-sheen)" />
          </g>

          <g class="fitting-body">
            <path d="M98,340 C96,420 106,470 110,520 C113,580 115,640 116,686 L140,686 C141,640 143,580 146,520 C149,470 150,420 150,344 Z" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.16)" stroke-width="1.2" />
            <path d="M202,340 C204,420 194,470 190,520 C187,580 185,640 184,686 L160,686 C159,640 157,580 154,520 C151,470 150,420 150,344 Z" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.16)" stroke-width="1.2" />
            <ellipse cx="124" cy="694" rx="21" ry="11" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.16)" stroke-width="1.2" />
            <ellipse cx="176" cy="694" rx="21" ry="11" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.16)" stroke-width="1.2" />

            <path d="M100,166 C88,176 82,208 80,248 C78,292 78,340 79,392 L97,394 C96,342 96,296 98,252 C100,214 104,184 112,172 Z" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.18)" stroke-width="1.2" />
            <path d="M200,166 C212,176 218,208 220,248 C222,292 222,340 221,392 L203,394 C204,342 204,296 202,252 C200,214 196,184 188,172 Z" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.18)" stroke-width="1.2" />
            <ellipse cx="88" cy="404" rx="11" ry="13" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.18)" stroke-width="1.2" />
            <ellipse cx="212" cy="404" rx="11" ry="13" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.18)" stroke-width="1.2" />

            <path d="M97,163 C97,153 118,146 150,146 C182,146 203,153 203,163 C201,196 195,232 190,268 C188,296 198,314 202,334 C202,352 180,358 150,358 C120,358 98,352 98,334 C102,314 112,296 110,268 C105,232 99,196 97,163 Z" fill="url(#fit-skin)" stroke="rgba(74,47,28,0.16)" stroke-width="1.2" />
            <path d="M97,163 C97,153 118,146 150,146 C182,146 203,153 203,163 C201,196 195,232 190,268 C188,296 198,314 202,334 C202,352 180,358 150,358 C120,358 98,352 98,334 C102,314 112,296 110,268 C105,232 99,196 97,163 Z" fill="url(#fit-sheen)" />

            ${garmentMarkup(product)}
          </g>
        </g>
      </svg>`;
  }

  function applyFittingState() {
    const body = fittingFigure.querySelector(".fitting-body");
    const stature = fittingFigure.querySelector(".fitting-stature");
    if (body) body.style.transform = `scaleX(${BUILD_SCALE[fittingState.build] || 1})`;
    if (stature) stature.style.transform = `scaleY(${HEIGHT_SCALE[fittingState.height] || 1})`;

    const tone = TONES[fittingState.tone] || TONES.clair;
    fittingFigure.style.setProperty("--mq-1", tone[0]);
    fittingFigure.style.setProperty("--mq-2", tone[1]);
    fittingFigure.style.setProperty("--mq-3", tone[2]);

    fittingControls.querySelectorAll("button").forEach((btn) => {
      const group = btn.dataset.group;
      btn.classList.toggle("active", fittingState[group] === btn.dataset.value);
    });
  }

  function openFittingRoom(product) {
    fittingTitle.textContent = product.name;
    fittingColorEl.textContent = `${product.category} — ${product.color}`;
    fittingFigure.innerHTML = buildFittingSVG(product);
    applyFittingState();
    fittingOverlay.hidden = false;
    // Reflow avant d'ajouter la classe pour que la transition de rideau joue.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => fittingOverlay.classList.add("is-open"));
    });
  }

  function closeFittingRoom() {
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
    const btn = e.target.closest("button[data-group]");
    if (!btn) return;
    fittingState[btn.dataset.group] = btn.dataset.value;
    applyFittingState();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !fittingOverlay.hidden) closeFittingRoom();
  });

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

  // ---- Année footer ----
  document.getElementById("year").textContent = new Date().getFullYear();

  renderGrid();
})();
