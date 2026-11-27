# Diseño de la versión 2

Las pantallas de referencia están en `codex/diseno/`. Cada una tiene su `.html`, para leer las medidas exactas en los estilos, y su `.png`, para ver cómo se ve. Las fotos de los mockups están en `codex/diseno/fotos/`. El diseño editable vive en Claude Design (lo mantiene Claude); si cambia, se actualizan estos archivos y se avisa en `FEEDBACK.md`.

| Pantalla | Archivo |
|---|---|
| Inicio | `Main.png` |
| Nueva venta | `Vender.png` |
| Escáner | `Escaner.png` |
| Inventario | `Inventario.png` |
| Producto para vender | `Producto.png` |
| Producto de cabina | `Cabina.png` |
| Paciente | `Paciente.png` |
| Reportes | `Reportes.png` |

## Identidad

Debe sentirse elegante, cálida y de spa, sin dejar de ser práctica: tarjetas blancas sobre un fondo marfil, mucho aire y esquinas redondeadas. El color de la marca es el ciruela de SPARATI, el mismo del ícono actual, y el dorado suave es el acento. No uses degradados llamativos, bordes de color a la izquierda de las tarjetas ni emojis como íconos.

## Tokens (variables CSS)

```css
:root{
  --fondo:#F8F4F1; --superficie:#FFFFFF; --tinta:#2A1F27; --tenue:#6E6169; --linea:#ECE4E0; --hundido:#EFE7E3;
  --marca:#6E3460; --marca-suave:#F3E8EF; --marca-hover:#4F2244;
  --oro-texto:#8A6235; --oro-suave:#F6EDE3; --oro-claro:#E9C9A3;
  --bien:#3F7A55; --bien-suave:#E6F1EA;
  --atencion:#9A5A10; --atencion-suave:#FBF0DF;
  --mal:#A8364A; --mal-suave:#F9E5E8;
  --radio-tarjeta:20px; --radio-control:16px; --radio-peq:12px;
  --sombra:0 1px 2px rgba(42,31,39,.04), 0 6px 18px rgba(42,31,39,.06);
  --sombra-marca:0 8px 20px rgba(110,52,96,.28);
  --serif:'Lora', Georgia, serif; --sans:'Inter', system-ui, sans-serif;
}
```

**Modo oscuro**, con `prefers-color-scheme` o elegido en Ajustes:
- fondo `#17121A`, superficie `#221B25`, tinta `#F3ECF0`, tenue `#B9AAB4`, línea `#342A36` y hundido `#2B232E`.
- marca `#C98AB8` como texto y acento; los botones llenos siguen en `#6E3460` con texto blanco.
- en los colores suaves de estado, usa los mismos tonos con 18 % de opacidad sobre la superficie.

## Tipografía

- **Lora** (600) para títulos de pantalla (28–30 px), títulos de sección (18–19 px) y cifras grandes (20–44 px).
- **Inter** para todo lo demás: 15 px para el texto normal, 13 px para lo secundario y 11–12 px para etiquetas.
- Las fuentes van guardadas en `prueba/fuentes/` (woff2) para que funcionen sin internet. Si no puedes descargarlas, usa Georgia y system-ui y anótalo en `DECISIONES.md`.

## Componentes

- **Barra inferior** (78 px, blanca y translúcida): Inicio, Inventario, **Vender** (botón circular ciruela de 60 px que sobresale 26 px, con sombra de marca y un anillo del color del fondo), Pacientes y Reportes. La pestaña activa va en ciruela y con un trazo más grueso.
- **Buscador**: campo de 50 px con ícono de lupa y, a su derecha, el botón cuadrado ciruela de 50 px para **escanear**. Aparece en Inicio, Inventario y Nueva venta.
- **Chips de filtro**: 36 px de alto. El activo es ciruela con texto blanco y los demás blancos con borde. Pueden llevar un punto de color de estado.
- **Segmentado**: fondo hundido y la opción activa en una píldora blanca con sombra. Se usa en Para vender/Uso en spa, en las formas de pago y en Ventas/Cabina/Inventario.
- **Píldora de stock**:
  - rojo «Queda 1» o «Agotado» cuando el stock está en el mínimo o por debajo;
  - ámbar cuando el producto vence pronto;
  - verde con el número en los demás casos.
- **Fila de lista**: foto de 54 px con radio 12, nombre en 15/600, detalle en 13 tenue y la píldora a la derecha. Toda la fila es tocable.
- **Hoja inferior**: radio superior de 26, tirador, sombra hacia arriba. El carrito de la venta queda **siempre visible** mientras se eligen productos.
- **Aviso con deshacer**: un toast abajo, sobre la barra, con el botón «Deshacer» durante 5 segundos después de borrar o registrar algo.
- **Ícono sin foto**: si un producto no tiene foto, muestra un cuadro `--oro-suave` con las iniciales del producto en Lora color `--oro-texto`.
- **Íconos**: SVG de trazo, `stroke-width` 1.8, puntas redondeadas y 22–24 px. Usa exactamente los trazos de `codex/diseno/*.html` para inicio, caja, bolsa, personas, gráfico, escanear, lupa, campana, volver, más, menos, entrada, gota, conteo, chat, calendario, linterna, cerrar, editar, pdf, sincronizar, check, etiqueta y ajustes.

## Movimiento

- Al cambiar de pantalla: desliza 16 px y aparece en 180 ms. Las hojas suben en 220 ms.
- Al agregar un producto al carrito, la insignia rebota y el celular vibra 10 ms con `navigator.vibrate`.
- Con `prefers-reduced-motion`, todo cambia sin animación.
