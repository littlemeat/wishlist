(function () {
  const $login = document.getElementById('login-section');
  const $admin = document.getElementById('admin-section');
  const $loginForm = document.getElementById('login-form');
  const $email = document.getElementById('email');
  const $password = document.getElementById('password');
  const $loginError = document.getElementById('login-error');
  const $newBtn = document.getElementById('new-btn');
  const $logoutBtn = document.getElementById('logout-btn');
  const $table = document.getElementById('admin-table');
  const $toast = document.getElementById('toast');
  const $forgotLink = document.getElementById('forgot-link');
  const $recovery = document.getElementById('recovery-section');
  const $recoveryForm = document.getElementById('recovery-form');
  const $newPassword = document.getElementById('new-password');
  const $newPasswordConfirm = document.getElementById('new-password-confirm');
  const $showDeleted = document.getElementById('show-deleted');

  let items = [];
  let toastTimer = null;
  let inRecovery = false;
  let showDeleted = false;
  const expanded = new Set();

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

  init().catch((err) => console.error(err));

  async function init() {
    if (!window.sb) {
      showLoginError('Chybí js/config.js. Zkopíruj js/config.example.js a doplň hodnoty.');
      return;
    }

    // Wire form/button handlers FIRST, synchronously, so a click or Enter
    // hitting the form during the getSession() await can't slip through to
    // native form submission (which would put email + password in the URL).
    $loginForm.addEventListener('submit', onLogin);
    $logoutBtn.addEventListener('click', () => window.sb.auth.signOut());
    $newBtn.addEventListener('click', onNew);
    $forgotLink.addEventListener('click', onForgot);
    $recoveryForm.addEventListener('submit', onRecoverySubmit);
    $showDeleted.addEventListener('change', onToggleShowDeleted);

    window.sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        inRecovery = true;
        showRecovery();
        return;
      }
      if (inRecovery) return;
      if (session) showAdmin();
      else showLogin();
    });

    const { data } = await window.sb.auth.getSession();
    if (!inRecovery) {
      if (data.session) await showAdmin();
      else showLogin();
    }
  }

  function showLogin() {
    $login.hidden = false;
    $admin.hidden = true;
    if ($recovery) $recovery.hidden = true;
  }

  async function showAdmin() {
    $login.hidden = true;
    $admin.hidden = false;
    if ($recovery) $recovery.hidden = true;
    await loadItems();
    render();
  }

  function showRecovery() {
    $login.hidden = true;
    $admin.hidden = true;
    $recovery.hidden = false;
    setTimeout(() => $newPassword.focus(), 0);
  }

  async function onForgot(e) {
    e.preventDefault();
    const email = $email.value.trim();
    if (!email) {
      showLoginError('Vyplň email — pošlu na něj odkaz na reset.');
      $email.focus();
      return;
    }
    const redirectTo = location.origin + location.pathname;
    const { error } = await window.sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      showLoginError(error.message);
      return;
    }
    toast('Odkaz na reset hesla je v emailu.');
  }

  async function onRecoverySubmit(e) {
    e.preventDefault();
    const pwd = $newPassword.value;
    const pwd2 = $newPasswordConfirm.value;
    if (pwd.length < 6) {
      toast('Heslo musí mít aspoň 6 znaků.', 'err');
      return;
    }
    if (pwd !== pwd2) {
      toast('Hesla se neshodují.', 'err');
      return;
    }
    const { error } = await window.sb.auth.updateUser({ password: pwd });
    if (error) {
      toast('Nastavení hesla selhalo: ' + error.message, 'err');
      return;
    }
    inRecovery = false;
    $newPassword.value = '';
    $newPasswordConfirm.value = '';
    toast('Heslo změněno.');
    await showAdmin();
  }

  function showLoginError(msg) {
    $loginError.textContent = msg;
    $loginError.hidden = false;
  }

  async function onLogin(e) {
    e.preventDefault();
    $loginError.hidden = true;
    const { error } = await window.sb.auth.signInWithPassword({
      email: $email.value,
      password: $password.value,
    });
    if (error) showLoginError(error.message);
  }

  async function loadItems() {
    let query = window.sb.from('wishlist_items').select('*');
    if (!showDeleted) query = query.is('deleted_at', null);
    const { data, error } = await query
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      toast('Načtení selhalo: ' + error.message, 'err');
      return;
    }
    items = data || [];
    // Prune the expanded Set so it doesn't hold ids of items that aren't
    // in the current view anymore (e.g. after toggling Zobrazit smazané).
    const currentIds = new Set(items.map((it) => it.id));
    for (const id of expanded) if (!currentIds.has(id)) expanded.delete(id);
  }

  async function onToggleShowDeleted() {
    showDeleted = $showDeleted.checked;
    await loadItems();
    render();
  }

  function render() {
    $table.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Zatím tu nic není. Klikni na „+ Nový dárek".';
      $table.appendChild(empty);
      return;
    }
    items.forEach((it, idx) => $table.appendChild(renderRow(it, idx)));
  }

  function renderRow(it, idx) {
    const isExpanded = expanded.has(it.id);
    const isDeleted = !!it.deleted_at;
    const row = document.createElement('div');
    row.className = 'admin-row'
      + (isExpanded ? ' admin-row--expanded' : '')
      + (isDeleted ? ' admin-row--deleted' : '');
    row.dataset.id = it.id;

    const header = document.createElement('div');
    header.className = 'admin-row-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'admin-row-title';
    titleEl.textContent = it.title || '(bez názvu)';
    header.appendChild(titleEl);

    if (it.reserved) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = it.reserved_by
        ? 'Rezervováno — ' + it.reserved_by
        : 'Rezervováno';
      header.appendChild(badge);
    } else {
      if (it.price_tier) {
        const p = document.createElement('span');
        p.className = 'admin-row-price';
        p.textContent = it.price_tier;
        header.appendChild(p);
      }
      if ((it.tags || []).length) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = it.tags[0];
        header.appendChild(tag);
      }
    }

    const order = document.createElement('div');
    order.className = 'admin-order';
    const up = orderBtn('↑', () => move(it.id, -1));
    const down = orderBtn('↓', () => move(it.id, +1));
    if (idx === 0) up.disabled = true;
    if (idx === items.length - 1) down.disabled = true;
    order.appendChild(up);
    order.appendChild(down);
    order.addEventListener('click', (e) => e.stopPropagation());
    header.appendChild(order);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-toggle';
    toggle.setAttribute('aria-label', isExpanded ? 'Sbalit' : 'Rozbalit');
    toggle.innerHTML = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path d="M4.5 7l4.5 4.5L13.5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    header.appendChild(toggle);

    header.addEventListener('click', () => toggleExpand(it.id));

    row.appendChild(header);

    const fields = document.createElement('div');
    fields.className = 'admin-fields';
    fields.appendChild(field('title', 'Název', it.title, 'text'));
    fields.appendChild(field('link', 'Odkaz', it.link, 'url'));
    fields.appendChild(field('price_tier', 'Cenovka', it.price_tier, 'select', ['', '€', '€€', '€€€']));
    fields.appendChild(field('image_url', 'Obrázek (URL)', it.image_url, 'url'));
    fields.appendChild(field('variant', 'Varianta', it.variant, 'text'));
    fields.appendChild(field('tags', 'Tagy (odděl čárkou)', (it.tags || []).join(', '), 'text'));
    fields.appendChild(field('note', 'Poznámka', it.note, 'textarea'));

    fields.addEventListener('change', (e) => {
      const tgt = e.target;
      const key = tgt.dataset && tgt.dataset.key;
      if (!key) return;
      const newVal = parseFieldValue(key, tgt);
      saveField(it.id, key, newVal);
      if (key === 'title') {
        titleEl.textContent = newVal || '(bez názvu)';
      }
    });

    row.appendChild(fields);

    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    if (isDeleted) {
      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'btn-link';
      restoreBtn.textContent = 'Obnovit';
      restoreBtn.addEventListener('click', () => restore(it.id));
      actions.appendChild(restoreBtn);

      const hardDel = document.createElement('button');
      hardDel.type = 'button';
      hardDel.className = 'btn-link btn-link--danger';
      hardDel.textContent = 'Smazat natrvalo';
      hardDel.addEventListener('click', () => hardDestroy(it.id));
      actions.appendChild(hardDel);
    } else {
      if (it.reserved) {
        const un = document.createElement('button');
        un.type = 'button';
        un.className = 'btn-link';
        un.textContent = 'Odrezervovat';
        un.addEventListener('click', () => unreserve(it.id));
        actions.appendChild(un);
      }
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn-link btn-link--danger';
      del.textContent = 'Smazat';
      del.addEventListener('click', () => destroy(it.id));
      actions.appendChild(del);
    }
    row.appendChild(actions);

    return row;
  }

  function toggleExpand(id) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    const row = document.querySelector(`.admin-row[data-id="${id}"]`);
    if (!row) return;
    row.classList.toggle('admin-row--expanded');
    const toggle = row.querySelector('.admin-toggle');
    if (toggle) toggle.setAttribute('aria-label', expanded.has(id) ? 'Sbalit' : 'Rozbalit');
  }

  function orderBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-icon';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function field(key, label, value, type, options) {
    const wrap = document.createElement('label');
    wrap.className = 'admin-field' + (type === 'textarea' ? ' admin-field--wide' : '');
    const lbl = document.createElement('span');
    lbl.className = 'admin-label';
    lbl.textContent = label;
    wrap.appendChild(lbl);

    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 2;
      input.value = value || '';
    } else if (type === 'select') {
      input = document.createElement('select');
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt || '—';
        if ((value || '') === opt) o.selected = true;
        input.appendChild(o);
      }
    } else {
      input = document.createElement('input');
      input.type = type;
      input.value = value == null ? '' : value;
    }
    input.dataset.key = key;
    wrap.appendChild(input);
    return wrap;
  }

  function parseFieldValue(key, el) {
    const v = el.value;
    if (key === 'tags') return v.split(',').map((s) => s.trim()).filter(Boolean);
    if (key === 'position') {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    }
    if (key === 'price_tier') return v || null;
    const trimmed = (v || '').trim();
    return trimmed === '' ? null : trimmed;
  }

  async function saveField(id, key, value) {
    const { error } = await window.sb
      .from('wishlist_items')
      .update({ [key]: value })
      .eq('id', id);
    if (error) {
      console.error(error);
      toast('Uložení selhalo: ' + error.message, 'err');
      return;
    }
    const idx = items.findIndex((x) => x.id === id);
    if (idx !== -1) items[idx][key] = value;
    toast('Uloženo');
  }

  async function destroy(id) {
    const item = items.find((x) => x.id === id);
    const title = (item && item.title) || 'tenhle dárek';
    if (!confirm(`Fakt smazat „${title}“?`)) return;
    const nowIso = new Date().toISOString();
    const { error } = await window.sb
      .from('wishlist_items')
      .update({ deleted_at: nowIso })
      .eq('id', id);
    if (error) {
      toast('Smazání selhalo: ' + error.message, 'err');
      return;
    }
    if (showDeleted) {
      const idx = items.findIndex((x) => x.id === id);
      if (idx !== -1) items[idx].deleted_at = nowIso;
    } else {
      items = items.filter((x) => x.id !== id);
      expanded.delete(id);
    }
    render();
    toast('Smazáno');
  }

  async function restore(id) {
    const { error } = await window.sb
      .from('wishlist_items')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) {
      toast('Obnovení selhalo: ' + error.message, 'err');
      return;
    }
    const idx = items.findIndex((x) => x.id === id);
    if (idx !== -1) items[idx].deleted_at = null;
    render();
    toast('Obnoveno');
  }

  async function hardDestroy(id) {
    const item = items.find((x) => x.id === id);
    const title = (item && item.title) || 'tenhle dárek';
    if (!confirm(`Smazat „${title}“ natrvalo? Tohle se nedá vrátit.`)) return;
    const { error } = await window.sb.from('wishlist_items').delete().eq('id', id);
    if (error) {
      toast('Smazání selhalo: ' + error.message, 'err');
      return;
    }
    items = items.filter((x) => x.id !== id);
    expanded.delete(id);
    render();
    toast('Smazáno natrvalo');
  }

  async function unreserve(id) {
    const { error } = await window.sb.rpc('toggle_reserved', { item_id: id, by_name: '' });
    if (error) {
      toast('Odrezervování selhalo: ' + error.message, 'err');
      return;
    }
    await loadItems();
    render();
    toast('Odrezervováno');
  }

  async function move(id, delta) {
    const { error } = await window.sb.rpc('admin_reorder', { p_id: id, p_direction: delta });
    if (error) {
      toast('Přesun selhal: ' + error.message, 'err');
      return;
    }
    await loadItems();
    render();
  }

  async function onNew() {
    const lastPos = items.length ? items[items.length - 1].position : 0;
    const { data, error } = await window.sb
      .from('wishlist_items')
      .insert({ title: 'Nový dárek', position: lastPos + 10 })
      .select()
      .single();
    if (error) {
      toast('Vytvoření selhalo: ' + error.message, 'err');
      return;
    }
    items.push(data);
    expanded.add(data.id);
    render();
    const newRow = document.querySelector(`.admin-row[data-id="${data.id}"]`);
    if (newRow) {
      const nameInput = newRow.querySelector('[data-key="title"]');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    toast('Přidáno');
  }
})();
