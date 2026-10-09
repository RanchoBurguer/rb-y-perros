/* =========================================================
   EL REY DE LA REDOMA — Carrito de Compras
   Estado en memoria + persistencia en localStorage.
   Cálculo de totales en $ USD y referencia en Bs.
   ========================================================= */
'use strict';

const Cart = (() => {
  const KEY = 'rey-carrito-v1';

  /* Estado en memoria */
  let items = [];            // [{ id, qty }]
  let notes = new Map();     // id -> indicaciones (ej: "sin cebolla, extra tártara")
  let coupon = null;         // cupón aplicado
  let zone = Object.keys(DELIVERY.zones)[0];

  /* ---------- Persistencia ---------- */
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 1,
        items,
        coupon,
        zone
      }));
    } catch (e) { /* modo incógnito */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1) return;
      items = (d.items || [])
        .filter((i) => MENU.some((m) => m.id === i.id))
        .map((i) => ({ id: i.id, qty: clampQty(i.qty) }));
      coupon = COUPONS[d.coupon] ? d.coupon : null;
      zone = DELIVERY.zones[d.zone] !== undefined ? d.zone : zone;
    } catch (e) { /* ignorar */ }
  }

  const clampQty = (q) => Math.max(1, Math.min(99, parseInt(q, 10) || 1));
  const dish = (id) => MENU.find((m) => m.id === id);

  /* ---------- API del Carrito ---------- */
  const api = {
    _subs: new Set(),
    on(fn) { api._subs.add(fn); return () => api._subs.delete(fn); },
    _emit() { api._subs.forEach((fn) => fn()); },

    get items() { return items.slice(); },
    get coupon() { return coupon; },
    get zone() { return zone; },
    setZone(z) {
      if (DELIVERY.zones[z] === undefined) return;
      zone = z; persist(); api._emit();
    },

    get(id) { return items.find((i) => i.id === id) || null; },
    qty(id) { return api.get(id)?.qty ?? 0; },

    add(id, n = 1) {
      if (!dish(id)) return false;
      const line = items.find((i) => i.id === id);
      if (line) line.qty = clampQty(line.qty + n);
      else items.push({ id, qty: clampQty(n) });
      persist(); api._emit();
      return true;
    },

    setQty(id, n) {
      const line = items.find((i) => i.id === id);
      if (!line) return;
      const q = clampQty(n);
      if (q <= 1) return api.remove(id);
      line.qty = q;
      persist(); api._emit();
    },

    remove(id) {
      items = items.filter((i) => i.id !== id);
      notes.delete(id);
      persist(); api._emit();
    },

    clear() { items = []; notes.clear(); coupon = null; persist(); api._emit(); },

    setNote(id, text) { notes.set(id, text.slice(0, 200)); api._emit(); },
    getNote(id) { return notes.get(id) || ''; },

    count() { return items.reduce((n, i) => n + i.qty, 0); },

    lines() {
      return items
        .map((i) => ({ dish: dish(i.id), qty: i.qty, note: notes.get(i.id) || '' }))
        .filter((l) => l.dish);
    },

    /* ---------- Cálculo de Totales ($ y Bs.) ---------- */
    totals() {
      const subtotal = api.lines().reduce((s, l) => s + (l.dish.price * l.qty), 0);

      // Tarifa de delivery por barrio
      const zoneFee = DELIVERY.zones[zone] ?? 0;
      let shipping = (DELIVERY.fee || 0) + zoneFee;

      // Descuentos por cupón
      let discount = 0;
      let freeShip = subtotal >= DELIVERY.freeFrom;
      const c = coupon ? COUPONS[coupon] : null;
      if (c) {
        if (c.type === 'percent') discount = Number(((subtotal * c.value) / 100).toFixed(2));
        if (c.type === 'fixed')   discount = Math.min(c.value, subtotal);
        if (c.type === 'shipping') freeShip = true;
      }
      discount = Math.min(discount, subtotal);

      if (freeShip) shipping = 0;

      const totalUSD = Math.max(0, subtotal - discount + shipping);
      const totalBs = totalUSD * (APP.tasaBCV || 50.00);

      return {
        subtotal,
        discount,
        iva: 0, // En el puesto de perros callejero no hay IVA colombiano
        shipping,
        freeShip,
        zoneFee,
        total: totalUSD,
        totalBs: totalBs,
        minOrder: DELIVERY.minOrder,
        belowMin: subtotal < DELIVERY.minOrder,
        freeFrom: DELIVERY.freeFrom,
        missingForFree: Math.max(0, DELIVERY.freeFrom - subtotal)
      };
    },

    /* ---------- Cupones ---------- */
    applyCoupon(code) {
      const c = (code || '').trim().toUpperCase();
      if (!COUPONS[c]) return { ok: false, msg: 'Ese código no es válido.' };
      coupon = c;
      persist(); api._emit();
      return { ok: true, msg: COUPONS[c].label };
    },
    removeCoupon() { coupon = null; persist(); api._emit(); },

    /* ---------- Perfil del cliente (guardar en dispositivo) ---------- */
    saveProfile(p) {
      try {
        localStorage.setItem('rey-perfil', JSON.stringify(p));
      } catch (e) {}
    },
    loadProfile() {
      try { return JSON.parse(localStorage.getItem('rey-perfil')) || null; }
      catch (e) { return null; }
    },

    wipe() {
      ['rey-carrito-v1', 'rey-perfil', 'rey-tema'].forEach((k) => {
        try { localStorage.removeItem(k); } catch (e) {}
      });
      items = []; notes.clear(); coupon = null;
      api._emit();
    }
  };

  restore();
  return api;
})();
