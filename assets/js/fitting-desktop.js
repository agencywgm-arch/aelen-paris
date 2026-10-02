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

    // Molette / pavé tactile : on cumule le défilement et on avance d'une
    // frame tous les WHEEL_STEP px. Avant, chaque petit événement du pavé
    // tactile (des dizaines par geste) faisait tourner d'une frame : rotation
    // beaucoup trop rapide et saccadée. Écouté sur toute la cabine pour que
    // la page derrière ne défile jamais.
    var WHEEL_STEP = 28;
    var wheelAccum = 0;
    var wheelResetTimer = null;
    if (overlay) overlay.addEventListener(
      "wheel",
      function (e) {
        if (overlay.hidden) return;
        e.preventDefault();
        e.stopPropagation();
        if (hint) hint.classList.remove("is-visible");
        // Souris classique en « lignes » : on convertit en pixels.
        var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        var delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
        wheelAccum += delta;
        var steps = 0;
        while (Math.abs(wheelAccum) >= WHEEL_STEP && steps < 4) {
          var btn = wheelAccum > 0 ? next : prev;
          if (btn) btn.click();
          wheelAccum -= wheelAccum > 0 ? WHEEL_STEP : -WHEEL_STEP;
          steps++;
        }
        if (steps === 4) wheelAccum = 0;
        clearTimeout(wheelResetTimer);
        wheelResetTimer = setTimeout(function () { wheelAccum = 0; }, 200);
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
    // Le pointerdown fait déjà avancer d'une frame : on ignore le « click »
    // natif qui suit le relâchement, sinon chaque appui tournait de 2 frames.
    // (Les clics programmés — maintien, molette — et le clavier passent.)
    var swallowNextClick = false;
    [prev, next].forEach(function (btn) {
      btn.addEventListener(
        "click",
        function (e) {
          if (e.isTrusted && swallowNextClick) {
            swallowNextClick = false;
            e.stopImmediatePropagation();
          }
        },
        true
      );
      btn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        swallowNextClick = true;
        startHold(btn);
      });
      btn.addEventListener("pointerup", stopHold);
      btn.addEventListener("pointerleave", stopHold);
      btn.addEventListener("pointercancel", stopHold);
    });

    // Sur mobile (pas de molette), on garde le texte « Glissez pour faire tourner ».
    if (hint && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      hint.textContent = "↔ Glissez ou utilisez la molette";
    }
  });
})();
