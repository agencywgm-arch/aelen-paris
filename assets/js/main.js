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

  function renderGrid() {
    grid.innerHTML = PRODUCTS.map(
      (p) => `
      <article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="Voir ${p.name}">
        <div class="thumb${p.fit === "contain" ? " thumb-contain" : ""}">
          <img src="${p.images[0]}" alt="${p.name}" loading="lazy" />
        </div>
        <div class="info">
          <p class="cat">${p.category}</p>
          <h3>${p.name}</h3>
          <p class="desc">${p.description}</p>
          <span class="view-link">Voir la pièce</span>
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
  let currentProduct = null;

  function selectImage(product, index) {
    modalImage.src = product.images[index];
    modalImage.alt = product.name;
    modalImage.parentElement.classList.toggle("modal-image-contain", product.fit === "contain");
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
    modalDesc.textContent = product.description;
    modalDetails.innerHTML = product.details.map((d) => `<li>${d}</li>`).join("");

    modalThumbs.innerHTML =
      product.images.length > 1
        ? product.images
            .map(
              (src, i) =>
                `<img src="${src}" alt="${product.name} — vue ${i + 1}" data-index="${i}" />`
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
  const fittingSizeButtons = document.querySelectorAll("#fitting-sizes button");

  // Silhouettes de vêtement très simplifiées par catégorie, positionnées
  // sur le buste du mannequin (viewBox 0 0 240 560).
  const GARMENT_SHAPES = {
    Manteaux:
      "M75,95 L60,140 L64,478 L100,478 L100,258 L140,258 L140,478 L176,478 L180,140 L165,95 C150,85 90,85 75,95 Z",
    Vestes:
      "M75,95 L62,140 L66,250 L174,250 L178,140 L165,95 C150,85 90,85 75,95 Z",
    Mailles:
      "M80,92 C80,80 160,80 160,92 L172,150 L150,160 L150,290 L90,290 L90,160 L68,150 Z",
  };

  // Couleurs approximatives associées aux libellés utilisés dans products-data.js.
  const COLOR_HEX = {
    Chocolat: "#4a2f22",
    Camel: "#b98a52",
    Marron: "#5c4033",
    "Beige doré": "#c9a876",
    Bordeaux: "#5c1f2e",
    Beige: "#cbb9a0",
    Rouge: "#a83232",
  };

  const SIZE_SCALE = { s: 0.88, m: 1, l: 1.16 };

  function buildFittingSVG(product) {
    const garmentPath = GARMENT_SHAPES[product.category] || GARMENT_SHAPES.Vestes;
    const garmentColor = COLOR_HEX[product.color] || "#8a7860";
    return `
      <svg viewBox="0 0 240 560" xmlns="http://www.w3.org/2000/svg">
        <g class="fitting-body-group">
          <ellipse cx="101" cy="548" rx="20" ry="12" fill="#e7ddcb" />
          <ellipse cx="139" cy="548" rx="20" ry="12" fill="#e7ddcb" />
          <rect x="88" y="270" width="26" height="270" rx="13" fill="#e7ddcb" />
          <rect x="126" y="270" width="26" height="270" rx="13" fill="#e7ddcb" />
          <rect x="55" y="100" width="22" height="170" rx="11" fill="#e7ddcb" transform="rotate(6 66 100)" />
          <rect x="163" y="100" width="22" height="170" rx="11" fill="#e7ddcb" transform="rotate(-6 174 100)" />
          <path d="M78,96 C78,90 90,88 120,88 C150,88 162,90 162,96 L168,230 C168,255 150,270 120,270 C90,270 72,255 72,230 Z" fill="#e7ddcb" />
          <ellipse cx="120" cy="44" rx="24" ry="28" fill="#e7ddcb" />
          <rect x="110" y="70" width="20" height="18" rx="6" fill="#e7ddcb" />
          <path d="${garmentPath}" fill="${garmentColor}" stroke="rgba(28,25,23,0.35)" stroke-width="1.5" />
        </g>
      </svg>
    `;
  }

  function setFittingSize(size) {
    const group = fittingFigure.querySelector(".fitting-body-group");
    if (group) group.style.transform = `scaleX(${SIZE_SCALE[size] || 1})`;
    fittingSizeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.size === size);
    });
  }

  function openFittingRoom(product) {
    fittingTitle.textContent = product.name;
    fittingColorEl.textContent = `${product.category} — ${product.color}`;
    fittingFigure.innerHTML = buildFittingSVG(product);
    setFittingSize("m");
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
  fittingSizeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setFittingSize(btn.dataset.size));
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
