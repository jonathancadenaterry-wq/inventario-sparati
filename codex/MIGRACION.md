# Migración a SPARATI Inventario 2

`prueba/` sigue abierta para las pruebas de Jonathan y Elba. Claude puede publicar la versión 2 en la raíz de GitHub Pages cuando Jonathan apruebe el pase. Antes del cambio, guarden en cada celular un envío de la versión 1 fuera del navegador y comprueben que abre y contiene las fotos esperadas. Los datos de cada celular se migran localmente al abrir la versión nueva.

## Preparar la publicación

1. En una copia de la publicación, lleva desde `prueba/` la portada, `app.js`, `estilos.css`, `manifest.webmanifest`, `sw.js`, los íconos, los tres archivos del logo, `fuentes/` y `vendor/`. Conserva las licencias, las rutas relativas y la URL instalada de producción. Publica los archivos juntos.
2. En la copia de producción de `app.js`, pon `CLAVE = 'sparati_inventario_v1'`, `CLAVE_YO = 'sparati_inventario_yo'` y `CLAVE_INSTALACION = 'sparati_inventario_instalacion'`. Abre `indexedDB.open('sparati_fotos', 1)` y conserva el almacén `fotos`, con sus identificadores y contenidos. Ninguna foto necesita copiarse ni cambiar de ID.
3. En esa copia, quita la franja de prueba de la portada y pon `--franja:env(safe-area-inset-top, 0px)` en el CSS. Ajusta el espacio superior del primer paso de la bienvenida de 46 a 70 px para conservar el margen de `Bienvenida.png`. Cambia el nombre visible, el título Apple, los nombres de los archivos descargados y el manifiesto a los de producción. Conserva `start_url` y `scope` en `./`. Elimina la sección «Datos de ejemplo» y su acción de carga de la app publicada.
4. En el service worker de producción, usa `sp-inventario-v2-1` como primer nombre de caché e identifica las cachés propias con el prefijo `sp-`. La activación debe borrar solo cachés con ese prefijo, salvo la que se acaba de instalar. La lista de caché debe incluir las mismas URLs versionadas de JS y CSS que la portada. Quita el catálogo y las fotos de ejemplo de la lista, así como sus rutas especiales. Conserva la selección de solicitudes por la portada y la lista de archivos propios. Los recursos de `/prueba/` quedan bajo su registro independiente y sus cachés `spp-`.

## Copia automática y conversión del estado local

Inserta esta función junto al arranque de `app.js` en la copia de producción. Usa `CLAVE` y `CLAVE_YO` de esa copia y las funciones de validación, estado y pacientes de la versión 2. Conserva `v:1`, incluidos los registros borrados, y completa los datos de forma aditiva. El primer respaldo guarda el texto original completo antes de escribir el estado migrado. Volver a abrir un estado ya migrado deja intacta esa primera copia.

```js
function migrarAV2(almacen = localStorage){
  const original = almacen.getItem(CLAVE);
  if(original === null) return false;

  const estado = JSON.parse(original);
  if(estado?.v !== 1 || !inventarioDeArchivo(estado)) throw new Error('El estado guardado no tiene el formato de SPARATI.');
  const anterior = JSON.stringify(estado);
  let nombre = '';
  try{ nombre = JSON.parse(almacen.getItem(CLAVE_YO))?.quien || ''; }catch(e){}

  completarEstado(estado);
  completarPacientes(estado, nombre);
  const migrado = JSON.stringify(estado);
  if(anterior === migrado) return false;

  const respaldo = 'sparati_inventario_respaldo_v1';
  if(almacen.getItem(respaldo) === null) almacen.setItem(respaldo, original);
  almacen.setItem(CLAVE, migrado);
  return true;
}
```

Pon la llamada a `migrarAV2()` inmediatamente antes de `cargar()` en el arranque y dentro de un `try`. Si falla, presenta una pantalla con «No se pudo abrir el inventario guardado» y una acción «Volver a intentar» que recargue. En ese caso, detén el resto del arranque. Se puede envolver el bloque de arranque en una función para salir con `return`. Si el espacio del teléfono alcanza para el respaldo y falla la segunda escritura, el estado original sigue en la clave real y ya existe su copia. Reintentar conserva esa copia. Si el JSON está dañado, conserva el valor y revisa el archivo que se guardó fuera del navegador.

## Verificar en el mismo origen y ruta de instalación

1. Antes de publicar, reproduce la actualización en un entorno de prueba con una copia de `codex/fixtures/v1-estado.json` en la clave de producción y una foto de prueba en `sparati_fotos`. Abre la versión 1 y luego actualiza a la 2 en el mismo origen y ruta del ensayo. Comprueba que siguen la identidad, las existencias 5, 4 y 1, la paciente de la venta, la foto y los registros borrados. Vuelve a abrir y verifica que `sparati_inventario_respaldo_v1` sea idéntico al texto inicial. `python3 codex/pruebas/correr.py` también ejecuta la función de este documento con almacenamiento simulado.
2. Comprueba en ese entorno un envío `.txt` de ida y vuelta entre versiones, un respaldo con fotos y su restauración. Tras instalar el service worker, recarga sin conexión y confirma que las cachés `spp-`, `cc-` y `di-` siguen disponibles.
3. En producción, actualicen con internet desde la app instalada y dejen que termine de cargar. Si aún aparece la versión 1 mientras cambia el service worker, cierren y abran de nuevo con internet. Comparen cantidades, movimientos recientes y fotos con los datos previos de cada celular. Después comprueben la recarga sin internet y generen un respaldo completo nuevo. En `PROGRESO.md` está la lista de recorridos de cada celular.

Si hace falta volver a la versión 1, guarda primero un respaldo completo de la versión 2 y un envío con las fotos de cada celular. Restaurar el texto inicial de `sparati_inventario_respaldo_v1` devuelve el estado al momento de la migración. Los movimientos posteriores tendrán que recuperarse del envío actual. Coordina esa restauración antes de sustituir el estado o volver a publicar los archivos de la versión 1.
