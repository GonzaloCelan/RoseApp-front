# ROSE Frontend

Frontend del sistema ROSE para administrar productos, variantes e inventario.
Está desarrollado con React y Vite y puede instalarse como aplicación de escritorio (PWA).

## Ejecutar el proyecto

La forma más sencilla es hacer doble clic en `ABRIR_ROSE.bat` y mantener abierta
la ventana que aparece mientras se usa el sistema.

Alternativamente, desde una terminal dentro de esta carpeta se puede ejecutar
`npm install` y luego `npm run dev`.

El backend debe estar disponible en `http://localhost:8080`. Durante el desarrollo,
Vite redirige automáticamente las solicitudes de `/api/v1` hacia esa dirección.

## Funcionalidades

- Alta de productos con imagen, colores, talles y stock por variante.
- Listado paginado, búsqueda y filtros.
- Edición general, actualización rápida de precios y stock.
- Activación y desactivación lógica de productos.
- Resumen del inventario, valores y ganancia estimada.
- Diseño responsive e instalación como PWA.

## Estructura

- `src/components/layout`: estructura general (menú y barra superior).
- `src/components/ui`: componentes visuales reutilizables.
- `src/pages/products`: pantallas relacionadas con productos.
- `src/styles`: estilos globales y variables de diseño.
- `public`: manifiesto, service worker e íconos de la PWA.

El frontend no solicita el código del producto: el backend lo genera automáticamente.
