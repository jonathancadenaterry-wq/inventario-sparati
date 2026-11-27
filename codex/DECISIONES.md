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

## 27-nov-2026 · T2

- El saludo y el gráfico usan la hora y la fecha locales del celular. El gráfico incluye hoy y los seis días anteriores, aunque crucen de mes o de año. Inicio y Reportes usan los mismos totales netos de descuentos y costos. La comparación usa el mes calendario anterior. Se mantuvo el magenta de `Main.png` en claro y se usó el tono ciruela de la marca en oscuro.
- El resumen de avisos cuenta cada producto con vencimientos una sola vez, aunque tenga fecha impresa y plazo después de abierto. Las recompras se cuentan por paciente y la lista completa tiene una acción por producto. La campana y «Ver todo» abren esa lista. El botón «Ya le escribí» registra el recordatorio cuando la usuaria lo confirma.
- El aviso de envío aparece cuando existen cambios locales pendientes y han pasado más de siete días desde el último envío. Para un inventario que aún no se ha enviado, el plazo se cuenta desde su creación. El aviso usa el flujo de archivo existente, que también registra la descarga como un envío.
- Cabina, entrada y conteo abren un selector de producto y usan los formularios actuales. «Usé en cabina» muestra los insumos de spa. «Contar inventario» registra el conteo de un producto. El recorrido guiado corresponde a T10. Ajustes quedó al pie de Inicio para dar a la campana el lugar de la cabecera.
- Las nuevas cargas de ejemplo reparten siete ventas en los últimos siete días para mostrar las barras. Las capturas simulan un último envío de hace nueve días y conservan las cantidades del catálogo.

## 27-nov-2026 · T3

- Los grupos siguen ordenados por cantidad de resultados, con el nombre de la marca para desempatar. Dentro de cada marca se puede ordenar por nombre, menor stock o fecha de la última venta vigente. Los productos sin ventas quedan al final de ese orden. Al cambiar de pestaña se conserva el orden elegido en cada inventario.
- El resumen muestra las existencias de toda la pestaña. Para vender suma las piezas y muestra el valor a precio de venta. Uso en spa muestra el valor a costo y desglosa las cantidades cuando hay más de una unidad de medida. El desglose también se usa si en Para vender se mezclan medidas como ml o g. Para sumar las existencias y su valor, el saldo negativo aporta cero.
- El encabezado conserva solo el botón «Producto», como en `Inventario.png`. «Lista de compras» sigue disponible junto al selector de orden, debajo de las cifras. Las categorías se desplazan de lado y se mantiene visible el filtro activo al regresar a su pestaña.
- Las filas de Inventario usan `content-visibility: auto`. Las fotos de IndexedDB se solicitan cuando su fila se acerca al área visible. Se reutilizan los cálculos de avisos y las iniciales de los otros listados.
- El formulario guarda el código como texto para conservar ceros iniciales. «Cantidad ideal para pedir» es la cantidad que se quiere tener al recibir un pedido. Al limpiar los campos se guarda el código vacío y la cantidad en cero, para que el cambio viaje en el archivo de envío. La lectura con cámara corresponde a T7 y la sugerencia del pedido corresponde a T11.

## 27-nov-2026 · T4

- La barra de stock tiene cinco tramos y toma como tope la cantidad ideal para pedir. Si está vacía, usa el mayor número entre cinco y el doble del mínimo más uno. La estimación reutiliza el consumo diario de la versión 1. La ficha muestra cuántas pacientes distintas aparecen en ventas vigentes y agrupa nombres que solo difieren en tildes, espacios o mayúsculas.
- El ajuste se registra como diferencia entre lo contado y lo que figura en la app. Un conteo hecho desde la ficha también queda en el historial si la cantidad coincide. Los motivos nuevos se guardan en el campo `motivo`.
- Deshacer anula la venta nueva junto con sus movimientos. Al deshacer una entrada se restaura el costo, el vencimiento y el lote que cambió esa entrada, siempre que esos campos sigan con el valor que dejó. La anulación y la restauración se guardan juntas.
- Se copiaron el lector `barcode-detector` 3.2.3 y `zxing-wasm` 3.1.6 con sus licencias MIT desde el directorio local de herramientas a `prueba/vendor/`. El lector se carga al abrir la cámara. `prepareZXingModule` apunta al binario local y el service worker guarda ambos archivos para leer sin conexión.
- En la ficha, tocar «Asignar con la cámara» pide permiso. El código leído se puede revisar antes de guardar. Se puede asignar por escrito si se deniega el permiso, y se rechazan códigos que ya pertenecen a otro producto vigente. El código queda como texto para conservar los ceros iniciales.

## 27-nov-2026 · T5

- La unidad `frascos` muestra un solo frasco en uso a la vez. Ese frasco cuenta en el stock hasta «Se terminó». «Sin abrir» descuenta el frasco en uso de la cifra que muestra, y una nueva apertura se registra después de terminar la anterior. Para las demás unidades se conserva el gasto por tratamiento con un toque y la opción «Otra cantidad».
- La ficha usa hasta tres ciclos completos entre una apertura y la terminación siguiente. Una apertura sin terminar queda fuera del promedio. Abrir y terminar el mismo día cuenta como un día. Para la fecha estimada se redondea la duración a días completos. Para el costo por día se usa el promedio completo y el costo de compra vigente.
- La apertura y la terminación se guardan junto con el cambio de `abierto`, y «Deshacer» revierte ambos. Una fecha de apertura de la versión 1 se conserva al terminar ese frasco, mediante un movimiento de cantidad cero fechado el día original. Al corregir la fecha desde Editar producto se actualiza el movimiento con el mismo ID. La fecha puede ser la del cierre anterior o una posterior para conservar el rendimiento de los frascos ya terminados.
- Para comparar las capturas con `Cabina.png`, la prueba usa la foto del catálogo y configura Pure Radiance como frasco con el historial del diseño. La carga normal conserva las unidades y cantidades del catálogo.

## 27-nov-2026 · T6

- «Más vendidos» ordena por unidades de ventas vigentes de los últimos 60 días calendario, incluido hoy. Cuando hay menos de nueve productos vendidos, completa la cuadrícula con productos del catálogo y da prioridad a los que tienen existencias. La búsqueda abarca todo el catálogo de venta desde «Más vendidos» y respeta la categoría si se eligió una.
- La venta rápida empieza sin nombre, en efectivo y cobrada. Elegir paciente es opcional. Los accesos rápidos muestran las dos pacientes con compras más recientes y el buscador acepta nombre o teléfono. «Nueva» deja la ficha lista para guardar junto con la venta. Si se deshace el cobro, se anulan la venta y sus movimientos y se conserva la ficha de la paciente.
- La hoja empieza plegada al vender desde Inicio. Muestra el último producto tocado, el total y «Cobrar». Al desplegarla, se ajustan cantidades y se puede tocar el precio para editarlo. Los descuentos se guardan en dólares y el estado de cobro se guarda por separado de la forma de pago. La fecha se muestra en español y se elige con el calendario del celular.
- El comprobante se prepara al guardar cuando se marca la casilla. Si hay teléfono se abre el contacto correspondiente en WhatsApp. Si falta, se puede escoger en WhatsApp. El aviso de éxito y «Editar venta» ofrecen el enlace para abrirlo de nuevo.
- El escáner de venta reutiliza la cámara y el lector local de T4. Si reconoce un producto de venta, lo agrega al carrito y cierra la cámara. Se mantiene la entrada escrita en el mismo cuadro. T7 completará el escáner general y los demás modos.

## 27-nov-2026 · T7

- Inicio y Para vender abren el escáner en «Vender». Uso en spa abre «Usé». Los selectores de cabina, entrada y conteo abren en su modo. La búsqueda reconoce productos de ambos inventarios y la tarjeta permite escoger la acción. «Contar» abre el ajuste por producto mientras se implementa el conteo guiado de T10.
- Una lectura muestra la tarjeta hasta que se elige una acción o se pide otra lectura. «Escanear otro» conserva la cámara encendida y espera a ver otro código o a que se retire el anterior. Solo se pide cámara al tocar un botón. El video se detiene al cerrar, al pasar a la escritura manual o a la asignación y al ocultarse la app. La entrada manual queda debajo de los modos para que el campo esté más cerca del encabezado al abrirse el teclado.
- Se mantiene el lector local de T4. El detector nativo se usa cuando ofrece los seis formatos. Los códigos se guardan como texto y se buscan con sus ceros, mayúsculas y tildes. Las etiquetas `SP-` admiten minúsculas al escribirlas. Si no hay una coincidencia exacta, un UPC-A válido también se busca con el cero inicial de EAN-13.
- «Asignar a un producto» muestra fichas vigentes que aún no tienen código. La creación abre el formulario habitual con el código cargado. Ambos recorridos comprueban que el código no le pertenezca a otro producto. Cuando el escáner se abrió desde una venta, se conserva el carrito y se actualiza el catálogo al volver.

## 27-nov-2026 · T8

- La ficha usa el teléfono y las notas del registro de la paciente. Desde Editar paciente se guardan esos dos datos con el mismo identificador. Las ventas conservan su nombre y teléfono como texto y sirven para crear las fichas al abrir archivos de la versión 1.
- El total suma compras vigentes con sus descuentos e incluye las que quedan por cobrar, identificadas en el historial. El promedio usa los días entre fechas de compra distintas. Varias compras hechas en el día cuentan como una visita para el promedio.
- Inicio y la ficha comparten la última compra vigente de cada producto y la misma ventana de aviso, desde cinco días antes de la fecha estimada hasta 60 días después. En Inicio se cuenta una vez a cada paciente. En la ficha se puede elegir cuál de sus productos mencionar y editar el mensaje de ese producto.
- Ajustes guarda la plantilla en cada celular. `{nombre}` y `{producto}` usan el nombre de la ficha y el del producto. Tocar «Enviar recordatorio» abre WhatsApp con el texto y registra el producto en `venta.recordados`. WhatsApp requiere tocar enviar dentro de su aplicación. El botón «Deshacer» restaura el aviso si se abrió por error.

## 27-nov-2026 · T9

- «Vendido», la ganancia, el promedio y las barras usan las ventas vigentes del mes con sus descuentos e incluyen las pendientes. Las barras agrupan los días 1–7, 8–14, 15–21, 22–28 y, si corresponde, 29–fin de mes. Las formas de pago agrupan solo cobros bajo su forma y muestran lo pendiente en «Por cobrar». «Lo más vendido» ordena por importe de producto antes del descuento aplicado a la venta completa, como en `Reportes.png`.
- Los usos nuevos de cabina guardan el costo unitario registrado al usarlos, incluso si es cero. Para un uso antiguo que carece de ese campo se toma el costo actual del producto. Se cuentan los frascos terminados con el movimiento que ya usa la ficha de cabina.
- Inventario suma movimientos vigentes hasta hoy para el mes actual y hasta su último día para meses anteriores. El catálogo actual aporta costos, precios y vencimientos. Se valora el stock positivo, con precio de venta solo para productos para vender. Los 60 días incluyen la fecha de corte y omiten movimientos que no cambian el stock. Los 90 días incluyen el día de corte y el del vencimiento límite.
- Se comparte la sección y el mes elegidos. El PDF se genera mediante el diálogo de impresión del dispositivo y usa la copia local del logo completo. Excel recibe un CSV con BOM, punto y coma y coma decimal. WhatsApp abre un resumen con cifras y productos, sin nombres ni teléfonos de pacientes.

## 27-nov-2026 · T10

- Inicio e Inventario abren el selector de todo el catálogo, Para vender, Uso en spa o una marca. Cada grupo empieza por orden alfabético. Las marcas agrupan ambos tipos de inventario e ignoran diferencias de tildes, mayúsculas y espacios.
- El celular guarda un borrador con la lista de productos, las cantidades escritas o leídas y la pantalla en curso. Los productos agregados después corresponden al siguiente conteo. Los eliminados se omiten. Una cantidad vacía queda pendiente y «No hay» anota un cero. El campo acepta coma o punto y hasta dos decimales.
- El escáner del conteo suma una unidad al producto leído si pertenece al grupo. Para repetir el mismo código, se lo retira del encuadre hasta que el lector deje de verlo por al menos 420 ms. La alternativa manual suma una unidad por cada confirmación. El modo Contar del escáner general abre el borrador vigente o empieza uno en la pestaña del producto leído.
- El resumen usa el stock vigente al retomar. Si otra pestaña guarda cambios mientras se revisa, el resumen se actualiza antes de confirmar. Se guarda un ajuste `conteo` por cada diferencia y se borra el borrador en la misma escritura. «Deshacer» revierte juntos los ajustes durante cinco segundos. El envío conserva el formato de la versión 1 y lleva los ajustes confirmados.

## 27-nov-2026 · T11

- La lista parte de los avisos de stock y resta lo que está por llegar. La meta es la cantidad ideal positiva. Cuando está vacía o en cero, toma la mayor entre el consumo estimado para 30 días redondeado hacia arriba y el mínimo más una unidad.
- Los grupos comparan los nombres de proveedor sin distinguir tildes, mayúsculas o espacios repetidos. Si un producto carece de teléfono y el proveedor tiene un único número en el catálogo, se usa ese número. Los contactos distintos del mismo nombre quedan en tarjetas separadas. «WhatsApp» abre el mensaje y «Marcar como pedido» guarda las cantidades sugeridas en este celular. La lista completa también se puede compartir.
- «Llegó» propone la cantidad pendiente y el costo actual por unidad. Se puede registrar una entrega parcial y poner cero en los productos que todavía faltan. El costo cero cuenta como válido. Cada llegada guarda juntas las entradas y el costo unitario que pasa a la ficha. «Deshacer» revierte la llegada y permite volver a registrarla. «Cerrar pedido» devuelve las cantidades pendientes a las sugerencias cuando aún hacen falta y conserva las entradas anteriores.
- Los pedidos pendientes son locales, como el borrador de conteo. Las entradas y el costo llegan al otro celular mediante el archivo de envío vigente. Si otro registro cambia mientras la hoja de llegada está abierta, se vuelve a abrir el pedido con las cantidades actualizadas.

## 27-nov-2026 · T12

- «Etiquetas QR» está en Inventario y reúne productos de Para vender y Uso en spa. La búsqueda permite cambiar el grupo visible sin perder lo elegido. Se pueden reimprimir los QR propios con su código original. Los productos que ya tienen otro código quedan fuera de la selección.
- Los códigos nuevos usan cinco letras o números sin I, O, 0 ni 1. Se comprueban contra los códigos existentes, incluidos los de productos eliminados. «Preparar etiquetas» guarda todos los códigos nuevos juntos en `producto.codigo`. Se incluyen con la ficha en el archivo de envío.
- La vista previa usa una etiqueta por producto. Cada hoja A4 tiene tres columnas y ocho filas, con lugares vacíos al final si sobran. Al imprimir se usa fondo blanco con QR negro y margen de cuatro módulos. Junto al QR van el emblema, el nombre y el código escrito para usarlo sin cámara.
- Se usa el módulo de `qrcode-generator` 2.0.4 en `prueba/vendor/qrcode.esm.js`, con el aviso MIT de la cabecera. Se guarda en la caché `spp-` y se carga al preparar las etiquetas. El escáner usa el lector local existente.
