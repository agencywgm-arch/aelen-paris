(function () {
  "use strict";

  // ---- Rendu de la grille collection ----
  const grid = document.getElementById("collection-grid");

  function renderGrid() {
    grid.innerHTML = PRODUCTS.map(
      (p) => `
      <article class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="Voir ${p.name}">
        <div class="thumb">
          <img src="${p.image}" alt="${p.name}" loading="lazy" />
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
  const modalClose = document.getElementById("modal-close");

  function openModal(id) {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) return;

    modalImage.src = product.image;
    modalImage.alt = product.name;
    modalCat.textContent = `${product.category} — ${product.color}`;
    modalTitle.textContent = product.name;
    modalDesc.textContent = product.description;
    modalDetails.innerHTML = product.details.map((d) => `<li>${d}</li>`).join("");

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
