// Reads window.WISHLIST_CONFIG (from config.js) and the UMD supabase-js
// global, then exposes the created client as window.sb.
(function () {
  const cfg = window.WISHLIST_CONFIG;
  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    console.error('Chybí js/config.js. Zkopíruj js/config.example.js a doplň hodnoty.');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('supabase-js se nenačetl ze CDN.');
    return;
  }
  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
})();
