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
  { id: 'perros',       name: '🌭 Perros Calientes' },
  { id: 'hamburguesas', name: '🍔 Hamburguesas' },
  { id: 'pepitos',      name: '🥖 Pepitos' },
  { id: 'shawarmas',    name: '🌯 Shawarmas' },
  { id: 'bebidas',      name: '🥤 Bebidas (Refrescos y Jugos)' }
];

/* ---------- Menú por defecto (Plan B si no hay menu.json) ---------- */
let MENU = [
  /* --- Perros Calientes --- */
  {
    id: 'perro-clasico',
    cat: 'perros',
    name: 'Perro Caliente Clásico Caraqueño',
    desc: 'Salchicha vienesa en pan suave al vapor, cebollita picada, repollo fresco, lluvia de papitas crujientes, queso blanco rallado y salsas tradicionales.',
    price: 1.14,
    prep: 8,
    img: 'perro_real.jpg',
    tags: ['popular'],
    badge: '1.000 Bs.'
  },
  {
    id: 'perro-especial',
    cat: 'perros',
    name: 'Perro Especial La Redoma',
    desc: 'Salchicha especial, tocineta crujiente, maíz tierno dulce, queso amarillo fundido, lluvia de papitas crocantes, queso blanco llanero y salsa tártara de la casa.',
    price: 1.60,
    prep: 10,
    img: 'perro_real.jpg',
    tags: ['popular'],
    badge: 'Más Pedido'
  },
  {
    id: 'perro-jumbo',
    cat: 'perros',
    name: 'Perro Jumbo Con Todo Caraqueño',
    desc: 'Salchicha jumbo polaca, doble tocineta, maíz dulce, lluvia de papitas, queso llanero nevado, queso amarillo fundido y baño de salsas callejeras.',
    price: 2.00,
    prep: 12,
    img: 'perro_real.jpg',
    tags: ['popular', 'pico'],
    badge: 'Favorito R.B.'
  },

  /* --- Hamburguesas --- */
  {
    id: 'burger-clasica',
    cat: 'hamburguesas',
    name: 'Hamburguesa Clásica de Carne',
    desc: 'Carne de res sazonada a la plancha, queso amarillo cheddar, jamón, lechuga fresca, tomate, cebolla, papitas crujientes y salsas de la casa.',
    price: 3.00,
    prep: 15,
    img: 'hamburguesa_real.jpg',
    tags: ['popular'],
    badge: 'Clásica $3'
  },
  {
    id: 'burger-especial',
    cat: 'hamburguesas',
    name: 'Hamburguesa Especial La Redoma',
    desc: 'Carne de res artesanal al grill, huevo frito a la plancha, tocineta crujiente, jamón, queso amarillo derretido, queso blanco rallado, papitas y salsa tártara.',
    price: 4.00,
    prep: 18,
    img: 'hamburguesa_real.jpg',
    tags: ['popular'],
    badge: 'Especial R.B.'
  },
  {
    id: 'burger-mixta',
    cat: 'hamburguesas',
    name: 'Hamburguesa Mixta (Carne + Pollo)',
    desc: 'Carne de res a la plancha y pechuga de pollo marinada, doble tocineta, huevo frito, queso amarillo, vegetales frescos, lluvia de papitas y salsa tártara.',
    price: 4.50,
    prep: 20,
    img: 'hamburguesa_real.jpg',
    tags: ['popular', 'pico'],
    badge: 'La Más Resuelta'
  },
  {
    id: 'burger-doble',
    cat: 'hamburguesas',
    name: 'Hamburguesa Doble Carne Caraqueña',
    desc: 'Doble carne de res jugosa a la plancha, triple queso amarillo, tocineta crujiente, cebolla salteada caramelizada, papitas y salsa especial.',
    price: 5.00,
    prep: 20,
    img: 'hamburguesa_real.jpg',
    tags: ['familiar'],
    badge: 'Doble Carne'
  },

  /* --- Pepitos --- */
  {
    id: 'pepito-pollo',
    cat: 'pepitos',
    name: 'Pepito de Pollo Clásico',
    desc: 'Pan baguette suave de 25 cm relleno de pollo a la plancha picadito con cebolla salteada, papitas crujientes, queso blanco rallado y salsas de la casa.',
    price: 4.00,
    prep: 18,
    img: 'pepito.svg',
    tags: ['popular']
  },
  {
    id: 'pepito-carne',
    cat: 'pepitos',
    name: 'Pepito de Carne de Res',
    desc: 'Jugosos trozos de carne a la plancha, tocineta crocante, maíz dulce, queso amarillo fundido, papitas rayadas y abundante salsa tártara.',
    price: 4.50,
    prep: 20,
    img: 'pepito.svg',
    tags: ['popular']
  },
  {
    id: 'pepito-mixto',
    cat: 'pepitos',
    name: 'Pepito Mixto Monstruo (Carne + Pollo)',
    desc: 'Carne de res + pechuga de pollo a la plancha, tocineta, maíz tierno, bañado en queso amarillo fundido y queso de mano rallado, papitas y explosión de salsas.',
    price: 5.00,
    prep: 22,
    img: 'pepito.svg',
    tags: ['popular', 'pico'],
    badge: 'Gigante'
  },

  /* --- Shawarmas --- */
  {
    id: 'shawarma-pollo',
    cat: 'shawarmas',
    name: 'Shawarma de Pollo Caraqueño',
    desc: 'Pan árabe tostado enrollado con pechuga de pollo marinada en finas especias, lechuga fresca, tomate, cebolla morada y abundante crema de ajo casera (Toum).',
    price: 3.00,
    prep: 15,
    img: 'shawarma.svg',
    tags: ['popular']
  },
  {
    id: 'shawarma-mixto',
    cat: 'shawarmas',
    name: 'Shawarma Mixto Especial',
    desc: 'Carne de res en tiras y pollo al grill marinados, enrollado con vegetales frescos, papitas crocantes dentro, crema de ajo y salsa tártara.',
    price: 4.00,
    prep: 18,
    img: 'shawarma.svg',
    tags: ['popular'],
    badge: 'Sabor Urbano'
  },

  /* --- Bebidas (Refrescos y Jugos Solamente) --- */
  {
    id: 'refresco-coca',
    cat: 'bebidas',
    name: 'Coca-Cola (Lata / 355 ml)',
    desc: 'Refresco Coca-Cola original bien frío de nevera.',
    price: 1.00,
    prep: 2,
    img: 'refresco.svg',
    tags: ['popular'],
    badge: 'Bien Fría'
  },
  {
    id: 'refresco-pepsi',
    cat: 'bebidas',
    name: 'Pepsi (Lata / 355 ml)',
    desc: 'Refresco Pepsi helado en lata.',
    price: 1.00,
    prep: 2,
    img: 'refresco.svg',
    tags: []
  },
  {
    id: 'refresco-chinotto',
    cat: 'bebidas',
    name: 'Chinotto / 7Up (Lata / 355 ml)',
    desc: 'Refresco de lima-limón helado.',
    price: 1.00,
    prep: 2,
    img: 'refresco.svg',
    tags: []
  },
  {
    id: 'malta-polar',
    cat: 'bebidas',
    name: 'Malta Polar Fría (Botella / Lata)',
    desc: 'La consentida de Venezuela. Malta Polar heladita.',
    price: 1.00,
    prep: 2,
    img: 'refresco.svg',
    tags: ['popular'],
    badge: 'La Consentida'
  },
  {
    id: 'jugo-parchita',
    cat: 'bebidas',
    name: 'Jugo Natural de Parchita (500 ml)',
    desc: 'Pura pulpa natural de parchita fresca, bien frío y refrescante.',
    price: 1.00,
    prep: 4,
    img: 'jugo.svg',
    tags: ['natural'],
    badge: 'Natural'
  },
  {
    id: 'jugo-mora',
    cat: 'bebidas',
    name: 'Jugo Natural de Mora (500 ml)',
    desc: 'Jugo natural de mora fresca, preparado al momento.',
    price: 1.00,
    prep: 4,
    img: 'jugo.svg',
    tags: ['natural'],
    badge: 'Natural'
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
  hash: '35f82825fdb85b160af93f23789283e531ec51532c65b63bab3b9750a9bda9d1', // PIN inicial: 2498
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
