/* =====================================================================
 * THE BATTLE OF HOGWARTS — main.js   (bootstrap)
 * ===================================================================== */
(function () {
  'use strict';
  function boot() { if (window.UI) window.UI.init(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
