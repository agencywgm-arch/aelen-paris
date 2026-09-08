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

    heroVideo.addEventListener("loadedmetadata", () => {
      duration = heroVideo.duration || 0;
      // "Amorce" la vidéo pour que le scrubbing fonctionne sur Safari/iOS.
      const playAttempt = heroVideo.play();
      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt.then(() => heroVideo.pause()).catch(() => {});
      }
    });

    function tick() {
      if (duration) {
        const rect = heroSection.getBoundingClientRect();
        const scrollable = heroSection.offsetHeight - heroSticky.offsetHeight;

        if (scrollable > 0) {
          const scrolled = Math.min(Math.max(-rect.top, 0), scrollable);
          const progress = scrolled / scrollable;
          const targetTime = progress * duration;

          // Lissage : la vidéo glisse vers la position cible au lieu de
          // sauter d'une image à l'autre à chaque événement de scroll.
          smoothedTime += (targetTime - smoothedTime) * 0.15;
          if (Math.abs(targetTime - smoothedTime) < 0.02) smoothedTime = targetTime;

          // On ne redemande une image que si l'écart est perceptible :
          // resolliciter le décodeur à chaque frame pour des micro-écarts
          // est ce qui rend le rendu saccadé plutôt que fluide.
          if (Math.abs(heroVideo.currentTime - smoothedTime) > 0.033) {
            heroVideo.currentTime = smoothedTime;
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
