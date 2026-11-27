# Progreso de la versión 2

_Codex: agrega una entrada al final en cada corrida (fecha y hora de Ecuador, tarea, lo hecho, lo que sigue)._

## Estado
- Tarea actual: T4
- Última corrida: 27-nov-2026, 09:54 (Ecuador) · T3 completada

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
