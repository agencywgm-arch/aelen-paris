// Visite guidée (mode démo) : parcourt les fonctionnalités clés du site
// en pilotant les vrais éléments de la page (clics réels sur les mêmes
// boutons qu'un visiteur utiliserait), avec un projecteur qui met en
// valeur la zone concernée et une carte d'explication.
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function click(selector) {
    const el = document.querySelector(selector);
    if (el) el.click();
    return el;
  }

  ready(function () {
    const fab = document.getElementById("tour-fab");
    if (!fab) return;

    // Le bouton ne reste visible que sur la vidéo d'accueil : une fois
    // celle-ci défilée, il disparaît pour ne pas rester en permanence
    // sur le reste du site.
    const heroSection = document.getElementById("hero-video");
    if (heroSection) {
      const fabObserver = new IntersectionObserver(
        (entries) => {
          fab.classList.toggle("is-hidden", !entries[0].isIntersecting);
        },
        { threshold: 0 }
      );
      fabObserver.observe(heroSection);
    }

    let overlay = null;
    let spotlightEl = null;
    let cardEl = null;
    let currentStep = -1;
    let active = false;

    const steps = [
      {
        title: "Bienvenue chez Ælen Paris",
        body: "Cette visite guidée montre, étape par étape, comment un·e client·e découvre et achète sur le site — de l'arrivée jusqu'à son espace personnel. Cliquez sur « Suivant » pour commencer.",
      },
      {
        title: "Précommande & liste d'attente",
        body: "Avant le lancement, les visiteurs peuvent rejoindre la liste d'attente. Le compte à rebours se configure depuis le tableau de bord staff, onglet « Liste d'attente ».",
        async enter() {
          const el = document.getElementById("waitlist");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          await wait(650);
          return el;
        },
      },
      {
        title: "La collection",
        body: "Chaque pièce est présentée en grille avec sa photo, sa catégorie et son prix. Un clic ouvre la fiche produit détaillée.",
        async enter() {
          const el = document.getElementById("collection");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          await wait(650);
          return document.getElementById("collection-grid");
        },
      },
      {
        title: "Fiche produit détaillée",
        body: "Description, matières, tailles disponibles et galerie d'images : tout ce qu'il faut pour décider. Les tailles en rupture de stock sont automatiquement désactivées.",
        async enter() {
          click(".product-card");
          await wait(350);
          return document.querySelector("#modal-overlay .modal");
        },
        async leave() {
          click("#modal-close");
          await wait(350);
        },
      },
      {
        title: "Cabine d'essayage virtuelle — 360°",
        body: "Glissez, utilisez la molette ou les flèches pour faire tourner le mannequin à 360°, et changez de silhouette (fine, classique, généreuse).",
        async enter() {
          click("#modal-fitting-btn");
          await wait(600);
          return document.getElementById("fitting-figure");
        },
        async leave() {
          click("#fitting-close");
          await wait(750);
        },
      },
      {
        title: "Ajout au panier",
        body: "Nous venons d'ajouter cette pièce à votre panier pour la démonstration. Le panier s'ouvre automatiquement avec un récapitulatif et des suggestions complémentaires.",
        async enter() {
          click("#modal-sizes button:not([disabled])");
          click("#modal-add-cart");
          await wait(500);
          return document.querySelector("#cart-overlay .cart-drawer");
        },
        async leave() {
          click("#cart-close");
          await wait(450);
        },
      },
      {
        title: "Connexion sans mot de passe",
        body: "Le client saisit son e-mail et reçoit un lien de connexion — aucun mot de passe à retenir. Une fois connecté, il retrouve son historique de commandes et peut télécharger chaque facture en PDF.",
        async enter() {
          click("#account-toggle");
          await wait(500);
          return document.querySelector("#account-overlay .cart-drawer");
        },
        async leave() {
          click("#account-close");
          await wait(450);
        },
      },
      {
        title: "Support & liste de diffusion",
        body: "Un formulaire de contact et une inscription à la newsletter permettent de rester en lien avec la maison, même en dehors d'un achat.",
        async enter() {
          const el = document.getElementById("contact");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          await wait(650);
          return el;
        },
      },
      {
        title: "Visite terminée",
        body: "C'est la fin de la démo. Vous pouvez la relancer à tout moment depuis le bouton « Visite guidée », en bas à droite du site.",
      },
    ];

    function buildOverlay() {
      overlay = document.createElement("div");
      overlay.className = "tour-overlay";
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="tour-spotlight is-hidden" id="tour-spotlight"></div>
        <div class="tour-card" id="tour-card">
          <div class="tour-card-head">
            <span class="tour-step-count" id="tour-step-count"></span>
            <button type="button" class="tour-skip" id="tour-skip">Fermer ✕</button>
          </div>
          <h3 id="tour-title"></h3>
          <p id="tour-body"></p>
          <div class="tour-dots" id="tour-dots"></div>
          <div class="tour-actions">
            <button type="button" class="tour-btn tour-btn-ghost" id="tour-prev">Précédent</button>
            <button type="button" class="tour-btn tour-btn-solid" id="tour-next">Suivant</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      spotlightEl = overlay.querySelector("#tour-spotlight");
      cardEl = overlay.querySelector("#tour-card");

      overlay.querySelector("#tour-skip").addEventListener("click", endTour);
      overlay.querySelector("#tour-prev").addEventListener("click", () => {
        if (currentStep > 0) goToStep(currentStep - 1);
      });
      overlay.querySelector("#tour-next").addEventListener("click", () => {
        if (currentStep >= steps.length - 1) endTour();
        else goToStep(currentStep + 1);
      });
      window.addEventListener("resize", () => {
        if (active) positionFor(lastTarget);
      });
    }

    let lastTarget = null;

    function positionFor(target) {
      lastTarget = target;
      const isCentered = !target;
      cardEl.classList.toggle("is-centered", isCentered);

      if (isCentered) {
        spotlightEl.classList.add("is-hidden");
        return;
      }

      const rect = target.getBoundingClientRect();
      const pad = 10;
      spotlightEl.classList.remove("is-hidden");
      spotlightEl.style.top = `${Math.max(0, rect.top - pad)}px`;
      spotlightEl.style.left = `${Math.max(0, rect.left - pad)}px`;
      spotlightEl.style.width = `${rect.width + pad * 2}px`;
      spotlightEl.style.height = `${rect.height + pad * 2}px`;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cardWidth = cardEl.offsetWidth || 360;
      const cardHeight = cardEl.offsetHeight || 220;
      const margin = 18;

      let top;
      if (rect.bottom + margin + cardHeight < vh) {
        top = rect.bottom + margin;
      } else if (rect.top - margin - cardHeight > 0) {
        top = rect.top - margin - cardHeight;
      } else {
        top = Math.max(margin, (vh - cardHeight) / 2);
      }
      let left = rect.left + rect.width / 2 - cardWidth / 2;
      left = Math.max(margin, Math.min(left, vw - cardWidth - margin));

      cardEl.style.top = `${top}px`;
      cardEl.style.left = `${left}px`;
    }

    function renderCard(step, index) {
      overlay.querySelector("#tour-step-count").textContent = `Étape ${index + 1} / ${steps.length}`;
      overlay.querySelector("#tour-title").textContent = step.title;
      overlay.querySelector("#tour-body").textContent = step.body;
      const dots = overlay.querySelector("#tour-dots");
      dots.innerHTML = steps.map((_, i) => `<span class="tour-dot${i === index ? " is-active" : ""}"></span>`).join("");
      const prevBtn = overlay.querySelector("#tour-prev");
      const nextBtn = overlay.querySelector("#tour-next");
      prevBtn.disabled = index === 0;
      nextBtn.textContent = index === steps.length - 1 ? "Terminer" : "Suivant";
    }

    let transitioning = false;

    async function goToStep(index) {
      if (index < 0 || index >= steps.length || !active || transitioning) return;
      transitioning = true;
      overlay.querySelector("#tour-next").disabled = true;
      overlay.querySelector("#tour-prev").disabled = true;
      try {
        const prevStep = steps[currentStep];
        if (prevStep && prevStep.leave) {
          try {
            await prevStep.leave();
          } catch (err) {}
        }
        if (!active) return;
        currentStep = index;
        const step = steps[index];
        let target = null;
        if (step.enter) {
          try {
            target = await step.enter();
          } catch (err) {}
        }
        if (!active) return;
        renderCard(step, index);
        await nextFrame();
        positionFor(target || null);
      } finally {
        transitioning = false;
        if (active) overlay.querySelector("#tour-prev").disabled = currentStep === 0;
        if (active) overlay.querySelector("#tour-next").disabled = false;
      }
    }

    function forceCloseAll() {
      [
        ["#fitting-overlay", "#fitting-close"],
        ["#modal-overlay", "#modal-close"],
        ["#cart-overlay", "#cart-close"],
        ["#account-overlay", "#account-close"],
      ].forEach(([overlaySel, closeSel]) => {
        const el = document.querySelector(overlaySel);
        if (el && !el.hidden) click(closeSel);
      });
    }

    async function startTour() {
      if (!overlay) buildOverlay();
      active = true;
      overlay.hidden = false;
      document.body.classList.add("tour-active");
      document.body.style.overflow = "hidden";
      await nextFrame();
      overlay.classList.add("is-open");
      currentStep = -1;
      goToStep(0);
    }

    function endTour() {
      if (!active) return;
      active = false;
      overlay.classList.remove("is-open");
      document.body.classList.remove("tour-active");
      document.body.style.overflow = "";
      forceCloseAll();
      currentStep = -1;
      setTimeout(() => {
        if (!active) overlay.hidden = true;
      }, 300);
    }

    fab.addEventListener("click", startTour);
    document.addEventListener("keydown", (e) => {
      if (!active) return;
      if (e.key === "Escape") endTour();
      else if (e.key === "ArrowRight") overlay.querySelector("#tour-next").click();
      else if (e.key === "ArrowLeft") overlay.querySelector("#tour-prev").click();
    });
  });
})();
