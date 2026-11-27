# Decisiones tomadas durante la construcción

_Codex: anota aquí cada decisión pequeña (qué, por qué, fecha)._

## 27-nov-2026 · T0

- Se usaron `@fontsource/inter` 5.3.0 en pesos 400, 600 y 700 y `@fontsource/playfair-display` 5.3.0 en peso 600. Los WOFF2 latinos y las licencias SIL están en `prueba/fuentes/`, copiados del directorio local de herramientas. Los íconos llevan una franja magenta con texto blanco «PRUEBA» y se hicieron a partir de `codex/marca/`.
- El service worker guarda el catálogo y precarga sus fotos siguiendo las rutas del propio catálogo. Así funciona el botón de Ajustes sin conexión después de la primera visita. Las actualizaciones de los archivos precargados se entregan al subir la versión de la caché `spp-`.
- Los ejemplos se agregan al inventario de prueba existente y tienen identificadores fijos. Los movimientos iniciales incluyen lo que salió en el historial ficticio, de modo que el saldo disponible coincida con el catálogo. Los costos, vencimientos y mínimos de ejemplo también son ficticios.
- La importación conserva los campos aditivos cuando un archivo antiguo trae una versión más reciente de un registro. Si faltan fichas de pacientes, las arma con los nombres de las ventas vigentes. La fecha de recepción se registra en la primera importación o cuando el archivo aporta cambios.
- Las pruebas sirven el repositorio mediante `page.route` y usan `context.route` para las solicitudes del service worker en Chromium. Simulan la ruta de GitHub Pages y comprueban la recarga fuera de línea con el service worker real del navegador.

## 27-nov-2026 · T1

- Las secciones principales usan fragmentos en la URL. Las fichas, los formularios y las hojas se apilan en el historial. Atrás cierra la capa activa o vuelve a la sección anterior, y al cerrar una capa se devuelve el foco al control que la abrió si sigue disponible.
- Los componentes comparten `prueba/estilos.css` y las fuentes locales de T0. Los chips tienen una píldora de 36 px dentro de un área táctil de 44 px. La bolsa de Vender mide 60 px dentro de su anillo de 4 px. Se oscurecieron ligeramente los textos verdes sobre fondos claros para cumplir AA.
- Inventario muestra primero las marcas con más resultados. Dentro de cada marca, ordena los productos por nombre. En Uso en spa el resumen cuenta productos, porque las existencias mezclan frascos, ml y otras unidades. Las acciones de cada producto están en su ficha.
- El botón de escanear abre una hoja para escribir códigos guardados. En inventario abre la ficha y en una venta agrega el producto. La cámara se incorpora en T7.
- La venta conserva la edición de fecha, cantidad, precio y forma de pago. El resumen y el total quedan visibles mientras se eligen productos. Una venta nueva empieza con el detalle del carrito plegado. Al editar una venta se abre para revisar las cantidades.
- Deshacer revierte el uso de cabina y la eliminación de productos o ventas durante cinco segundos. Para revertir una eliminación de venta se restauran juntos el registro y sus movimientos, con el mismo identificador y una nueva fecha de modificación.
