// Small, dependency-free domain helpers shared by the public UI and Node tests.
// Keep this file free of DOM and Supabase access so its behaviour stays easy to
// verify without introducing a build step or test framework.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WishlistCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function sortItems(items) {
    return [...items].sort((a, b) => {
      if (a.reserved !== b.reserved) return a.reserved ? 1 : -1;
      const posDiff = (a.position || 0) - (b.position || 0);
      if (posDiff !== 0) return posDiff;
      return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
    });
  }

  function allTags(items) {
    const tags = new Set();
    for (const item of items) {
      for (const tag of item.tags || []) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b, 'cs'));
  }

  function filterItems(items, selectedTag) {
    if (selectedTag === null) return items;
    return items.filter((item) => (item.tags || []).includes(selectedTag));
  }

  function pickUnreserved(items, random) {
    const pool = items.filter((item) => !item.reserved);
    if (!pool.length) return null;
    return pool[Math.floor(random() * pool.length)];
  }

  return { sortItems, allTags, filterItems, pickUnreserved };
});
