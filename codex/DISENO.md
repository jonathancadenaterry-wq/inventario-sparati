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
| Bienvenida (primera vez) | `Bienvenida.png` |

## Identidad

Debe sentirse elegante, cálida y de spa, sin dejar de ser práctica: tarjetas blancas sobre un fondo casi blanco, mucho aire y esquinas redondeadas. Los colores salen del **logotipo de SPARATI** (`codex/marca/`): **magenta** `#C2207F` como color principal y **verde menta** `#87BEA6` como acento. Para textos en verde usa el tono oscuro `#3E7F66`, porque el menta claro no tiene contraste suficiente. No uses degradados llamativos, bordes de color a la izquierda de las tarjetas ni emojis como íconos.

## Logotipo

Los archivos están en `codex/marca/`, todos con fondo transparente salvo los íconos:

- `logo-completo.png`: emblema con la palabra SPARATI.
- `emblema.png`: solo el círculo con la figura.
- `logo-texto.png`: solo la palabra SPARATI.
- `icono-512.png`, `icono-192.png`, `icono-180.png` (Apple) e `icono-1024.png`: el emblema sobre blanco, con margen seguro para ícono enmascarable.

Dónde va el logo:

- en el ícono de la app;
- en la pantalla de bienvenida (`Bienvenida.png`);
- en la cabecera de Inicio: emblema de 58 px más la palabra en 13 px de alto;
- en el encabezado del PDF de reportes y en las etiquetas QR;
- en el comprobante de WhatsApp solo va el nombre «SPARATI», en texto.

Guarda versiones reducidas en `prueba/` (por ejemplo, 600 px de ancho) para que la app cargue rápido. Nunca deformes el logo ni le cambies los colores.

## Tokens (variables CSS)

```css
:root{
  --fondo:#F9F6F7; --superficie:#FFFFFF; --tinta:#2A1F27; --tenue:#6B6169; --linea:#ECE4E0; --hundido:#EFE7E3;
  --marca:#C2207F; --marca-suave:#FBE7F2; --marca-hover:#9C1966;
  --menta:#87BEA6; --menta-texto:#3E7F66; --menta-suave:#E7F3ED; --menta-claro:#BFE3D2;
  --bien:#2F7A57; --bien-suave:#E3F2EA;
  --atencion:#9A5A10; --atencion-suave:#FBF0DF;
  --mal:#A8364A; --mal-suave:#F9E5E8;
  --radio-tarjeta:20px; --radio-control:16px; --radio-peq:12px;
  --sombra:0 1px 2px rgba(42,31,39,.04), 0 6px 18px rgba(42,31,39,.06);
  --sombra-marca:0 8px 20px rgba(194,32,127,.28);
  --serif:'Playfair Display', Georgia, serif; --sans:'Inter', system-ui, sans-serif;
}
```

**Modo oscuro**, con `prefers-color-scheme` o elegido en Ajustes:
- fondo `#17121A`, superficie `#221B25`, tinta `#F3ECF0`, tenue `#B9AAB4`, línea `#342A36` y hundido `#2B232E`.
- marca `#E77DB8` como texto y acento; los botones llenos siguen en `#C2207F` con texto blanco. El logo se ve bien sobre fondo oscuro sin cambios.
- en los colores suaves de estado, usa los mismos tonos con 18 % de opacidad sobre la superficie.

## Tipografía

- **Playfair Display** (600), la letra que más se parece a la del logo, para títulos de pantalla (28–30 px), títulos de sección (18–19 px) y cifras grandes (20–44 px), siempre con `font-variant-numeric: lining-nums` para que los números se vean parejos.
- **Inter** para todo lo demás: 15 px para el texto normal, 13 px para lo secundario y 11–12 px para etiquetas.
- Las fuentes van guardadas en `prueba/fuentes/` (woff2) para que funcionen sin internet. Si no puedes descargarlas, usa Georgia y system-ui y anótalo en `DECISIONES.md`.

## Componentes

- **Barra inferior** (78 px, blanca y translúcida): Inicio, Inventario, **Vender** (botón circular magenta de 60 px que sobresale 26 px, con sombra de marca y un anillo del color del fondo), Pacientes y Reportes. La pestaña activa va en magenta y con un trazo más grueso.
- **Buscador**: campo de 50 px con ícono de lupa y, a su derecha, el botón cuadrado magenta de 50 px para **escanear**. Aparece en Inicio, Inventario y Nueva venta.
- **Chips de filtro**: 36 px de alto. El activo es magenta con texto blanco y los demás blancos con borde. Pueden llevar un punto de color de estado.
- **Segmentado**: fondo hundido y la opción activa en una píldora blanca con sombra. Se usa en Para vender/Uso en spa, en las formas de pago y en Ventas/Cabina/Inventario.
- **Píldora de stock**:
  - rojo «Queda 1» o «Agotado» cuando el stock está en el mínimo o por debajo;
  - ámbar cuando el producto vence pronto;
  - verde con el número en los demás casos.
- **Fila de lista**: foto de 54 px con radio 12, nombre en 15/600, detalle en 13 tenue y la píldora a la derecha. Toda la fila es tocable.
- **Hoja inferior**: radio superior de 26, tirador, sombra hacia arriba. El carrito de la venta queda **siempre visible** mientras se eligen productos.
- **Aviso con deshacer**: un toast abajo, sobre la barra, con el botón «Deshacer» durante 5 segundos después de borrar o registrar algo.
- **Ícono sin foto**: si un producto no tiene foto, muestra un cuadro `--menta-suave` con las iniciales del producto en Playfair Display color `--menta-texto`.
- **Íconos**: SVG de trazo, `stroke-width` 1.8, puntas redondeadas y 22–24 px. Usa exactamente los trazos de `codex/diseno/*.html` para inicio, caja, bolsa, personas, gráfico, escanear, lupa, campana, volver, más, menos, entrada, gota, conteo, chat, calendario, linterna, cerrar, editar, pdf, sincronizar, check, etiqueta y ajustes.

## Movimiento

- Al cambiar de pantalla: desliza 16 px y aparece en 180 ms. Las hojas suben en 220 ms.
- Al agregar un producto al carrito, la insignia rebota y el celular vibra 10 ms con `navigator.vibrate`.
- Con `prefers-reduced-motion`, todo cambia sin animación.
