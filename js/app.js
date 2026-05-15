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

  let pendingReserveId = null;

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
    const surprise = document.createElement('button');
    surprise.type = 'button';
    surprise.className = 'filter filter--surprise';
    surprise.textContent = 'Překvap mě';
    surprise.addEventListener('click', doSurprise);
    $filters.appendChild(surprise);
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
    for (const it of items) $items.appendChild(renderCard(it));
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
    }

    const body = document.createElement('div');
    body.className = 'body';

    const titleRow = document.createElement('div');
    titleRow.className = 'title-row';
    const titleEl = document.createElement(it.link ? 'a' : 'span');
    titleEl.className = 'title';
    titleEl.textContent = it.title;
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
      undo.addEventListener('click', () => doToggle(it.id, ''));
      actions.appendChild(undo);
    } else {
      const reserve = document.createElement('button');
      reserve.type = 'button';
      reserve.className = 'btn-outline btn-small';
      reserve.textContent = 'Rezervovat';
      reserve.addEventListener('click', () => openModal(it.id));
      actions.appendChild(reserve);
    }
    body.appendChild(actions);

    li.appendChild(body);
    return li;
  }

  function openModal(id) {
    pendingReserveId = id;
    $name.value = '';
    if (typeof $modal.showModal === 'function') $modal.showModal();
    else $modal.setAttribute('open', '');
    setTimeout(() => $name.focus(), 0);
  }

  function closeModal() {
    if (typeof $modal.close === 'function' && $modal.open) $modal.close();
    else $modal.removeAttribute('open');
    pendingReserveId = null;
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
      const name = $name.value.trim();
      closeModal();
      doToggle(id, name);
    });
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

  async function doToggle(id, byName) {
    const { data, error } = await window.sb.rpc('toggle_reserved', {
      item_id: id,
      by_name: byName || '',
    });
    if (error) {
      console.error(error);
      alert('Něco se podělalo: ' + error.message);
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
