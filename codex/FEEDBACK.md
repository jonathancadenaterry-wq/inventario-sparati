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
6. (27-nov-2026) **El celular de Elba es un iPhone 14 Pro con iOS 26.5** (pantalla de 393×852, con Dynamic Island): la app tiene que funcionar bien en su Safari, en el navegador y instalada en la pantalla de inicio. Cuida en especial:
   - **Cámara y códigos:** Safari no trae `BarcodeDetector`; usa siempre el polyfill local. El `<video>` de la cámara lleva `playsinline`, `muted` y `autoplay` (sin `playsinline` iOS lo abre a pantalla completa o queda negro). Pide la cámara solo después de un toque de la usuaria.
   - **Datos:** Safari puede borrar los datos de un sitio que no se usa en 7 días si no está instalado en la pantalla de inicio. Llama a `navigator.storage.persist()` si existe, invita (una sola vez, con opción de cerrar) a «Agregar a pantalla de inicio» cuando no esté instalada, y recuerda hacer la copia de respaldo.
   - **Archivos:** para enviar el respaldo usa `navigator.share` con archivo si `navigator.canShare({files})` lo permite; si no, la descarga con `<a download>`. Para recibir, `<input type="file">`.
   - **Pantalla:** `viewport-fit=cover` con `env(safe-area-inset-*)` para la muesca y la barra de abajo; `100dvh` en vez de `100vh`; textos de los campos de 16 px o más (si no, iOS hace zoom al tocarlos); metas `apple-mobile-web-app-*` y el ícono de 180 px.
   - **Código:** todo lo que use tiene que existir en Safari 26; si algo no está, con respaldo.
   - **Pruebas:** en `correr.py`, además de 390×844, corre las pruebas principales con el perfil de iPhone de Playwright (`p.devices['iPhone 14 Pro']`, o el más parecido que exista) en Chromium. No reemplaza a Safari, pero detecta problemas de tamaño y de toque.
7. (28-nov-2026) **Nuevas tareas: T15 y T16, con la revisión de Jonathan (Android, Chrome) y de Elba (iPhone 14 Pro, Safari).** Cópialas tal cual al final de `codex/TAREAS.md`, antes de la línea `---`, como `## T15 · Lo que se rompe o confunde  [ ]` y `## T16 · Pulido de la revisión  [ ]`, y trabájalas en orden, como las demás. Todo va en `prueba/` y en `codex/`, sin romper el contrato de datos. Cada punto lleva su prueba en `codex/pruebas/correr.py`. Donde el punto lo pide, la prueba corre también a 360×800.

   **T15 · Lo que se rompe o confunde**
   - **Fechas de Nuevo producto › Vencimiento (solo en iPhone).** «Fecha de vencimiento» se monta sobre «Lote», y «Fecha en que se abrió» se sale de la tarjeta. Los campos de fecha de Safari tienen un ancho mínimo propio que Chromium no tiene. Arréglalo por CSS: en los campos de fecha, `min-width: 0`, `width: 100%`, `box-sizing: border-box` y `appearance: none` (también con `-webkit-appearance: none`); y `min-width: 0` en la columna o celda que contiene cada campo.
     - Prueba, midiendo cajas: ningún campo se sale de su tarjeta ni se cruza con otro. Como Chromium no tiene ese ancho propio, antes de medir simúlalo con una regla de prueba de poca fuerza, por ejemplo `:where(input[type="date"]) { min-width: 14em }`. Comprueba también el estilo calculado de los campos de fecha y de la columna o celda de cada uno.
   - **Proveedor (solo en iPhone).** «WhatsApp del proveedor» ocupa dos líneas y los dos cuadros de esa fila quedan desalineados. Alinea los cuadros por abajo o pon la fila en una sola columna.
     - Prueba, midiendo cajas: a 360 y 390 px, los dos cuadros tienen el mismo borde de abajo, o están uno debajo del otro.
   - **Reportes › Inventario.** «Valor a costo» suma uso en spa ($434) y para vender ($708,80), $1.142,80, pero «Valor a precio de venta» cuenta solo para vender ($1.162): compara dos grupos distintos. Muéstralos por separado, cada uno con su texto: «Para vender», con el valor a costo y a precio de venta, y «Uso en spa», solo a costo, porque no se vende.
     - Prueba: con los datos de ejemplo, cada valor coincide con la suma que la prueba calcula desde los productos de su grupo, y ningún valor mezcla los dos grupos.
   - **Reportes › Cabina.** «Lo que más se gastó» suma $30 de un total de $32. Agrega una fila «Otros» con el resto. Si no hay resto, no la muestres.
     - Prueba: la suma de las filas, con «Otros», es igual al total.
   - **«Queda 1» en Nueva venta.** Hoy se pinta en rojo en todo producto con 1 unidad, aunque no tenga aviso. Usa la misma regla que Inventario y «Por terminarse», con una sola función para las tres pantallas: rojo cuando el producto llega a su aviso, y siempre cuando está agotado (0), tenga aviso o no.
     - Prueba: un producto con 1 unidad que no llega a su aviso no sale en rojo, uno que llega sí, y uno agotado (0) sale en rojo aunque no tenga aviso. El resultado es el mismo en Nueva venta, Inventario y «Por terminarse».
   - **El 0 parece una «o».** La fuente de los títulos dibuja las cifras antiguas: «Venta · o productos», «1o», «2o26». Pon `font-variant-numeric: lining-nums tabular-nums` en todo número. Si la fuente guardada no trae esas cifras, usa Inter para los números.
     - Prueba, con el dibujo real (un canvas no aplica `font-variant-numeric`): con Playwright, captura un elemento con «0» y otro con «o», los dos en la fuente de los títulos y del mismo tamaño. En Python, solo con zlib y sin bibliotecas nuevas, decodifica cada PNG (también los filtros de cada fila) y cuenta las filas con tinta: el «0» tiene que ser más alto que la «o». Además, el estilo calculado de los títulos y de los números tiene `lining-nums`.
   - **Un número nunca se separa de su unidad o símbolo.** Pasa con «30 cc» en los avisos de Inicio, «$ 189,00» en Ventas por semana (Android), «$ / 72,00» en Pacientes (iPhone), y con «3 %» y «5 %» dentro de los nombres. Al formatear cantidades y precios, usa un espacio irrompible (U+00A0) entre el número y su unidad o su símbolo, en una sola función de formato. «3 %» y «5 %» vienen del nombre que escribe la usuaria, no de esa función: al mostrar nombres, cambia el espacio entre un número y %, ml, g, cc o mg por uno irrompible, solo en pantalla. El dato guardado no cambia.
     - Prueba: la función de formato no deja espacios comunes entre el número y su unidad. A 360 y 390 px, ninguna cantidad o precio ocupa más de una línea. A 360 px, «Gel de Ácido Tranexámico 3 %» no deja el % solo en una línea, y su nombre guardado sigue con el espacio común.
   - **Tamaño en Nueva venta.** Si el nombre se corta, se pierde el tamaño: «Hydrating Foaming…» existe en 100 y en 200 ml. Muestra el tamaño en su propia línea, siempre entero.
     - Prueba: a 360 px, dos productos con el mismo nombre y distinto tamaño muestran su tamaño completo, sin cortar, y distinto.
   - **Hoja de Envío.** Cuando el celular no puede compartir el archivo y se descarga, la hoja dice el paso siguiente con el nombre del archivo, por ejemplo: «Ahora abre el chat de Jonathan en WhatsApp y adjunta el archivo `….txt` que se descargó».
     - Prueba: con la descarga, la hoja muestra ese paso con el nombre del archivo descargado.
   - **«Último envío».** Hoy se marca al empezar la descarga, antes de que el archivo llegue a Jonathan, y eso puede apagar el aviso de los 7 días sin que se haya enviado nada. Desde ahora:
     - si se comparte con el menú del celular (`navigator.share`) y termina bien, se marca la fecha;
     - si la usuaria cierra el menú sin compartir, o el menú falla, no se marca nada;
     - si se descarga, la hoja pregunta «¿Ya lo enviaste?», con «Sí» y «Todavía no», y la fecha se marca solo con el «Sí».
     - Prueba: con `navigator.share` simulado, que termine bien marca la fecha y que se cancele no la marca; con la descarga, aparece la pregunta, «Todavía no» no marca la fecha y «Sí» la marca. En los cuatro casos, el aviso de los 7 días sigue lo que diga la fecha.
   - **Hecha cuando:**
     - todas las pruebas pasan en Chromium a 390×844 y con el perfil de iPhone 14 Pro, y las que lo piden, a 360×800;
     - `codex/capturas/` tiene capturas nuevas, en claro y en oscuro y con el perfil de iPhone 14 Pro, de Nuevo producto › Vencimiento, Proveedor, Reportes › Inventario y Cabina, Nueva venta, Pacientes y la hoja de Envío;
     - en `PROGRESO.md`, la lista de lo que Elba tiene que volver a mirar en su iPhone.

   **T16 · Pulido de la revisión**
   - **Buscador de Inicio (Android).** El texto se corta: «…pacie». Que quepa entero a 360 px, o acórtalo.
     - Prueba: a 360 px, el ancho del texto del buscador, medido en un canvas con su fuente, cabe en el ancho útil del campo.
   - **Iniciales de los productos.** Salen «D·» (DTX), «A·» (ADN) y «M·» (Manicmag), y «Gel de Ácido…», «Gel de Colágeno…» y «Gel de Malva» salen todas «GD». Ignora los signos. Con una sola palabra, usa sus dos primeras letras. Salta las palabras de, del, la, el, y, con y el signo +.
     - Prueba: DTX da «DT», ADN da «AD», Manicmag da «MA», Gel de Colágeno da «GC», Gel de Malva da «GM», y los tres geles dan iniciales distintas.
   - **Ícono del botón «Excel».** Usa el de etiqueta, el mismo de «Etiquetas QR». Usa uno de hoja de cálculo, dibujado en SVG dentro del código.
     - Prueba: el ícono de «Excel» no es el de «Etiquetas QR».
   - **«Sin marca» en Inventario.** Va siempre al final de los grupos.
     - Prueba: con un producto sin marca y marcas que van antes y después en el orden alfabético, el último grupo es «Sin marca».
   - **Nombres de las categorías.** En venta dice «Facial» y «Corporal», y en spa, «Faciales» y «Corporales». Usa los mismos nombres en los dos grupos, en singular: «Facial» y «Corporal». Cambia las categorías de fábrica y lo que se muestra. Los datos guardados no se renombran (contrato de datos): un producto que traiga el nombre viejo se muestra con el nuevo.
     - Prueba: venta y spa muestran los mismos nombres. Un producto guardado con «Faciales» se muestra como «Facial» y su dato no cambia. Los archivos de la versión 1 siguen abriendo sin perder nada.
   - **Historial de ventas.** Separa los productos de una venta con un salto de línea, no con «·», que ya separa el tamaño.
     - Prueba: una venta de dos productos muestra cada uno en su propia línea, sin «·» entre ellos.
   - **«Avanzado», en Ajustes.** Usa el triángulo «►» del navegador. Quítalo y dale el estilo de las demás filas, con el mismo indicador.
     - Prueba: el triángulo del navegador no se muestra, y la fila tiene el mismo alto y relleno que las demás filas de Ajustes.
   - **Selectores en oscuro (Categorías y Preferencias).** La opción activa casi no se distingue: su fondo tiene un contraste de 1,1:1 con el resto del selector. Tiene que distinguirse por algo más que el color del texto. Usa un fondo con un contraste de 3:1 o más contra el resto del selector, o el relieve de `Inventario.png`. Revisa también el tema claro. En Categorías, no repitas el nombre del grupo activo como título de la lista.
     - Prueba: en oscuro y en claro, el fondo de la opción activa tiene un contraste de 3:1 o más con el resto del selector.
   - **Invitación a instalar, en Inicio.** Hoy queda debajo de todos los avisos y hay que bajar para verla. Mientras la app no esté instalada, ponla arriba de los avisos, todavía una sola vez y con opción de cerrar. Su texto habla solo de agregarla a la pantalla de inicio, porque «Ver los pasos» abre solo esa guía. El recordatorio del respaldo ya tiene su propio aviso.
     - Prueba: sin instalar, la invitación va antes que los avisos y no menciona el respaldo; al cerrarla, no vuelve.
   - **«Cargar datos de ejemplo», en Ajustes.** Cuando los datos ya están cargados, el botón desactivado se ve tenue (2,23:1) y queda cortado. En ese caso quita el botón y deja solo el mensaje de que ya están cargados. Al final del desplazamiento de Ajustes, nada queda tapado por la barra de abajo ni por la zona segura del iPhone.
     - Prueba: con los datos cargados, el botón no está y el mensaje sí. Al bajar hasta el final, el último elemento de Ajustes termina por encima de la barra de abajo.
   - **Guía para instalar en Safari.** Junto a la palabra «Compartir» muestra el ícono del botón (un cuadrado con una flecha hacia arriba), dibujado en SVG dentro del código, sin descargar nada. Después nombra «Agregar a pantalla de inicio».
     - Prueba: la guía de Safari tiene el ícono junto a «Compartir» y nombra «Agregar a pantalla de inicio».
   - **Campos de Plantillas.** El tirador diagonal queda pegado a la esquina redondeada. Quítalo (`resize: none`) y haz que cada campo crezca solo con el texto.
     - Prueba: los campos tienen `resize: none`, y al escribir varias líneas el campo crece sin barra de desplazamiento.
   - **Título de Ajustes.** Mide 24 px, y `DISENO.md` pide de 28 a 30 px para los títulos de pantalla. Usa el mismo estilo de título que las demás pantallas.
     - Prueba: el título de cada pantalla, Ajustes incluido, mide de 28 a 30 px.
   - **Hecha cuando:**
     - todas las pruebas pasan en Chromium a 390×844 y con el perfil de iPhone 14 Pro, y las que lo piden, a 360×800;
     - `codex/capturas/` tiene capturas nuevas, en claro y en oscuro, de Inicio con la invitación (y a 360 px, con el buscador), Inventario, Historial de ventas, Reportes con el botón «Excel», Ajustes con «Avanzado», Categorías, Plantillas y la guía de Safari.
