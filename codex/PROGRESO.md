# Progreso de la versión 2

_Codex: agrega una entrada al final en cada corrida (fecha y hora de Ecuador, tarea, lo hecho, lo que sigue)._

## Estado
- Tarea actual: T2
- Última corrida: 27-nov-2026, 08:30 (Ecuador) · T1 completada

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
