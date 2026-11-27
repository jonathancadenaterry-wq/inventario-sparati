# AGENTS.md — SPARATI Inventario, versión 2

Este repositorio contiene la app de inventario del spa SPARATI de Elba. La usan Elba (iPhone, Safari) y Jonathan (Android, Chrome), instalada en la pantalla de inicio. Se publica con GitHub Pages en `https://jonathancadenaterry-wq.github.io/inventario-sparati/`.

Tu trabajo es construir la **versión 2** según `codex/TAREAS.md` y el diseño de `codex/DISENO.md` (con las imágenes de `codex/diseno/*.png`).

## Reglas que no se pueden romper

1. **Trabaja solo dentro de `prueba/` y `codex/`.** Los archivos de la raíz (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `icono-*.png`) son la app que Elba usa todos los días. No los modifiques, no los muevas y no los borres. Si un commit tuyo toca algo fuera de `prueba/` o `codex/`, el bucle lo rechaza y no se sube.
2. **Los datos de Elba son sagrados.** La versión 2 en `prueba/` usa su propia clave de almacenamiento (`sparati_prueba_v2`) y su propia base de fotos (`sparati_prueba_fotos`), así que nunca lee ni escribe los datos reales. El paso final a la clave real (`sparati_inventario_v1`) lo hará Claude cuando Jonathan lo apruebe, no tú.
3. **Compatibilidad del formato.** Todo cambio al modelo de datos es **solo aditivo**: se agregan campos o tipos de movimiento nuevos, nunca se renombran ni se quitan los de la versión 1. El contrato está en `codex/TAREAS.md` § «Contrato de datos». La versión 2 tiene que abrir sin perder nada los archivos `codex/fixtures/v1-estado.json` y `codex/fixtures/v1-envio.txt`.
4. **Sin servidores ni servicios externos.** Es HTML + CSS + JavaScript sin framework y sin paso de compilación, servido como archivos estáticos. No uses CDN en tiempo de ejecución: si necesitas una biblioteca (lector de códigos, QR), descárgala una vez, guárdala en `prueba/vendor/` junto con su licencia y anótala en `codex/DECISIONES.md`. Nada de analítica ni de rastreo. Las únicas salidas permitidas son los enlaces `https://wa.me/` que abre la usuaria.
5. **Funciona sin internet.** Una vez abierta, la app debe funcionar sin conexión, gracias al service worker de `prueba/` con caché de prefijo `spp-`. Ese service worker solo borra cachés que empiecen con `spp-`, nunca las `sp-`, `cc-` ni `di-`, que son de otras apps del mismo dominio.
6. **Sin secretos.** Nunca escribas claves, tokens ni contraseñas en el repositorio.

## Cómo trabajar en cada corrida

1. Lee primero `codex/FEEDBACK.md`: lo que diga ahí manda sobre todo lo demás. Después lee `codex/PROGRESO.md`.
2. Toma la **primera tarea sin terminar** de `codex/TAREAS.md`. Si es grande, avanza una parte que quede funcionando.
3. Antes de hacer commit, ejecuta las pruebas: `python3 codex/pruebas/correr.py`. Usa Playwright en Chromium con un tamaño de 390×844, y también en WebKit si está instalado. Agrega pruebas por cada función nueva. No hagas commit con pruebas fallando.
4. Saca capturas a `codex/capturas/` de las pantallas que tocaste, en 390×844 y en modo oscuro, y compáralas con `codex/diseno/*.png`. El resultado debe parecerse al diseño: colores, tipografía, espacios, radios y jerarquía.
5. Actualiza `codex/PROGRESO.md` con lo que hiciste, lo que sigue y lo que no pudiste resolver. Anota las decisiones pequeñas en `codex/DECISIONES.md`.
6. Haz commits pequeños con mensajes en español, por ejemplo: `Inventario: filtros por estado y búsqueda`.

## Si algo no está claro

Elige la opción más simple que respete el diseño y las reglas, anótala en `codex/DECISIONES.md` y sigue trabajando. Pregunta en `codex/PROGRESO.md`, sección «Preguntas para Jonathan», **solo** si la decisión cambia lo que Elba ve o hace de forma importante.

## Estilo de la app

- Todos los textos en español de Ecuador, cálidos y claros, sin tecnicismos. Ejemplos: «Queda 1», «Se acabaría en ~10 días», «Llegó mercadería». Dinero en dólares, con este formato: `$ 18,00`.
- Botones de al menos 44 px, contraste AA y foco visible. Respeta `prefers-reduced-motion`.
- El código y los comentarios, en español.
