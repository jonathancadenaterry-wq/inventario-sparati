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
