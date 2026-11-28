# Tareas de la versión 2 (en orden)

Cada tarea dice cuándo está **hecha**. Marca `[x]` al terminar y deja una línea en `PROGRESO.md`. Toda la versión 2 vive en `prueba/`. La app actual (versión 1, en la raíz) es la base: copia y mejora su lógica en lugar de reescribir lo que ya funciona (cálculo del stock, avisos, mezcla al recibir, compresión de fotos y botón «atrás» de Android).

---

## Contrato de datos (no se puede romper)

El estado se guarda en `localStorage` como un JSON con esta forma:

```
{ v:1, productos:[], movs:[], ventas:[], cats:{venta:[], uso:[]},
  ajustes:{diasVence:60, tema:'auto'}, sync:{envio, recibo, de}, creado }
```

- **Producto**
  ```
  {id, tipo:'venta'|'uso', nombre, marca, cat, unidad, min, costo, precio, gasto, duraPac,
   vence:'AAAA-MM-DD', lote, abierto:'AAAA-MM-DD', pao (meses), prov, telProv, notas, foto,
   creado, mod, por, borrado}
  ```
  - `gasto` es lo que descuenta «Usar» de un toque en cabina.
  - `duraPac` son los días que el producto le dura a la paciente.
- **Movimiento**
  ```
  {id, prod, tipo:'inicial'|'entrada'|'venta'|'uso'|'ajuste', cant (con signo), fecha:'AAAA-MM-DD',
   pac, trat, precio, costo, venta, motivo, nota, creado, mod, por, borrado}
  ```
  - El **stock** es la suma de `cant` de los movimientos que no están borrados.
- **Venta**
  ```
  {id, pac, tel, fecha, items:[{prod, nombre, cant, precio, costo}], cobrado, pago, nota,
   recordados:{}, creado, mod, por, borrado}
  ```
- **Archivo de envío** entre celulares: `{app:'sparati-inventario', v:1, de, generado, datos:{productos, movs, ventas, cats}, fotos:{[idFoto]: dataURL}}`.
  - Se guarda como `.txt` de tipo text/plain.
  - Al recibir, se mezcla por `id`: gana el registro con `mod` más nuevo. No se borra nada: se usa `borrado:true`.
- **Agregados permitidos en la versión 2** (todos opcionales; la versión 1 los ignora sin romperse):
  - Producto: `codigo` (código de barras o `SP-xxxxx`), `max` (cantidad ideal para pedir), `favorito`.
  - Venta: `descuento` (en dólares) y `pago` con estos valores: `'efectivo'|'transferencia'|'tarjeta'`.
  - Movimiento de tipo `'apertura'` con `cant:0`: registra la fecha en que se abrió un frasco nuevo de cabina. No cambia el stock.
  - Movimiento de tipo `'entrada'`: el campo opcional `pedido` vincula la llegada con el pedido local.
  - Paciente, en la lista nueva `pacientes:[{id, nombre, tel, notas, creado, mod, por, borrado}]`.
    - Las ventas siguen guardando `pac` y `tel` como texto para seguir siendo compatibles.
    - Al recibir un archivo de la versión 1, la lista de pacientes se arma a partir de los nombres de las ventas.
  - En Ajustes, `plantillaRecordatorio` guarda el mensaje base de WhatsApp, `plantillaComprobante` la despedida del comprobante y `letraGrande` el tamaño de letra de este celular.
  - En `sync`, `hastaEnvio` indica cuándo se preparó el archivo del último envío y `categoriasMod` cuándo se agregó una categoría en este celular.
  - Estado local: `conteo` guarda el borrador del conteo guiado. El archivo de envío solo lleva los movimientos de ajuste después de confirmar el conteo.
  - Estado local: `pedidos:[{id, proveedor, fecha, items:[{prod, nombre, unidad, cant}], creado, mod, por, borrado}]`. El archivo de envío lleva las entradas registradas y los costos actualizados.
- Los mismos `id` se mantienen siempre. Todo cambio pone `mod = Date.now()` y `por = quien()`.

**Prueba obligatoria del contrato.**
- Al cargar `codex/fixtures/v1-estado.json` como estado:
  - el stock queda en p1 = 5, p2 = 4 y p3 = 1;
  - p4 y m9 se ignoran porque están borrados;
  - la venta v1 se ve con su paciente.
- Al recibir `codex/fixtures/v1-envio.txt` dos veces, la segunda vez no cambia nada.

---

## T0 · Preparar la carpeta de prueba  [x]
- Copia la versión 1 a `prueba/` y cambia lo siguiente:
  - clave `sparati_prueba_v2`, quién `sparati_prueba_yo` y base de fotos `sparati_prueba_fotos`;
  - caché del service worker con prefijo `spp-`;
  - manifiesto con el nombre «SPARATI Prueba», `start_url` y `scope` `./`, e íconos hechos con los de `codex/marca/`, más una franja que diga PRUEBA. El `theme_color` es `#C2207F`.
- Agrega una franja fina arriba que diga «Versión de prueba · los datos no son los reales».
- Agrega el botón «Cargar datos de ejemplo» en Ajustes. Debe cargar `codex/catalogo.json` (104 productos reales, con las cantidades y las fotos que hay) con:
  - los precios de ejemplo;
  - 25 ventas de ejemplo en los últimos 60 días, a 8 pacientes con nombres inventados;
  - algunos usos de cabina y aperturas.
- Arma `codex/pruebas/correr.py` (Playwright) con un servidor local que sirva la raíz del repositorio, para que `prueba/` y `codex/` estén accesibles.
- **Hecha cuando:** la raíz sigue idéntica (`git diff --stat` sin cambios fuera de `prueba/` y `codex/`), `prueba/` abre y funciona como la versión 1, las pruebas pasan y la prueba del contrato pasa.

## T1 · Sistema de diseño y estructura  [x]
- Pon los tokens, el modo oscuro, las fuentes guardadas en el repositorio y los componentes de `DISENO.md`: barra inferior con Vender al centro, buscador con botón de escanear, chips, segmentado, píldoras, filas, hojas inferiores, toast con deshacer, stepper e íconos.
- Arma una navegación por pantallas (hash o estado) que mantenga el botón «atrás» de Android funcionando como en la versión 1.
- **Hecha cuando:** las capturas de los componentes se ven como el diseño en claro y en oscuro.

## T2 · Inicio  [x]
Según `Main.png`:
- saludo según la hora y fecha en español;
- buscador global de productos y pacientes;
- acciones rápidas: Vender, Usé en cabina, Llegó mercadería y Contar inventario;
- tarjeta ciruela con las ventas del mes, la comparación con el mes anterior, la ganancia y barras de los últimos 7 días (SVG o div propios, sin bibliotecas);
- tres contadores: por terminarse, vencen pronto y pacientes por recordar;
- lista «Necesita atención», que junta el stock bajo, los vencimientos o el tiempo después de abierto (PAO) que se cumple, las pacientes por recordar y «Jonathan no tiene tus cambios» si pasaron más de 7 días sin enviar. Cada fila lleva su botón de acción.
- **Hecha cuando:** con los datos de ejemplo se ve como el diseño, con el logo en la cabecera, y cada acción lleva a su pantalla.

## T3 · Inventario  [x]
Según `Inventario.png`:
- segmentado Para vender / Uso en spa, con cuántos hay en cada uno;
- buscador que no distingue tildes ni mayúsculas, y botón de escanear;
- chips: Todos, Por terminarse, Vencen pronto y las categorías;
- resumen de unidades y valor a precio de venta (y a costo, en Uso en spa);
- lista agrupada por marca, con foto o iniciales y la píldora de stock;
- orden por nombre, stock o última venta;
- botón «+ Producto», que abre el formulario de la versión 1 con el diseño nuevo, más los campos `codigo` y `max`.
- **Hecha cuando:** con 300 productos de prueba la lista se desplaza con fluidez (usa `content-visibility` o paginado) y los filtros funcionan.

## T4 · Ficha de producto para vender  [x]
Según `Producto.png`:
- foto grande;
- stock con barra y la predicción «se acabaría en ~N días», que sale del consumo de la versión 1;
- botones Vender, Llegó más y Ajustar. Ajustar pide un motivo: conteo, se dañó, se venció, regalo u otro;
- precio, costo y ganancia en dólares y porcentaje;
- código de barras («Asignar con la cámara»), vence y lote, y cuántas pacientes lo compran;
- historial en línea de tiempo.
- **Hecha cuando:** cada acción crea el movimiento correcto, el historial lo muestra y se puede deshacer desde el toast.

## T5 · Ficha de producto de cabina  [x]
Según `Cabina.png`:
- Tarjeta «Frasco en uso»:
  - «Abrí uno nuevo» crea un movimiento `apertura` y pone `abierto = hoy`;
  - «Se terminó» crea un `uso` −1 con el motivo `terminado`;
  - el rendimiento es el promedio de días entre una apertura y el «se terminó» siguiente, con hasta los últimos 3 frascos;
  - con eso salen la barra de avance, la fecha estimada en que se acaba y el costo por día.
- Mantén el «Usar» de un toque con `gasto` para los productos que se miden por tratamiento (ml, ampollas o unidades). Muestra los dos modos según la unidad: con `frascos` el modo frasco y con el resto el modo tratamiento.
- Aviso de tiempo después de abierto (PAO): «Ya pasó el tiempo de uso después de abierto».
- **Hecha cuando:** con los datos de ejemplo se calcula bien el rendimiento y hay pruebas para estos cálculos.

## T6 · Nueva venta  [x]
Según `Vender.png`:
- **Paciente**: recientes, buscar, o «+ Nueva» con nombre y teléfono opcional.
- **Productos**:
  - cuadrícula de los más vendidos (los 9 primeros de los últimos 60 días) con foto, precio y stock;
  - buscador, chips por categoría y escanear.
- **Carrito**:
  - hoja inferior siempre visible, con stepper por producto y descuento opcional;
  - forma de pago: Efectivo, Transferencia o Tarjeta;
  - «Cobrado» o «Queda pendiente»;
  - casilla «Enviar comprobante por WhatsApp», que abre `wa.me` con el detalle, el total y el nombre del spa.
- No permite vender más de lo que hay sin pedir confirmación.
- Al cobrar: animación de éxito, toast con deshacer y regreso a Inicio.
- **Hecha cuando:** una venta de 3 productos se hace en menos de 6 toques desde Inicio (con escáner o tocando las fotos) y la prueba lo comprueba.

## T7 · Escáner  [x]
Según `Escaner.png`:
- Cámara trasera con `getUserMedia`.
  - Usa `BarcodeDetector` si existe. Si no (Safari en iPhone), usa el polyfill `barcode-detector` (ZXing en WebAssembly) guardado en `prueba/vendor/`.
  - Formatos: EAN-13, EAN-8, UPC-A, UPC-E, Code 128 y QR.
- Modos: Vender (agrega al carrito), Usé (cabina), Llegó (entrada) y Contar (va a T10).
- Al leer un código:
  - pitido corto con WebAudio y vibración;
  - si el producto existe, muestra su tarjeta;
  - si no existe, ofrece «Asignar a un producto» (buscador) o «Crear producto con este código».
- Botón de linterna si el teléfono lo permite (`torch`), y «Escribir el código a mano».
- Mensajes claros en español si se niega el permiso de cámara.
- Apaga la cámara al salir.
- **Hecha cuando:**
  - funciona con un video falso de Chromium que muestra un código EAN-13: `--use-file-for-fake-video-capture`, o con `detect()` sobre una imagen de prueba;
  - la lógica de asignar y buscar el código tiene pruebas;
  - en `PROGRESO.md` queda anotado qué falta probar en un iPhone real.

## T8 · Pacientes  [x]
- **Lista** con buscador, la última compra y lo que gastó en total.
- **Ficha** según `Paciente.png`:
  - iniciales, teléfono, y los botones WhatsApp y Nueva venta;
  - cuánto compró, cuántas compras y cada cuántos días vuelve;
  - «Le toca volver a comprar», calculado con `duraPac` y la fecha de su última compra de cada producto;
  - un mensaje de recordatorio que se puede editar, con una plantilla guardada en Ajustes, y que se envía con `wa.me`;
  - notas e historial de compras.
- Al enviar el recordatorio, se anota en `venta.recordados` para no repetir el aviso.
- **Hecha cuando:** las pacientes por recordar de Inicio coinciden con las de esta ficha.

## T9 · Reportes  [x]
Según `Reportes.png`:
- selector de mes;
- **Ventas**: lo vendido, la ganancia, el número de ventas, la venta promedio, las barras por semana, lo más vendido y las formas de pago;
- **Cabina**: el gasto en cabina (costo de los `uso`), los frascos terminados y los productos que más se gastan;
- **Inventario**: el valor a costo y a precio, lo que no se movió en 60 días y lo que vence en 90 días;
- **Descargar PDF**: una vista de impresión con el logo completo de `codex/marca/` en el encabezado, `@media print` y `window.print()`. En el iPhone se guarda como PDF desde «Compartir»;
- **Excel**: un CSV con `;` como separador, UTF-8 con BOM y coma decimal;
- **Enviar por WhatsApp**: un resumen en texto.
- **Hecha cuando:** las cifras de los reportes cuadran con las ventas del mes, con una prueba que lo verifica.

## T10 · Contar inventario  [x]
- Revisión guiada de uno de estos grupos: todos, una pestaña o una marca.
- En cada producto: foto, stock esperado y la cantidad contada (stepper o escáner, que suma uno por cada lectura).
- Al final, un resumen de las diferencias. Al confirmar, se crean ajustes con el motivo `conteo`.
- El conteo se puede pausar y retomar.
- **Hecha cuando:** un conteo con diferencias deja el stock igual a lo contado.

## T11 · Lista para pedir  [x]
- Mejora la lista de compras de la versión 1:
  - sugiere cuánto pedir: hasta `max` si existe; si no, lo que cubre 30 días de consumo, o como mínimo `min + 1`;
  - agrupa por proveedor;
  - envía el pedido por WhatsApp al `telProv`;
  - permite marcar «Pedido» y luego «Llegó», que crea las entradas con el costo.
- **Hecha cuando:** se puede hacer el ciclo pedir → llegó, que actualiza el stock y el costo.

## T12 · Etiquetas QR propias  [x]
- Para los productos sin código: genera un código `SP-` + 5 caracteres, guardado en `codigo`, y una hoja A4 para imprimir con 24 etiquetas de 3×8, cada una con su QR, el nombre y el emblema pequeño.
  - Usa una biblioteca de QR guardada en `prueba/vendor/`.
- El escáner reconoce estos códigos.
- **Hecha cuando:** imprimir a PDF da una hoja ordenada y el escáner lee el QR generado.

## T13 · Ajustes, envío y respaldo  [x]
- Rediseña Ajustes:
  - quién usa el celular, tema (claro, oscuro o automático), letra grande y plantillas de WhatsApp;
  - categorías, días de aviso de vencimiento y «Cargar datos de ejemplo».
- Mantén el envío y la recepción por archivo de la versión 1. Agrega un aviso en Inicio si pasaron más de 7 días sin enviar, y un «Respaldo completo» (archivo con fotos) que se pueda guardar en Archivos o Drive.
- **Hecha cuando:** un archivo enviado desde `prueba/` lo puede abrir la versión 1 sin errores (prueba automática que carga la raíz con ese archivo), y al revés.

## T14 · Pulido final  [x]
- Primera vez: una bienvenida de 3 pasos que empieza como `Bienvenida.png`, con el logo completo.
- Estados vacíos amables.
- Animaciones de `DISENO.md`.
- Revisión de accesibilidad: etiquetas, foco y contraste.
- Rendimiento: menos de 1 segundo hasta la primera pantalla en un celular de gama media; el JS dividido por pantallas si conviene.
- Funciona sin conexión.
- Escribe `codex/MIGRACION.md` con la función `migrarAV2()` lista y probada, y los pasos para que Claude pase `prueba/` a la raíz:
  - la clave real;
  - una copia de seguridad automática del estado de la versión 1 en `sparati_inventario_respaldo_v1` antes de migrar;
  - los nombres de caché `sp-`.
- **Hecha cuando:** todas las pruebas pasan en Chromium (y en WebKit si está), y `PROGRESO.md` tiene la lista de lo que Jonathan y Elba deben probar en sus celulares.

## T15 · Lo que se rompe o confunde  [x]

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

## T16 · Pulido de la revisión  [ ]

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

---

**No hagas tú:** pasar `prueba/` a la raíz, cambiar la clave real ni tocar los archivos de la raíz. Eso lo hace Claude cuando Jonathan lo apruebe.
