# Decisiones tomadas durante la construcción

_Codex: anota aquí cada decisión pequeña (qué, por qué, fecha)._

## 27-nov-2026 · T0

- Se usaron `@fontsource/inter` 5.3.0 en pesos 400, 600 y 700 y `@fontsource/playfair-display` 5.3.0 en peso 600. Los WOFF2 latinos y las licencias SIL están en `prueba/fuentes/`, copiados del directorio local de herramientas. Los íconos llevan una franja magenta con texto blanco «PRUEBA» y se hicieron a partir de `codex/marca/`.
- El service worker guarda el catálogo y precarga sus fotos siguiendo las rutas del propio catálogo. Así funciona el botón de Ajustes sin conexión después de la primera visita. Las actualizaciones de los archivos precargados se entregan al subir la versión de la caché `spp-`.
- Los ejemplos se agregan al inventario de prueba existente y tienen identificadores fijos. Los movimientos iniciales incluyen lo que salió en el historial ficticio, de modo que el saldo disponible coincida con el catálogo. Los costos, vencimientos y mínimos de ejemplo también son ficticios.
- La importación conserva los campos aditivos cuando un archivo antiguo trae una versión más reciente de un registro. Si faltan fichas de pacientes, las arma con los nombres de las ventas vigentes. La fecha de recepción se registra en la primera importación o cuando el archivo aporta cambios.
- Las pruebas sirven el repositorio mediante `page.route` y usan `context.route` para las solicitudes del service worker en Chromium. Simulan la ruta de GitHub Pages y comprueban la recarga fuera de línea con el service worker real del navegador.
