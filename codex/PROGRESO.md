# Progreso de la versión 2

_Codex: agrega una entrada al final en cada corrida (fecha y hora de Ecuador, tarea, lo hecho, lo que sigue)._

## Estado
- Tarea actual: T15 completada en `prueba/`. Sigue T16.
- Última corrida: 28-nov-2026, 00:20–00:39 (Ecuador) · T15 y revisión de las capturas de T14

## Preguntas para Jonathan
- (ninguna)

## Bitácora

### 27-nov-2026 · 07:39 (Ecuador) · T0

- Se preparó `prueba/` a partir de la versión 1, con almacenamiento, fotos y caché propios. El manifiesto e íconos identifican la app como SPARATI Prueba. La franja se ve también al abrir formularios y Ajustes.
- Ajustes permite agregar 104 productos, 15 fotos, 25 ventas ficticias de los últimos 60 días, 8 pacientes ficticias y un historial de uso y aperturas de cabina. Las cantidades disponibles coinciden con el catálogo.
- Pasaron las cinco pruebas en Chromium a 390×844. Los archivos de la versión 1 conservan sus registros, los stocks quedan en 5, 4 y 1, y la segunda importación del envío deja el estado idéntico. También se comprobó una venta, el aislamiento de los datos y la carga del catálogo y las fotos sin conexión. WebKit no está instalado.
- Se compararon las capturas claras y oscuras en `codex/capturas/` con los diseños de Bienvenida, Inicio, Inventario, Cabina y Vender. Ya se usan el logotipo, los colores y la tipografía aprobados sobre la estructura de la versión 1.
- Sigue T1 con los componentes y la estructura de navegación del nuevo diseño. Git confirmó que todos los cambios están en `prueba/` y `codex/`.
- El commit quedó pendiente. El entorno montó `.git` en modo de solo lectura y Git no pudo crear `index.lock`.

### 27-nov-2026 · 08:07–08:30 (Ecuador) · T1

**Hallazgos en las ocho capturas T0 adjuntas**

- **Inicio, inventario y navegación.** la barra de cuatro pestañas conserva la estructura de la versión 1. El botón flotante magenta tapa parte de la lista. En inventario faltan el segmentado y el botón cuadrado para escanear. Los nombres, marcas y categorías se cortan en una sola línea, y el stock al mínimo aparece en ámbar aunque el diseño lo indica en rojo.
- **Venta clara y oscura.** los campos de cantidad son cajas de texto sin botones para sumar o restar. El total queda fuera de la vista al elegir productos y la fecha se ve como «11/27/2026» en ambas capturas. La cuadrícula de productos y la selección de paciente son parte de T6.
- **Cabina clara y oscura.** el título se repite y la ficha usa un cuadro pequeño de iniciales. El diseño reserva una zona amplia para la foto cuando existe. Faltan «Frasco en uso», la estimación y el historial en línea de tiempo de T5.
- **Ajustes.** el segmentado marca la opción activa con un bloque magenta. El componente aprobado usa un fondo hundido y la opción activa elevada. El rediseño completo de Ajustes corresponde a T13.
- **Bienvenida.** el logotipo y la franja se leen bien en oscuro. La captura empieza al elegir el nombre y deja un espacio amplio debajo. El diseño abre con el mensaje de bienvenida y las acciones al pie, que corresponden a T14.
- **Inicio.** el aviso de envío ocupa el primer bloque de contenido y las filas largas esconden nombres. El resumen del mes, las acciones rápidas y la nueva jerarquía de avisos corresponden a T2.

**Trabajo completado**

- Se aplicó el sistema de diseño en `prueba/` con temas claro, oscuro y automático, los trazos SVG del diseño y las fuentes locales. La barra inferior muestra Inicio, Inventario, Vender, Pacientes y Reportes. Atrás cierra las hojas y vuelve a la sección anterior.
- El buscador de Inicio encuentra productos y pacientes. Inventario reúne los dos tipos, con filtros, marcas, fotos o iniciales y píldoras de stock. El total de la venta queda a la vista mientras se eligen productos y el carrito permite sumar o restar. Deshacer dura cinco segundos y actualiza las existencias al revertir un registro.
- Se generaron y compararon 22 capturas T1 de 390×844, en claro y oscuro. Pasaron 10 pruebas en Chromium y 7 con su perfil iPhone 14 Pro, incluidos los archivos v1, el reintento de guardado, Atrás, el contraste y la recarga sin conexión. Los cambios de la corrida quedaron en `prueba/` y `codex/`.
- Escanear ya acepta códigos guardados escritos a mano. La cámara corresponde a T7. El campo de fecha sigue el formato del navegador y Chromium lo muestra como mes/día/año en las capturas. Falta comprobar el formato, el teclado y las zonas seguras en el iPhone real de Elba.
- Sigue T2 con el saludo, las acciones rápidas, el resumen de ventas y «Necesita atención». Las fichas completas, el flujo nuevo de venta, los reportes y la bienvenida quedan en sus tareas respectivas.

### 27-nov-2026 · 08:42–08:58 (Ecuador) · T2

**Revisión de las ocho capturas T1 adjuntas**

- **Venta nueva y edición.** La fecha se ve como «11/27/2026». Al desplegar el carrito de edición, la lista de productos queda fuera de vista a 390×844. La venta nueva usa filas y un campo de texto para la paciente. El diseño de T6 usa una cuadrícula y selección de pacientes recientes.
- **Reportes.** El primer registro apenas asoma sobre la barra inferior. Faltan el segmentado Ventas/Cabina/Inventario y los bloques de promedio, evolución semanal y formas de pago de T9.
- **Pacientes.** La lista muestra nombre, última compra y total. La barra cruza la última fila visible en la captura. Queda por verificar en T8 el acceso al detalle de recompra desde la ficha.
- **Cabina y Deshacer.** La ficha empieza con las iniciales y el bloque de stock. Todavía faltan «Frasco en uso» y la barra de rendimiento de T5. Después de usar el último frasco, el aviso tapa momentáneamente dos filas de Datos y dice «Quedan 0».
- **Código manual.** La hoja funciona como alternativa escrita. Aún faltan la vista de cámara, el encuadre y la linterna de T7.
- **Inventario.** El siguiente chip queda parcialmente a la vista. Conviene comprobar en T3 que las categorías se alcancen al deslizar en ambos celulares. La barra inferior se superpone a las filas que están pasando por debajo de ella en la captura.

**Trabajo completado**

- Inicio muestra el emblema y la palabra SPARATI, el saludo según la hora local y la fecha en español. El buscador abre productos y pacientes, incluidas las fichas que aún no tienen compras. Las cuatro acciones rápidas abren la venta o el selector conectado a los formularios de cabina, entrada y conteo.
- La tarjeta mensual comparte los cálculos de Reportes. Muestra ventas, ganancia, variación frente al mes anterior y siete barras con los montos diarios. El monto abre el mes actual en Reportes.
- «Necesita atención» reúne stock bajo, vencimientos y plazos después de abierto, recompras y envíos atrasados. La campana, «Ver todo» y los tres contadores abren los avisos. Las filas permiten pedir, abrir la ficha, preparar un recordatorio de WhatsApp o exportar el envío. Ajustes quedó al pie de Inicio.
- Se guardaron 14 capturas de 390×844 en claro y oscuro y se comparó Inicio con `Main.png`. Se ajustó el saludo para que «Buenas noches, Elba» quepa en una línea y el título de avisos quede visible sobre la barra. Las cifras y los avisos corresponden al catálogo y a las ventas de ejemplo.
- Pasaron 13 pruebas en Chromium y 10 con el perfil iPhone 14 Pro. Se comprobó el contraste, el cambio de año en el gráfico, el reintento de entrada y conteo, el plazo de siete días, los archivos v1 y la recarga sin conexión. Los cambios quedaron en `prueba/` y `codex/`.
- Sigue T3 con Inventario. El conteo de Inicio usa el ajuste por producto hasta T10. La cámara sigue pendiente en T7 y el formato de fecha de venta queda para T6.

### 27-nov-2026 · 09:41–09:54 (Ecuador) · T3

**Revisión de las ocho capturas T2 adjuntas**

- **Contar inventario en claro y oscuro, Llegó mercadería y Usé en cabina.** Los cuatro selectores muestran filas casi idénticas y la cantidad de stock como un número solo. El encabezado distingue la acción en curso. «Contar inventario» todavía se ve como un selector normal y el recorrido de conteo queda para T10.
- **Recordatorio.** El mensaje ocupa tres líneas y la firma «SPARATI» queda pegada al final del texto. La vista muestra el mensaje fijo. La edición y la plantilla corresponden a T8.
- **Avisos.** «Alcanza para unos 12 días» aparece por encima de «Alcanza para unos 10 días». Eso le resta prioridad visual al producto que se terminaría primero. Los nombres largos dejan poco espacio entre el texto y «Pedir».
- **Inicio y Necesita atención.** Frente a `Main.png`, la barra translúcida deja ver texto de la primera fila debajo de las pestañas en la captura de Inicio. En la captura desplazada, el título y las cuatro acciones de avisos se leen completos. El nombre del producto y el motivo de recompra de Clara ocupan tres líneas junto a «Escribir».

**Trabajo completado**

- Inventario conserva el segmentado con los totales, la búsqueda sin tildes ni mayúsculas, la consulta manual por código y los filtros. Añadí el orden por nombre, menor stock y última venta dentro de cada marca. El resumen muestra las unidades y su valor de venta o a costo. «Ver por unidad» desglosa las cantidades cuando hay unidades de medida distintas.
- «+ Producto» abre el formulario con las tarjetas del diseño, el código de barras y la cantidad ideal para pedir. Se pueden agregar, editar y limpiar los campos. El guardado del producto y su movimiento inicial se aplica en conjunto, de modo que se puede reintentar si se agota el espacio del navegador.
- Revisé las diez capturas T3 de 390×844 en claro y oscuro. Frente a `Inventario.png`, la pantalla mantiene el segmentado, las cifras y los grupos por marca. El selector de orden y «Lista de compras» añaden una fila debajo de las cifras.
- Pasaron 15 pruebas en Chromium a 390×844 y 12 con su perfil de iPhone 14 Pro. Comprobé el deslizamiento táctil de los filtros, el acceso al último de 300 productos agrupados en una marca y la carga diferida de su foto. También pasaron el reintento con una foto, los archivos v1 y la recarga sin conexión. La validación de iPhone se hizo con el perfil emulado de Chromium.
- Sigue T4 con la ficha de producto para vender. La búsqueda por código funciona con entrada manual. La cámara queda para T7 y el uso de la cantidad ideal para sugerir pedidos queda para T11.

### 27-nov-2026 · 10:00–10:17 (Ecuador) · T4

**Revisión de las ocho capturas T3 adjuntas**

- **Para vender y Uso en spa, claro y oscuro.** Frente a `Inventario.png`, la fila de «Lista de compras» y el selector de orden desplazan hacia abajo el primer grupo. El chip de la siguiente categoría asoma cortado por el borde derecho. En ambos inventarios se alcanzan a leer fragmentos de las filas debajo de la barra translúcida y la bolsa central.
- **Cantidades abiertas, claro y oscuro.** El desglose se extiende solo en la columna izquierda. Debajo de «Valor a costo» queda un espacio vacío de la altura de casi toda la lista y se ven menos productos en el primer pantallazo.
- **Editar existencias, claro y oscuro.** El mínimo sin configurar se ve como un campo vacío entre los botones de sumar y restar. El anillo de foco de la cantidad ideal queda parcialmente cubierto en el lado del botón de sumar.
- **Producto nuevo, oscuro.** El título de «Existencias» aparece justo encima del pie fijo. Hay que desplazar el formulario para llegar al primer campo de esa sección.

**Trabajo completado**

- La ficha de productos para vender muestra la foto grande, el stock con una barra de cinco tramos, la previsión de consumo, el precio, el costo y la ganancia. Muestra el vencimiento y el lote, las pacientes que compraron ese producto y una línea de tiempo con los movimientos vigentes.
- Las acciones «Vender», «Llegó más» y «Ajustar» registran sus movimientos y ofrecen «Deshacer» durante cinco segundos. Se comprobó que la anulación devuelve el stock y que deshacer una entrada también devuelve sus cambios de costo, vencimiento y lote. Un conteo sin diferencia queda registrado en el historial.
- Desde «Código de barras» se puede leer con la cámara o escribir el código a mano. El lector local leyó un EAN-13 simulado con la conexión desactivada. También se probó la alternativa sin permiso, el cierre de la cámara al regresar y la validación de códigos duplicados.
- Se guardaron 16 capturas a 390×844 en claro y oscuro. Se compararon la foto, el encabezado, la barra, las acciones, los precios y el historial con `Producto.png`. Se ajustó el espacio del vencimiento y el lote para que los datos del ejemplo quepan en una línea. El foco de los campos de cantidad quedó dentro del campo, visible entre los dos botones. Los campos de fecha nativos siguen mostrando mes/día/año en Chromium.
- Pasaron 17 pruebas en Chromium y 14 con el perfil de iPhone 14 Pro, incluidos los archivos v1 y la recarga sin conexión. Queda por comprobar el permiso y el enfoque de la cámara en el iPhone de Elba, en Safari y desde la pantalla de inicio.
- Sigue T5 con «Frasco en uso», las aperturas y el cálculo de rendimiento en la ficha de cabina. El escáner general y sus modos corresponden a T7. Los cambios de la corrida están en `prueba/` y `codex/` para que los guarde el bucle.

### 27-nov-2026 · 10:18–10:34 (Ecuador) · T5

**Revisión de las ocho capturas T4 adjuntas**

- **Ficha y precios.** La foto, la jerarquía del stock y las tres cifras siguen `Producto.png`. En la ficha inicial solo asoman las etiquetas de precio, costo y ganancia sobre la barra inferior. En el desplazamiento a precios queda completa la fila de cifras, pero la última parte visible del historial cruza la barra.
- **Historial y Deshacer.** En ambas capturas se cortan registros al llegar a la navegación. Mientras aparece «Deshacer», también queda tapado el detalle de la entrada recién registrada.
- **Ajuste y entrada.** Los nombres largos ocupan dos líneas en el encabezado y repiten «200 ml», aunque los movimientos están expresados en unidades. «Otro» queda solo en la segunda línea de motivos. El selector de fecha muestra «11/27/2026» y el vencimiento vacío pide «mm/dd/yyyy» en el navegador de las capturas.
- **Código de barras.** Tras denegar el permiso, la explicación queda separada del campo manual por el borde de la tarjeta. La alternativa se puede usar sin cámara. El lector general con encuadre corresponde a T7.
- **Venta desde la ficha.** El producto ya está en el total, pero el carrito plegado oculta su nombre, por lo que la captura no permite confirmar qué se agregó. Se mantiene el formato de fecha mes/día/año. La selección de paciente y la cuadrícula de `Vender.png` corresponden a T6.

**Trabajo completado**

- La ficha de cabina muestra la foto, el estado del frasco, el avance, la fecha estimada, los frascos sin abrir, el costo por día y el historial. El cálculo toma hasta los tres ciclos completos más recientes. El aviso «Ya pasó el tiempo de uso después de abierto» aparece en la ficha cuando corresponde.
- «Abrí uno nuevo» registra `apertura` con cantidad cero. «Se terminó» registra `uso` con cantidad −1 y motivo `terminado`. «Deshacer» restaura el stock y la fecha. Al cerrar un frasco que venía abierto de la versión 1, se conserva su fecha original en el historial. Los productos medidos por tratamiento mantienen «Usar» de un toque y «Otra cantidad».
- Revisé las 14 capturas T5 de 390×844 en modo claro y oscuro. La ficha de Pure Radiance sigue la foto, el avance y las cifras de `Cabina.png`. Las acciones de entrada y ajuste quedan junto a los datos. En la captura de terminación, el aviso «Deshacer» se superpone durante cinco segundos a parte del primer registro visible.
- Pasaron 19 pruebas en Chromium a 390×844 y 16 con su perfil de iPhone 14 Pro. Se comprobó el promedio de los tres últimos frascos, los cierres el mismo día, la corrección de la fecha, el reintento si falla el guardado, los archivos v1 y el flujo de cabina sin conexión. Queda por probar el recorrido en Safari del iPhone de Elba.
- Sigue T6 con la selección de paciente, la cuadrícula de productos y el carrito de «Nueva venta». Los cambios de esta corrida están en `prueba/` y `codex/`.

### 27-nov-2026 · 12:30–12:45 (Ecuador) · T6

**Revisión de las ocho capturas T5 adjuntas**

- **Tratamiento, claro y oscuro.** El encabezado de iniciales ocupa casi 190 px sin foto. «Usar 1 ampolla» salta a dos líneas y el primer movimiento de Historial queda bajo la barra. En oscuro, la categoría y el estado «Disponible» quedan en segundo plano frente al botón magenta.
- **Ficha y rendimiento, oscuro.** La ficha de Pure Radiance sigue la foto, los colores y la jerarquía de `Cabina.png`. Al abrirla, «Costo por día» y su cifra quedan cortados por la barra inferior. Al desplazar al rendimiento se alcanza a leer el costo y la fecha estimada.
- **Apertura y terminación, oscuro.** «Deshacer» se superpone al título de Historial al abrir un frasco y tapa el primer movimiento al terminarlo. El botón «Se terminó» desactivado se distingue poco sobre la tarjeta oscura.
- **Vencimiento, oscuro.** La tarjeta dice «Venció el 30 ago» y la fila de datos dice «Vence ago 2027» para el mismo vencimiento. El formato y el verbo distintos dificultan reconocer que es la misma fecha. El aviso de tiempo después de abierto parte la fecha en dos líneas.
- **Historial, oscuro.** Las aperturas y los cierres se leen completos al desplazar al final. Los puntos rosados de ambos movimientos se parecen en oscuro. El texto distingue qué pasó en cada fecha.

**Trabajo completado**

- «Nueva venta» muestra las pacientes recientes, permite buscar por nombre o teléfono y agrega una paciente con teléfono opcional al guardar la venta. La cuadrícula presenta hasta nueve de los productos más vendidos en 60 días y ofrece filtros por categoría, búsqueda y escaneo por cámara o código escrito.
- El carrito queda al pie con el último producto agregado, el total y «Cobrar». Al abrirlo se pueden ajustar cantidades, editar precios, anotar el descuento y elegir la forma y el estado del pago. Si faltan existencias, se pide confirmación antes de guardar. Al registrar una venta, la app vuelve a Inicio y muestra la confirmación animada con «Deshacer».
- El comprobante opcional incluye los productos, el descuento, el total y el nombre SPARATI. El aviso de éxito y la edición de la venta permiten volver a abrirlo en WhatsApp si el navegador bloquea la primera apertura.
- Revisé 14 capturas de 390×844 en claro y oscuro. Frente a `Vender.png`, se conservaron la tarjeta de paciente, las tres columnas y la hoja de carrito. En la pantalla corta el carrito plegado deja elegir productos y el detalle abierto se desplaza para alcanzar la fecha, el descuento y la nota.
- Pasaron 22 pruebas en Chromium a 390×844 y 19 con su perfil iPhone 14 Pro. Se comprobó una venta de tres productos en cinco toques desde Inicio, el cobro sin conexión con un EAN-13, el descuento, el comprobante, la confirmación por falta de existencias, el reintento de guardado, Deshacer y los archivos de la versión 1.
- Sigue T7 con el escáner general. Queda por comprobar en el iPhone de Elba el calendario, el enfoque de la cámara y la apertura del comprobante de WhatsApp en Safari y desde la pantalla de inicio. Los cambios de la corrida quedaron en `prueba/` y `codex/`.

### 27-nov-2026 · 12:47–13:05 (Ecuador) · T7

**Revisión de las ocho capturas T6 adjuntas**

- **Venta cobrada, claro y oscuro.** «Deshacer» cubre parte de los tres contadores de Inicio. Se alcanza a leer la primera fila de «Necesita atención» por debajo de la barra translúcida, especialmente en oscuro.
- **Escáner de venta, oscuro.** El mensaje de permiso y la entrada manual son visibles. La hoja sobre el carrito difiere de la vista completa con encuadre, modos y ficha de `Escaner.png`.
- **Carrito y descuento, oscuro.** Al abrir el carrito, el pie fijo corta las etiquetas «Descuento ($)» y «Fecha». Al bajar al descuento, asoma una franja del selector de pago debajo de la cabecera y el total queda fuera de la zona desplazada. El importe se conserva en el botón de registro.
- **Cuadrícula, oscuro.** Frente a `Vender.png`, los nombres largos terminan en puntos suspensivos y los precios de la segunda fila quedan detrás del carrito plegado en el primer pantallazo. El chip siguiente aparece parcialmente por el borde derecho.
- **Elegir paciente y Nueva paciente, oscuro.** «Editar datos» aparece antes de elegir una ficha y no indica en ese punto cuál se editará. En «Nueva paciente», el nombre recibe foco y el campo de teléfono queda visible. Falta ver cuánto queda a la vista con el teclado del iPhone abierto.

**Trabajo completado**

- El escáner se abre a pantalla completa desde Inicio, Inventario, Nueva venta y los selectores de acciones rápidas. Los modos Vender, Usé, Llegó y Contar muestran la ficha encontrada y la acción del modo. Contar abre el ajuste individual hasta el recorrido guiado de T10. El carrito se conserva al consultar una ficha o registrar otro movimiento y volver.
- Se reutiliza el lector local para EAN-13, EAN-8, UPC-A, UPC-E, Code 128 y QR. La lectura emite un pitido y pide una vibración cuando el dispositivo lo permite. La linterna aparece según las capacidades de la cámara trasera. El video se apaga al salir, pasar a escritura manual o asignación, y al ocultar la app.
- «Escribir el código a mano» está disponible aunque se deniegue el permiso. Para un código desconocido se puede buscar un producto sin código o abrir un formulario con el código ya escrito. La validación conserva ceros iniciales e impide asignar el mismo código a dos productos vigentes.
- Revisé 16 capturas de 390×844 en claro y oscuro. El encabezado, los cuatro modos, el encuadre menta y la tarjeta inferior siguen `Escaner.png`. Al escribir a mano, el formulario sube debajo de los modos para quedar más cerca del encabezado al aparecer el teclado.
- Pasaron 25 pruebas en Chromium a 390×844 y 22 con su perfil iPhone 14 Pro. Se comprobó la lectura de EAN-13 con video simulado y ZXing sin conexión, la asignación y creación de códigos, los cuatro modos, el cierre de la cámara, el contraste y la compatibilidad con los archivos de la versión 1.
- Queda comprobar en el iPhone de Elba, en Safari y desde la pantalla de inicio, el permiso, el enfoque de la cámara trasera al leer códigos impresos, la linterna si se ofrece, el sonido, el teclado, las zonas seguras y el cierre de la cámara al bloquear el teléfono o volver atrás.
- Sigue T8 con la lista, la ficha y los recordatorios de pacientes. Los cambios de la corrida quedaron en `prueba/` y `codex/`.

### 27-nov-2026 · 13:07–13:19 (Ecuador) · T8

**Revisión de las ocho capturas T7 adjuntas**

- **Cámara y producto encontrado.** El encuadre menta y la tarjeta inferior siguen `Escaner.png`. La instrucción blanca cae sobre una zona clara de la imagen. Con el producto encontrado, los dos enlaces del pie quedan muy juntos y se leen con menos jerarquía que la acción manual centrada del diseño. La foto de fondo es una simulación.
- **Permiso y escritura manual.** El mensaje y la alternativa se entienden. El campo vacío no da un ejemplo de código. «Abrir cámara» se ve como enlace secundario aunque es el control para reintentar.
- **Código desconocido, asignación y creación.** Las acciones del código desconocido se parten en dos líneas. En asignación se ve el código y el foco, pero las cifras de stock aparecen sin etiqueta. En creación, el pie fijo deja a la vista solo el título de «Existencias» y obliga a desplazar para ver el primer campo.
- **Contar y selector de conteo.** La tarjeta sin cámara aparece al comienzo y deja gran parte de la pantalla vacía. «Contar producto» ocupa dos líneas. El selector repite el número de existencias sin etiqueta y la última fila queda a medias al pie de la captura. El recorrido guiado se revisará en T10.

**Trabajo completado**

- La lista de Pacientes busca por nombre o teléfono y muestra la última compra y el total. La ficha reúne las iniciales, WhatsApp, «Nueva venta» con la paciente elegida, tres cifras de compras, notas e historial. Editar el teléfono o las notas guarda la ficha con su mismo identificador y conserva los datos registrados en las ventas anteriores.
- La ficha e Inicio aplican el mismo cálculo de recompra a la última compra de cada producto. Se puede elegir el producto, editar el mensaje y guardar su plantilla en Ajustes. El toque en «Enviar recordatorio» abre WhatsApp con el texto listo y anota el producto en la venta. «Deshacer» vuelve a mostrar el aviso. El envío del mensaje se confirma dentro de WhatsApp.
- Se revisaron 16 capturas a 390×844 en claro y oscuro y se compararon la cabecera, las tres cifras, los colores, las notas y las compras con `Paciente.png`. El mensaje crece para mostrar el texto completo. En la ficha inicial, el botón de enviar se alcanza al desplazar cuando hay dos productos con nombres largos.
- Pasaron 27 pruebas en Chromium a 390×844 y 24 con el perfil de iPhone 14 Pro. Se comprobó que Inicio y la ficha quiten el mismo aviso, que el enlace lleve el mensaje editado, que Deshacer lo restaure, que el editor abra sin conexión y que los archivos v1 sigan siendo compatibles.
- Sigue T9 con Reportes. Queda por verificar el teclado y la apertura de WhatsApp en el iPhone de Elba, desde Safari y desde la pantalla de inicio. Los cambios quedaron en `prueba/` y `codex/` para que los guarde el bucle.

### 27-nov-2026 · 13:21–13:33 (Ecuador) · T9

**Revisión de las ocho capturas T8 adjuntas**

- **Lista y compras.** La barra inferior translúcida deja ver texto por debajo de las pestañas. En la lista se superpone a parte de la fila de Sofía. En Compras corta la tarjeta que pasa por debajo y «2 nov» ocupa tres líneas de producto por los nombres completos.
- **Ficha y recompra.** Los nombres largos agregan líneas al mensaje frente a `Paciente.png`. En la primera vista el botón «Enviar recordatorio» queda más abajo, detrás del borde de la pantalla. En la captura desplazada se ve completo, pero el bloque menta oscuro se distingue poco del resto de las tarjetas.
- **Recordatorio desde Inicio.** El texto y el botón se leen completos, pero la pantalla solo identifica el nombre y el producto. Se pierde la fecha o el motivo de recompra que daba contexto en Inicio.
- **Nueva venta.** Los precios de la segunda fila quedan detrás del carrito y algunos nombres de la primera fila terminan en puntos suspensivos. El chip siguiente queda cortado por el borde derecho.
- **Editar paciente.** El nombre se presenta como un título y la pantalla solo ofrece cambiar teléfono y notas. El espacio entre el formulario y las acciones queda vacío en la captura sin teclado.
- **Ajustes.** La cabecera fija corta el título «Avisos» al desplazar. La plantilla y su botón se ven completos. «Avanzado» se distingue por el triángulo pequeño del control nativo.

**Trabajo completado**

- Reportes incluye selector de mes y las pestañas Ventas, Cabina e Inventario. Ventas reúne lo vendido con descuentos, ganancia, promedio, barras semanales, productos y formas de pago con los importes por cobrar. El historial de ventas sigue disponible debajo de las acciones para compartir.
- Cabina muestra el gasto por los usos, los frascos terminados y los productos con más gasto. Los usos nuevos guardan su costo unitario. Inventario muestra los valores a costo y a precio de venta, los productos sin movimiento en 60 días y los vencimientos de los próximos 90 días. En meses anteriores, las existencias se calculan al cierre del mes y se valoran con el catálogo actual.
- Las tres pestañas tienen impresión con el logo completo, descarga CSV para Excel y resumen por WhatsApp. Se comprobó un PDF A4 generado en Chromium y la descarga sin conexión, incluida la carga del logo. Queda por probar cómo se guarda el PDF y cómo se abre WhatsApp en Safari del iPhone de Elba, también desde la pantalla de inicio.
- Revisé 12 capturas de 390×844 en claro y oscuro. Frente a `Reportes.png`, se conservaron el selector, la cuadrícula de cifras y las barras magenta. Los meses de más de 28 días muestran una quinta barra y «Formas de pago» queda antes de las acciones para compartir. En las capturas desplazadas se siguen viendo fragmentos de filas bajo la barra inferior translúcida.
- Pasaron 29 pruebas en Chromium a 390×844 y 26 con su perfil de iPhone 14 Pro. Las barras y las formas de pago cuadran con el total del mes, incluidos descuentos y ventas pendientes. También pasaron los límites de 60 y 90 días, los archivos de la versión 1 y la recarga sin conexión.
- Sigue T10 con el conteo guiado. Los cambios quedaron en `prueba/` y `codex/` para que los guarde el bucle.

### 27-nov-2026 · 13:35–13:50 (Ecuador) · T10

**Revisión de las ocho capturas T9 adjuntas**

- **Ventas.** Frente a `Reportes.png`, la quinta semana queda como una raya de $ 0,00 y estrecha las otras barras. El nombre del limpiador se parte en dos líneas bajo «Lo más vendido» y los nombres de la segunda y tercera tarjetas también ocupan más espacio al desplazarse.
- **Productos e historial de ventas.** En la captura de productos, la bolsa fija queda encima del borde inferior de «Descargar PDF». En el historial, la barra deja entrever el encabezado del día siguiente y parte del nombre de otra paciente.
- **Cabina.** Los nombres de dos insumos ocupan dos líneas y las barras de menor gasto se ven casi iguales. La cantidad y el monto a la derecha permiten leer la diferencia con el producto de mayor gasto.
- **Inventario en claro y oscuro.** «Vencen en los próximos 90 días» muestra tres filas completas o casi completas. La fecha de la tercera queda contra el borde de la barra y se alcanzan a leer fragmentos del siguiente producto debajo de la navegación.
- **Impresión en claro y oscuro.** La hoja mantiene el fondo blanco en ambos temas. En la vista de 390 px, el logotipo, los bordes de las tarjetas y las barras quedan pegados a los lados. La captura se corta al empezar el bloque siguiente. La vista A4 se comprobó en T9.

**Trabajo completado**

- Desde Inicio e Inventario se puede contar todo el catálogo, Para vender, Uso en spa o una marca. Cada paso muestra la foto o las iniciales, el stock esperado y la cantidad encontrada. «No hay» anota cero. El avance se guarda en el celular y se puede retomar al volver a abrir la app.
- El escáner suma una unidad en cada lectura aceptada y permite escribir el código si falta cámara. Sostener el mismo código en el encuadre cuenta una sola vez. El resumen muestra las diferencias y deja corregirlas antes de confirmar. La confirmación registra juntos los ajustes `conteo` y ofrece «Deshacer» durante cinco segundos.
- Revisé 12 capturas de 390×844 en claro y oscuro. El acceso de Inventario comparte fila con la lista de compras y el orden. Las filas y las tarjetas del conteo siguen `Inventario.png` y `Producto.png`. La cámara usa el encuadre menta y la ficha inferior de `Escaner.png`. En Inicio e Inventario aún se alcanzan a leer fragmentos de filas bajo la barra fija.
- Pasaron 32 pruebas en Chromium a 390×844 y 29 con su perfil de iPhone 14 Pro. Se comprobó que las existencias quedan iguales a lo contado, incluida una cantidad decimal y otra en cero. También pasaron la lectura repetida con la cámara simulada, la pausa y reanudación sin conexión, el reintento del guardado y los archivos v1.
- Sigue T11 con la lista para pedir. Queda probar la lectura repetida con códigos impresos y el teclado de cantidades en Safari del iPhone de Elba, también desde la pantalla de inicio. Los cambios quedaron en `prueba/` y `codex/` para que los guarde el bucle.

### 27-nov-2026 · 13:53–14:05 (Ecuador) · T11

**Revisión de las ocho capturas T10 adjuntas**

- **Inicio con conteo pausado, claro y oscuro.** La barra inferior deja ver partes de la primera fila de «Necesita atención» debajo de las pestañas. La bolsa queda encima del comienzo de esa fila y el título de la sección queda pegado a la barra.
- **Inventario oscuro.** «Lista de compras», «Contar» y «Por nombre» comparten una fila apretada. El siguiente filtro asoma cortado a la derecha y la navegación deja ver fragmentos de la lista que pasa por debajo.
- **Grupos y producto, oscuro.** Las tarjetas distinguen bien los grupos. En el paso de conteo aparecen juntas las cifras «Producto 3 de 42» y «3 de 42 contados». La franja de avance es pequeña y ambos números se confunden cuando coinciden. El texto «Cantidad contada (frascos)» sí deja clara la unidad.
- **Escáner oscuro.** El fondo de cámara es una simulación. El texto de ayuda y la confirmación de lectura se leen completos. El rayo aparece solo como ícono y su estado queda poco claro en la captura fija.
- **Resumen, claro y oscuro.** «Esperado 6» y «Esperado 4» quedan sin unidad, mientras «Contado 8 frascos» y «Contado 1 unidad» sí la muestran. El espacio vacío sobre «Confirmar conteo» es amplio cuando solo hay dos diferencias, aunque deja el botón al alcance al pie.

**Trabajo completado**

- «Lista de compras» sugiere cuánto pedir según la cantidad ideal o el consumo de 30 días con un piso de mínimo más uno. Resta lo que ya está por llegar. Las tarjetas agrupan por proveedor y preparan en WhatsApp el mensaje para su número.
- «Marcar como pedido» guarda el pedido en ese celular. «Llegó» permite anotar entregas completas o parciales y guarda juntas las cantidades y el costo unitario en el inventario. «Deshacer» revierte la llegada. Las entradas y los costos se incluyen en el archivo de envío entre celulares.
- Revisé ocho capturas de 390×844, en claro y oscuro. La lista toma de `Inventario.png` el segmentado, las tarjetas redondeadas, las filas con fotos y los separadores rectos. En «Llegó» el pie fijo deja el botón visible mientras se desplaza el formulario.
- Pasaron 35 pruebas en Chromium a 390×844 y 32 con su perfil iPhone 14 Pro. Se comprobaron el mensaje por proveedor, las cantidades sugeridas, las entregas parciales sin conexión, el reintento de guardado, Deshacer y la prevención de entradas duplicadas desde otra pestaña. También pasaron los archivos de la versión 1.
- Sigue T12, etiquetas QR propias. Queda comprobar el teclado de recepción y la apertura de WhatsApp en el iPhone de Elba. Los cambios están en `prueba/` y `codex/`.

### 27-nov-2026 · 14:07 (Ecuador) · T12

**Revisión de las ocho capturas T11 adjuntas**

- **Por pedir, claro y oscuro.** Las píldoras «Pedir 4 unidades» y «Pedir 4 frascos» parten la cantidad en dos líneas. El ancho que ocupan también fuerza saltos en los nombres. En oscuro, el número del proveedor y «Sin WhatsApp registrado» tienen menos presencia que las acciones.
- **Pedidos, claro y oscuro.** «Cerrar pedido» compite en tamaño con «Llegó». El título y la fecha dejan claro cuándo se hizo el pedido, pero el botón de cierre por sí solo no explica qué pasa con las unidades pendientes.
- **Llegó el pedido, claro y oscuro.** El foco sobre el primer costo domina la vista inicial. En las tres tarjetas, los campos precargados y editables se ven iguales a los valores ya confirmados. La instrucción de escribir 0 aclara cómo omitir un producto.
- **Pedido recibido, claro y oscuro.** Debajo del segmentado solo queda el estado vacío. «Pedido completo» se lee en el aviso temporal, repartido en dos líneas junto a «Deshacer». Después de ese aviso, la pestaña no muestra un resumen de lo que se recibió.

**En curso**

- T12, códigos propios y hoja de etiquetas QR.

### 27-nov-2026 · 18:40–18:49 (Ecuador) · T12

**Revisión de las ocho capturas T11 adjuntas**

- **Por pedir, claro y oscuro.** Las píldoras de cantidad para cuatro unidades o frascos saltan a dos líneas y dejan estrecha la columna de nombres. «Pedir 1 frasco» sí cabe en una línea.
- **Pedidos, claro y oscuro.** «Cerrar pedido» ocupa más ancho que «Llegó». La consecuencia para las cantidades pendientes queda para la pantalla de confirmación.
- **Llegó el pedido, claro y oscuro.** El anillo magenta del costo domina la primera tarjeta al abrir. «Cantidad recibida» se repite y la unidad de cada producto queda en la línea «Por recibir», encima de los campos.
- **Pedido recibido, claro y oscuro.** El aviso de éxito queda separado del pie y «Pedido completo» se parte en dos líneas. Después de cinco segundos solo queda el mensaje de que no hay pedidos por recibir.

**Trabajo completado**

- Desde Inventario, «Etiquetas QR» permite buscar y elegir productos de venta y cabina. Los que carecen de código reciben uno propio `SP-xxxxx` y los que ya tienen un QR propio se pueden reimprimir con el mismo código. La selección distingue Para vender y Uso en spa, y el botón «Preparar etiquetas» recupera el foco al volver de la vista previa.
- La impresión usa 24 etiquetas por hoja A4, en tres columnas y ocho filas. Cada etiqueta contiene el emblema, el nombre, el QR y el código escrito. Si otra pestaña cambió el nombre o el código, la app pide volver a preparar la hoja.
- Pasaron 38 pruebas en Chromium a 390×844 y 35 con su perfil iPhone 14 Pro. Se verificó una página A4 para 24 etiquetas y dos para 25, el reintento de guardado, la lectura sin conexión y la compatibilidad con los archivos v1. El lector local también reconoció un QR extraído del PDF.
- Revisé ocho capturas T12 de 390×844 en claro y oscuro. Inventario conserva las tarjetas de cifras, los grupos y las filas de `Inventario.png`, con dos filas de acciones y orden antes del catálogo. El escáner conserva el encuadre menta y la tarjeta inferior de `Escaner.png`. La vista previa queda en blanco en ambos temas para representar el papel. En Inventario todavía se alcanzan a ver fragmentos de filas bajo la barra translúcida.
- Sigue T13, Ajustes, envío y respaldo. Queda comprobar la impresión y la lectura de una etiqueta física en Safari del iPhone de Elba, también desde la pantalla de inicio.

### 27-nov-2026 · 18:52–19:10 (Ecuador) · T13

**Revisión de las ocho capturas T12 adjuntas**

- **Inventario en claro y oscuro.** El filtro siguiente asoma cortado a la derecha. Las dos filas de acciones debajo de las cifras bajan el primer grupo frente a `Inventario.png`. El botón central y la barra translúcida dejan una fila a medias y permiten entrever texto debajo de las pestañas.
- **Selección en claro y oscuro.** «Preparar etiquetas» queda al alcance en el pie. La última fila visible pasa por debajo de ese pie y su detalle se corta. La casilla de «Ácido Mandélico» tiene un tono magenta más oscuro que las demás casillas seleccionadas y puede parecer otro estado.
- **Vista previa en claro y oscuro.** El bloque blanco y los QR conservan contraste en ambos temas. Al llegar al botón de imprimir se ve solo parte de la quinta fila. Los nombres de varias etiquetas ocupan tres líneas y los códigos quedan en letra pequeña.
- **Escáner en claro y oscuro.** Frente a `Escaner.png`, el QR de la simulación y la línea menta se cruzan en el centro. La instrucción blanca cae sobre una zona clara del fondo. Al ofrecer también «Escanear otro», el acceso manual ocupa menos espacio y pierde el centrado del diseño.

**Trabajo completado**

- Ajustes reúne quién usa el celular, el tema, el tamaño de letra, los días de aviso y los datos de ejemplo. Se pueden consultar y agregar categorías en los dos inventarios y editar el recordatorio de compra y la despedida del comprobante de WhatsApp.
- «Enviar» conserva el `.txt` de la versión 1. Se prepara antes de abrir el menú Compartir o de descargarlo. Inicio mantiene el aviso de más de siete días cuando hay cambios pendientes. «Recibir» mezcla los registros por su identificador y fecha de modificación y conserva las fotos.
- «Respaldo completo» guarda un `.json` con las fotos, las preferencias, el conteo en curso y los pedidos. «Restaurar respaldo» requiere confirmar el reemplazo y conserva el nombre elegido en el celular que lo recibe. La invitación de Inicio muestra cómo agregar la app a la pantalla de inicio y dónde guardar una copia con fotos.
- Pasaron 43 pruebas en Chromium a 390×844 y 39 con el perfil iPhone 14 Pro, ejecutadas por tandas. La prueba de intercambio abrió en la raíz un `.txt` de `prueba/` con foto, QR y movimientos, registró allí una entrada y la leyó de vuelta en `prueba/`. También se comprobó la importación repetida del archivo v1, la cancelación de Compartir, la descarga y restauración sin conexión y la conservación de las cachés de las otras apps.
- Revisé 14 capturas T13 de 390×844 en claro y oscuro. Como Ajustes carece de una imagen propia en el diseño aprobado, usé las tarjetas y jerarquía de `Main.png`, el segmentado de `Inventario.png` y la hoja inferior de `Vender.png`. Envío y respaldo se abren en una hoja inferior. En Ajustes, los controles de inventario y plantillas se ven al desplazar.
- Sigue T14, pulido final. En el iPhone real de Elba queda comprobar que el menú Compartir permita guardar el respaldo en Archivos o Drive y abrirlo de nuevo, desde Safari y desde la app instalada. Los cambios quedaron en `prueba/` y `codex/`.

### 27-nov-2026 · 19:13–19:37 (Ecuador) · T14

**Revisión de las ocho capturas T13 adjuntas**

- **Instalación, claro y oscuro.** El título y la guía de Safari caben en la hoja. La tarjeta que abrió la guía queda parcialmente tapada y su botón repite el título de la hoja. En la captura clara, el fondo oscurecido conserva bastante contraste y las acciones de avisos todavía compiten con la guía.
- **Plantillas y categorías, oscuro.** El borde de los campos casi se pierde sobre el fondo de las tarjetas. En Categorías, el campo vacío se distingue sobre todo por el texto «Nueva categoría». En Plantillas, el botón para guardar y el texto de ayuda se leen completos.
- **Ajustes y preferencias, oscuro.** En la captura desplazada se ve una línea residual de la tarjeta anterior bajo el encabezado. El botón de datos de ejemplo se corta en el borde inferior. En la primera vista completa, la opción de letra grande queda justo al pie y las opciones de Inventario requieren desplazar.
- **Envío y respaldo, oscuro.** Las dos hojas presentan «Archivo listo · 15 fotos» y «Descargar archivo». La diferencia entre compartir con Jonathan y guardar una copia queda solo en el título y la instrucción. Es la vista de descarga de respaldo del navegador cuando Compartir con archivo no está disponible.

**Trabajo completado**

- La bienvenida empieza con el logo completo de `Bienvenida.png`, permite elegir quién usa el celular y ofrece entrar o recibir un envío antes de empezar. El botón Volver y Atrás del navegador recorren los pasos. La recepción usa la mezcla habitual y avisa si el archivo es inválido o si falta espacio para guardarlo.
- Los inventarios y la lista de pacientes explican qué hacer cuando aún están vacíos. Reportes indica por qué el mes está vacío y omite las barras sin ventas. Se reforzó el borde de los campos en los dos temas y la navegación de teclado conserva el foco al abrir y cerrar hojas. Las transiciones y el rebote se desactivan con movimiento reducido.
- Comparé 30 capturas T14 de 390×844 en claro y oscuro con `Bienvenida.png`, `Main.png`, `Inventario.png` y `Reportes.png`. Ajusté el salto de línea de la bienvenida, la separación del encabezado de Ajustes y el fondo de la guía de instalación. Los botones de Envío y Respaldo dicen qué archivo se guarda o comparte. La barra translúcida desenfoca el contenido que pasa por debajo.
- La mediana de arranque fue 429 ms para la bienvenida y 729 ms para Inicio con 300 productos y 2300 movimientos. Fueron cinco aperturas por caso, con recursos locales en Chromium, perfil iPhone 14 Pro y CPU ralentizada cuatro veces. Falta medir el arranque en los celulares reales.
- `MIGRACION.md` incluye la función probada, la copia automática exacta del estado v1 antes de escribir los campos nuevos y los pasos para el pase a producción que hará Claude tras la aprobación de Jonathan. La versión de prueba sigue bajo su propia clave, base de fotos y service worker.
- Pasaron 49 pruebas en Chromium a 390×844 y 43 con su perfil iPhone 14 Pro, ejecutadas por tandas. Se verificaron la recepción con fotos y el reintento tras un error de almacenamiento, el arranque y la lectura sin conexión, los formatos v1, la conservación de las cachés ajenas y el respaldo ante los dos posibles fallos de escritura de la migración. Los cambios quedaron en `prueba/` y `codex/` para que los guarde el bucle.

**Recorridos para Elba y Jonathan en sus celulares**

- **Ambos, en `prueba/`.** Si ya tienen un nombre guardado, usen un perfil nuevo del navegador para recorrer la bienvenida y verificar el saludo. Agreguen la app a la pantalla de inicio, carguen los datos de ejemplo desde Ajustes y abran de nuevo con el modo avión activo después de que termine la carga. Revisen Inventario y sus fotos, hagan una venta de ejemplo, desháganla y retomen un conteo. Repitan en tema oscuro y con letra grande.
- **Elba, iPhone 14 Pro.** En Safari y desde la pantalla de inicio, pruebe el teclado de cantidades y fechas, y compruebe que la isla, la barra inferior y el teclado dejen tocar los controles. Con VoiceOver, recorra la bienvenida, los nombres de los botones del escáner y el cierre de una hoja. Pruebe permitir y rechazar la cámara, leer un código impreso y usar la escritura manual. Guarde también un PDF desde Reportes.
- **Jonathan, Android.** En Chrome y desde la pantalla de inicio, pruebe Atrás al recorrer la bienvenida, cerrar el escáner y volver de una ficha. Compruebe la lectura de un código con cámara y la linterna si el teléfono la ofrece. Imprima una hoja de QR, lea una etiqueta y compruebe que abra su producto.
- **Entre los dos.** Hagan un envío con fotos por WhatsApp, ábranlo con «Recibir» y repitan la recepción para comprobar que no se duplique. Abran el comprobante y un recordatorio de ejemplo para revisar el texto antes de enviar. Guarden un respaldo completo en Archivos o Drive, confirmen que se puede volver a elegir y restauren solo en un inventario de prueba.
- Estos recorridos quedan pendientes en equipos físicos. El perfil iPhone de Playwright permite comprobar el tamaño y los toques en Chromium.

### 27-nov-2026 · 19:40–19:46 (Ecuador) · Revisión posterior a T14

**Hallazgos en las ocho capturas adjuntas, en oscuro y a 390×844**

- **Invitación e instalación.** En Inicio, la tarjeta queda debajo de todos los avisos y hay que bajar para encontrarla. Su texto mezcla la instalación con el respaldo, mientras que «Ver los pasos» abre la guía de instalación. En la hoja, la instrucción menciona «Compartir» sin mostrar cómo reconocer el botón en Safari. Las cifras recortadas arriba corresponden a la posición desplazada de ambas capturas.
- **Ajustes y preferencias.** La primera vista deja «Tamaño de letra» al borde inferior. En la vista desplazada, «Cargar datos de ejemplo» queda cortado y su texto pierde contraste en el estado desactivado. El mensaje de encima confirma que ya se cargaron los datos.
- **Categorías.** El grupo activo «Para vender» se repite como título de la lista. Los fondos de la opción activa y del segmentado son parecidos en oscuro, de modo que el estado se distingue principalmente por el texto.
- **Plantillas de WhatsApp.** Se ven los tiradores diagonales de ambos campos de texto. La ayuda explica cómo usar `{nombre}` y `{producto}`. El mensaje visible conserva esos marcadores, así que el resultado personalizado se revisa al preparar un recordatorio.
- **Envío y respaldo.** Las dos hojas conservan la jerarquía de título, estado y acción al pie del diseño de `Vender.png`. En el envío, «Manda el envío por WhatsApp» junto con «Descargar envío» deja implícito que luego hay que adjuntar el archivo en el chat. El respaldo indica dónde se guarda el archivo y qué opción permite restaurarlo.

**Estado de la corrida**

- `TAREAS.md` tiene T0–T14 marcadas como completas. La corrida se limitó a revisar las capturas, documentar los hallazgos y verificar la versión de prueba.
- Pasaron las 49 pruebas de Chromium a 390×844 y las 43 con su perfil de iPhone 14 Pro. La ejecución continua se interrumpió después de las primeras 20 pruebas aprobadas y se completó la misma suite por tandas. Pasaron los archivos v1 en ambos sentidos, la migración simulada y la recarga sin conexión.
- Sigue la revisión en los celulares de Elba y Jonathan con los recorridos de T14.

### 27-nov-2026 · 19:50–19:54 (Ecuador) · Revisión de las capturas de T14

Se revisaron las ocho capturas adjuntas en oscuro a 390×844. Inicio conserva la jerarquía de avisos de `Main.png`. Para las vistas de Ajustes, se usó como referencia el selector de `Inventario.png` y la hoja inferior de `Vender.png`.

- **Invitación e instalación.** La invitación queda después de todos los avisos, por debajo de la primera vista. El texto menciona dos acciones y «Ver los pasos» abre la guía para instalar la app. En la guía de Safari falta una referencia visual para encontrar «Compartir». «Entendido» oculta la invitación en las próximas visitas. Los contadores cortados arriba se deben al desplazamiento de las capturas.
- **Ajustes y preferencias.** El selector de tamaño de letra queda al borde inferior al abrir Ajustes. En la vista desplazada, «Cargar datos de ejemplo» se ve tenue y cortado. El mensaje inmediatamente anterior ya informa que los datos están cargados.
- **Categorías y plantillas.** En Categorías, el fondo de la opción activa y el del selector tienen un contraste de 1,1:1 en oscuro. El texto ayuda a distinguir la selección y su nombre se repite como título de la lista. En Plantillas, los tiradores diagonales de los campos quedan muy cerca del borde redondeado. La ayuda explica los marcadores `{nombre}` y `{producto}` y el mensaje final se ve al preparar un recordatorio.
- **Envío y respaldo.** Las dos hojas muestran la alternativa de descarga. En Envío falta indicar que, después de descargar, hay que adjuntar el archivo al chat. El código actual ya actualiza «Último envío» al descargar, antes de ese paso manual. Respaldo sí indica dónde guardar la copia y cómo volver a abrirla.

`TAREAS.md` tiene T0–T14 completas. El único archivo editado en esta corrida es este registro. Pasaron las 49 pruebas de Chromium a 390×844 y las 43 con el perfil iPhone 14 Pro. Queda por probar en los celulares el menú Compartir de Safari y Chrome, la entrega por WhatsApp y la restauración de la copia.

### 27-nov-2026 · 20:00–20:05 (Ecuador) · Revisión de las ocho capturas adjuntas

Se revisaron las ocho capturas oscuras de 390×844. `Main.png` sirvió de referencia para Inicio, `Inventario.png` para el selector y `Vender.png` para las hojas inferiores. `TAREAS.md` tiene marcadas las 15 tareas, de T0 a T14. La corrida se dedicó a la revisión y a las pruebas de la versión de prueba.

- **Invitación e instalación.** La tarjeta se descubre al bajar después de los cuatro avisos. Su texto reúne el acceso desde la pantalla de inicio y la copia de seguridad, aunque «Ver los pasos» explica solo la instalación. La guía de Safari podría mostrar el ícono de Compartir junto al nombre. El tirador tenue de la hoja parece un control para arrastrar. El cierre desde la hoja se hace con «Entendido», que también oculta la invitación en próximas visitas. Las cifras a medias en el borde superior corresponden al punto de desplazamiento de ambas capturas.
- **Ajustes y preferencias.** Al abrir Ajustes, «Tamaño de letra» empieza justo en el borde inferior. En la captura desplazada, el botón desactivado «Cargar datos de ejemplo» pierde legibilidad y queda a medias. El texto de la misma tarjeta ya indica que los datos están cargados.
- **Categorías y plantillas.** En Categorías, «Para vender» aparece dos veces y el fondo seleccionado apenas se distingue del resto del selector en oscuro. El mismo efecto se ve en los selectores de Ajustes. En Plantillas, los tiradores diagonales coinciden con la curva inferior de los campos. Los bordes, la ayuda y los botones de guardado se leen completos.
- **Envío y respaldo.** En la vista de descarga, la hoja de Envío deja implícito que hay que adjuntar el `.txt` al chat de WhatsApp. Confirmé en el código que Ajustes actualiza «Último envío» al iniciar la descarga, antes de adjuntar el archivo. La hoja de respaldo indica dónde guardar la copia y con qué acción volver a abrirla. Las dos hojas comparten un tirador decorativo con la guía de instalación.

Pasaron las 49 pruebas de Chromium a 390×844 y las 43 con el perfil iPhone 14 Pro. El proceso inicial terminó tras 27 pruebas aprobadas. Las restantes pasaron por tandas, incluidos el intercambio con la versión 1, la migración simulada y la recarga sin conexión. Solo se editó este registro.

Quedan pendientes los recorridos de T14 en los celulares físicos, en especial compartir y adjuntar el archivo por WhatsApp y abrir el respaldo desde Archivos o Drive.

### 27-nov-2026 · 20:10–20:15 (Ecuador) · Revisión de T14

Las 15 tareas de `TAREAS.md`, de T0 a T14, figuran como completas. Revisé las ocho capturas adjuntas en oscuro a 390×844. Comparé los avisos con `Main.png`, los selectores con `Inventario.png` y las hojas inferiores con `Vender.png`.

- **Ajustes y preferencias.** El selector de letra aparece al pie de la primera vista y el botón desactivado «Cargar datos de ejemplo» queda parcialmente visible en la captura desplazada. El texto de ese botón tiene un contraste de 2,23:1 en oscuro. El párrafo de la tarjeta informa que los datos ya se cargaron.
- **Categorías y plantillas.** «Para vender» se lee tanto en el selector como en el encabezado de la lista. El fondo de la opción activa apenas se diferencia del resto del selector (1,10:1), igual que en Preferencias. Los textos de ambas opciones superan 4,5:1. El borde de los campos alcanza 3,29:1. En Plantillas, el tirador para cambiar la altura coincide con la esquina redondeada.
- **Invitación y guía de instalación.** La invitación aparece después de «Necesita atención» y menciona el respaldo junto con la instalación. «Ver los pasos» abre únicamente la guía. En la hoja, «Compartir» se nombra por escrito y falta una referencia visual para encontrar el botón de Safari. Los contadores de Inicio cortados arriba corresponden al desplazamiento de las capturas.
- **Envío y respaldo.** En la hoja de Envío, «Manda el envío por WhatsApp» y «Descargar envío» dejan implícito que luego hay que adjuntar el archivo al chat. El código registra «Último envío» al iniciar la descarga. La hoja de Respaldo indica dónde guardar la copia y con qué opción volver a abrirla. El tirador de las dos hojas sigue el diseño y puede sugerir que se cierran al arrastrar.

Pasaron las 49 pruebas en Chromium a 390×844 y las 43 con el perfil iPhone 14 Pro, incluidas la compatibilidad con los archivos de la versión 1, la migración simulada y la recarga sin conexión. El proceso inicial terminó tras 23 pruebas aprobadas. Las demás pasaron en tandas sucesivas con un solo navegador abierto. Solo se editó este registro.

Sigue la revisión en los celulares de Elba y Jonathan, especialmente la instalación en Safari, el envío por WhatsApp y la restauración desde Archivos o Drive.

### 27-nov-2026 · 20:20–20:23 (Ecuador) · Revisión de las ocho capturas de T14

Se revisaron las ocho capturas oscuras de 390×844 antes de intervenir. Inicio conserva la jerarquía de `Main.png` y las hojas de archivo conservan el botón principal al pie de `Vender.png`. T0–T14 figuran como completas en `TAREAS.md`.

- **Invitación e instalación.** La tarjeta se descubre después de los avisos. Su texto menciona el respaldo, y «Ver los pasos» lleva a una guía que explica la instalación. En esa guía falta una referencia visual al botón Compartir de Safari. En «Necesita atención», el nombre largo del primer producto deja «cc» solo en la segunda línea.
- **Ajustes y preferencias.** El encabezado usa 24 px frente a los 28–30 px de `DISENO.md` para títulos de pantalla. Al abrir Ajustes, el selector de letra queda parcialmente visible en el borde inferior. Con los datos de ejemplo cargados, el botón desactivado queda tenue y cortado en la captura desplazada.
- **Categorías y plantillas.** El selector activo en oscuro pierde el efecto elevado que se ve en `Inventario.png`, también en Preferencias. El nombre del grupo se repite encima de la lista. Los tiradores diagonales de los dos campos de Plantillas coinciden con el borde redondeado inferior.
- **Envío y respaldo.** La hoja de descarga del envío omite el paso de adjuntar el archivo al chat. «Último envío» se actualiza al descargarlo, así que la fecha puede avanzar antes de que Jonathan reciba el archivo. El respaldo sí indica dónde guardar la copia y cómo abrirla de nuevo.

`python3 codex/pruebas/correr.py` terminó en una sola ejecución. Pasaron 49 pruebas en Chromium a 390×844 y 43 con el perfil iPhone 14 Pro, incluidos el intercambio de archivos entre versiones, la migración simulada y la recarga sin conexión. La revisión solo cambió esta bitácora. Siguen pendientes los recorridos de T14 en los celulares de Elba y Jonathan, en particular la instalación, el envío por WhatsApp y la restauración desde Archivos o Drive.

### 27-nov-2026 · 20:30–20:39 (Ecuador) · Revisión de las capturas adjuntas

Revisé las ocho capturas T14 en oscuro a 390×844. Comparé los avisos de Inicio con `Main.png`, los selectores con `Inventario.png` y las hojas inferiores con `Vender.png`.

- **Invitación e instalación.** La tarjeta se encuentra al desplazar Inicio después de los avisos. Menciona la copia de seguridad junto al botón «Ver los pasos», que abre la guía de instalación. En la hoja de Safari falta un ícono que ayude a identificar «Compartir». En la primera fila de avisos, «30 cc» se parte y «cc» queda en su propia línea.
- **Ajustes y preferencias.** La primera vista termina en medio del selector de tamaño de letra. En la vista desplazada, el botón desactivado «Cargar datos de ejemplo» queda cortado y su texto magenta se distingue poco del fondo. La tarjeta ya confirma que los datos están cargados.
- **Categorías y plantillas.** En oscuro, el fondo de la píldora activa tiene un contraste de 1,10 a 1 con el fondo del selector en Categorías y Preferencias. El cambio de color del texto es la señal más visible. En Categorías el nombre de la opción activa se repite como título de la lista. En Plantillas, el tirador para cambiar la altura de cada campo queda pegado a la esquina redondeada.
- **Envío y respaldo.** En la vista de descarga falta el paso de adjuntar el archivo en el chat de WhatsApp. La fecha de «Último envío» avanza al descargar, antes de adjuntar el archivo. El respaldo indica dónde guardar la copia y cómo restaurarla. El tirador decorativo de las dos hojas parece un control de arrastre.

Pasaron las 49 pruebas a 390×844 y las 43 con el perfil iPhone 14 Pro, ambas en Chromium. La suite se completó en el segundo intento tras la interrupción del primer proceso. Se verificó el intercambio con la versión 1, la migración simulada y la recarga sin conexión.

Las 15 tareas de `TAREAS.md` están completas. Solo se editó esta bitácora. Sigue la validación de T14 en los celulares de Elba y Jonathan, especialmente la instalación, el envío por WhatsApp y la restauración desde Archivos o Drive.

### 27-nov-2026 · 20:42–20:46 (Ecuador) · Revisión de las ocho capturas de T14

Las 15 tareas de `TAREAS.md` figuran como completas. Revisé las ocho capturas oscuras de 390×844 y comparé los avisos con `Main.png`, los selectores con `Inventario.png` y las hojas inferiores con `Vender.png`. El diseño aprobado no incluye una pantalla de referencia para Ajustes.

- **Invitación e instalación.** La invitación queda debajo de los cuatro avisos. Su texto menciona el respaldo, aunque «Ver los pasos» lleva solo a la instalación. En la guía falta el ícono que ayuda a reconocer «Compartir» en Safari. En ambas capturas, los contadores se ven cortados por la posición de desplazamiento y «30 cc» se parte entre dos líneas.
- **Ajustes y preferencias.** En la primera vista, el borde de la pantalla corta el selector de tamaño de letra y obliga a desplazar para leer las opciones. En la captura desplazada, el botón desactivado «Cargar datos de ejemplo» queda cortado y tiene poco contraste. La tarjeta ya indica que los datos están cargados.
- **Categorías y plantillas.** Los selectores de Categorías y Preferencias pierden en oscuro el efecto de relieve de la opción activa del diseño. «Para vender» se repite como título de la lista. En las plantillas, el tirador diagonal para cambiar el alto de cada campo coincide con la esquina redondeada.
- **Envío y respaldo.** La hoja «Enviar a Jonathan» pide mandar el archivo por WhatsApp, pero omite el paso de adjuntar el `.txt` al chat después de descargarlo. Confirmé en el código que «Último envío» se actualiza al iniciar la descarga, antes de ese paso. La hoja de respaldo sí indica cómo guardar y volver a abrir la copia. El tirador de las dos hojas sigue la referencia y parece un control de arrastre.

Pasaron 49 pruebas en Chromium a 390×844 y 43 en Chromium con el perfil de iPhone 14 Pro. La ejecución inicial se interrumpió tras 19 pruebas aprobadas y las restantes se completaron por tandas. Pasaron el intercambio con la versión 1, la migración simulada y la recarga sin conexión. Solo se actualizó esta bitácora.

Sigue la validación de T14 en los celulares de Elba y Jonathan. Queda por comprobar la instalación en Safari, el envío y la recepción por WhatsApp y la restauración desde Archivos o Drive.

### 27-nov-2026 · 20:50–20:53 (Ecuador) · Revisión de las ocho capturas de T14

Las 15 tareas de `TAREAS.md`, de T0 a T14, figuran como completas. Revisé las ocho capturas adjuntas en oscuro a 390×844. Comparé los avisos de Inicio con `Main.png`, los selectores con `Inventario.png` y las hojas inferiores con `Vender.png`.

- **Invitación e instalación.** La tarjeta se descubre al bajar después de los cuatro avisos. El texto menciona guardar una copia, pero «Ver los pasos» solo explica cómo instalar la app. La guía de Safari nombra «Compartir» sin mostrar el ícono. En ambas capturas, los contadores quedan cortados arriba por el desplazamiento y «30 cc» se parte entre dos líneas en el primer aviso.
- **Ajustes y preferencias.** El título de Ajustes usa 24 px frente a los 28–30 px de la guía para títulos de pantalla. El selector de tamaño de letra queda cortado al pie de la primera vista. En la captura desplazada, el botón desactivado «Cargar datos de ejemplo» se ve tenue y cortado. La tarjeta ya informa que esos datos están cargados.
- **Categorías y plantillas.** El fondo de la opción elegida apenas se distingue en oscuro, tanto en Categorías como en Preferencias. En Categorías, «Para vender» se repite como encabezado de la lista. En Plantillas, el tirador diagonal de cada campo coincide con la esquina redondeada.
- **Envío y respaldo.** La hoja de descarga del envío omite el paso de adjuntar el `.txt` en el chat de WhatsApp. El código adelanta «Último envío» al iniciar la descarga, antes de que la otra persona reciba el archivo. La hoja de respaldo explica dónde guardar la copia y cómo restaurarla. En las hojas inferiores, el tirador decorativo parece un control para arrastrar.

`python3 codex/pruebas/correr.py` terminó en una sola ejecución. Pasaron las 49 pruebas en Chromium a 390×844 y las 43 en Chromium con el perfil de iPhone 14 Pro. Se verificaron el intercambio de archivos con la versión 1 en ambos sentidos, la migración simulada y la recarga sin conexión. La revisión solo actualizó esta bitácora.

Sigue la validación en los celulares de Elba y Jonathan, con la instalación desde el navegador, el envío y la recepción por WhatsApp y la restauración desde Archivos o Drive.

### 28-nov-2026 · 00:20 (Ecuador) · Inicio de T15

Revisé las ocho capturas de T14 en oscuro antes de cambiar la interfaz. Tomé como referencia los avisos de `Main.png`, los selectores de `Inventario.png` y las hojas inferiores de `Vender.png`.

- **Invitación y guía de Safari.** La tarjeta queda debajo de los avisos y menciona un respaldo que «Ver los pasos» no explica. Falta el ícono junto a «Compartir». En ambas capturas de Inicio, «30 cc» se parte y deja «cc» solo en la segunda línea.
- **Ajustes y preferencias.** El título se ve más pequeño que los 28–30 px del diseño. El tamaño de letra queda parcialmente visible al abrir Ajustes. En la captura desplazada, «Cargar datos de ejemplo» se ve tenue y cortado, aunque el texto encima ya confirma que están cargados.
- **Categorías y plantillas.** El fondo de la opción activa apenas se distingue en oscuro, también en Preferencias. Categorías repite el grupo activo como título de la lista. Los dos campos de Plantillas dejan el tirador de redimensionamiento pegado a la esquina.
- **Envío y respaldo.** En Envío falta explicar cómo adjuntar el archivo descargado en el chat. Respaldo sí explica dónde guardar el archivo y cómo volver a abrirlo. Las dos hojas muestran un tirador que parece arrastrable y, en las capturas, se cierran con el botón de la esquina.

Quedaron incorporadas T15 y T16 en `TAREAS.md`. Esta corrida empieza por T15.

**Cambios de T15**

- En Nuevo producto, los dos campos de fecha caben dentro de su columna. Nombre y WhatsApp del proveedor quedan alineados por abajo aunque el rótulo de WhatsApp ocupe dos líneas.
- Reportes › Inventario muestra costo y precio de venta para «Para vender» y solo costo para «Uso en spa». El desglose también se usa al imprimir y compartir. En Cabina, los cuatro productos principales y «Otros» suman el gasto total. El CSV de Cabina conserva los productos individuales.
- Nueva venta, Inventario y «Por terminarse» usan el mismo criterio para el rojo de las existencias. En Nueva venta, Hydrating Foaming Cleanser muestra 100 ml y 200 ml debajo del nombre. Las cifras de Playfair Display se ven en caja alta. Las cantidades, los importes y las medidas de los nombres quedan unidos en pantalla. Los nombres guardados conservan sus espacios.
- La hoja de descarga indica el nombre del archivo y cómo adjuntarlo en WhatsApp. Compartir con éxito o confirmar «Sí» registra la fecha. Cerrar Compartir, un error del menú o «Todavía no» conservan la fecha y el aviso de siete días.

**Para que Elba vuelva a revisar en su iPhone 14 Pro**

1. En Safari y desde el ícono de inicio, abrir Nuevo producto. Tocar y llenar las dos fechas. Comprobar que «Lote» se pueda tocar por separado y que ningún campo salga de la tarjeta. Confirmar que los dos cuadros de Proveedor queden a la misma altura.
2. Abrir Reportes para ver los importes de cada grupo en Inventario y la fila «Otros» en Cabina. Mirar también que las cifras semanales queden en una línea.
3. Buscar Hydrating Foaming Cleanser en Nueva venta. Comprobar los tamaños y comparar «Queda 1» con y sin mínimo de aviso, además de un producto agotado. Revisar el cero de «Venta · 0 productos».
4. En Inicio, mirar que «30 cc» quede junto. En Inventario, revisar «3 %» en Gel de Ácido Tranexámico. En Pacientes, revisar que el símbolo y los centavos se vean juntos en la lista y la ficha.
5. Probar Enviar a Jonathan con datos de ejemplo. Cerrar el menú de iOS y comprobar la fecha. Repetir compartiendo el archivo, abrirlo con «Recibir» y revisar que la fecha avance. Si Safari ofrece descargar, seguir el paso de adjuntar el nombre que indica la hoja y comprobar «Todavía no» y «Sí». Revisar el aviso de Inicio después de cada intento.

**Verificación**

- Pasaron 54 pruebas en Chromium a 390×844 y 48 con el perfil iPhone 14 Pro. Vencimiento, Proveedor, cantidades y tamaño también se probaron a 360×800. El recorrido completo se verificó por tandas después de que se interrumpió la primera ejecución. Pasaron el intercambio en ambos sentidos con la versión 1, la migración simulada y la recarga sin conexión.
- Quedaron 44 capturas T15 en claro y oscuro. Hay 22 de 390×844 y 22 de 393×660, el área visible del perfil iPhone 14 Pro en Playwright. Se compararon con `Main.png`, `Inventario.png`, `Reportes.png`, `Vender.png` y `Paciente.png`. Cabina se desplazó en el perfil iPhone para mostrar el total y «Otros» juntos. Las fechas siguen el formato del calendario nativo de cada navegador.
- T15 queda marcada como completa. Sigue T16 con el pulido de la revisión. Queda pendiente la comprobación de Safari en el iPhone físico con los pasos de arriba.
