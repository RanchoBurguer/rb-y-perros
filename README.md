# 🌭 R.B. & Perros — «Pídelo y verás»

> **Ubicación:** Redoma de la Calle 5 de Julio, Los Jardines de El Valle, Caracas, Venezuela  
> **Eslogan:** «Pídelo y verás»  
> **WhatsApp de Pedidos:** [+58 424 166 24 98](https://wa.me/584241662498)  
> **Hosting:** 100% compatible con **Cloudflare Pages** (Cero dependencias, HTML/CSS/JS nativo, ultrarrápido y gratis).

---

## 🎨 Identidad Visual y Colores
- **Logotipo Oficial:** Incluido en `assets/logo.svg` y `assets/favicon.svg`.
- **Negro Carbón (`#0B0B0E`):** Fondo urbano, estilo puesto nocturno caraqueño.
- **Amarillo Mostaza (`#FFC700`):** Papitas crujientes, queso fundido, detalles y precios en Bs.
- **Rojo Intenso (`#E50914`):** Botones de acción, salsas y logotipo apetitoso.

---

## 📋 Categorías del Menú
1. **🌭 Perros Calientes:** Clásico, Especial La Redoma, Jumbo "Con Todo" caraqueño (salchicha polaca, tocineta, maíz dulce, lluvia de papitas y queso llanero nevado).
2. **🍔 Hamburguesas:** Clásica de carne, Especial La Redoma (con huevo y tocineta), Mixta res + pollo, Doble carne caraqueña.
3. **🥖 Pepitos:** Pepito de pollo, Pepito de carne, Pepito mixto especial El Valle en pan baguette de 25cm.
4. **🌯 Shawarmas:** Shawarma de pollo, Shawarma mixto con crema de ajo casera (Toum) y vegetales frescos.
5. **🥤 Bebidas (Refrescos y Jugos Solamente):** Coca-Cola, Pepsi, Chinotto, Malta Polar fría, Jugo natural de parchita, mora y guanábana.

---

## 💰 Moneda y Pagos en Venezuela
- **Precios Base:** En Dólares ($ USD).
- **Cálculo Automático en Bolívares:** Según la **Tasa de Cambio BCV** configurable en el panel de administración.
- **Formas de Pago Soportadas:**
  - **Pago Móvil (Bs.):** Con datos de banco, teléfono y cédula generados en la planilla.
  - **Efectivo Divisas ($ USD):** El cliente puede indicar con qué billete paga para el vuelto.
  - **Efectivo Bolívares (Bs.):** Al cambio del día.
  - **Punto de Venta / Biopago:** Al retirar en el puesto.
- **Zonas de Entrega en El Valle:**
  - Retiro directo en el Puesto (Gratis)
  - Calle 5 de Julio / Alrededores ($0.50)
  - Los Jardines de El Valle (Calles 1 a 14) ($1.00)
  - Longaray / San Antonio ($1.50)
  - Alberto Ravell / El Valle Centro ($1.50)
  - Coche / Las Mayas ($2.00)

---

## 🔐 Panel de Administración Oculto e Inhackeable

### ¿Cómo entrar al Admin de forma oculta?
Para que los clientes comunes no vean enlaces de administración:
1. **Opción 1 (El Secreto del Logo):** Haz clic **5 veces seguidas** sobre el logo de *"R.B. & Perros"* en la barra superior.
2. **Opción 2 (Atajo de teclado):** Presiona `Ctrl + Shift + A` (o `Cmd + Shift + A` en Mac).
3. **Opción 3 (Enlace directo):** Abre el archivo `admin.html` en tu navegador o visita `tudominio.pages.dev/admin.html`.

### Seguridad Criptográfica Militar
- **Algoritmo:** **PBKDF2 con SHA-256 (100.000 iteraciones) + Salt aleatorio**.
- **Inhackeable:** La contraseña **NUNCA está escrita en texto plano** en el código. Nadie puede verla inspeccionando el código fuente.
- **Protección contra fuerza bruta:** Después de 5 intentos fallidos, el panel se bloquea automáticamente por 15 minutos.
- **PIN Inicial Predeterminado:** `2498` *(los últimos 4 números de tu teléfono)*.

### ¿Qué puedes hacer en el Admin?
- Cambiar el precio de cualquier perro, hamburguesa, pepito o bebida en **$ USD** con cálculo automático en **Bs.**
- Cambiar la **Tasa de Cambio (BCV / Bs por $)** con un clic.
- Cambiar los datos de **Pago Móvil** y número de **WhatsApp**.
- Añadir platos nuevos o cambiar fotos/ingredientes.
- **Cambiar la clave maestra** cuando quieras (crea un nuevo hash criptográfico en el acto).

---

## 🚀 Cómo Subir y Publicar en Cloudflare Pages

1. Ve a [Cloudflare Pages](https://pages.cloudflare.com/) (es 100% gratis).
2. Selecciona **"Crear una aplicación"** > **"Pages"** > **"Subir activos directamente"** (o conecta tu repositorio de GitHub si usas Git).
3. Arrastra toda la carpeta del proyecto (`puesto-perros-elvalle`).
4. ¡Listo! En 10 segundos tu página estará online con certificado SSL HTTPS gratis en una dirección como `rb-perros.pages.dev`.

### ¿Cómo actualizar los precios en Cloudflare Pages?
1. Entras a tu panel `admin.html`.
2. Haces tus cambios de precios o platos.
3. Pulsas el botón verde **"💾 Guardar para Cloudflare ↓"**.
4. Se descargará el archivo `menu.json` actualizado.
5. Reemplazas ese `menu.json` en Cloudflare Pages (o en tu GitHub) y en segundos la web de todos los clientes tendrá los nuevos precios.
