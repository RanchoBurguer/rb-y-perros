/* =========================================================
   R.B. & PERROS — «Pídelo y verás» — app.js
   Vanilla JS, sin dependencias. Secciones comentadas.
   ========================================================= */
'use strict';

/* ============ 0. Utilidades ============ */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE    = matchMedia('(pointer: fine)').matches;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============ 0.b Carga del menú externo ============
   menu.json (generado por admin.html) tiene prioridad sobre el
   MENU embebido en data.js. Si no existe o falla, se usa el embebido.
   Así el dueño edita el menú sin tocar una línea de código.
=============================================== */
const loadMenu = () => {
  try {
    const local = localStorage.getItem('rey-menu-override');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        MENU = parsed;
        return Promise.resolve({ external: true, n: MENU.length, fuente: 'localStorage' });
      }
    }
  } catch (e) {}

  // Si se abre directo desde el explorador como archivo (file:///), los navegadores bloquean fetch('menu.json') por CORS.
  // Usamos de inmediato el menú de data.js para no trabar la interfaz.
  if (window.location.protocol === 'file:') {
    return Promise.resolve({ external: false, n: MENU.length, fuente: 'embebido' });
  }

  return fetch('menu.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('sin menu.json'))))
    .then((d) => {
      if (!Array.isArray(d?.dishes) || !d.dishes.length) throw new Error('menu.json vacío');
      const valid = d.dishes.every((m) => m && m.id && m.name && Number(m.price) > 0);
      if (!valid) throw new Error('menu.json con platos inválidos');
      MENU = d.dishes;
      if (d?.negocio?.tasaBCV) {
        APP.tasaBCV = Number(d.negocio.tasaBCV) || APP.tasaBCV;
      }
      return { external: true, n: d.dishes.length, fuente: 'menu.json' };
    })
    .catch(() => ({ external: false, n: MENU.length, fuente: 'embebido' }));
};

/* ============ 1. Toast ============ */
const Toast = (() => {
  const box = $('#toasts');
  function show(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = `toast${type === 'warn' ? ' toast--warn' : ''}`;
    t.setAttribute('role', 'status');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      t.addEventListener('animationend', () => t.remove(), { once: true });
    }, 3400);
  }
  return { show };
})();

/* ============ 2. Tema ============ */
(() => {
  const btn = $('#themeToggle');
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('ss-tema', next);
    btn.animate(
      [{ transform: 'rotate(0)' }, { transform: 'rotate(180deg) scale(1.12)' }, { transform: 'rotate(360deg)' }],
      { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
  });
})();

/* ============ 2.b Tasa Oficial BCV en tiempo real (DolarApi) ============ */
async function syncDolarApi() {
  const badgeEl = $('#bcvRate');
  const heroEl = $('#heroTasa');
  
  const updateUI = (tasa) => {
    const tasaFormatted = Number(tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (badgeEl) badgeEl.textContent = `Bs. ${tasaFormatted}`;
    if (heroEl) heroEl.textContent = `Bs. ${tasaFormatted}`;
    const heroPriceDish = MENU.find((m) => m.id === 'perro-jumbo') || MENU[0];
    if (heroPriceDish && $('#heroPriceBs')) {
      $('#heroPriceBs').textContent = `~ ${moneyBs(heroPriceDish.price)}`;
    }
    const bcvWrap = $('#bcvBadge');
    if (bcvWrap) bcvWrap.setAttribute('data-rate', tasaFormatted);
  };

  updateUI(APP.tasaBCV);

  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (res.ok) {
      const data = await res.json();
      const num = Number(data?.promedio);
      if (num && num > 0) {
        APP.tasaBCV = Math.round(num * 100) / 100;
        localStorage.setItem('rey-tasa-bcv', String(APP.tasaBCV));
        updateUI(APP.tasaBCV);
        if (typeof MenuView !== 'undefined' && MenuView.render) {
          MenuView.render();
        }
      }
    }
  } catch (err) {
    // Si la API no responde, mantiene el valor guardado
  }
}
syncDolarApi();

/* ============ 2.c Estado del Puesto (Horario) ============ */
function checkStoreStatus() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const min = now.getMinutes();

  let isOpen = false;
  // Abierto Jueves (4), Viernes (5), Sábado (6)
  if (day >= 4 && day <= 6) {
    const totalMins = hour * 60 + min;
    const startMins = 17 * 60 + 30; // 5:30 PM
    const endMins = 23 * 60 + 59; // 12:00 AM (midnight)
    if (totalMins >= startMins && totalMins <= endMins) {
      isOpen = true;
    }
  }
  
  if (!isOpen && !sessionStorage.getItem('rey-closed-warn')) {
    setTimeout(() => {
      if (typeof Toast !== 'undefined' && Toast.show) {
        Toast.show('Cerrado por ahora. Abrimos de Jueves a Sábado (5:30 pm - 12:00 am).', 'error');
        sessionStorage.setItem('rey-closed-warn', '1');
      }
    }, 1500);
  }
}
checkStoreStatus();
/* ============ 3. Scroll: progreso, nav, to-top ============ */
(() => {
  const bar = $('#progressBar'), nav = $('#nav'), toTop = $('#toTop'), links = $('#navLinks');
  let lastY = 0;

  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = `${(y / max) * 100}%`;
    nav.classList.toggle('is-stuck', y > 20);
    nav.classList.toggle('is-hidden', y > 520 && y > lastY && !links.classList.contains('is-open'));
    toTop.classList.toggle('is-on', y > 620);
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));
})();

/* ============ 4. Menú móvil ============ */
(() => {
  const burger = $('#burger'), links = $('#navLinks');
  burger.addEventListener('click', () =>
    burger.setAttribute('aria-expanded', String(links.classList.toggle('is-open'))));
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      links.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
})();

/* ============ 5. Cursor glow + partículas ============ */
if (FINE && !REDUCED) {
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glow);

  let gx = innerWidth / 2, gy = innerHeight / 2, cx = gx, cy = gy;
  addEventListener('pointermove', (e) => { gx = e.clientX; gy = e.clientY; }, { passive: true });
  (function loop() {
    cx += (gx - cx) * .09; cy += (gy - cy) * .09;
    glow.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  })();
}

(() => {
  const cv = $('#particles'), ctx = cv.getContext('2d');
  let w, h, dpr, pts = [];

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.width = innerWidth * dpr;
    h = cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + 'px';
    cv.style.height = innerHeight + 'px';
    const n = clamp(Math.round(innerWidth / 26), 26, 80);
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .3 * dpr, vy: (Math.random() - .5) * .3 * dpr,
      r: (Math.random() * 1.4 + .5) * dpr
    }));
  };

  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    const c = getComputedStyle(document.documentElement).getPropertyValue('--a2').trim() || '#ffc93c';
    const link = 132 * dpr;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < link) {
          ctx.strokeStyle = c;
          ctx.globalAlpha = (1 - d / link) * .15;
          ctx.lineWidth = .7 * dpr;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
      ctx.globalAlpha = .34; ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  };

  addEventListener('resize', resize);
  resize();
  if (REDUCED) ctx.clearRect(0, 0, w, h); else frame();
})();

/* ============ 6. Parallax de auroras ============ */
if (FINE && !REDUCED) {
  const blobs = $$('.blob');
  let mx = 0, my = 0;
  addEventListener('pointermove', (e) => {
    mx = (e.clientX / innerWidth - .5) * 2;
    my = (e.clientY / innerHeight - .5) * 2;
  }, { passive: true });
  addEventListener('scroll', () => {
    const y = scrollY * .035;
    blobs.forEach((b, i) => {
      const d = (i + 1) * 16;
      b.style.translate = `${mx * d}px ${-y * d}px`;
    });
  }, { passive: true });
}

/* ============ 7. Spotlight en el cristal ============ */
if (FINE) {
  $$('.glass:not(.nav__inner):not(.modal__box):not(.toast):not(.consent)').forEach((el) => {
    el.classList.add('spot');
    const layer = document.createElement('span');
    layer.className = 'spot__layer';
    layer.setAttribute('aria-hidden', 'true');
    el.prepend(layer);
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ============ 8. Reveal + contadores ============ */
(() => {
  const items = $$('.reveal');
  if (REDUCED) { items.forEach((i) => i.classList.add('is-in')); }
  else {
    // Permisivo: dispara en cuanto 1px es visible
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0, rootMargin: '0px' });
    items.forEach((i) => io.observe(i));
    // Fallback: si al cabo de 150ms quedan sin .is-in, forzamos (carga inicial)
    setTimeout(() => items.forEach((i) => i.classList.add('is-in')), 150);
  }

  const io2 = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      io2.unobserve(e.target);
      const el = e.target;
      const to = parseFloat(el.dataset.to);
      const dec = +(el.dataset.dec || 0);
      if (REDUCED) { el.textContent = to.toFixed(dec); return; }
      const t0 = performance.now(), dur = 1500;
      const step = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        el.textContent = (to * (1 - Math.pow(1 - p, 4))).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: .15 });
  $$('.count').forEach((c) => io2.observe(c));

  // Fallback rápido si el observador tarda
  setTimeout(() => {
    $$('.count').forEach((el) => {
      if (el.textContent === '0' || !el.textContent) {
        const to = parseFloat(el.dataset.to);
        const dec = +(el.dataset.dec || 0);
        el.textContent = to.toFixed(dec);
      }
    });
  }, 800);
})();

/* ============ 9. Tilt 3D + imanes ============ */
if (FINE && !REDUCED) {
  $$('[data-tilt]').forEach((el) => {
    el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      el.style.transition = 'transform .12s linear';
      el.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg) scale(1.015)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transition = ''; el.style.transform = ''; });
  });

  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .2}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ============ 10. Textos legales dinámicos (Venezuela / R.B. & Perros) ============ */
(() => {
  if ($('#footLegal')) {
    $('#footLegal').textContent =
      `${APP.brand} · «Pídelo y verás» · ${APP.address}, ${APP.city} · WhatsApp: ${APP.phoneDisplay}`;
  }
  if ($('#footRights')) {
    $('#footRights').textContent =
      `© ${new Date().getFullYear()} ${APP.brand} · «Pídelo y verás» · Precios en Dólares ($) y Bolívares (Bs.).`;
  }
  if ($('#rsBadge')) {
    $('#rsBadge').textContent = `Puesto Callejero · Redoma Calle 5 de Julio`;
  }

  const heroDish = MENU.find((m) => m.id === 'perro-clasico') || MENU[0];
  if (heroDish && $('#heroPrice')) {
    $('#heroPrice').textContent = money(heroDish.price);
    if ($('#heroPriceBs')) $('#heroPriceBs').textContent = `~ ${moneyBs(heroDish.price)}`;
  }
  if ($('#heroEta')) $('#heroEta').textContent = '10 – 20 min';

  if ($('#legalPriv')) {
    $('#legalPriv').innerHTML = `
      <p><strong>1. Responsable del Puesto</strong><br>${esc(APP.brand)} («Pídelo y verás»), ubicado en la ${esc(APP.address)}, ${esc(APP.city)}. Pedidos y atención: ${esc(APP.phoneDisplay)}.</p>
      <p><strong>2. Sin base de datos ni rastreo</strong><br>Este sitio es 100% estático y privado. No almacenamos tus datos en servidores externos. Tu navegador únicamente guarda de forma temporal tus platos seleccionados para armar tu pedido.</p>
      <p><strong>3. Finalidad única</strong><br>Tus datos (nombre y celular) solo se usan en tu propio equipo para generar el ticket que envías voluntariamente a nuestro WhatsApp (+58 424 166 24 98) para comenzar la preparación.</p>
      <p><strong>4. Pagos 100% seguros</strong><br>Nunca te pediremos contraseñas ni datos bancarios por esta web. Pagas directamente vía Pago Móvil, divisas en efectivo ($ USD) o bolívares (Bs.) al retirar tu comida caliente en el puesto.</p>
      <p><strong>5. Control total</strong><br>Puedes pulsar el botón «Borrar mis datos» en cualquier momento para limpiar todo rastro del pedido en tu navegador.</p>
      <p class="legal__note">Compromiso de calidad y confianza de R.B. & Perros para toda la comunidad de Los Jardines de El Valle.</p>`;
  }

  if ($('#legalTerm')) {
    $('#legalTerm').innerHTML = `
      <p><strong>Modalidad de Pedido</strong><br>Actualmente los pedidos son exclusivamente para <strong>RETIRO EN EL PUESTO</strong> (Redoma de la Calle 5 de Julio, Los Jardines de El Valle). El servicio de delivery a domicilio se encuentra en fase <em>«Próximamente»</em>.</p>
      <p><strong>Precios en Dólares y Bolívares</strong><br>Todos los precios están fijados en Dólares ($ USD) con conversión simultánea a Bolívares (Bs.) calculada según la tasa del día (Tasa BCV). Cero comisiones de apps externas.</p>
      <p><strong>Preparación al Momento</strong><br>Nuestros perros calientes, hamburguesas, pepitos y shawarmas se cocinan al momento en la plancha con ingredientes frescos. El tiempo de preparación estimado es de 10 a 20 minutos desde que confirmamos tu WhatsApp.</p>
      <p><strong>Confirmación por WhatsApp</strong><br>Al generar tu orden, pulsa el botón de WhatsApp para enviarnos el ticket. Te responderemos confirmando el tiempo exacto para que vengas a retirarlo calientico.</p>
      <p><strong>Métodos de Pago Aceptados</strong><br>Aceptamos Pago Móvil (Banesco / BDV / Mercantil), efectivo en divisas ($ USD) y efectivo en bolívares (Bs.). Si necesitas vuelto en divisas, avísanos en las notas de tu orden.</p>
      <p class="legal__note">¡Gracias por preferir el auténtico sabor de la calle! «Pídelo y verás».</p>`;
  }

  if ($('#legalSeg')) {
    $('#legalSeg').innerHTML = `
      <p><strong>Arquitectura y Seguridad</strong></p>
      <ul>
        <li>Sitio 100% estático compatible con Cloudflare Pages.</li>
        <li>Cero dependencias remotas inseguras o scripts de seguimiento de terceros.</li>
        <li>Panel de administración protegido con criptografía nativa (PBKDF2 con 100.000 iteraciones + SHA-256) y bloqueo automático por fuerza bruta.</li>
        <li>Tus datos nunca salen de tu dispositivo sin tu autorización expresa al enviar el WhatsApp.</li>
      </ul>`;
  }
})();

/* ============ 11. Modales ============ */
const openModal = (el) => {
  el._lastFocus = document.activeElement;
  el.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  const f = $$('button, [href], input, select, textarea', el).filter((n) => n.offsetParent);
  f[0]?.focus();
};
const closeModal = (el) => {
  el.classList.remove('is-open');
  document.body.style.overflow = '';
  el._lastFocus?.focus?.();
};
function closeAllModals() { $$('.modal.is-open').forEach(closeModal); }

$$('.modal').forEach((m) => {
  $$('[data-close]', m).forEach((b) => b.addEventListener('click', () => closeModal(m)));
  // Trampa de foco
  m.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button, [href], input, select, textarea', m).filter((n) => n.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeAllModals(); Drawer.close(); }
});
$$('[data-modal]').forEach((b) =>
  b.addEventListener('click', () => openModal($('#' + b.dataset.modal))));

/* ============ 12. Banner de consentimiento ============ */
const Consent = (() => {
  const el = $('#consent');
  if (!el) return { open: () => {} };
  function open() {
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-in'));
  }
  function decide(v) {
    store.set('rb-consentimiento', v);
    el.classList.remove('is-in');
    setTimeout(() => { el.hidden = true; }, 350);
  }
  const btnAcc = $('#consentAccept');
  if (btnAcc) btnAcc.addEventListener('click', () => decide('pleno'));
  const btnRej = $('#consentReject');
  if (btnRej) btnRej.addEventListener('click', () => decide('esencial'));
  if (!store.get('rb-consentimiento')) setTimeout(open, 700);
  return { open };
})();

/* ============ 13. MENÚ: render, filtros y búsqueda ============ */
const MenuView = (() => {
  const grid = $('#menuGrid'), chips = $('#catChips'), empty = $('#menuEmpty');
  const search = $('#search'), searchClear = $('#searchClear');
  const sort = $('#sort'), veg = $('#filterVeg');
  const favBtn = $('#favToggle'), favLabel = $('#favLabel');

  let cat = 'todos';
  let q = '';
  let onlyVeg = false;
  let soloFav = false;

  /* Favoritos: solo ids, solo en este navegador */
  const FAV = 'ss-favoritos';
  let favs = new Set();
  try { favs = new Set(JSON.parse(store.get(FAV) || '[]')); } catch (e) {}
  const isFav = (id) => favs.has(id);
  const toggleFav = (id) => {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set(FAV, JSON.stringify([...favs]));
  };

  // Chips de categoría
  chips.innerHTML = CATEGORIES.map((c, i) =>
    `<button class="chip${i === 0 ? ' is-active' : ''}" role="tab" data-cat="${c.id}"
       aria-selected="${i === 0}">${esc(c.name)}</button>`).join('');

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    $$('.chip', chips).forEach((c) => { c.classList.remove('is-active'); c.setAttribute('aria-selected', 'false'); });
    b.classList.add('is-active'); b.setAttribute('aria-selected', 'true');
    cat = b.dataset.cat;
    render();
  });

  favBtn.addEventListener('click', () => {
    soloFav = !soloFav;
    favBtn.classList.toggle('is-active', soloFav);
    favBtn.setAttribute('aria-pressed', String(soloFav));
    render();
  });

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Resalta lo que coincide dentro del nombre, sin romper el escapado */
  function markHtml(text, nq) {
    const safe = esc(text);
    if (!nq || nq.length < 2) return safe;
    try {
      return safe.replace(new RegExp(`(${escRe(nq)})`, 'gi'), '<mark>$1</mark>');
    } catch { return safe; }
  }

  function list() {
    let out = MENU.filter((m) => (cat === 'todos' || m.cat === cat));
    if (soloFav) out = out.filter((m) => favs.has(m.id));
    if (onlyVeg) out = out.filter((m) => m.tags.includes('vegetariano'));
    if (q) {
      const nq = norm(q);
      out = out.filter((m) =>
        norm(m.name).includes(nq) || norm(m.desc).includes(nq) ||
        m.tags.some((t) => norm(TAG_LABELS[t] || t).includes(nq)));
    }
    const s = sort.value;
    if (s === 'precio-asc') out = [...out].sort((a, b) => a.price - b.price);
    if (s === 'precio-desc') out = [...out].sort((a, b) => b.price - a.price);
    if (s === 'nombre') out = [...out].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (s === 'recomendado') out = [...out].sort((a, b) =>
      (b.tags.includes('popular') ? 1 : 0) - (a.tags.includes('popular') ? 1 : 0));
    return out;
  }

  function card(m) {
    const isAvail = m.disponible !== false;
    const tags = m.tags.map((t) =>
      `<span class="ptag ptag--${esc(t.replace(/[^a-z]/g, ''))}">${esc(TAG_LABELS[t] || t)}</span>`).join('');
    return `
      <article class="glass dish reveal is-in ${!isAvail ? 'dish--soon' : ''}" data-id="${esc(m.id)}">
        <span class="dish__badge ${!isAvail ? 'dish__badge--soon' : ''}">${esc(m.badge || (isAvail ? 'Disponible' : 'Próximamente'))}</span>
        ${isAvail ? `
        <button class="dish__fav${isFav(m.id) ? ' is-on' : ''}" data-fav="${esc(m.id)}"
                aria-pressed="${isFav(m.id)}" aria-label="Marcar ${esc(m.name)} como favorito">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5 4.3 13a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2A4.6 4.6 0 0 1 19.7 13Z"/></svg>
        </button>` : ''}
        <div class="dish__img">
          <img src="assets/platos/${esc(m.img)}" alt="${esc(m.name)}" width="200" height="150"
               loading="lazy" decoding="async">
          <span class="dish__prep" title="Tiempo de preparación">${isAvail ? m.prep + ' min' : 'Pronto'}</span>
        </div>
        <div class="dish__body">
          <h3 data-name>${esc(m.name)}</h3>
          <p>${esc(m.desc)}</p>
          <div class="dish__tags">${tags}</div>
        </div>
        <footer class="dish__foot">
          <div class="dish__price-box">
            <b class="dish__price">${money(m.price)}</b>
            <small class="dish__price-bs">~ ${moneyBs(m.price)}</small>
          </div>
          ${isAvail ? `
          <button class="addbtn" data-add="${esc(m.id)}"
                  aria-label="Añadir ${esc(m.name)} al pedido">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>` : `
          <span class="badge-soon">Próximamente</span>
          `}
        </footer>
      </article>`;
  }

  /* ---- Construcción ÚNICA de las tarjetas ----
     Antes se reconstruía todo el HTML en cada tecla: eso recargaba las
     imágenes y provocaba el parpadeo que se veía como "bug".
     Ahora las tarjetas se crean una vez y solo se reordenan/ocultan. */
  const cards = new Map();

  function buildAll() {
    grid.innerHTML = MENU.map(card).join('');
    cards.clear();
    grid.querySelectorAll('.dish').forEach((el) => cards.set(el.dataset.id, el));
  }

  const counter = $('#menuCount');

  function render() {
    if (!cards.size) buildAll();

    const shown = list();
    const nq = norm(q);

    // Reordenar sin recrear: mueve nodos ya cargados
    const frag = document.createDocumentFragment();
    shown.forEach((m) => {
      const el = cards.get(m.id);
      if (!el) return;
      frag.appendChild(el);
      const h = el.querySelector('[data-name]');
      if (h) h.innerHTML = markHtml(m.name, nq);
      paintAdd(m.id);
    });
    grid.appendChild(frag);

    // Ocultar el resto
    const ids = new Set(shown.map((m) => m.id));
    cards.forEach((el, id) => el.classList.toggle('is-off', !ids.has(id)));

    empty.hidden = shown.length > 0;
    counter.textContent = shown.length === MENU.length
      ? `${MENU.length} platos`
      : `${shown.length} de ${MENU.length} platos`;

    favLabel.textContent = soloFav
      ? (favs.size ? `Favoritos (${favs.size})` : 'Sin favoritos')
      : 'Mis favoritos';
  }

  /* Refresco puntual: solo el botón de una tarjeta */
  function paintAdd(id) {
    const btn = cards.get(id)?.querySelector('[data-add]');
    if (!btn) return;
    const n = Cart.qty(id);
    btn.classList.toggle('is-added', n > 0);
    let b = btn.querySelector('.addbtn__n');
    if (n > 0 && !b) { b = document.createElement('span'); b.className = 'addbtn__n'; btn.appendChild(b); }
    if (b) b.textContent = n;
  }
  const refreshItem = paintAdd;

  // Delegación: añadir al carrito y marcar favorito
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]');
    if (f) {
      e.preventDefault();
      e.stopPropagation();
      const id = f.dataset.fav;
      toggleFav(id);
      const on = isFav(id);
      f.classList.toggle('is-on', on);
      f.setAttribute('aria-pressed', String(on));
      if (soloFav) render();                       // si filtramos por favoritos, recalcula
      favLabel.textContent = soloFav ? `Favoritos (${favs.size})` : 'Mis favoritos';
      return;
    }

    const b = e.target.closest('[data-add]');
    if (!b) return;
    const id = b.dataset.add;
    if (Cart.add(id)) {
      const m = MENU.find((x) => x.id === id);
      MenuView.refreshItem(id);          // solo esa tarjeta, no las 27
      Toast.show(`${m.name} añadido al pedido`);
      if (navigator.vibrate) navigator.vibrate(12);
    }
  });

  // Búsqueda: rebote suave + atajos de teclado
  let t;
  search.addEventListener('input', () => {
    searchClear.hidden = !search.value;
    clearTimeout(t);
    t = setTimeout(() => { q = search.value.trim(); render(); }, 130);
  });
  searchClear.addEventListener('click', () => {
    search.value = ''; q = ''; searchClear.hidden = true; search.focus(); render();
  });
  // "/" enfoca el buscador · "Escape" lo vacía
  addEventListener('keydown', (e) => {
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !escribiendo && !$('#drawer').classList.contains('is-open')) {
      e.preventDefault();
      $('#menu').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      setTimeout(() => search.focus(), REDUCED ? 0 : 450);
    }
    if (e.key === 'Escape' && document.activeElement === search && search.value) {
      search.value = ''; q = ''; searchClear.hidden = true; render();
    }
  });
  if (sort) sort.addEventListener('change', render);
  if (veg) veg.addEventListener('change', () => { onlyVeg = veg.checked; render(); });
  const resetBtn = $('#resetFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      q = ''; onlyVeg = false; soloFav = false; cat = 'todos';
      if (search) { search.value = ''; searchClear.hidden = true; }
      if (veg) veg.checked = false;
      if (favBtn) {
        favBtn.classList.remove('is-active');
        favBtn.setAttribute('aria-pressed', 'false');
      }
      $$('.chip', chips).forEach((c, i) => {
        c.classList.toggle('is-active', i === 0);
        c.setAttribute('aria-selected', String(i === 0));
      });
      render();
    });
  }

  return { render, refreshItem: paintAdd };
})();

// El render inicial espera a que se resuelva el menú (interno o menu.json)
const menuListo = loadMenu().then((info) => {
  MenuView.render();
  return info;
});

/* Refresco puntual de las tarjetas (no reconstruye las 27 en cada cambio).
   Se llama con el id concreto desde quien conoce el cambio. */
Cart.on(() => {
  if ($('#drawer').classList.contains('is-open')) Drawer.renderCart();
});

/* ============ 14. Drawer: carrito / datos / ticket ============ */
const Drawer = (() => {
  const wrap = $('#drawer');
  const views = { cart: $('#viewCart'), checkout: $('#viewCheckout'), ticket: $('#viewTicket') };
  const title = $('#drawerTitle'), back = $('#drawerBack'), foot = $('#cartFoot');
  let view = 'cart';

  function show(v) {
    view = v;
    Object.entries(views).forEach(([k, el]) => {
      el.hidden = k !== v;
      el.classList.toggle('is-active', k === v);
    });
    title.textContent = { cart: 'Tu pedido', checkout: 'Datos del pedido', ticket: 'Tu ticket' }[v];
    back.hidden = v === 'cart';
    foot.hidden = v !== 'cart';
    wrap._lastFocus = document.activeElement;
    wrap.classList.add('is-open');
    wrap.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    /* El foco debe entrar al drawer o el tabulador se escapa al fondo.
       No usamos solo requestAnimationFrame: se pausa en pestañas ocultas
       y el foco nunca llegaría a moverse. */
    const focusables = () => $$('button, [href], input, select, textarea', wrap)
      .filter((n) => n.offsetParent && !n.closest('.view[hidden]'));
    if (!focusables().length) requestAnimationFrame(() => focusables()[0]?.focus());
    else focusables()[0]?.focus();
  }

  function close() {
    wrap.classList.remove('is-open');
    wrap.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    wrap._lastFocus?.focus?.();
  }

  back.addEventListener('click', () => show(view === 'ticket' ? 'checkout' : 'cart'));
  $$('[data-close]', wrap).forEach((b) => b.addEventListener('click', close));
  $('#cartBtn').addEventListener('click', () => { show('cart'); renderCart(); });

  // Foco al abrir
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button, [href], input, select, textarea, a', wrap)
      .filter((n) => n.offsetParent && !n.closest('.view[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Zona / Modalidad ---------- */
  const zoneSel = $('#zone'), zoneHint = $('#zoneHint');
  zoneSel.innerHTML = DELIVERY.coverage.map((z) => {
    return `<option value="${esc(z)}">📍 ${esc(z)} (Sin costo de envío)</option>`;
  }).join('');
  zoneSel.value = Cart.zone;
  zoneSel.addEventListener('change', () => Cart.setZone(zoneSel.value));

  /* Tiempo estimado */
  function eta(z) {
    return '10–20 min';
  }

  /* ---------- Anillo de progreso del domicilio gratis ---------- */
  const fsWrap = $('#freeship'), fsRing = $('.freeship__ring', fsWrap);
  const fsArc = $('.fg', fsRing), fsTxt = $('#freeshipTxt');

  function paintFreeship(t) {
    if (fsWrap) fsWrap.hidden = true; // Delivery en pausa; únicamente retiro
  }

  /* ---------- Lista del carrito ---------- */
  const list = $('#cartList'), cartEmpty = $('#cartEmpty');

  function renderCart() {
    zoneSel.value = Cart.zone;
    const lines = Cart.lines();
    const t = Cart.totals();

    list.innerHTML = lines.map((l) => `
      <li class="cline">
        <img src="assets/platos/${esc(l.dish.img)}" alt="" width="56" height="42" loading="lazy">
        <div class="cline__body">
          <strong>${esc(l.dish.name)}</strong>
          <small>${money(l.dish.price)} c/u${l.note ? ` · ${esc(l.note)}` : ''}</small>
          <div class="stepper">
            <button data-dec="${esc(l.dish.id)}" aria-label="Quitar uno de ${esc(l.dish.name)}">&minus;</button>
            <span aria-live="polite">${l.qty}</span>
            <button data-inc="${esc(l.dish.id)}" aria-label="Añadir uno más de ${esc(l.dish.name)}">+</button>
          </div>
        </div>
        <div class="cline__right">
          <b>${money(l.dish.price * l.qty)}</b>
          <button class="cline__del" data-del="${esc(l.dish.id)}" aria-label="Quitar ${esc(l.dish.name)}">&times;</button>
        </div>
      </li>`).join('');

    cartEmpty.hidden = lines.length > 0;

    /* Totales */
    const rows = [
      ['Subtotal ($)', money(t.subtotal)],
      ...(t.discount ? [[`Descuento${Cart.coupon ? ` (${Cart.coupon})` : ''}`, '−' + money(t.discount)]] : []),
      ['Modalidad', 'Retiro en el puesto ($0.00)']
    ];
    $('#totals').innerHTML =
      rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('') +
      `<div class="totals__total"><dt>Total en Dólares</dt><dd>${money(t.total)}</dd></div>` +
      `<div class="totals__total" style="color:var(--a2);"><dt>Al cambio (Tasa BCV)</dt><dd>${moneyBs(t.total)}</dd></div>`;

    // Mensaje de zona y ETA
    zoneHint.innerHTML = `📍 <b>Retiro en el Puesto</b> (Redoma Calle 5 de Julio). Listo en 10–20 min.<br><span style="display:inline-block; margin-top:4px; font-size:.76rem; color:var(--a2);">🛵 Servicio de Delivery a domicilio: <b>¡Próximamente en El Valle!</b></span>`;

    paintFreeship(t);

    // Botón continuar: el motivo del bloqueo se explica, no solo se desactiva
    const btn = $('#toCheckout');
    const falta = t.minOrder - t.subtotal;
    btn.disabled = lines.length === 0 || t.belowMin;
    btn.textContent = t.belowMin && lines.length
      ? `Te faltan ${money(falta)}`
      : 'Continuar con el pedido';

    // Aviso debajo del botón para que quede claro qué hacer
    const aviso = $('#minAviso');
    if (!lines.length) {
      aviso.hidden = true;
    } else if (t.belowMin) {
      aviso.hidden = false;
      aviso.innerHTML = `El pedido mínimo es <b>${money(t.minOrder)}</b>. Agrega <b>${money(falta)}</b> más para continuar.`;
    } else {
      aviso.hidden = true;
    }

    // Cupón
    const cMsg = $('#couponMsg');
    if (cMsg) {
      if (Cart.coupon) {
        cMsg.hidden = false;
        cMsg.className = 'coupon-ok';
        cMsg.innerHTML = `Código <b>${esc(Cart.coupon)}</b> aplicado: ${esc(COUPONS[Cart.coupon].label)}. <button class="linkish" id="couponDrop">Quitar</button>`;
        const dropBtn = $('#couponDrop');
        if (dropBtn) {
          dropBtn.addEventListener('click', () => {
            Cart.removeCoupon();
            const cin = $('#couponInput');
            if (cin) cin.value = '';
            Toast.show('Código removido');
          });
        }
      } else {
        cMsg.hidden = true;
      }
    }
  }

  // Delegación de acciones del carrito
  wrap.addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), del = e.target.closest('[data-del]');
    if (inc) { Cart.add(inc.dataset.inc); MenuView.refreshItem(inc.dataset.inc); }
    if (dec) { Cart.setQty(dec.dataset.dec, Cart.qty(dec.dataset.dec) - 1); MenuView.refreshItem(dec.dataset.dec); }
    if (del) {
      const id = del.dataset.del;
      const m = MENU.find((x) => x.id === id);
      Cart.remove(id);
      MenuView.refreshItem(id);
      Toast.show(`${m.name} eliminado`, 'warn');
    }
  });

  // Cupón
  $('#couponApply').addEventListener('click', () => {
    const r = Cart.applyCoupon($('#couponInput').value);
    Toast.show(r.msg, r.ok ? 'ok' : 'warn');
    if (r.ok) $('#couponInput').value = '';
  });
  $('#couponInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#couponApply').click(); }
  });

  $('#toCheckout').addEventListener('click', () => { show('checkout'); renderPays(); });

  /* ---------- Métodos de pago ---------- */
  const payBox = $('#payOptions'), payNote = $('#payNote');

  function renderPays() {
    if (!payBox.dataset.done) {
      payBox.innerHTML = PAYMENTS.map((p, i) => `
        <label class="pay${i === 0 ? ' is-on' : ''}">
          <input type="radio" name="pago" value="${esc(p.id)}"${i === 0 ? ' checked' : ''}>
          <span class="pay__ico" aria-hidden="true">${payIcon(p.icon)}</span>
          <span class="pay__body">
            <strong>${esc(p.name)}</strong>
            <small>${esc(p.desc)}</small>
          </span>
          <span class="pay__note">${esc(p.note)}</span>
        </label>`).join('');
      payBox.dataset.done = '1';
      payBox.addEventListener('change', () => {
        $$('.pay', payBox).forEach((l) => l.classList.toggle('is-on', l.querySelector('input').checked));
        payNoteUpdate();
      });
    }
    payNoteUpdate();
  }

  function payNoteUpdate() {
    const id = $('input[name="pago"]:checked', payBox)?.value || 'contra';
    const t = Cart.totals();
    const notes = {
      contra: `Llevamos datáfono. Ten listo el monto exacto: ${money(t.total)}.`,
      transfer: `Transferencia a ${esc(APP.pagoNumero)} (${esc(APP.pagoBanco)}). Te confirmamos la recepción por este mismo chat.`,
      pse: `Te enviamos el enlace de PSE por este mismo chat. Nunca te pedimos tu clave ni tu PIN.`,
      tarjeta: `Te enviamos el enlace seguro de la pasarela certificada. Este sitio no procesa tarjetas ni guarda datos de pago.`
    };
    payNote.textContent = notes[id];
  }

  function payIcon(kind) {
    const p = {
      cash: '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.6"/>',
      phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
      bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>',
      card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>'
    }[kind] || '';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }

  /* ---------- Validación y ticket ---------- */
  const form = $('#checkoutForm');

  function validate(input) {
    const ok = input.checkValidity();
    input.closest('.field').classList.toggle('invalid', !ok);
    return ok;
  }
  $$('input[type="text"], input[type="tel"]', form).forEach((i) => {
    i.addEventListener('blur', () => validate(i));
    i.addEventListener('input', () => {
      if (i.closest('.field').classList.contains('invalid')) validate(i);
    });
  });
  $('#cPhone').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });

  function orderId() {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SS-${ymd}-${rnd}`;
  }

  /* ---------- 1) Mensaje para la TIENDA (WhatsApp) ---------- */
  function buildTicket(data) {
    const t = Cart.totals();
    const lines = Cart.lines();
    const id = orderId();

    const items = lines.map((l, i) =>
      `${i + 1}. ${l.qty} x ${l.dish.name} — ${money(l.dish.price)} c/u = ${money(l.dish.price * l.qty)}` +
      (l.note ? `\n   ↳ Nota: ${l.note}` : '')
    ).join('\n');

    const pay = PAYMENTS.find((p) => p.id === data.pago) || PAYMENTS[0];
    const isRetiro = (data.zone || '').toLowerCase().includes('retiro');

    const text = [
      `*🌭 NUEVO PEDIDO — ${APP.brand.toUpperCase()}*`,
      `📍 ${APP.address}`,
      `Orden #${id}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*CLIENTE*`,
      `Nombre: ${data.nombre}`,
      `Celular: ${data.tel}`,
      ``,
      `*MODALIDAD DE ENTREGA*`,
      `Modalidad: Retiro en el Puesto (Redoma Calle 5 de Julio)`,
      `🛵 Delivery a domicilio: ¡Próximamente!`,
      ...(data.notas ? [`Notas / Especificaciones: ${data.notas}`] : []),
      ``,
      `*DETALLE DE LA ORDEN*`,
      items,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Subtotal: ${money(t.subtotal)} (~ ${moneyBs(t.subtotal)})`,
      ...(t.discount ? [`Descuento (${Cart.coupon}): −${money(t.discount)}`] : []),
      `Modalidad: Retiro en el Puesto ($0.00)`,
      `*TOTAL EN DÓLARES: ${money(t.total)}*`,
      `*TOTAL EN BS (Tasa BCV): ${moneyBs(t.total)}*`,
      ``,
      `*Método de pago:* ${pay.name}`,
      ...(data.pago === 'pagomovil' ? [
        `*Datos para Pago Móvil:*`,
        `• Banco: ${APP.pagoMovil.banco}`,
        `• Teléfono: ${APP.pagoMovil.telefono}`,
        `• Cédula: ${APP.pagoMovil.cedula}`,
        `• Titular: ${APP.pagoMovil.titular}`
      ] : []),
      `*Tiempo estimado para retirar:* 10 – 20 min`,
      ``,
      `_¡Gracias por preferir a R.B. & Perros! «Pídelo y verás» 🔥_`
    ].join('\n');

    return { id, text, total: t.total, totalBs: t.totalBs, lines, totals: t };
  }

  /* ---------- 2) Comprobante para el CLIENTE ---------- */
  function buildReceipt(data, ticket) {
    const t = ticket.totals;
    const now = new Date();
    const pay = PAYMENTS.find((p) => p.id === data.pago) || PAYMENTS[0];
    const ancho = 44;
    const hueco = ancho - 14;

    const items = ticket.lines.map((l, i) => {
      const valor = money(l.dish.price * l.qty);
      const nombre = `${i + 1}. ${l.qty} x ${l.dish.name}`;
      const anchoReal = [...nombre].reduce((n, ch) => n + (/\s/.test(ch) ? 1 : 2), 0);
      const recortado = anchoReal > hueco ? '…' + [...nombre].slice(-8).join('') : nombre;
      const relleno = Math.max(0, hueco - [...recortado].reduce((n, ch) => n + (/\s/.test(ch) ? 1 : 2), 0));
      return `${recortado}${' '.repeat(relleno)}${valor}`;
    }).join('\n');

    const fila = (k, v) => {
      const t = String(v);
      const disponible = ancho - 11 - 1;
      const corta = [...t].reduce((n, ch) => n + (/\s/.test(ch) ? 1 : 2), 0) > disponible
        ? '…' + [...t].slice(-10).join('') : t;
      const rel = Math.max(0, disponible - [...corta].reduce((n, ch) => n + (/\s/.test(ch) ? 1 : 2), 0));
      return k.padEnd(11) + corta + ' '.repeat(rel);
    };

    return [
      `${APP.brand.toUpperCase()}`,
      `PUESTO DE COMIDA RÁPIDA CALLEJERA`,
      '─'.repeat(ancho),
      fila('Ubicación:', 'Redoma Calle 5 de Julio, El Valle'),
      fila('WhatsApp:', `+58 ${APP.whatsapp}`),
      '─'.repeat(ancho),
      fila('Pedido:', ticket.id),
      fila('Fecha:', `${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`),
      fila('Cliente:', data.nombre),
      fila('Celular:', data.tel),
      fila('Modalidad:', 'Retiro en el Puesto'),
      fila('Delivery:', 'Próximamente'),
      ...(data.notas ? [fila('Referencia:', data.notas)] : []),
      '─'.repeat(ancho),
      'CONCEPTO'.padEnd(hueco) + 'VALOR',
      items,
      '─'.repeat(ancho),
      'Subtotal ($)'.padEnd(hueco) + money(t.subtotal),
      ...(t.discount ? ['Descuento'.padEnd(hueco) + ('−' + money(t.discount))] : []),
      'Modalidad'.padEnd(hueco) + 'Retiro en Puesto ($0.00)',
      '='.repeat(ancho),
      'TOTAL ($ USD)'.padEnd(hueco) + money(t.total),
      'TOTAL (Bs)'.padEnd(hueco) + moneyBs(t.total),
      '='.repeat(ancho),
      `FORMA DE PAGO: ${pay.name}`,
      ...(data.pago === 'pagomovil' ? [`PAGO MÓVIL: ${APP.pagoMovil.telefono} (V)`] : []),
      '─'.repeat(ancho),
      `¡Gracias por preferir el sabor del Valle! 🔥`
    ].join('\n');
  }

  function renderTicket(ticket, data) {
    const pay = PAYMENTS.find((p) => p.id === data.pago) || PAYMENTS[0];

    $('#ticketBox').innerHTML = `
      <div class="ticket__head">
        <span class="ticket__ok" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 5 5L19 7"/></svg>
        </span>
        <h3>Pedido ${esc(ticket.id)}</h3>
        <p>Pagas <b>${money(ticket.total)}</b> al recibir · ${esc(pay.name)}</p>
        <span class="ticket__status">Pendiente de pago</span>
      </div>
      <details class="ticket__peek">
        <summary>Ver la planilla que se enviará</summary>
        <pre class="ticket__text">${esc(ticket.text)}</pre>
      </details>`;

    // Enviar a la tienda
    $('#waSend').href = `https://wa.me/${APP.whatsapp}?text=${encodeURIComponent(ticket.text)}`;

    // Comprobante del cliente
    const receipt = buildReceipt(data, ticket);
    $('#receiptBox').textContent = receipt;

    const copiar = async (texto, msg) => {
      try { await navigator.clipboard.writeText(texto); Toast.show(msg); }
      catch { Toast.show('Tu navegador bloqueó el portapapeles', 'warn'); }
    };
    const bajar = (texto, nombre) => {
      const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      Toast.show('Archivo descargado');
    };

    const btnCopy = $('#copyReceipt');
    if (btnCopy) btnCopy.onclick = () => copiar(receipt, 'Comprobante copiado');
    const btnDown = $('#downloadReceipt');
    if (btnDown) btnDown.onclick = () => bajar(receipt, `comprobante-${ticket.id}.txt`);
    const btnPrint = $('#printReceipt');
    if (btnPrint) btnPrint.onclick = () => window.print();

    // Generar y descargar comprobante como imagen PNG
    function generarImagenFactura(datos, tkt) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const w = 620;
      const lines = tkt.lines;
      const h = 600 + (lines.length * 40);
      canvas.width = w;
      canvas.height = h;

      // Fondo oscuro
      ctx.fillStyle = '#0B0B0E';
      ctx.fillRect(0, 0, w, h);

      // Borde dorado
      ctx.strokeStyle = '#FFC700';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, w - 16, h - 16);

      // Barra superior roja
      ctx.fillStyle = '#E50914';
      ctx.fillRect(10, 10, w - 20, 10);

      // Encabezado
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('R.B. & PERROS', w / 2, 58);

      ctx.fillStyle = '#FFC700';
      ctx.font = 'italic 16px sans-serif';
      ctx.fillText('«Pídelo y verás»', w / 2, 84);

      ctx.fillStyle = '#A1A1AA';
      ctx.font = '13px sans-serif';
      ctx.fillText('Redoma Calle 5 de Julio, Los Jardines de El Valle, Caracas', w / 2, 106);
      ctx.fillText('WhatsApp: +58 424 166 24 98', w / 2, 126);

      // Línea divisoria
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 140);
      ctx.lineTo(w - 30, 140);
      ctx.stroke();

      // Info de Orden y Tasa
      ctx.textAlign = 'left';
      ctx.fillStyle = '#F9FAFB';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`ORDEN: #${tkt.id}`, 30, 168);

      const fechaStr = new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
      ctx.textAlign = 'right';
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#A1A1AA';
      ctx.fillText(`Fecha: ${fechaStr}`, w - 30, 168);

      // Tasa BCV
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFC700';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`TASA OFICIAL BCV: Bs. ${Number(APP.tasaBCV).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`, 30, 194);

      // Cliente
      ctx.fillStyle = '#F9FAFB';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Cliente: ${datos.nombre}`, 30, 224);
      ctx.fillText(`Teléfono: ${datos.tel}`, 30, 246);
      ctx.fillText(`Modalidad: Retiro en el Puesto (Calle 5 de Julio)`, 30, 268);

      // Encabezado de productos
      ctx.fillStyle = '#18181B';
      ctx.fillRect(30, 284, w - 60, 28);
      ctx.fillStyle = '#FFC700';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('CANT. / PRODUCTO', 40, 303);
      ctx.textAlign = 'right';
      ctx.fillText('TOTAL ($)', w - 40, 303);

      // Lista de items
      let y = 334;
      ctx.textAlign = 'left';
      lines.forEach((l) => {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px sans-serif';
        const itemTxt = `${l.qty}x ${l.dish.name}`;
        ctx.fillText(itemTxt.length > 38 ? itemTxt.slice(0, 36) + '…' : itemTxt, 40, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#FBBF24';
        ctx.fillText(`$${(l.dish.price * l.qty).toFixed(2)}`, w - 40, y);

        y += 32;
        ctx.textAlign = 'left';
      });

      // Línea divisoria de totales
      ctx.strokeStyle = '#FFC700';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(w - 30, y);
      ctx.stroke();

      y += 34;
      // Subtotal & Totales
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#A1A1AA';
      ctx.fillText('TOTAL EN DÓLARES:', 40, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#22C55E';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`$${Number(tkt.total).toFixed(2)}`, w - 40, y);

      y += 32;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#A1A1AA';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('TOTAL EN BOLÍVARES:', 40, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFC700';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(moneyBs(tkt.total), w - 40, y);

      y += 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '13px sans-serif';
      ctx.fillText(`Forma de pago: ${datos.pago === 'pagomovil' ? 'Pago Móvil' : datos.pago === 'efectivo_usd' ? 'Efectivo Divisas ($)' : 'Efectivo Bs.'}`, 40, y);

      // Pie
      y += 40;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#71717A';
      ctx.font = 'italic 12px sans-serif';
      ctx.fillText('¡Gracias por preferir a R.B. & Perros! Retira calientico en la redoma.', w / 2, y);

      // Descarga como imagen PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `factura-${tkt.id}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        Toast.show('Factura descargada como imagen PNG');
      }, 'image/png');
    }

    const btnDownImg = $('#downloadReceiptImg');
    if (btnDownImg) {
      btnDownImg.onclick = () => generarImagenFactura(data, ticket);
    }

    // Al volver al carrito tras enviar, vaciarlo
    $('#waSend').addEventListener('click', () => {
      setTimeout(() => {
        Cart.clear();
        Toast.show('Enviado. Te esperamos con el pedido 🏍️');
      }, 900);
    }, { once: true });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = $$('input[type="text"], input[type="tel"]', form);
    if (!inputs.map(validate).every(Boolean)) {
      Toast.show('Revisa los campos marcados', 'warn');
      return;
    }
    const t = Cart.totals();
    if (t.belowMin) { Toast.show(`El mínimo es ${money(t.minOrder)}`, 'warn'); show('cart'); return; }

    const data = {
      nombre: $('#cName').value.trim(),
      tel: $('#cPhone').value.trim(),
      direccion: $('#cAddr').value.trim(),
      notas: $('#cNotes').value.trim(),
      zone: Cart.zone,
      pago: $('input[name="pago"]:checked', payBox)?.value || 'contra'
    };

    if ($('#cSave').checked) {
      // Consentimiento explícito del usuario para guardar en su dispositivo
      Cart.saveProfile({ n: data.nombre, t: data.tel, d: data.direccion });
      Toast.show('Datos guardados en este dispositivo');
    }

    const ticket = buildTicket(data);
    renderTicket(ticket, data);
    show('ticket');
  });

  const btnBackCart = $('#btnBackToCart');
  if (btnBackCart) btnBackCart.addEventListener('click', () => show('cart'));

  // Prefijar perfil guardado (solo si el usuario lo pidió antes)
  const prof = Cart.loadProfile();
  if (prof) {
    $('#cName').value = prof.n || '';
    $('#cPhone').value = prof.t || '';
    $('#cAddr').value = prof.d || '';
    Toast.show('Recordamos tus datos (puedes editarlos)');
  }

  return { show, close, renderCart, open: () => { show('cart'); renderCart(); } };
})();

// El carrito se redibuja en cada cambio
Cart.on(() => { if ($('#drawer').classList.contains('is-open')) Drawer.renderCart(); });

/* Contador del botón de pedido */
function paintBadge() {
  const n = Cart.count();
  const b = $('#cartCount');
  b.textContent = n;
  b.dataset.empty = String(n === 0);
  b.animate(
    n ? [{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1)' }]
      : [{ transform: 'scale(1)' }],
    { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' }
  );
}
Cart.on(paintBadge);
paintBadge();

/* ============ 15. Enlaces de WhatsApp directos ============ */
(() => {
  const hello = `Hola ${APP.brand} 🔥 Quiero hacer un pedido. ¿Me pueden enviar el menú y el tiempo de entrega?`;
  const link = `https://wa.me/${APP.whatsapp}?text=${encodeURIComponent(hello)}`;
  if ($('#waHero')) $('#waHero').href = link;
  if ($('#waCta')) $('#waCta').href = link;

  if ($('#ctaInfo')) {
    $('#ctaInfo').innerHTML = [
      ['Ubicación', APP.address],
      ['Horario', APP.hours],
      ['Teléfono / WhatsApp', APP.phoneDisplay || ('+58 ' + APP.whatsapp)],
      ['Tasa del Día', `Bs. ${APP.tasaBCV.toFixed(2)} por $`]
    ].map(([k, v]) => `<div class="cta__item"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('');
  }
})();

/* ============ 16. Resalte de sección en el nav ============ */
(() => {
  const links = $$('.nav__links a');
  const map = new Map(links.map((a) => [$(a.getAttribute('href')), a]).filter(([el]) => el));
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      const a = map.get(e.target);
      if (a) a.classList.toggle('is-hl', e.isIntersecting);
    });
  }, { rootMargin: '-45% 0px -50%' });
  map.forEach((_, el) => io.observe(el));
})();

/* ============ 17. ACCESO OCULTO AL PANEL DE ADMINISTRACIÓN ============ */
(() => {
  // 1) 5 clics consecutivos en el logo en menos de 3 segundos
  let clicks = 0;
  let timer = null;
  const brand = $('#brandLogo') || $('.brand');
  if (brand) {
    brand.addEventListener('click', (e) => {
      clicks++;
      clearTimeout(timer);
      if (clicks >= 5) {
        clicks = 0;
        Toast.show('Accediendo al Panel de Administración...', 'ok');
        setTimeout(() => { window.location.href = 'admin.html'; }, 300);
      } else {
        timer = setTimeout(() => { clicks = 0; }, 3000);
      }
    });
  }

  // 2) Atajo de teclado secreto: Ctrl + Shift + A
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      Toast.show('Accediendo al Panel de Administración...', 'ok');
      setTimeout(() => { window.location.href = 'admin.html'; }, 300);
    }
  });

  // 3) Hash en la URL: #admin
  if (window.location.hash === '#admin') {
    window.location.href = 'admin.html';
  }
})();

console.log('%cR.B. & Perros%c · «Pídelo y verás» · Comida Rápida Callejera · El Valle, Caracas.', 'font:700 20px Impact;color:#E50914', 'color:#FFC700');
