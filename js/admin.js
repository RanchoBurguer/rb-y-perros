/* =========================================================
   R.B. & PERROS — «Pídelo y verás» — Panel de Administración Seguro
   Seguridad Criptográfica PBKDF2 + SHA-256 (100.000 iteraciones)
   Edición de precios en $ USD, cálculo en Bs., datos de WhatsApp y Pago Móvil
   ========================================================= */
'use strict';

(async () => {

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Ilustraciones disponibles para comida rápida caraqueña */
const ILUSTRACIONES = [
  'perro.svg',
  'hamburguesa.svg',
  'pepito.svg',
  'shawarma.svg',
  'refresco.svg',
  'jugo.svg'
];

/* ---------- Toast ---------- */
const Toast = (() => {
  const box = $('#toasts');
  return {
    show(msg, type = 'ok') {
      const t = document.createElement('div');
      t.className = `toast${type === 'warn' ? ' toast--warn' : ''}`;
      t.textContent = msg;
      box.appendChild(t);
      setTimeout(() => {
        t.classList.add('out');
        t.addEventListener('animationend', () => t.remove(), { once: true });
      }, 3200);
    }
  };
})();

/* =========================================================
   1. CRIPTOGRAFÍA Y AUTENTICACIÓN SEGURA (PBKDF2 + SHA-256)
   ========================================================= */

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function computePBKDF2(password, saltHex, iterations = 100000) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const salt = hexToBytes(saltHex);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

/* Verificación con comparación en tiempo constante */
function secureCompare(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const Auth = {
  SESSION_KEY: 'rey-admin-session-token',
  LOCKOUT_KEY: 'rey-admin-lockout',

  isLockedOut() {
    try {
      const raw = localStorage.getItem(this.LOCKOUT_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.until && Date.now() < data.until) {
        const remainingMin = Math.ceil((data.until - Date.now()) / 60000);
        return `Sistema bloqueado temporalmente por seguridad. Intenta en ${remainingMin} minuto(s).`;
      }
      if (data.until && Date.now() >= data.until) {
        localStorage.removeItem(this.LOCKOUT_KEY);
      }
    } catch (e) {}
    return false;
  },

  recordFailedAttempt() {
    try {
      const raw = localStorage.getItem(this.LOCKOUT_KEY);
      let data = raw ? JSON.parse(raw) : { attempts: 0 };
      data.attempts = (data.attempts || 0) + 1;
      if (data.attempts >= (SECURITY.maxAttempts || 5)) {
        const lockoutMs = (SECURITY.lockoutMinutes || 15) * 60 * 1000;
        data.until = Date.now() + lockoutMs;
      }
      localStorage.setItem(this.LOCKOUT_KEY, JSON.stringify(data));
      return (SECURITY.maxAttempts || 5) - data.attempts;
    } catch (e) {
      return 1;
    }
  },

  resetFailedAttempts() {
    try { localStorage.removeItem(this.LOCKOUT_KEY); } catch (e) {}
  },

  async verify(username, password) {
    const lockMsg = this.isLockedOut();
    if (lockMsg) return { ok: false, error: lockMsg };

    const expectedUser = SECURITY.username || 'kiritoapt2';
    if (username !== expectedUser) {
      const remaining = this.recordFailedAttempt();
      if (remaining <= 0) return { ok: false, error: 'Has superado el límite de intentos. Bloqueado por 15 minutos.' };
      return { ok: false, error: `Credenciales incorrectas. Intentos restantes: ${remaining}` };
    }

    const calculatedHash = await computePBKDF2(password, SECURITY.salt, SECURITY.iterations);
    const valid = secureCompare(calculatedHash, SECURITY.hash);

    if (valid) {
      this.resetFailedAttempts();
      const token = 'auth-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      sessionStorage.setItem(this.SESSION_KEY, token);
      return { ok: true };
    } else {
      const remaining = this.recordFailedAttempt();
      if (remaining <= 0) {
        return { ok: false, error: 'Has superado el límite de intentos. Bloqueado por 15 minutos.' };
      }
      return { ok: false, error: `Credenciales incorrectas. Intentos restantes: ${remaining}` };
    }
  },

  isAuthenticated() {
    return Boolean(sessionStorage.getItem(this.SESSION_KEY));
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.reload();
  }
};

/* =========================================================
   2. ESTADO DEL MENÚ Y CONFIGURACIÓN
   ========================================================= */
let platos = [];
let actual = -1;
let original = '';

function getTasa() {
  return Number(APP.tasaBCV) || 50.00;
}

function updateTasaPill() {
  $('#pillTasa').textContent = `Tasa: Bs. ${getTasa().toFixed(2)} / $`;
}

/* Guardar en localStorage */
function persistMenu() {
  try {
    localStorage.setItem('rey-menu-override', JSON.stringify(platos));
  } catch (e) {}
}

/* Carga inicial del menú */
async function loadInitialMenu() {
  // 1) Intentar desde localStorage
  try {
    const local = localStorage.getItem('rey-menu-override');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        platos = parsed;
        $('#pillFuente').textContent = 'Guardado en navegador';
        $('#pillFuente').style.color = 'var(--a2)';
        return;
      }
    }
  } catch (e) {}

  // 2) Intentar desde menu.json
  try {
    const r = await fetch('menu.json', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d?.dishes) && d.dishes.length > 0) {
        platos = d.dishes;
        $('#pillFuente').textContent = 'menu.json';
        $('#pillFuente').style.color = 'var(--a4)';
        if (d?.negocio?.tasaBCV) {
          APP.tasaBCV = Number(d.negocio.tasaBCV);
          updateTasaPill();
        }
        return;
      }
    }
  } catch (e) {}

  // 3) Fallback a MENU en data.js
  platos = JSON.parse(JSON.stringify(MENU));
  $('#pillFuente').textContent = 'Menú base predeterminado';
  $('#pillFuente').style.color = 'var(--a1)';
}

/* =========================================================
   3. RENDERIZADO DEL PANEL DE ADMINISTRACIÓN
   ========================================================= */

function pintar() {
  const q = ($('#alistSearch').value || '').trim().toLowerCase();
  const cat = $('#alistCat').value || 'todos';

  const filtrados = platos.map((p, idx) => ({ p, idx })).filter(({ p }) => {
    if (cat !== 'todos' && p.cat !== cat) return false;
    if (q && !p.name.toLowerCase().includes(q) && !p.desc.toLowerCase().includes(q)) return false;
    return true;
  });

  $('#pillCount').textContent = platos.length;

  const lista = $('#alistList');
  lista.innerHTML = filtrados.map(({ p, idx }) => `
    <li class="ali${idx === actual ? ' is-on' : ''}" data-idx="${idx}">
      <img src="assets/platos/${esc(p.img)}" alt="" width="44" height="33" onerror="this.src='assets/platos/perro.svg'">
      <div class="ali__b">
        <strong>${esc(p.name)}</strong>
        <small>$${Number(p.price).toFixed(2)} · ~ Bs. ${(Number(p.price) * getTasa()).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
      </div>
      ${p.badge ? `<span class="ali__badge">${esc(p.badge)}</span>` : ''}
    </li>`).join('');

  if (!filtrados.length) {
    lista.innerHTML = '<li class="ali__none">No se encontraron platos</li>';
  }

  updateTasaPill();
}

function cargarEnFormulario(i) {
  actual = i;
  pintar();
  if (i < 0 || i >= platos.length) {
    $('#aformEmpty').hidden = false;
    $('#form').hidden = true;
    return;
  }

  const p = platos[i];
  original = JSON.stringify(p);

  $('#aformEmpty').hidden = true;
  $('#form').hidden = false;
  $('#formTitle').textContent = `Editar: ${p.name}`;

  $('#fName').value = p.name;
  $('#fCat').value = p.cat;
  $('#fPrice').value = p.price;
  $('#fPrep').value = p.prep || 10;
  $('#fDesc').value = p.desc || '';
  $('#fBadge').value = p.badge || '';
  $('#fImg').value = p.img || 'perro.svg';
  $('#fId').value = p.id;

  $('#descCount').textContent = `${(p.desc || '').length} / 250`;
  actualizarLiveBs();

  // Tags
  $$('#fTags input').forEach((cb) => {
    cb.checked = (p.tags || []).includes(cb.value);
  });

  actualizarPreview();
}

function actualizarLiveBs() {
  const pr = Number($('#fPrice').value) || 0;
  const bs = pr * getTasa();
  $('#priceBsLive').textContent = `~ Bs. ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: ${getTasa().toFixed(2)})`;
}

function leerFormulario() {
  const p = {
    id: ($('#fId').value || '').trim() || slug($('#fName').value),
    cat: $('#fCat').value,
    name: ($('#fName').value || '').trim(),
    desc: ($('#fDesc').value || '').trim(),
    price: parseFloat($('#fPrice').value) || 1.50,
    prep: parseInt($('#fPrep').value, 10) || 10,
    img: $('#fImg').value || 'perro.svg',
    tags: $$('#fTags input:checked').map((cb) => cb.value),
    badge: ($('#fBadge').value || '').trim()
  };
  return p;
}

function actualizarPreview() {
  const p = leerFormulario();
  const bs = (p.price * getTasa()).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('#previewBox').innerHTML = `
    <article class="glass dish" style="max-width:280px; margin:0 auto;">
      ${p.badge ? `<span class="dish__badge">${esc(p.badge)}</span>` : ''}
      <div class="dish__img">
        <img src="assets/platos/${esc(p.img)}" alt="" width="200" height="150" onerror="this.src='assets/platos/perro.svg'">
        <span class="dish__prep">${p.prep} min</span>
      </div>
      <div class="dish__body">
        <h3>${esc(p.name || 'Nombre del plato')}</h3>
        <p>${esc(p.desc || 'Descripción de los ingredientes...')}</p>
        <div class="dish__tags">
          ${p.tags.map((t) => `<span class="ptag">${esc(TAG_LABELS[t] || t)}</span>`).join('')}
        </div>
      </div>
      <footer class="dish__foot">
        <div class="dish__price-box">
          <b class="dish__price">$${p.price.toFixed(2)}</b>
          <small class="dish__price-bs">~ Bs. ${bs}</small>
        </div>
        <button type="button" class="addbtn" aria-label="Añadir">+</button>
      </footer>
    </article>`;
}

const slug = (s) => (s || 'plato')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'plato-' + Date.now();

/* =========================================================
   4. INICIALIZACIÓN Y EVENTOS
   ========================================================= */

async function start() {
  const lock = $('#lockScreen');
  const panel = $('#adminPanel');

  // Si ya está autenticado en sessionStorage
  if (Auth.isAuthenticated()) {
    lock.style.display = 'none';
    panel.style.display = 'grid';
    await initPanel();
    return;
  }

  // Si no está autenticado, escuchar login
  lock.style.display = 'grid';
  panel.style.display = 'none';

  $('#lockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = $('#lockUser').value.trim();
    const pin = $('#lockPin').value;
    const btn = $('#lockBtn');
    const err = $('#lockError');

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    err.hidden = true;

    const res = await Auth.verify(user, pin);
    if (res.ok) {
      lock.style.display = 'none';
      panel.style.display = 'grid';
      await initPanel();
      Toast.show('Acceso concedido al panel', 'ok');
    } else {
      err.textContent = res.error;
      err.hidden = false;
      $('#lockPin').value = '';
      $('#lockPin').focus();
    }
    btn.disabled = false;
    btn.textContent = 'Desbloquear Panel';
  });
}

async function initPanel() {
  await loadInitialMenu();

  // Categorías
  const catOpts = CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#alistCat').innerHTML = catOpts;
  $('#fCat').innerHTML = CATEGORIES.filter((c) => c.id !== 'todos').map((c) =>
    `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  // Ilustraciones
  $('#fImg').innerHTML = ILUSTRACIONES.map((img) =>
    `<option value="${img}">${img.replace('.svg', '').toUpperCase()}</option>`).join('');

  // Tags
  $('#fTags').innerHTML = Object.entries(TAG_LABELS).map(([k, lbl]) => `
    <label class="tgl">
      <input type="checkbox" value="${k}">
      <span>${esc(lbl)}</span>
    </label>`).join('');

  pintar();

  // Seleccionar plato al hacer clic en la lista
  $('#alistList').addEventListener('click', (e) => {
    const li = e.target.closest('.ali');
    if (!li || li.dataset.idx === undefined) return;
    cargarEnFormulario(parseInt(li.dataset.idx, 10));
  });

  // Búsqueda y filtro de lista
  $('#alistSearch').addEventListener('input', pintar);
  $('#alistCat').addEventListener('change', pintar);

  // Botón nuevo plato
  $('#btnNew').addEventListener('click', () => {
    const nuevo = {
      id: 'plato-' + Date.now().toString(36),
      cat: 'perros',
      name: 'Nuevo Plato',
      desc: 'Ingredientes y preparación...',
      price: 2.00,
      prep: 10,
      img: 'perro.svg',
      tags: ['popular'],
      badge: ''
    };
    platos.unshift(nuevo);
    persistMenu();
    cargarEnFormulario(0);
    Toast.show('Nuevo plato añadido');
  });

  // Inputs del formulario con vista previa en vivo
  $('#form').addEventListener('input', () => {
    actualizarLiveBs();
    actualizarPreview();
    $('#descCount').textContent = `${($('#fDesc').value || '').length} / 250`;
  });

  // Guardar cambios del formulario
  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (actual < 0 || actual >= platos.length) return;
    platos[actual] = leerFormulario();
    persistMenu();
    pintar();
    Toast.show('Plato actualizado correctamente', 'ok');
  });

  // Descartar cambios
  $('#btnCancel').addEventListener('click', () => {
    if (original) {
      platos[actual] = JSON.parse(original);
      cargarEnFormulario(actual);
      Toast.show('Cambios descartados');
    }
  });

  // Duplicar plato
  $('#btnDup').addEventListener('click', () => {
    if (actual < 0) return;
    const clon = JSON.parse(JSON.stringify(platos[actual]));
    clon.id = slug(clon.name + '-copia-' + Date.now().toString(36).slice(2, 5));
    clon.name += ' (Copia)';
    platos.splice(actual + 1, 0, clon);
    persistMenu();
    cargarEnFormulario(actual + 1);
    Toast.show('Plato duplicado');
  });

  // Eliminar plato
  $('#btnDel').addEventListener('click', () => {
    if (actual < 0) return;
    const nombre = platos[actual].name;
    if (confirm(`¿Estás seguro de eliminar "${nombre}"?`)) {
      platos.splice(actual, 1);
      persistMenu();
      cargarEnFormulario(-1);
      pintar();
      Toast.show(`"${nombre}" eliminado`, 'warn');
    }
  });

  // Botón Logout
  $('#btnLogout').addEventListener('click', () => {
    Auth.logout();
  });

  // ==================== MODAL DE AJUSTES ====================
  const modalAjustes = $('#modalAjustes');
  $('#btnAjustes').addEventListener('click', () => {
    $('#cfgTasa').value = getTasa();
    $('#cfgPhone').value = APP.whatsapp;
    $('#cfgHours').value = APP.hours;
    $('#cfgPmBanco').value = APP.pagoMovil.banco;
    $('#cfgPmTelefono').value = APP.pagoMovil.telefono;
    $('#cfgPmCedula').value = APP.pagoMovil.cedula;
    modalAjustes.classList.add('is-open');
  });

  const cerrarAjustes = () => modalAjustes.classList.remove('is-open');
  $('#cancelAjustes').addEventListener('click', cerrarAjustes);
  $('#backAjustes').addEventListener('click', cerrarAjustes);

  $('#formAjustes').addEventListener('submit', (e) => {
    e.preventDefault();
    const nuevaTasa = parseFloat($('#cfgTasa').value) || 50.00;
    const nuevoPhone = ($('#cfgPhone').value || '').trim();
    const nuevoHours = ($('#cfgHours').value || '').trim();
    const pmBanco = ($('#cfgPmBanco').value || '').trim();
    const pmTelefono = ($('#cfgPmTelefono').value || '').trim();
    const pmCedula = ($('#cfgPmCedula').value || '').trim();

    APP.tasaBCV = nuevaTasa;
    APP.whatsapp = nuevoPhone;
    APP.hours = nuevoHours;
    APP.pagoMovil = { banco: pmBanco, telefono: pmTelefono, cedula: pmCedula, titular: 'R.B. & Perros' };

    try {
      localStorage.setItem('rey-config', JSON.stringify({
        tasaBCV: nuevaTasa,
        whatsapp: nuevoPhone,
        hours: nuevoHours,
        pmBanco,
        pmTelefono,
        pmCedula
      }));
    } catch (err) {}

    updateTasaPill();
    pintar();
    if (actual >= 0) actualizarLiveBs();
    cerrarAjustes();
    Toast.show('Ajustes y Tasa BCV actualizados con éxito', 'ok');
  });

  // ==================== MODAL DE CAMBIO DE CONTRASEÑA ====================
  const modalPass = $('#modalPass');
  $('#btnChangePass').addEventListener('click', () => {
    $('#oldPass').value = '';
    $('#newPass').value = '';
    $('#confirmPass').value = '';
    modalPass.classList.add('is-open');
  });

  const cerrarPass = () => modalPass.classList.remove('is-open');
  $('#cancelPass').addEventListener('click', cerrarPass);
  $('#backPass').addEventListener('click', cerrarPass);

  $('#formPass').addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldP = $('#oldPass').value;
    const newP = $('#newPass').value;
    const confP = $('#confirmPass').value;

    if (newP !== confP) {
      alert('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    const checkOld = await computePBKDF2(oldP, SECURITY.salt, SECURITY.iterations);
    if (!secureCompare(checkOld, SECURITY.hash)) {
      alert('La contraseña actual es incorrecta.');
      return;
    }

    // Generar nuevo salt aleatorio seguro de 16 bytes
    const newSaltBytes = new Uint8Array(16);
    crypto.getRandomValues(newSaltBytes);
    const newSaltHex = bytesToHex(newSaltBytes);
    const newHashHex = await computePBKDF2(newP, newSaltHex, 100000);

    SECURITY.salt = newSaltHex;
    SECURITY.hash = newHashHex;

    try {
      localStorage.setItem('rey-security', JSON.stringify({
        salt: newSaltHex,
        hash: newHashHex,
        iterations: 100000
      }));
    } catch (err) {}

    cerrarPass();
    Toast.show('¡Contraseña maestra actualizada exitosamente!', 'ok');
  });

  // ==================== MODAL CLOUDFLARE EXPORT ====================
  const saveModal = $('#saveModal');
  $('#btnExport').addEventListener('click', () => {
    saveModal.classList.add('is-open');
  });

  const cerrarSave = () => saveModal.classList.remove('is-open');
  $('#saveCancel').addEventListener('click', cerrarSave);
  $('#saveBack').addEventListener('click', cerrarSave);

  $('#saveConfirm').addEventListener('click', () => {
    const payload = {
      version: 1,
      generado: new Date().toISOString().slice(0, 10),
      negocio: {
        nombre: APP.brand,
        subtitulo: APP.tagline,
        ubicacion: APP.address,
        whatsapp: APP.whatsapp,
        tasaBCV: getTasa()
      },
      total: platos.length,
      dishes: platos
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'menu.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    cerrarSave();
    Toast.show('menu.json descargado para Cloudflare Pages', 'ok');
  });
}

// Iniciar aplicación
start();

})();
