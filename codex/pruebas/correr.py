#!/usr/bin/env python3
"""Pruebas de SPARATI Prueba con Playwright. Los archivos se sirven por rutas, sin red."""

import argparse
import json
import mimetypes
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlsplit

from playwright.sync_api import expect, sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = 'https://sparati.test'
PREFIJO = '/inventario-sparati/'
APP = ORIGEN + PREFIJO + 'prueba/'
FECHA = datetime.fromisoformat('2026-11-27T07:24:00-05:00')
CLAVE = 'sparati_prueba_v2'
CLAVE_YO = 'sparati_prueba_yo'
FIXTURE_ESTADO = RAIZ / 'codex/fixtures/v1-estado.json'
FIXTURE_ENVIO = RAIZ / 'codex/fixtures/v1-envio.txt'
ESTADO_V1 = json.loads(FIXTURE_ESTADO.read_text(encoding='utf-8'))
CATALOGO = json.loads((RAIZ / 'codex/catalogo.json').read_text(encoding='utf-8'))['productos']


class Sitio:
    def __init__(self, navegador, *, color='light', trabajador=False):
        self.contexto = navegador.new_context(
            viewport={'width': 390, 'height': 844},
            color_scheme=color,
            locale='es-EC',
            timezone_id='America/Guayaquil',
            reduced_motion='reduce',
            service_workers='allow' if trabajador else 'block',
        )
        self.pagina = self.contexto.new_page()
        self.pagina.set_default_timeout(8000)
        self.errores = []
        self.faltante = None
        self.sin_red = False
        self.pagina.on('pageerror', lambda error: self.errores.append(str(error)))
        # Las solicitudes del service worker llegan al contexto en Chromium.
        self.contexto.route('**/*', self.responder)
        self.pagina.route('**/*', self.responder)
        self.pagina.clock.install(time=FECHA)

    def responder(self, ruta):
        url = urlsplit(ruta.request.url)
        if f'{url.scheme}://{url.netloc}' != ORIGEN or not url.path.startswith(PREFIJO):
            self.errores.append(f'Solicitud fuera del sitio: {ruta.request.url}')
            ruta.abort()
            return
        if self.sin_red:
            self.errores.append(f'El modo sin conexión intentó pedir {url.path}')
            ruta.abort('internetdisconnected')
            return
        relativo = unquote(url.path.removeprefix(PREFIJO))
        archivo = (RAIZ / relativo).resolve()
        if archivo.is_dir():
            archivo = archivo / 'index.html'
        if relativo == self.faltante:
            ruta.fulfill(status=404, body='Archivo omitido para probar el reintento')
        elif archivo.is_relative_to(RAIZ) and archivo.is_file():
            tipo = {'.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}.get(archivo.suffix)
            ruta.fulfill(path=archivo, content_type=tipo or mimetypes.guess_type(archivo)[0])
        else:
            self.errores.append(f'Archivo no encontrado: {url.path}')
            ruta.fulfill(status=404)

    def abrir(self, *, estado=None, quien='Jonathan', datos_extra=None):
        datos = dict(datos_extra or {})
        if quien:
            datos[CLAVE_YO] = {'quien': quien}
        if estado is not None:
            datos[CLAVE] = estado
        self.pagina.add_init_script(f"""
            if (location.origin === {json.dumps(ORIGEN)} && !sessionStorage.getItem('prueba_iniciada')) {{
              for (const [k, v] of Object.entries({json.dumps(datos)})) localStorage.setItem(k, JSON.stringify(v));
              sessionStorage.setItem('prueba_iniciada', '1');
            }}
        """)
        self.pagina.goto(APP)
        expect(self.pagina.locator('.franja-prueba')).to_have_text('Versión de prueba · los datos no son los reales')
        return self.pagina

    def cerrar(self):
        try:
            assert not self.errores, '\n'.join(self.errores)
        finally:
            self.contexto.close()


def datos_guardados(pagina):
    return pagina.evaluate('(clave) => JSON.parse(localStorage.getItem(clave))', CLAVE)


def inventario(pagina, tipo):
    pagina.locator(f'.nav button[data-tab="{tipo}"]').click()


def abrir_ajustes(pagina):
    pagina.get_by_role('button', name='Ajustes', exact=True).click()
    return pagina.locator('[data-tipo=ajustes]')


def cerrar_hoja(pagina):
    hoja = pagina.locator('#capas > .hoja').last
    pagina.evaluate('history.back()')
    expect(hoja.get_by_role('button', name='Cerrar')).to_have_count(0)


def prueba_estado_v1(navegador):
    sitio = Sitio(navegador)
    try:
        pagina = sitio.abrir(estado=ESTADO_V1)
        assert pagina.evaluate("['p1', 'p2', 'p3'].map(stockDe)") == [5, 4, 1]
        assert pagina.evaluate("productos().map(p => p.id).sort()") == ['p1', 'p2', 'p3']
        assert pagina.evaluate("E.movs.find(m => m.id === 'm9').borrado")

        inventario(pagina, 'venta')
        expect(pagina.locator('[data-act=verProd][data-id=p1] .stock .q')).to_have_text('5')
        expect(pagina.locator('[data-act=verProd][data-id=p2] .stock .q')).to_have_text('4')
        pagina.locator('#qProd').fill('AZELAC')
        expect(pagina.locator('#listaProd .prod')).to_have_count(1)
        inventario(pagina, 'uso')
        expect(pagina.locator('[data-act=verProd][data-id=p3] .stock .q')).to_have_text('1')
        expect(pagina.locator('[data-act=verProd][data-id=p4]')).to_have_count(0)
        pagina.locator('[data-act=verProd][data-id=p3]').click()
        expect(pagina.locator('.det-stock .q')).to_have_text('1')
        cerrar_hoja(pagina)

        inventario(pagina, 'ventas')
        pagina.locator('#qVentas').fill('Maria Jose')
        venta = pagina.locator('.venta[data-id=v1]')
        expect(venta).to_contain_text('María José Andrade')
        expect(venta).to_contain_text('Transferencia')
        expect(venta).to_contain_text('$ 42,00')
        venta.click()
        expect(pagina.get_by_role('button', name='Transferencia', exact=True)).to_have_class('chip on')
        cerrar_hoja(pagina)
        assert datos_guardados(pagina) == ESTADO_V1
    finally:
        sitio.cerrar()


def prueba_edicion(navegador):
    sitio = Sitio(navegador)
    try:
        pagina = sitio.abrir(estado=ESTADO_V1)
        inventario(pagina, 'venta')
        pagina.locator('[data-act=vender][data-id=p1]').click()
        pagina.get_by_label('Paciente', exact=True).fill('Rosa Cauce')
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(pagina.locator('#toast')).to_contain_text('Venta guardada')
        expect(pagina.locator('[data-act=verProd][data-id=p1] .stock .q')).to_have_text('4')
        estado = datos_guardados(pagina)
        venta = estado['ventas'][-1]
        assert venta['pac'] == 'Rosa Cauce' and len(venta['items']) == 1
        assert any(p['nombre'] == 'Rosa Cauce' for p in estado['pacientes'])
        assert any(m['venta'] == venta['id'] and m['cant'] == -1 for m in estado['movs'])
    finally:
        sitio.cerrar()


def prueba_envio_v1(navegador):
    sitio = Sitio(navegador)
    try:
        pagina = sitio.abrir(estado={
            **ESTADO_V1,
            'productos': [{**ESTADO_V1['productos'][0], 'codigo': 'SP-ABCDE', 'max': 6,
                           'mod': ESTADO_V1['productos'][0]['mod'] - 1}],
            'movs': [], 'ventas': [], 'cats': {'venta': [], 'uso': []},
        })
        ajustes = abrir_ajustes(pagina)
        entrada = pagina.locator('#inArchivo')
        with pagina.expect_file_chooser() as selector:
            ajustes.get_by_role('button', name='Recibir', exact=False).click()
        selector.value.set_files(FIXTURE_ENVIO)
        expect(pagina.locator('#toast')).to_contain_text('Recibido de Elba')
        primero = datos_guardados(pagina)
        assert primero['sync']['recibo'] > 0 and primero['sync']['de'] == 'Elba'
        archivo = json.loads(FIXTURE_ENVIO.read_text(encoding='utf-8'))['datos']
        for campo in ('movs', 'ventas', 'cats'):
            assert primero[campo] == archivo[campo], campo
        assert primero['productos'][0] == {**archivo['productos'][0], 'codigo': 'SP-ABCDE', 'max': 6}
        assert primero['productos'][1:] == archivo['productos'][1:]
        assert [p['nombre'] for p in primero['pacientes']] == ['María José Andrade']
        assert primero['pacientes'][0]['tel'] == archivo['ventas'][0]['tel']
        assert pagina.evaluate("['p1', 'p2', 'p3'].map(stockDe)") == [5, 4, 1]

        pagina.clock.fast_forward(5000)
        entrada.set_input_files([])
        entrada.set_input_files(FIXTURE_ENVIO)
        expect(pagina.locator('#toast')).to_contain_text('no hubo cambios')
        assert datos_guardados(pagina) == primero
    finally:
        sitio.cerrar()


def verificar_ejemplo(pagina):
    estado = datos_guardados(pagina)
    productos = [p for p in estado['productos'] if p['id'].startswith('ejemplo-')]
    ventas = [v for v in estado['ventas'] if v['id'].startswith('ejemplo-')]
    movs = [m for m in estado['movs'] if m['id'].startswith('ejemplo-')]
    assert len(productos) == len(CATALOGO) == 104
    stocks = pagina.evaluate('Object.fromEntries(E.productos.map(p => [p.id, stockDe(p.id)]))')
    for producto, original in zip(productos, CATALOGO, strict=True):
        assert stocks[producto['id']] == original['cantidad'], original['nombre']
        assert producto['precio'] == original.get('precioEjemplo', 0), original['nombre']
        assert bool(producto['foto']) == bool(original.get('foto')), original['nombre']
        for campo in ('nombre', 'unidad', 'cat', 'marca', 'tipo'):
            assert producto[campo] == original[campo]
    assert sorted(pagina.evaluate('FDB.claves()')) == sorted(p['foto'] for p in productos if p['foto'])
    assert len(ventas) == 25
    assert len({v['pac'] for v in ventas}) == 8
    assert {v['pac'] for v in ventas} <= {p['nombre'] for p in estado['pacientes']}
    assert all(not v['tel'] for v in ventas)
    assert all(0 <= (FECHA.date() - datetime.fromisoformat(v['fecha']).date()).days < 60 for v in ventas)
    assert {v['pago'] for v in ventas} == {'efectivo', 'transferencia', 'tarjeta'}
    for venta in ventas:
        ligados = {m['prod']: m for m in movs if m['venta'] == venta['id']}
        assert len(ligados) == len(venta['items'])
        for item in venta['items']:
            m = ligados[item['prod']]
            assert m['tipo'] == 'venta' and m['cant'] == -item['cant'] and m['fecha'] == venta['fecha']
    aperturas = [m for m in movs if m['tipo'] == 'apertura']
    assert len(aperturas) == 4 and all(m['cant'] == 0 for m in aperturas)
    assert any(m['tipo'] == 'uso' and m['cant'] < 0 and m['trat'] for m in movs)
    frasco = next(p for p in productos if p['id'] == aperturas[0]['prod'])
    assert frasco['abierto'] == max(m['fecha'] for m in aperturas) and frasco['pao'] > 0
    assert sum(m['motivo'] == 'terminado' for m in movs if m['prod'] == frasco['id']) == 3
    return estado


def prueba_ejemplo(navegador):
    sitio = Sitio(navegador)
    try:
        real_yo = {'quien': 'Elba'}
        pagina = sitio.abrir(quien=None, datos_extra={
            'sparati_inventario_v1': ESTADO_V1, 'sparati_inventario_yo': real_yo,
        })
        expect(pagina.get_by_role('heading', name='¿Quién usa este celular?')).to_be_visible()
        pagina.get_by_role('button', name='Jonathan', exact=True).click()
        expect(pagina.locator('[data-tipo=quien]')).to_have_count(0)
        pagina.wait_for_function('!history.state?.capa')
        assert pagina.evaluate('E.productos.length') == 0
        pagina.evaluate("""() => new Promise((ok, mal) => {
          const r = indexedDB.open('sparati_fotos', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('fotos').put('foto real', 'ejemplo-foto1');
          r.onsuccess = () => { r.result.close(); ok(); };
          r.onerror = () => mal(r.error);
        })""")

        # Una foto que falla permite reintentar sin aplicar ningún registro ni foto.
        ajustes = abrir_ajustes(pagina)
        boton = ajustes.get_by_role('button', name='Cargar datos de ejemplo')
        sitio.faltante = CATALOGO[0]['foto']
        boton.click()
        expect(pagina.locator('#toast')).to_have_text('No se pudieron cargar los datos de ejemplo. Vuelve a intentar.')
        expect(boton).to_be_enabled()
        assert datos_guardados(pagina) is None
        assert pagina.evaluate('FDB.claves()') == []
        sitio.faltante = None

        boton.click()
        expect(pagina.locator('#toast')).to_have_text('Datos de ejemplo cargados')
        expect(boton).to_be_disabled()
        estado = verificar_ejemplo(pagina)
        assert len(estado['pacientes']) == 8
        assert pagina.evaluate('''() => new Promise((ok, mal) => {
          const r = indexedDB.open('sparati_fotos', 1);
          r.onsuccess = () => {
            const q = r.result.transaction('fotos').objectStore('fotos').get('ejemplo-foto1');
            q.onsuccess = () => { r.result.close(); ok(q.result); };
            q.onerror = () => mal(q.error);
          };
          r.onerror = () => mal(r.error);
        })''') == 'foto real'
        assert pagina.evaluate('JSON.parse(localStorage.getItem("sparati_inventario_v1"))') == ESTADO_V1
        assert pagina.evaluate('JSON.parse(localStorage.getItem("sparati_inventario_yo"))') == real_yo
        assert pagina.evaluate('JSON.parse(localStorage.getItem(CLAVE_YO)).quien') == 'Jonathan'

        cerrar_hoja(pagina)
        inventario(pagina, 'venta')
        pagina.locator('#qProd').fill('peptidos efecto botox')
        pagina.wait_for_function("document.querySelector('#listaProd img')?.naturalWidth > 0")
        expect(pagina.locator('#listaProd .m')).to_contain_text('$ 18,00')
        pagina.reload()
        assert datos_guardados(pagina) == estado
        expect(abrir_ajustes(pagina).get_by_role('button', name='Cargar datos de ejemplo')).to_be_disabled()
    finally:
        sitio.cerrar()


def prueba_sin_conexion(navegador):
    sitio = Sitio(navegador, trabajador=True)
    try:
        # Una pantalla simple del mismo origen instala cachés que pertenecen a otras apps.
        pagina = sitio.pagina
        preparacion = ORIGEN + PREFIJO + 'preparacion'
        pagina.route(preparacion, lambda ruta: ruta.fulfill(content_type='text/html', body='<p>Preparación</p>'))
        pagina.goto(preparacion)
        pagina.evaluate("""Promise.all(['sp-v1', 'cc-v1', 'di-v1', 'spp-anterior'].map(k => caches.open(k)))""")
        pagina = sitio.abrir(estado=ESTADO_V1)
        pagina.wait_for_function('navigator.serviceWorker.controller !== null')
        assert pagina.evaluate('navigator.serviceWorker.ready.then(r => r.scope)') == APP
        caches = pagina.evaluate('caches.keys()')
        assert set(caches) >= {'sp-v1', 'cc-v1', 'di-v1'}
        assert 'spp-anterior' not in caches
        assert sum(k.startswith('spp-') for k in caches) == 1
        manifiesto = pagina.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
        assert manifiesto['name'] == manifiesto['short_name'] == 'SPARATI Prueba'
        assert manifiesto['start_url'] == manifiesto['scope'] == './'
        assert manifiesto['theme_color'] == '#C2207F'
        iconos = [i['src'] for i in manifiesto['icons']] + ['icono-180.png']
        assert pagina.evaluate("""async rutas => {
          const imgs = await Promise.all(rutas.map(async ruta => {
            const img = new Image();
            img.src = ruta;
            await img.decode();
            return img;
          }));
          return imgs.map(img => img.naturalWidth);
        }""", iconos) == [192, 512, 180]

        sitio.sin_red = True
        sitio.contexto.set_offline(True)
        pagina.reload()
        expect(pagina.get_by_role('img', name='SPARATI')).to_be_visible()
        ajustar = abrir_ajustes(pagina)
        ajustar.get_by_role('button', name='Cargar datos de ejemplo').click()
        expect(pagina.locator('#toast')).to_have_text('Datos de ejemplo cargados')
        estado = verificar_ejemplo(pagina)
        for campo in ('productos', 'ventas', 'movs'):
            assert estado[campo][:len(ESTADO_V1[campo])] == ESTADO_V1[campo]
        expect(pagina.locator('.franja-prueba')).to_be_visible()
    finally:
        sitio.cerrar()


def capturar(navegador):
    carpeta = RAIZ / 'codex/capturas'

    def guardar(sitio, pantalla, sufijo):
        pagina = sitio.pagina
        pagina.evaluate('document.fonts.ready')
        pagina.evaluate("""async () => {
          await Promise.all(Array.from(document.images).filter(i => i.src).map(i => i.decode().catch(() => {})));
        }""")
        pagina.screenshot(path=carpeta / f'T0-{pantalla}-{sufijo}.png', animations='disabled')

    for color, sufijo in [('light', 'claro'), ('dark', 'oscuro')]:
        sitio = Sitio(navegador, color=color)
        try:
            pagina = sitio.abrir(quien=None)
            expect(pagina.get_by_role('heading', name='¿Quién usa este celular?')).to_be_visible()
            guardar(sitio, 'bienvenida', sufijo)
            pagina.get_by_role('button', name='Jonathan', exact=True).click()
            pagina.wait_for_function('!history.state?.capa')
            ajustes = abrir_ajustes(pagina)
            guardar(sitio, 'ajustes', sufijo)
            ajustes.get_by_role('button', name='Cargar datos de ejemplo').click()
            expect(pagina.locator('#toast')).to_have_text('Datos de ejemplo cargados')
            pagina.clock.fast_forward(5000)
            cerrar_hoja(pagina)
            guardar(sitio, 'inicio', sufijo)
            inventario(pagina, 'venta')
            guardar(sitio, 'inventario', sufijo)
            inventario(pagina, 'uso')
            pagina.locator('#qProd').fill("AHA's Peel")
            pagina.locator('#listaProd [data-act=verProd]').first.click()
            guardar(sitio, 'cabina', sufijo)
            cerrar_hoja(pagina)
            inventario(pagina, 'ventas')
            pagina.locator('.venta').first.click()
            guardar(sitio, 'venta', sufijo)
        finally:
            sitio.cerrar()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capturas', action='store_true', help='guardar capturas en modo claro y oscuro')
    args = parser.parse_args()
    with sync_playwright() as p:
        for motor in (p.chromium, p.webkit):
            if motor.name == 'webkit' and not Path(motor.executable_path).is_file():
                print('WebKit no está instalado')
                continue
            with motor.launch() as navegador:
                pruebas = [prueba_estado_v1, prueba_edicion, prueba_envio_v1, prueba_ejemplo]
                if motor.name == 'chromium':
                    pruebas.append(prueba_sin_conexion)
                for prueba in pruebas:
                    prueba(navegador)
                    print(f'{motor.name}: {prueba.__name__} pasó')
                if args.capturas and motor.name == 'chromium':
                    capturar(navegador)
                    print('Capturas en codex/capturas/')


if __name__ == '__main__':
    main()
