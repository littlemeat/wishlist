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

  let items = [];
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

  init().catch((err) => console.error(err));

  async function init() {
    if (!window.sb) {
      showLoginError('Chybí js/config.js. Zkopíruj js/config.example.js a doplň hodnoty.');
      return;
    }

    const { data } = await window.sb.auth.getSession();
    if (data.session) await showAdmin();
    else showLogin();

    window.sb.auth.onAuthStateChange((_event, session) => {
      if (session) showAdmin();
      else showLogin();
    });

    $loginForm.addEventListener('submit', onLogin);
    $logoutBtn.addEventListener('click', () => window.sb.auth.signOut());
    $newBtn.addEventListener('click', onNew);
  }

  function showLogin() {
    $login.hidden = false;
    $admin.hidden = true;
  }

  async function showAdmin() {
    $login.hidden = true;
    $admin.hidden = false;
    await loadItems();
    render();
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
    const { data, error } = await window.sb
      .from('wishlist_items')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      alert('Načtení selhalo: ' + error.message);
      return;
    }
    items = data || [];
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
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.dataset.id = it.id;

    const header = document.createElement('div');
    header.className = 'admin-row-header';

    const indexEl = document.createElement('span');
    indexEl.className = 'admin-row-index';
    indexEl.textContent = String(idx + 1).padStart(2, '0');
    header.appendChild(indexEl);

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
    }

    const order = document.createElement('div');
    order.className = 'admin-order';
    const up = orderBtn('↑', () => move(it.id, -1));
    const down = orderBtn('↓', () => move(it.id, +1));
    if (idx === 0) up.disabled = true;
    if (idx === items.length - 1) down.disabled = true;
    order.appendChild(up);
    order.appendChild(down);
    header.appendChild(order);

    row.appendChild(header);

    const fields = document.createElement('div');
    fields.className = 'admin-fields';
    fields.appendChild(field('title', 'Název', it.title, 'text'));
    fields.appendChild(field('link', 'Odkaz', it.link, 'url'));
    fields.appendChild(field('price_tier', 'Cenovka', it.price_tier, 'select', ['', '€', '€€', '€€€']));
    fields.appendChild(field('image_url', 'Obrázek (URL)', it.image_url, 'url'));
    fields.appendChild(field('variant', 'Varianta', it.variant, 'text'));
    fields.appendChild(field('tags', 'Tagy (odděl čárkou)', (it.tags || []).join(', '), 'text'));
    fields.appendChild(field('position', 'Pořadí', it.position, 'number'));
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
    del.className = 'btn-link';
    del.textContent = 'Smazat';
    del.addEventListener('click', () => destroy(it.id));
    actions.appendChild(del);
    row.appendChild(actions);

    return row;
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
    if (!confirm('Fakt smazat?')) return;
    const { error } = await window.sb.from('wishlist_items').delete().eq('id', id);
    if (error) {
      toast('Smazání selhalo: ' + error.message, 'err');
      return;
    }
    items = items.filter((x) => x.id !== id);
    render();
    toast('Smazáno');
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
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const swap = idx + delta;
    if (swap < 0 || swap >= items.length) return;
    const a = items[idx];
    const b = items[swap];

    // If positions match, give the whole list a deterministic spread first.
    if (a.position === b.position) {
      const updates = items.map((it, i) => ({ id: it.id, position: i * 10 }));
      for (const u of updates) {
        await window.sb.from('wishlist_items').update({ position: u.position }).eq('id', u.id);
        const k = items.findIndex((x) => x.id === u.id);
        if (k !== -1) items[k].position = u.position;
      }
    }

    const newA = items[swap].position;
    const newB = items[idx].position;
    await window.sb.from('wishlist_items').update({ position: newA }).eq('id', a.id);
    await window.sb.from('wishlist_items').update({ position: newB }).eq('id', b.id);
    a.position = newA;
    b.position = newB;
    items.sort((x, y) => x.position - y.position || (x.created_at < y.created_at ? -1 : 1));
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
    render();
    toast('Přidáno');
  }
})();
