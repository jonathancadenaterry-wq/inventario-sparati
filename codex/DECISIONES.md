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
