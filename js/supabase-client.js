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
  // Refuse to start with anything that isn't a publishable key — guard against
  // accidentally committing service_role or anon secret to a public repo.
  if (!String(cfg.SUPABASE_PUBLISHABLE_KEY).startsWith('sb_publishable_')) {
    console.error('SUPABASE_PUBLISHABLE_KEY must start with "sb_publishable_". Never commit service_role keys.');
    return;
  }
  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
})();
