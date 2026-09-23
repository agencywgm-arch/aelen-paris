/**
 * Améliore la rotation 360° de la cabine sur PC :
 * - bloque le drag natif des images
 * - molette souris
 * - maintien des flèches = rotation continue
 * (le glisser-déposer existe déjà dans main.js)
 */
(function () {
  "use strict";
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var figure = document.getElementById("fitting-figure");
    var photo = document.getElementById("fitting-photo");
    var photoB = document.getElementById("fitting-photo-b");
    var prev = document.getElementById("spin-prev");
    var next = document.getElementById("spin-next");
    var overlay = document.getElementById("fitting-overlay");
    var hint = document.getElementById("spin-hint");
    if (!figure || !prev || !next) return;

    // Bloque le drag HTML5 des images (principal blocage desktop).
    figure.addEventListener("dragstart", function (e) { e.preventDefault(); });
    [photo, photoB].forEach(function (img) {
      if (img) img.addEventListener("dragstart", function (e) { e.preventDefault(); });
    });

    // Empêche la sélection / drag pendant le pointerdown sur la figure
    // (renforce main.js sans le remplacer).
    figure.addEventListener(
      "pointerdown",
      function (e) {
        if (e.target.closest && e.target.closest(".spin-arrow")) return;
        e.preventDefault();
      },
      true
    );

    // Molette = une frame à la fois, fluide
    figure.addEventListener(
      "wheel",
      function (e) {
        if (!overlay || overlay.hidden) return;
        e.preventDefault();
        e.stopPropagation();
        if (hint) hint.classList.remove("is-visible");
        var btn = e.deltaY > 0 || e.deltaX > 0 ? next : prev;
        if (btn) btn.click();
      },
      { passive: false }
    );

    // Maintien flèche = rotation continue
    var holdTimer = null;
    function startHold(btn) {
      if (hint) hint.classList.remove("is-visible");
      btn.click();
      clearInterval(holdTimer);
      holdTimer = setInterval(function () { btn.click(); }, 45);
    }
    function stopHold() {
      clearInterval(holdTimer);
      holdTimer = null;
    }
    [prev, next].forEach(function (btn) {
      btn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        startHold(btn);
      });
      btn.addEventListener("pointerup", stopHold);
      btn.addEventListener("pointerleave", stopHold);
      btn.addEventListener("pointercancel", stopHold);
    });

    if (hint) {
      hint.textContent = "↔ Glissez ou utilisez la molette";
    }
  });
})();
