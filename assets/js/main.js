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
  const fittingPhoto = document.getElementById("fitting-photo");
  const fittingTitle = document.getElementById("fitting-title");
  const fittingColorEl = document.getElementById("fitting-color");
  const fittingNote = document.getElementById("fitting-note");
  const fittingControls = document.getElementById("fitting-controls");
  const spinToggleGroup = document.getElementById("spin-toggle-group");
  const spinToggleBtn = document.getElementById("spin-toggle-btn");
  const spinHint = document.getElementById("spin-hint");
  const spinPrevBtn = document.getElementById("spin-prev");
  const spinNextBtn = document.getElementById("spin-next");

  // Photos générées : la même styliste/mannequin virtuelle rephotographiée
  // en studio pour chaque pièce, en trois carrures (S/M/L) pour un aperçu
  // fidèle plutôt qu'un simple étirement d'image.
  const FITTING_PHOTOS = {
    "trench-chocolat": {
      s: "assets/img/fitting-tryons/trench-chocolat-s.webp",
      m: "assets/img/fitting-tryons/trench-chocolat-m.webp",
      l: "assets/img/fitting-tryons/trench-chocolat-l.webp",
    },
    "trench-beige": {
      s: "assets/img/fitting-tryons/trench-beige-s.webp",
      m: "assets/img/fitting-tryons/trench-beige-m.webp",
      l: "assets/img/fitting-tryons/trench-beige-l.webp",
    },
    "veste-croco-beige": {
      s: "assets/img/fitting-tryons/veste-croco-beige-s.webp",
      m: "assets/img/fitting-tryons/veste-croco-beige-m.webp",
      l: "assets/img/fitting-tryons/veste-croco-beige-l.webp",
    },
    "cardigan-bordeaux": {
      s: "assets/img/fitting-tryons/cardigan-bordeaux-s.webp",
      m: "assets/img/fitting-tryons/cardigan-bordeaux-m.webp",
      l: "assets/img/fitting-tryons/cardigan-bordeaux-l.webp",
    },
    "veste-foulard-marron": {
      s: "assets/img/fitting-tryons/veste-foulard-marron-s.webp",
      m: "assets/img/fitting-tryons/veste-foulard-marron-m.webp",
      l: "assets/img/fitting-tryons/veste-foulard-marron-l.webp",
    },
    "pull-raye-beige": {
      s: "assets/img/fitting-tryons/pull-raye-beige-s.webp",
      m: "assets/img/fitting-tryons/pull-raye-beige-m.webp",
      l: "assets/img/fitting-tryons/pull-raye-beige-l.webp",
    },
    "pull-raye-rouge": {
      s: "assets/img/fitting-tryons/pull-raye-rouge-s.webp",
      m: "assets/img/fitting-tryons/pull-raye-rouge-m.webp",
      l: "assets/img/fitting-tryons/pull-raye-rouge-l.webp",
    },
  };

  // Rotation à 360° : 16 prises de vue (tous les 22,5°) par taille S/M/L,
  // générées et cadrées pour s'enchaîner sans saut de zoom. Glisser à l'écran
  // fait défiler ces 16 images comme un flipbook.
  const SPIN_FRAME_COUNT = 16;
  const SPIN_SIZES = ["s", "m", "l"];
  const SPIN_FRAMES = {};
  Object.keys(FITTING_PHOTOS).forEach((id) => {
    SPIN_FRAMES[id] = {};
    SPIN_SIZES.forEach((size) => {
      SPIN_FRAMES[id][size] = Array.from(
        { length: SPIN_FRAME_COUNT },
        (_, i) => `assets/img/spin360/${id}/${size}/frame_${String(i).padStart(2, "0")}.webp`
      );
    });
  });

  let fittingSize = "m";
  let spinMode = false;
  let spinIndex = 0;
  let spinFramesCache = {};
  let spinDragging = false;
  let spinDragStartX = 0;
  let spinDragStartIndex = 0;
  let spinIntroTimer = null;
  let spinInertiaTimer = null;
  let spinLastMoveX = 0;
  let spinLastMoveT = 0;
  let spinVelocity = 0; // frames par seconde, signé
  const SPIN_FRAMES_PER_STEP = 16; // px de glisse pour avancer d'une frame

  function resolveFittingPhoto(product, size) {
    const set = FITTING_PHOTOS[product.id];
    if (!set) return { src: null, fallback: false };
    if (set[size]) return { src: set[size], fallback: false };
    const fallback = set.m || set.l || set.s;
    return { src: fallback, fallback: true };
  }

  function setFittingSize(size) {
    fittingSize = size;
    fittingControls.querySelectorAll("button[data-size]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.size === size);
    });
    if (!currentProduct) return;

    if (spinMode) {
      preloadSpinFrames(currentProduct.id, size);
      showSpinFrame(spinIndex);
      return;
    }

    const { src, fallback } = resolveFittingPhoto(currentProduct, size);
    fittingNote.textContent = fallback
      ? "Aperçu en taille M — la taille " + size.toUpperCase() + " arrive bientôt pour cette pièce."
      : "";

    if (!src) return;
    fittingPhoto.classList.remove("is-visible");
    const preload = new Image();
    preload.onload = () => {
      fittingPhoto.src = src;
      requestAnimationFrame(() => fittingPhoto.classList.add("is-visible"));
    };
    preload.src = src;
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

  function showSpinFrame(index) {
    const frames = spinFramesCache[`${currentProduct.id}_${fittingSize}`];
    if (!frames) return;
    spinIndex = ((index % frames.length) + frames.length) % frames.length;
    fittingPhoto.src = frames[spinIndex].src;
    fittingPhoto.classList.add("is-visible");
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
    }, 90);
  }

  function enableSpinMode() {
    if (!currentProduct || !SPIN_FRAMES[currentProduct.id]) return;
    spinMode = true;
    spinToggleBtn.dataset.spin = "on";
    spinToggleBtn.classList.add("active");
    fittingNote.textContent = "";
    fittingFigure.classList.add("is-spin");
    spinHint.classList.add("is-visible");
    preloadSpinFrames(currentProduct.id, fittingSize);
    showSpinFrame(0);
    playSpinIntro();
  }

  function disableSpinMode() {
    spinMode = false;
    stopSpinIntro();
    stopSpinInertia();
    spinToggleBtn.dataset.spin = "off";
    spinToggleBtn.classList.remove("active");
    fittingFigure.classList.remove("is-spin");
    spinHint.classList.remove("is-visible");
    setFittingSize(fittingSize);
  }

  function spinPointerDown(e) {
    if (!spinMode || e.target.closest(".spin-arrow")) return;
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
    if (!spinMode || !spinDragging) return;
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
    if (!spinMode) return;
    stopSpinIntro();
    stopSpinInertia();
    spinHint.classList.remove("is-visible");
    showSpinFrame(spinIndex + direction);
  }

  function openFittingRoom(product) {
    fittingTitle.textContent = product.name;
    fittingColorEl.textContent = `${product.category} — ${product.color}`;
    fittingPhoto.classList.remove("is-visible");
    fittingPhoto.alt = product.name;
    disableSpinMode();
    spinToggleGroup.hidden = !SPIN_FRAMES[product.id];
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
    if (sizeBtn) {
      setFittingSize(sizeBtn.dataset.size);
      return;
    }
    if (e.target.closest("#spin-toggle-btn")) {
      if (spinMode) disableSpinMode();
      else enableSpinMode();
    }
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

  // ---- Année footer ----
  document.getElementById("year").textContent = new Date().getFullYear();

  renderGrid();
})();
