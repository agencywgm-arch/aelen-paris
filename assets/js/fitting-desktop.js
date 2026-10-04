/**
 * Commandes de rotation de la cabine sur ordinateur.
 * Il n'y a plus de glissé / molette : on tourne avec les flèches de l'écran
 * (un appui = une vue, maintien = rotation continue) ou avec les touches ← / →.
 * La rotation elle-même est dans main.js (clics sur #spin-prev / #spin-next).
 */
(function () {
  "use strict";
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var prev = document.getElementById("spin-prev");
    var next = document.getElementById("spin-next");
    var overlay = document.getElementById("fitting-overlay");
    var hint = document.getElementById("spin-hint");
    if (!prev || !next || !overlay) return;

    function hideHint() {
      if (hint) hint.classList.remove("is-visible");
    }

    // Maintien d'une flèche = rotation continue.
    var holdTimer = null;
    var holdDelay = null;
    function startHold(btn) {
      hideHint();
      btn.click();
      clearTimeout(holdDelay);
      clearInterval(holdTimer);
      // Petit délai avant la répétition : un simple appui ne tourne que d'une vue.
      holdDelay = setTimeout(function () {
        holdTimer = setInterval(function () { btn.click(); }, 45);
      }, 260);
    }
    function stopHold() {
      clearTimeout(holdDelay);
      clearInterval(holdTimer);
      holdDelay = null;
      holdTimer = null;
    }

    // Le pointerdown fait déjà avancer d'une vue : on ignore le « click » natif qui
    // suit le relâchement, sinon chaque appui tournait de 2 vues. (Les clics
    // programmés — maintien, clavier — passent.)
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

    // Clavier : ← / → font tourner (la touche maintenue répète toute seule).
    document.addEventListener("keydown", function (e) {
      if (overlay.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); hideHint(); prev.click(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); hideHint(); next.click(); }
    });

    // Sur ordinateur, on le dit aussi avec le clavier.
    if (hint && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      hint.textContent = "‹ › Flèches ou touches ← →";
    }
  });
})();
