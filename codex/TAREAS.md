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
  - Paciente, en la lista nueva `pacientes:[{id, nombre, tel, notas, creado, mod, por, borrado}]`.
    - Las ventas siguen guardando `pac` y `tel` como texto para seguir siendo compatibles.
    - Al recibir un archivo de la versión 1, la lista de pacientes se arma a partir de los nombres de las ventas.
- Los mismos `id` se mantienen siempre. Todo cambio pone `mod = Date.now()` y `por = quien()`.

**Prueba obligatoria del contrato.**
- Al cargar `codex/fixtures/v1-estado.json` como estado:
  - el stock queda en p1 = 5, p2 = 4 y p3 = 1;
  - p4 y m9 se ignoran porque están borrados;
  - la venta v1 se ve con su paciente.
- Al recibir `codex/fixtures/v1-envio.txt` dos veces, la segunda vez no cambia nada.

---

## T0 · Preparar la carpeta de prueba  [ ]
- Copia la versión 1 a `prueba/` y cambia lo siguiente:
  - clave `sparati_prueba_v2`, quién `sparati_prueba_yo` y base de fotos `sparati_prueba_fotos`;
  - caché del service worker con prefijo `spp-`;
  - manifiesto con el nombre «SPARATI Prueba», `start_url` y `scope` `./`, e ícono con una franja que diga PRUEBA.
- Agrega una franja fina arriba que diga «Versión de prueba · los datos no son los reales».
- Agrega el botón «Cargar datos de ejemplo» en Ajustes. Debe cargar `codex/catalogo.json` (104 productos reales, con las cantidades y las fotos que hay) con:
  - los precios de ejemplo;
  - 25 ventas de ejemplo en los últimos 60 días, a 8 pacientes con nombres inventados;
  - algunos usos de cabina y aperturas.
- Arma `codex/pruebas/correr.py` (Playwright) con un servidor local que sirva la raíz del repositorio, para que `prueba/` y `codex/` estén accesibles.
- **Hecha cuando:** la raíz sigue idéntica (`git diff --stat` sin cambios fuera de `prueba/` y `codex/`), `prueba/` abre y funciona como la versión 1, las pruebas pasan y la prueba del contrato pasa.

## T1 · Sistema de diseño y estructura  [ ]
- Pon los tokens, el modo oscuro, las fuentes guardadas en el repositorio y los componentes de `DISENO.md`: barra inferior con Vender al centro, buscador con botón de escanear, chips, segmentado, píldoras, filas, hojas inferiores, toast con deshacer, stepper e íconos.
- Arma una navegación por pantallas (hash o estado) que mantenga el botón «atrás» de Android funcionando como en la versión 1.
- **Hecha cuando:** las capturas de los componentes se ven como el diseño en claro y en oscuro.

## T2 · Inicio  [ ]
Según `Main.png`:
- saludo según la hora y fecha en español;
- buscador global de productos y pacientes;
- acciones rápidas: Vender, Usé en cabina, Llegó mercadería y Contar inventario;
- tarjeta ciruela con las ventas del mes, la comparación con el mes anterior, la ganancia y barras de los últimos 7 días (SVG o div propios, sin bibliotecas);
- tres contadores: por terminarse, vencen pronto y pacientes por recordar;
- lista «Necesita atención», que junta el stock bajo, los vencimientos o el tiempo después de abierto (PAO) que se cumple, las pacientes por recordar y «Jonathan no tiene tus cambios» si pasaron más de 7 días sin enviar. Cada fila lleva su botón de acción.
- **Hecha cuando:** con los datos de ejemplo se ve como el diseño y cada acción lleva a su pantalla.

## T3 · Inventario  [ ]
Según `Inventario.png`:
- segmentado Para vender / Uso en spa, con cuántos hay en cada uno;
- buscador que no distingue tildes ni mayúsculas, y botón de escanear;
- chips: Todos, Por terminarse, Vencen pronto y las categorías;
- resumen de unidades y valor a precio de venta (y a costo, en Uso en spa);
- lista agrupada por marca, con foto o iniciales y la píldora de stock;
- orden por nombre, stock o última venta;
- botón «+ Producto», que abre el formulario de la versión 1 con el diseño nuevo, más los campos `codigo` y `max`.
- **Hecha cuando:** con 300 productos de prueba la lista se desplaza con fluidez (usa `content-visibility` o paginado) y los filtros funcionan.

## T4 · Ficha de producto para vender  [ ]
Según `Producto.png`:
- foto grande;
- stock con barra y la predicción «se acabaría en ~N días», que sale del consumo de la versión 1;
- botones Vender, Llegó más y Ajustar. Ajustar pide un motivo: conteo, se dañó, se venció, regalo u otro;
- precio, costo y ganancia en dólares y porcentaje;
- código de barras («Asignar con la cámara»), vence y lote, y cuántas pacientes lo compran;
- historial en línea de tiempo.
- **Hecha cuando:** cada acción crea el movimiento correcto, el historial lo muestra y se puede deshacer desde el toast.

## T5 · Ficha de producto de cabina  [ ]
Según `Cabina.png`:
- Tarjeta «Frasco en uso»:
  - «Abrí uno nuevo» crea un movimiento `apertura` y pone `abierto = hoy`;
  - «Se terminó» crea un `uso` −1 con el motivo `terminado`;
  - el rendimiento es el promedio de días entre una apertura y el «se terminó» siguiente, con hasta los últimos 3 frascos;
  - con eso salen la barra de avance, la fecha estimada en que se acaba y el costo por día.
- Mantén el «Usar» de un toque con `gasto` para los productos que se miden por tratamiento (ml, ampollas o unidades). Muestra los dos modos según la unidad: con `frascos` el modo frasco y con el resto el modo tratamiento.
- Aviso de tiempo después de abierto (PAO): «Ya pasó el tiempo de uso después de abierto».
- **Hecha cuando:** con los datos de ejemplo se calcula bien el rendimiento y hay pruebas para estos cálculos.

## T6 · Nueva venta  [ ]
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

## T7 · Escáner  [ ]
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

## T8 · Pacientes  [ ]
- **Lista** con buscador, la última compra y lo que gastó en total.
- **Ficha** según `Paciente.png`:
  - iniciales, teléfono, y los botones WhatsApp y Nueva venta;
  - cuánto compró, cuántas compras y cada cuántos días vuelve;
  - «Le toca volver a comprar», calculado con `duraPac` y la fecha de su última compra de cada producto;
  - un mensaje de recordatorio que se puede editar, con una plantilla guardada en Ajustes, y que se envía con `wa.me`;
  - notas e historial de compras.
- Al enviar el recordatorio, se anota en `venta.recordados` para no repetir el aviso.
- **Hecha cuando:** las pacientes por recordar de Inicio coinciden con las de esta ficha.

## T9 · Reportes  [ ]
Según `Reportes.png`:
- selector de mes;
- **Ventas**: lo vendido, la ganancia, el número de ventas, la venta promedio, las barras por semana, lo más vendido y las formas de pago;
- **Cabina**: el gasto en cabina (costo de los `uso`), los frascos terminados y los productos que más se gastan;
- **Inventario**: el valor a costo y a precio, lo que no se movió en 60 días y lo que vence en 90 días;
- **Descargar PDF**: una vista de impresión con el logo de texto SPARATI, `@media print` y `window.print()`. En el iPhone se guarda como PDF desde «Compartir»;
- **Excel**: un CSV con `;` como separador, UTF-8 con BOM y coma decimal;
- **Enviar por WhatsApp**: un resumen en texto.
- **Hecha cuando:** las cifras de los reportes cuadran con las ventas del mes, con una prueba que lo verifica.

## T10 · Contar inventario  [ ]
- Revisión guiada de uno de estos grupos: todos, una pestaña o una marca.
- En cada producto: foto, stock esperado y la cantidad contada (stepper o escáner, que suma uno por cada lectura).
- Al final, un resumen de las diferencias. Al confirmar, se crean ajustes con el motivo `conteo`.
- El conteo se puede pausar y retomar.
- **Hecha cuando:** un conteo con diferencias deja el stock igual a lo contado.

## T11 · Lista para pedir  [ ]
- Mejora la lista de compras de la versión 1:
  - sugiere cuánto pedir: hasta `max` si existe; si no, lo que cubre 30 días de consumo, o como mínimo `min + 1`;
  - agrupa por proveedor;
  - envía el pedido por WhatsApp al `telProv`;
  - permite marcar «Pedido» y luego «Llegó», que crea las entradas con el costo.
- **Hecha cuando:** se puede hacer el ciclo pedir → llegó, que actualiza el stock y el costo.

## T12 · Etiquetas QR propias  [ ]
- Para los productos sin código: genera un código `SP-` + 5 caracteres, guardado en `codigo`, y una hoja A4 para imprimir con 24 etiquetas de 3×8, cada una con su QR y el nombre.
  - Usa una biblioteca de QR guardada en `prueba/vendor/`.
- El escáner reconoce estos códigos.
- **Hecha cuando:** imprimir a PDF da una hoja ordenada y el escáner lee el QR generado.

## T13 · Ajustes, envío y respaldo  [ ]
- Rediseña Ajustes:
  - quién usa el celular, tema (claro, oscuro o automático), letra grande y plantillas de WhatsApp;
  - categorías, días de aviso de vencimiento y «Cargar datos de ejemplo».
- Mantén el envío y la recepción por archivo de la versión 1. Agrega un aviso en Inicio si pasaron más de 7 días sin enviar, y un «Respaldo completo» (archivo con fotos) que se pueda guardar en Archivos o Drive.
- **Hecha cuando:** un archivo enviado desde `prueba/` lo puede abrir la versión 1 sin errores (prueba automática que carga la raíz con ese archivo), y al revés.

## T14 · Pulido final  [ ]
- Primera vez: una bienvenida de 3 pasos.
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

---

**No hagas tú:** pasar `prueba/` a la raíz, cambiar la clave real ni tocar los archivos de la raíz. Eso lo hace Claude cuando Jonathan lo apruebe.
