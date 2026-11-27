# Progreso de la versión 2

_Codex: agrega una entrada al final en cada corrida (fecha y hora de Ecuador, tarea, lo hecho, lo que sigue)._

## Estado
- Tarea actual: T1
- Última corrida: 27-nov-2026, 07:39 (Ecuador) · T0 completada

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
