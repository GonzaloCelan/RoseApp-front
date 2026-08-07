# Integración con la API de ROSE

## Configuración

La URL se define con `VITE_API_URL`. En desarrollo se usa `/api/v1`; Vite reenvía
estas solicitudes a `http://localhost:8080` para evitar bloqueos CORS del navegador.

En producción debe configurarse la URL pública o un proxy equivalente en el servidor.

## Organización

- `src/config/env.js`: variables del entorno.
- `src/api/httpClient.js`: solicitudes, JSON y errores comunes.
- `src/api/apiRoutes.js`: rutas centralizadas.
- `src/features/products/api/productApi.js`: operaciones de productos.
- `src/features/products/model/productMapper.js`: transforma el formulario al DTO.

## Endpoints documentados

- `POST /product`: crea un producto mediante `multipart/form-data`, usando la parte JSON `product` y la parte opcional `image`.
- `GET /product?page=0&size=10`: devuelve una página de productos activos.
- `GET /product/category/{category}?page=0&size=10`: filtra por categoría técnica.
- `GET /product/status?active=true|false&page=0&size=10`: filtra por estado.
- `GET /product/search?query=ROSE&page=0&size=10`: busca por nombre, código, marca, color o talle.
- `GET /product/categories`: devuelve nombres técnicos y visibles de categorías.
- `GET /product/summary`: devuelve el resumen general del inventario.
- `PUT /product/{id}`: actualiza los datos generales de un producto.
- `PATCH /product/{productId}/variants/{variantId}/stock`: actualiza el stock de una variante.
- `PATCH /product/{id}/activate`: activa un producto.
- `PATCH /product/{id}/deactivate`: desactiva un producto.

## Consideraciones

- No se envía `code`; el backend lo genera como `ROSE-00001`.
- `category` contiene el valor técnico del enum.
- Cada producto puede incluir varias combinaciones de color, talle y stock dentro de `variants`.
- La imagen se envía como archivo opcional junto con la parte JSON del producto.
- `active` aparece en la respuesta y se administra mediante los endpoints de activación y desactivación.
- Los estados `400` y `409` se convierten en `ApiError`, conservando `message` y `details`.
