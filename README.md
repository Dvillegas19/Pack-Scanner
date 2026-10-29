# 📦 Pack Scanner (Pesa Pack) | Sistema Web de Gestión de Inventario y Operaciones

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

**Pack Scanner** es una plataforma web desarrollada para la administración eficiente y la trazabilidad operativa en plantas de empaque. Permite la gestión centralizada de operarios, el seguimiento de órdenes de producción, el control de consumibles en tiempo real y la lectura rápida de insumos mediante códigos QR.

---

## 🚀 Características Principales

- 🔐 **Autenticación y Seguridad:** Control de acceso y sesiones persistentes con `Supabase Auth` y protección de rutas dinámicas mediante layouts en SvelteKit (`+layout.svelte`).
- 📷 **Escaneo de Códigos QR:** Captura óptica integrada mediante la cámara del dispositivo (`html5-qrcode`) para rápida identificación de consumibles en planta.
- 📋 **Control de Órdenes y Operarios:** Módulo para asignación de tareas, filtrado por fechas y gestión de solicitudes de insumos.
- 🗄️ **Base de Datos Relacional:** Almacenamiento optimizado sobre **PostgreSQL** consumido vía cliente de Supabase.
- ⚡ **Despliegue Continuo:** Configurado para despliegue automatizado en la infraestructura de **Vercel**.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** SvelteKit + HTML5 / CSS3 / JavaScript (ES6+).
- **Backend / Base de Datos / Auth:** Supabase (PostgreSQL & GoTrue Auth).
- **Librerías Adicionales:** `html5-qrcode` para lectura de códigos de barras/QR.
- **Herramientas de Construcción:** Vite, Svelte Config.
- **Hosting & CI/CD:** Vercel.

---

## 📂 Estructura del Proyecto

```text
Pack-Scanner/
├── src/
│   ├── lib/
│   │   ├── index.js
│   │   └── supabaseClient.js      # Conexión y cliente de Supabase
│   ├── routes/
│   │   ├── login/
│   │   │   └── +page.svelte        # Pantalla de inicio de sesión
│   │   ├── +layout.svelte         # Validación global de autenticación
│   │   └── +page.svelte           # Panel principal de operaciones
│   └── app.html
├── static/                         # Assets estáticos y logos
├── svelte.config.js
├── vite.config.js
└── package.json
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
