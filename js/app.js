(function () {
  const state = {
    items: [],
    selectedTags: new Set(),
  };

  const $items = document.getElementById('items');
  const $filters = document.getElementById('filters');
  const $empty = document.getElementById('empty');
  const $modal = document.getElementById('reserve-modal');
  const $form = document.getElementById('reserve-form');
  const $name = document.getElementById('reserver-name');
  const $cancel = document.getElementById('reserve-cancel');
  const $imageModal = document.getElementById('image-modal');
  const $imageModalImg = $imageModal.querySelector('img');
  const $imageModalClose = document.getElementById('image-modal-close');
  const $filterHint = document.getElementById('filter-hint');
  const $surpriseBtn = document.getElementById('surprise-btn');
  const $toast = document.getElementById('toast');

  let toastTimer = null;
  function toast(msg, kind) {
    if (!$toast) return;
    $toast.textContent = msg;
    $toast.className = 'toast' + (kind === 'err' ? ' toast--err' : '');
    $toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      $toast.hidden = true;
    }, kind === 'err' ? 4000 : 1400);
  }

  let pendingReserveId = null;
  let pendingReserveBtn = null;

  init().catch((err) => {
    console.error(err);
    showFatal('Něco se podělalo. Zkus to znovu.');
  });

  async function init() {
    if (!window.sb) {
      showFatal('Chybí konfigurace Supabase. Zkopíruj js/config.example.js → js/config.js.');
      return;
    }

    await loadItems();
    renderFilters();
    renderItems();
    wireModal();
    $surpriseBtn.addEventListener('click', doSurprise);
  }

  function showFatal(msg) {
    $items.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'error';
    li.textContent = msg;
    $items.appendChild(li);
  }

  async function loadItems() {
    const { data, error } = await window.sb
      .from('wishlist_items')
      .select('*')
      .is('deleted_at', null)
      .order('reserved', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    state.items = data || [];
  }

  function sortItems() {
    state.items.sort((a, b) => {
      if (a.reserved !== b.reserved) return a.reserved ? 1 : -1;
      const posDiff = (a.position || 0) - (b.position || 0);
      if (posDiff !== 0) return posDiff;
      return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
    });
  }

  function allTags() {
    const t = new Set();
    for (const it of state.items) {
      for (const tag of it.tags || []) t.add(tag);
    }
    return [...t].sort((a, b) => a.localeCompare(b, 'cs'));
  }

  function renderFilters() {
    const tags = allTags();
    $filters.innerHTML = '';
    $filters.appendChild(
      filterButton('Vše', state.selectedTags.size === 0, () => {
        state.selectedTags.clear();
        renderFilters();
        renderItems();
      }),
    );
    for (const tag of tags) {
      const active = state.selectedTags.has(tag);
      $filters.appendChild(
        filterButton(tag, active, () => {
          if (active) state.selectedTags.delete(tag);
          else state.selectedTags.add(tag);
          renderFilters();
          renderItems();
        }),
      );
    }
    $filterHint.hidden = state.selectedTags.size < 2;
  }

  function filterButton(label, active, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter' + (active ? ' filter--active' : '');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function visibleItems() {
    if (state.selectedTags.size === 0) return state.items;
    return state.items.filter((it) => {
      const set = new Set(it.tags || []);
      for (const sel of state.selectedTags) if (!set.has(sel)) return false;
      return true;
    });
  }

  function renderItems() {
    const items = visibleItems();
    $empty.hidden = items.length !== 0;
    $items.innerHTML = '';
    let reservedHeaderShown = false;
    for (const it of items) {
      if (it.reserved && !reservedHeaderShown) {
        const heading = document.createElement('li');
        heading.className = 'items-section-heading';
        heading.textContent = 'Rezervováno';
        $items.appendChild(heading);
        reservedHeaderShown = true;
      }
      $items.appendChild(renderCard(it));
    }
  }

  // --- Placeholder dárkové krabičky ----------------------------------------
  // Dárek bez obrázku dostane místo prázdna plochou krabičku. Kreslí se jako
  // inline SVG — žádné externí soubory a ostré na retině. Barvy sahají na tokeny
  // v :root, takže se placeholdery přebarví spolu se zbytkem webu.
  //
  // Varianta se vybírá deterministicky z ID dárku, ne náhodně: stejný dárek má
  // vždycky stejnou krabičku (jinak by poskakovala při každém filtru a rezervaci),
  // ale dva různé dárky vedle sebe vypadají jinak.

  // Stuha a mašle jsou vždycky v kontrastní značkové barvě, ne světlé. Placeholder
  // nemá žádnou podkladovou dlaždici (držíme pravidlo „žádná vnořená pozadí"),
  // takže světlá mašle, která přesahuje nad víko, by se na bílé kartě ztratila.
  const GIFT_BOXES = [
    { paper: 'var(--accent)', mark: 'var(--bg)', ribbon: 'var(--price)',  pattern: 'solid' },
    { paper: 'var(--accent)', mark: 'var(--bg)', ribbon: 'var(--price)',  pattern: 'diagonal' },
    { paper: 'var(--accent)', mark: 'var(--bg)', ribbon: 'var(--price)',  pattern: 'dots' },
    { paper: 'var(--accent)', mark: 'var(--bg)', ribbon: 'var(--price)',  pattern: 'grid' },
    { paper: 'var(--accent)', mark: 'var(--bg)', ribbon: 'var(--price)',  pattern: 'stars' },
    { paper: 'var(--price)',  mark: 'var(--bg)', ribbon: 'var(--accent)', pattern: 'solid' },
    { paper: 'var(--price)',  mark: 'var(--bg)', ribbon: 'var(--accent)', pattern: 'vertical' },
    { paper: 'var(--price)',  mark: 'var(--bg)', ribbon: 'var(--accent)', pattern: 'dots' },
    { paper: 'var(--price)',  mark: 'var(--bg)', ribbon: 'var(--accent)', pattern: 'stars' },
  ];

  function hashIndex(str, mod) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % mod;
  }

  function starPath(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
    }
    return `M${pts.join('L')}Z`;
  }

  // Vzor se kreslí přes celou krabičku a ořízne se clipPath na víko + tělo.
  function giftPattern(kind, color) {
    const p = [];
    if (kind === 'vertical') {
      for (let x = 19; x < 66; x += 8) p.push(`<rect x="${x}" y="24" width="3" height="43" fill="${color}"/>`);
    } else if (kind === 'diagonal') {
      for (let i = -3; i < 9; i += 1) {
        const x = i * 11;
        p.push(`<path d="M${x} 70 L${x + 26} 21" stroke="${color}" stroke-width="3.6" fill="none"/>`);
      }
    } else if (kind === 'dots') {
      for (let y = 29; y < 68; y += 9) {
        for (let x = 19; x < 67; x += 9) p.push(`<circle cx="${x}" cy="${y}" r="1.9" fill="${color}"/>`);
      }
    } else if (kind === 'grid') {
      for (let y = 27; y < 68; y += 6) {
        for (let x = 17; x < 68; x += 6) p.push(`<circle cx="${x}" cy="${y}" r="1.1" fill="${color}"/>`);
      }
    } else if (kind === 'stars') {
      // Mimo středový pruh stuhy (x 35,5–44,5), ať se hvězdy neschovají pod ní.
      const spots = [[22, 31], [55, 32], [27, 47], [59, 48], [21, 60], [51, 60]];
      for (const [cx, cy] of spots) p.push(`<path d="${starPath(cx, cy, 3.2)}" fill="${color}"/>`);
    }
    return p.join('');
  }

  function giftPlaceholder(it) {
    const seed = String(it.id || it.title || '');
    const v = GIFT_BOXES[hashIndex(seed, GIFT_BOXES.length)];
    const uid = 'gb-' + seed.replace(/[^a-zA-Z0-9_-]/g, '');
    const svg = `<svg class="thumb thumb--placeholder" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true" focusable="false">
<defs><clipPath id="${uid}"><rect x="11" y="24" width="58" height="12" rx="1.5"/><rect x="15" y="36" width="50" height="31" rx="1.5"/></clipPath></defs>
<rect x="11" y="24" width="58" height="12" rx="1.5" fill="${v.paper}"/>
<rect x="15" y="36" width="50" height="31" rx="1.5" fill="${v.paper}"/>
<g clip-path="url(#${uid})">${giftPattern(v.pattern, v.mark)}</g>
<rect x="35.5" y="24" width="9" height="43" fill="${v.ribbon}"/>
<path d="M40 25 C 36 18 28 9 23.5 13 C 19.5 16.8 29 22.5 40 25 Z" fill="none" stroke="${v.ribbon}" stroke-width="3.4" stroke-linejoin="round"/>
<path d="M40 25 C 44 18 52 9 56.5 13 C 60.5 16.8 51 22.5 40 25 Z" fill="none" stroke="${v.ribbon}" stroke-width="3.4" stroke-linejoin="round"/>
<circle cx="40" cy="25" r="2.8" fill="${v.ribbon}"/>
</svg>`;
    const holder = document.createElement('div');
    holder.innerHTML = svg;
    return holder.firstElementChild;
  }

  function renderCard(it) {
    const li = document.createElement('li');
    li.className = 'card' + (it.reserved ? ' card--reserved' : '');
    li.dataset.id = it.id;

    if (it.image_url) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = it.image_url;
      img.alt = it.title || '';
      img.loading = 'lazy';
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        openImage(it.image_url, it.title);
      });
      li.appendChild(img);
    } else {
      // Placeholder se nekliká — v lightboxu není co zvětšovat.
      li.appendChild(giftPlaceholder(it));
    }

    const body = document.createElement('div');
    body.className = 'body';

    const titleRow = document.createElement('div');
    titleRow.className = 'title-row';
    const titleEl = document.createElement(it.link ? 'a' : 'span');
    titleEl.className = 'title';
    titleEl.textContent = it.title || '(bez názvu)';
    if (it.link) {
      titleEl.href = it.link;
      titleEl.target = '_blank';
      titleEl.rel = 'noopener noreferrer';
      const ext = document.createElement('span');
      ext.className = 'ext';
      ext.setAttribute('aria-hidden', 'true');
      ext.textContent = '↗';
      titleEl.appendChild(document.createTextNode(' '));
      titleEl.appendChild(ext);
    }
    titleRow.appendChild(titleEl);
    body.appendChild(titleRow);

    if (it.price_tier || it.variant) {
      const meta = document.createElement('div');
      meta.className = 'meta';
      if (it.price_tier) {
        const p = document.createElement('span');
        p.className = 'price';
        p.textContent = it.price_tier;
        meta.appendChild(p);
      }
      if (it.variant) {
        const v = document.createElement('span');
        v.className = 'variant';
        v.textContent = it.variant;
        meta.appendChild(v);
      }
      body.appendChild(meta);
    }

    if (it.note) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = it.note;
      body.appendChild(note);
    }

    if ((it.tags || []).length) {
      const tags = document.createElement('div');
      tags.className = 'tags';
      for (const t of it.tags) {
        const pill = document.createElement('span');
        pill.className = 'tag';
        pill.textContent = t;
        tags.appendChild(pill);
      }
      body.appendChild(tags);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    if (it.reserved) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Rezervováno';
      actions.appendChild(badge);
      if (it.reserved_by) {
        const who = document.createElement('span');
        who.className = 'reserved-by';
        who.textContent = it.reserved_by;
        actions.appendChild(who);
      }
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'btn-link';
      undo.textContent = 'Ruším rezervaci';
      undo.addEventListener('click', () => doToggle(it.id, '', undo));
      actions.appendChild(undo);
    } else {
      const reserve = document.createElement('button');
      reserve.type = 'button';
      reserve.className = 'btn-outline btn-small';
      reserve.textContent = 'Rezervovat';
      reserve.addEventListener('click', () => openModal(it.id, reserve));
      actions.appendChild(reserve);
    }
    body.appendChild(actions);

    li.appendChild(body);
    return li;
  }

  function openModal(id, btn) {
    pendingReserveId = id;
    pendingReserveBtn = btn || null;
    $name.value = '';
    if (typeof $modal.showModal === 'function') $modal.showModal();
    else $modal.setAttribute('open', '');
    setTimeout(() => $name.focus(), 0);
  }

  function closeModal() {
    if (typeof $modal.close === 'function' && $modal.open) $modal.close();
    else $modal.removeAttribute('open');
    pendingReserveId = null;
    pendingReserveBtn = null;
  }

  function wireModal() {
    $cancel.addEventListener('click', closeModal);
    $modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeModal();
    });
    $form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!pendingReserveId) return;
      const id = pendingReserveId;
      const btn = pendingReserveBtn;
      const name = $name.value.trim();
      closeModal();
      doToggle(id, name, btn);
    });
    // Click anywhere inside the lightbox closes it — backdrop, image, or ×.
    $imageModal.addEventListener('click', () => {
      if (typeof $imageModal.close === 'function' && $imageModal.open) $imageModal.close();
    });
  }

  function openImage(src, alt) {
    $imageModalImg.src = src;
    $imageModalImg.alt = alt || '';
    if (typeof $imageModal.showModal === 'function') $imageModal.showModal();
    else $imageModal.setAttribute('open', '');
  }

  async function doToggle(id, byName, btn) {
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await window.sb.rpc('toggle_reserved', {
        item_id: id,
        by_name: byName || '',
      });
      if (error) {
        console.error(error);
        toast('Něco se podělalo: ' + error.message, 'err');
        return;
      }
      const fresh = Array.isArray(data) ? data[0] : data;
      const idx = state.items.findIndex((x) => x.id === id);
      if (idx !== -1 && fresh) {
        state.items[idx] = fresh;
        sortItems();
      } else {
        await loadItems();
      }
      renderItems();
    } finally {
      if (btn && btn.isConnected) btn.disabled = false;
    }
  }

  function doSurprise() {
    const pool = visibleItems().filter((x) => !x.reserved);
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const el = $items.querySelector(`[data-id="${pick.id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1500);
  }
})();
