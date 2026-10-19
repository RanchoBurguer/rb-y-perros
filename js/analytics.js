/* =========================================================
   R.B. & PERROS — Módulo de Analítica y Medición de Embudo
   Eventos comerciales y Core Web Vitals (sin dependencias)
   ========================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'rb_analytics_log';
  const MAX_LOGS = 50;

  function getStoredEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveStoredEvents(events) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_LOGS)));
    } catch (e) {}
  }

  const RBAnalytics = {
    /**
     * Registra un evento en el embudo comercial
     * @param {string} eventName - Nombre del evento (menu_view, add_to_cart, etc.)
     * @param {object} params - Parámetros del evento (sin datos sensibles)
     */
    track(eventName, params = {}) {
      const payload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        url: window.location.pathname + window.location.hash,
        ...params
      };

      // 1. Guardar en log local (persistente para auditoría)
      const logs = getStoredEvents();
      logs.push(payload);
      saveStoredEvents(logs);

      // 2. Disparar evento DOM para extensiones o integraciones
      try {
        window.dispatchEvent(new CustomEvent('rb:analytics', { detail: payload }));
      } catch (e) {}

      // 3. Enviar a Google Tag Manager / GA4 si están disponibles
      if (typeof window.gtag === 'function') {
        try {
          window.gtag('event', eventName, params);
        } catch (e) {}
      }
      if (Array.isArray(window.dataLayer)) {
        try {
          window.dataLayer.push(payload);
        } catch (e) {}
      }

      // Log en entorno de desarrollo
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`📊 [Analytics] ${eventName}:`, params);
      }
    },

    getEvents() {
      return getStoredEvents();
    },

    clearEvents() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }
  };

  // Exponer API global
  window.RBAnalytics = RBAnalytics;

  // Track inicial de carga de página
  document.addEventListener('DOMContentLoaded', () => {
    RBAnalytics.track('page_view', {
      title: document.title,
      referrer: document.referrer || '(direct)'
    });

    // Observer para menu_view (cuando el usuario llega al menú)
    const menuEl = document.getElementById('menu');
    if (menuEl && 'IntersectionObserver' in window) {
      let menuViewed = false;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !menuViewed) {
            menuViewed = true;
            RBAnalytics.track('menu_view');
            observer.disconnect();
          }
        });
      }, { threshold: 0.2 });
      observer.observe(menuEl);
    }
  });

  // Monitoreo de Core Web Vitals (LCP, CLS)
  if ('PerformanceObserver' in window) {
    try {
      // LCP Observer
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          RBAnalytics.track('core_web_vitals', {
            metric: 'LCP',
            value: Math.round(lastEntry.startTime),
            element: lastEntry.element?.tagName || 'unknown'
          });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}
  }
})();
