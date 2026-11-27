# Indicaciones de Jonathan y Claude

_Lo que diga este archivo manda sobre todo lo demás. Codex: léelo al inicio de cada corrida y no lo edites._

1. (26-nov-2026) Empieza por T0. La app de Elba en la raíz no se toca.
2. (26-nov-2026) Jonathan y Elba aprobaron el diseño de `codex/diseno/`. Síguelo fielmente.
3. (26-nov-2026) Elba envió el logotipo de SPARATI (`codex/marca/`). Los colores de la app cambian a los del logo: magenta `#C2207F` y verde menta `#87BEA6`, con letra Playfair Display en los títulos. `DISENO.md` y las imágenes de `codex/diseno/` ya están actualizados. Hay una pantalla nueva: `Bienvenida.png`.
4. (27-nov-2026) Entorno de trabajo en hermes:
   - **No descargues nada de internet** (ni npm, ni CDN, ni fuentes). Las bibliotecas y fuentes ya están descargadas y comprobadas en `/home/juego/herramientas/vendor-sparati/` (solo lectura): barcode-detector 3.2.3 con zxing-wasm 3.1.6, qrcode-generator 2.0.4, y @fontsource/playfair-display y @fontsource/inter 5.3.0. Copia a `prueba/vendor/` y `prueba/fuentes/` solo lo que uses, con su licencia, y anota las versiones en `DECISIONES.md`.
   - El polyfill de códigos baja el `.wasm` de jsDelivr si no se le indica otra cosa. Llama a `prepareZXingModule` con `locateFile` apuntando al `zxing_reader.wasm` local, guardado en `prueba/vendor/`.
   - qrcode-generator no trae un archivo LICENSE: la licencia MIT está en la cabecera de `qrcode.js`. Consérvala.
   - Playwright para Python ya está instalado: el comando `python` del PATH lo trae, y `PLAYWRIGHT_BROWSERS_PATH` ya está puesto. Usa Chromium sin pantalla (`p.chromium.launch()`).
   - `codex/pruebas/correr.py` lo vuelve a correr el bucle **sin red**. Sirve las páginas con `page.route` (respondiendo con los archivos del repositorio bajo una dirección inventada, por ejemplo `https://sparati.test/`) y no con un servidor HTTP ni con internet.
5. (27-nov-2026) No hagas `git commit` ni intentes tocar `.git`. Que `.git` sea de solo lectura es lo previsto, no un error: el bucle guarda y sube tus cambios al terminar cada corrida. Deja los archivos listos y anota la corrida en `PROGRESO.md`. Que solo esté Chromium (sin WebKit) también es lo previsto: no hace falta anotarlo cada vez.
6. (27-nov-2026) **El celular de Elba es un iPhone**: la app tiene que funcionar bien en Safari de iPhone (iOS 16 o más nuevo), en el navegador y instalada en la pantalla de inicio. Cuida en especial:
   - **Cámara y códigos:** Safari no trae `BarcodeDetector`; usa siempre el polyfill local. El `<video>` de la cámara lleva `playsinline`, `muted` y `autoplay` (sin `playsinline` iOS lo abre a pantalla completa o queda negro). Pide la cámara solo después de un toque de la usuaria.
   - **Datos:** Safari puede borrar los datos de un sitio que no se usa en 7 días si no está instalado en la pantalla de inicio. Llama a `navigator.storage.persist()` si existe, invita (una sola vez, con opción de cerrar) a «Agregar a pantalla de inicio» cuando no esté instalada, y recuerda hacer la copia de respaldo.
   - **Archivos:** para enviar el respaldo usa `navigator.share` con archivo si `navigator.canShare({files})` lo permite; si no, la descarga con `<a download>`. Para recibir, `<input type="file">`.
   - **Pantalla:** `viewport-fit=cover` con `env(safe-area-inset-*)` para la muesca y la barra de abajo; `100dvh` en vez de `100vh`; textos de los campos de 16 px o más (si no, iOS hace zoom al tocarlos); metas `apple-mobile-web-app-*` y el ícono de 180 px.
   - **Código:** nada que no exista en Safari 16 (por ejemplo, sin `color-mix()` ni APIs más nuevas sin respaldo).
   - **Pruebas:** en `correr.py`, además de 390×844, corre las pruebas principales con el perfil de iPhone de Playwright (`p.devices['iPhone 13']`) en Chromium. No reemplaza a Safari, pero detecta problemas de tamaño y de toque.
