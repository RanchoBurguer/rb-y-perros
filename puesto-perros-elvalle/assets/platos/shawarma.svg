/* =========================================================
   R.B. & PERROS — Capa de Datos (Caracas, Venezuela)
   «Pídelo y verás»
   Puesto de Perros Calientes, Hamburguesas, Pepitos y Shawarmas
   Redoma de la Calle 5 de Julio, Los Jardines de El Valle
   ========================================================= */

/* Cargar configuración personalizada guardada por el Admin desde localStorage */
const savedConfig = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem('rey-config') || '{}');
    if (raw && (raw.brand?.includes('Sabor') || raw.nit)) {
      localStorage.removeItem('rey-config');
      return {};
    }
    return raw;
  } catch (e) {
    return {};
  }
})();

const APP = {
  brand: savedConfig.brand || 'R.B. & Perros',
  slogan: '«Pídelo y verás»',
  legalName: 'R.B. & Perros',
  nit: '',
  rif: 'V-24.166.249-8',
  tagline: savedConfig.tagline || '«Pídelo y verás» · Perros Calientes, Hamburguesas, Pepitos y Shawarmas',
  city: 'Caracas, Venezuela',
  address: savedConfig.address || 'Redoma de la Calle 5 de Julio, Los Jardines de El Valle',
  puestoRef: 'Puesto callejero en la redoma de la Calle 5 de Julio',
  /* Formato internacional WhatsApp para wa.me sin + ni espacios */
  whatsapp: savedConfig.whatsapp || '584241662498',
  phoneDisplay: savedConfig.phoneDisplay || '0424-1662498',
  hours: savedConfig.hours || '5:00 p.m. – 2:00 a.m. (Martes a Domingo)',
  
  /* Tasa de cambio (USD a Bs) configurable y sincronizada con DolarApi */
  tasaBCV: Number(savedConfig.tasaBCV) || 875.65,

  /* Datos para Pago Móvil en Venezuela */
  pagoMovil: {
    banco: savedConfig.pmBanco || 'Banesco (0134) o Banco de Venezuela (0102)',
    telefono: savedConfig.pmTelefono || '0424-1662498',
    cedula: savedConfig.pmCedula || 'V-24.166.249',
    titular: savedConfig.pmTitular || 'R.B. & Perros'
  }
};

/* ---------- Modalidad / Retiro en el Puesto (Delivery Próximamente) ---------- */
const DELIVERY = {
  fee: 0,            // Sin recargo de retiro
  freeFrom: 999999,  // Delivery en pausa
  minOrder: 1.14,    // pedido mínimo: al menos un perro caliente ($1.14 ~ 1000 Bs)
  eta: '10 – 20 min',
  deliveryStatus: 'Próximamente',
  pickupOnly: true,
  coverage: [
    'Retiro en el Puesto (Redoma Calle 5 de Julio)'
  ],
  zones: {
    'Retiro en el Puesto (Redoma Calle 5 de Julio)': 0.00
  }
};

/* ---------- Métodos de pago en Venezuela ---------- */
const PAYMENTS = [
  {
    id: 'pagomovil',
    name: 'Pago Móvil (Bs.)',
    desc: 'Banesco / BDV / Mercantil a la tasa oficial del día',
    icon: 'phone',
    note: 'Recomendado'
  },
  {
    id: 'efectivo_usd',
    name: 'Efectivo Divisas ($ USD)',
    desc: 'Pagas con billetes en $ al retirar',
    icon: 'cash',
    note: 'Indicar en notas si necesitas vuelto'
  },
  {
    id: 'efectivo_bs',
    name: 'Efectivo Bolívares (Bs.)',
    desc: 'Billetes en efectivo en Bs al retirar en el puesto',
    icon: 'cash',
    note: 'Al cambio de la tasa oficial'
  },
  {
    id: 'punto',
    name: 'Punto de Venta / Biopago',
    desc: 'Tarjeta de débito en el puesto',
    icon: 'card',
    note: 'Válido para Retiro en el Puesto'
  }
];

/* ---------- Cupones / Promociones ---------- */
const COUPONS = {
  VALLE10:        { type: 'percent',  value: 10,   label: '10% de descuento en tu orden' },
  COMBORB:        { type: 'fixed',    value: 0.50, label: '$0.50 de descuento especial R.B. & Perros' }
};

/* ---------- Categorías del Puesto ---------- */
const CATEGORIES = [
  { id: 'todos',        name: 'Todo el menú' },
  { id: 'perros',       name: '🌭 Perros' },
  { id: 'hamburguesas', name: '🍔 Hamburguesas' }
];

/* ---------- Menú por defecto (Plan B si no hay menu.json) ---------- */
let MENU = [
  /* --- 1. Perros Calientes (Disponibles) --- */
  {
    id: 'perro-clasico',
    cat: 'perros',
    name: 'Perro Caliente Normal Caraqueño',
    desc: 'Salchicha vienesa en pan suave al vapor, cebollita picada, repollo fresco, lluvia de papitas crujientes, queso blanco llanero rallado y salsas tradicionales.',
    price: 1.14,
    prep: 8,
    img: 'perro_real.jpg',
    tags: ['popular'],
    badge: 'Disponible · 1.000 Bs.',
    disponible: true
  },

  /* --- 2. Hamburguesas (Disponibles) --- */
  {
    id: 'burger-clasica',
    cat: 'hamburguesas',
    name: 'Hamburguesa Normal de Carne',
    desc: 'Carne de res sazonada a la plancha, queso amarillo cheddar, jamón, lechuga fresca, tomate, cebolla, papitas crujientes y salsas de la casa.',
    price: 3.00,
    prep: 12,
    img: 'hamburguesa_real.jpg',
    tags: ['popular'],
    badge: 'Disponible · $3.00',
    disponible: true
  }
];

/* ---------- Utilidades de Formato Monetario ($ USD y Bs.) ---------- */
const moneyUSD = (n) => `$${Number(n || 0).toFixed(2)}`;

const moneyBs = (n, tasa = null) => {
  const currentTasa = tasa !== null ? Number(tasa) : (Number(APP.tasaBCV) || 875.65);
  const bs = Number(n || 0) * currentTasa;
  return `Bs. ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const money = (n) => moneyUSD(n);
const moneyDual = (n) => `${moneyUSD(n)} · ${moneyBs(n)}`;

/* Etiquetas legibles */
const TAG_LABELS = {
  'popular': 'Favorito',
  'pico': 'Con Todo',
  'familiar': 'Para Compartir',
  'natural': '100% Natural'
};

/* ---------- Seguridad Criptográfica del Admin (PBKDF2 + SHA-256) ---------- */
const DEFAULT_SECURITY = {
  salt: 'c1a5e78b94df45e0',
  hash: '22c3d730fa26c18b855af569067696bd64c958a8990760444e08a5903b1109ed', // ñadminkirito2026.
  username: 'kiritoapt2',
  iterations: 100000,
  maxAttempts: 5,
  lockoutMinutes: 15
};

const SECURITY = (() => {
  try {
    const custom = JSON.parse(localStorage.getItem('rey-security') || '{}');
    return { ...DEFAULT_SECURITY, ...custom };
  } catch (e) {
    return DEFAULT_SECURITY;
  }
})();
