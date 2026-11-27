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
    def __init__(self, navegador, *, color='light', trabajador=False, perfil=None):
        dispositivo = {'viewport': {'width': 390, 'height': 844}}
        if perfil:
            dispositivo = {k: v for k, v in perfil.items() if k != 'default_browser_type'}
        self.contexto = navegador.new_context(
            **dispositivo,
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
    if tipo in ('venta', 'uso'):
        if not pagina.get_by_role('heading', name='Inventario', exact=True).is_visible():
            pagina.locator('.nav [data-tab=inventario]').click()
        pagina.locator(f'.seg [data-tab="{tipo}"]').click()
    else:
        pagina.locator(f'.nav [data-tab="{tipo}"]').click()


def abrir_ajustes(pagina):
    if not pagina.get_by_role('button', name='Ajustes', exact=True).is_visible():
        pagina.locator('.nav [data-tab=inicio]').click()
    pagina.get_by_role('button', name='Ajustes', exact=True).click()
    return pagina.locator('[data-tipo=ajustes]')


def cerrar_hoja(pagina):
    capas = pagina.locator('#capas > *')
    anterior = capas.count()
    pagina.evaluate('history.back()')
    expect(capas).to_have_count(anterior - 1)


def prueba_estado_v1(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        pagina = sitio.abrir(estado=ESTADO_V1)
        assert pagina.evaluate("['p1', 'p2', 'p3'].map(stockDe)") == [5, 4, 1]
        assert pagina.evaluate("productos().map(p => p.id).sort()") == ['p1', 'p2', 'p3']
        assert pagina.evaluate("E.movs.find(m => m.id === 'm9').borrado")

        inventario(pagina, 'venta')
        expect(pagina.locator('[data-act=verProd][data-id=p1] .stock')).to_have_text('5')
        expect(pagina.locator('[data-act=verProd][data-id=p2] .stock')).to_have_text('4')
        pagina.locator('#qProd').fill('AZELAC')
        expect(pagina.locator('#listaProd .fila-lista')).to_have_count(1)
        inventario(pagina, 'uso')
        expect(pagina.locator('[data-act=verProd][data-id=p3] .stock')).to_have_text('Queda 1')
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
        expect(pagina.get_by_role('button', name='Transferencia', exact=True)).to_have_attribute('aria-pressed', 'true')
        cerrar_hoja(pagina)
        assert datos_guardados(pagina) == ESTADO_V1
    finally:
        sitio.cerrar()


def prueba_edicion(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        pagina = sitio.abrir(estado=ESTADO_V1)
        inventario(pagina, 'venta')
        pagina.locator('#listaProd [data-id=p1]').click()
        pagina.get_by_role('dialog').get_by_role('button', name='Vender', exact=True).click()
        pagina.get_by_label('Paciente', exact=True).fill('Rosa Cauce')
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(pagina.locator('#toast')).to_contain_text('Venta guardada')
        expect(pagina.locator('.det-stock .q')).to_have_text('4')
        cerrar_hoja(pagina)
        expect(pagina.locator('[data-act=verProd][data-id=p1] .stock')).to_have_text('4')
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
        cerrar_hoja(pagina)
        inventario(pagina, 'venta')
        pagina.reload()
        expect(pagina.get_by_role('button', name='Inventario', exact=True)).to_have_attribute('aria-current', 'page')
        expect(pagina.locator('.boton-escanear')).to_be_visible()
        assert pagina.locator('.boton-escanear').bounding_box()['width'] == 50
    finally:
        sitio.cerrar()


def prueba_navegacion(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        pagina = sitio.abrir(estado=ESTADO_V1)
        barra = pagina.get_by_role('navigation', name='Principal')
        assert [b.inner_text().splitlines()[0] for b in barra.get_by_role('button').all()] == [
            'Inicio', 'Inventario', 'Vender', 'Pacientes', 'Reportes',
        ]
        en_inicio = barra.get_by_role('button', name='Inicio')
        inventario_nav = barra.get_by_role('button', name='Inventario')
        expect(en_inicio).to_have_attribute('aria-current', 'page')
        if perfil:
            inventario_nav.tap()
        else:
            inventario_nav.click()
        expect(pagina).to_have_url(APP + '#inventario')
        inventario(pagina, 'uso')
        expect(pagina).to_have_url(APP + '#uso-en-spa')
        producto = pagina.locator('#listaProd [data-id=p3]')
        producto.click()
        expect(pagina.locator('#app')).to_have_attribute('inert', '')
        pagina.get_by_role('button', name='Otra cantidad').click()
        cerrar_hoja(pagina)
        expect(pagina.get_by_role('heading', name='Mascarilla hidroplástica Pure Radiance · 280 g')).to_be_visible()
        pagina.get_by_role('button', name='Volver').click()
        expect(producto).to_be_visible()
        expect(pagina.locator('#capas > *')).to_have_count(0)
        pagina.evaluate('history.back()')
        expect(pagina).to_have_url(APP + '#inventario')
        expect(pagina.locator('.seg [data-tab=venta]')).to_have_attribute('aria-pressed', 'true')
        pagina.evaluate('history.forward()')
        expect(pagina).to_have_url(APP + '#uso-en-spa')
        expect(pagina.locator('.seg [data-tab=uso]')).to_have_attribute('aria-pressed', 'true')
        pagina.reload()
        expect(inventario_nav).to_have_attribute('aria-current', 'page')
        expect(producto).to_be_visible()

        barra.get_by_role('button', name='Pacientes').click()
        pagina.get_by_role('searchbox', name='Buscar paciente').fill('maria jose')
        pagina.get_by_role('button', name='María José Andrade', exact=False).click()
        cerrar_hoja(pagina)
        expect(pagina.get_by_role('searchbox', name='Buscar paciente')).to_have_value('maria jose')
        barra.get_by_role('button', name='Reportes').click()
        expect(pagina.get_by_role('heading', name='Reportes')).to_be_visible()
        barra.get_by_role('button', name='Vender').click()
        pagina.get_by_label('Paciente', exact=True).fill('Nombre sin guardar')
        pagina.keyboard.press('Escape')
        expect(pagina.locator('#capas > *')).to_have_count(0)
        expect(pagina.get_by_role('heading', name='Reportes')).to_be_visible()
        barra.get_by_role('button', name='Vender').click()
        expect(pagina.get_by_label('Paciente', exact=True)).to_have_value('')
    finally:
        sitio.cerrar()


def prueba_buscadores_y_filtros(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': 'SP-ABCDE'} if p['id'] == 'p1' else
            {**p, 'vence': '2026-12-02'} if p['id'] == 'p2' else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado)
        buscador = pagina.get_by_role('searchbox', name='Buscar producto o paciente')
        buscador.fill('maria jose')
        expect(pagina.locator('#resultadosInicio [data-act=verPaciente]')).to_contain_text('María José Andrade')
        buscador.fill('mascarilla hidroplastica')
        expect(pagina.locator('#resultadosInicio [data-act=verProd]')).to_contain_text('Pure Radiance')
        buscador.fill('')
        inventario(pagina, 'venta')
        filas = pagina.locator('#listaProd .fila-lista')
        expect(filas).to_have_count(2)
        expect(filas.locator('.stock.warn')).to_have_text('4')
        expect(filas.locator('.stock.ok')).to_have_text('5')
        expect(pagina.locator('#listaProd h2')).to_have_text('Professional Spa')
        filtro = pagina.get_by_role('button', name='Vencen pronto')
        filtro.click()
        expect(filtro).to_have_attribute('aria-pressed', 'true')
        expect(filas).to_have_count(1)
        pagina.get_by_role('button', name='Protector solar', exact=True).click()
        expect(filas).to_have_count(1)
        expect(filas.first).to_contain_text('Sun Screen')
        pagina.get_by_role('button', name='Todos', exact=True).click()
        expect(filas).to_have_count(2)

        pagina.get_by_role('button', name='Escanear').click()
        campo = pagina.get_by_label('Escribir el código a mano')
        campo.fill('sin código')
        pagina.get_by_role('button', name='Buscar código').click()
        expect(pagina.locator('#errorCodigo')).to_contain_text('No encontré')
        campo.fill(' sp-abcde ')
        if perfil:
            pagina.get_by_role('button', name='Buscar código').tap()
        else:
            campo.press('Enter')
        expect(pagina.locator('#capas > *')).to_have_count(1)
        expect(pagina.get_by_role('heading', name='Sun Screen Clear SPF 50+ · 60 g')).to_be_visible()
        cerrar_hoja(pagina)
        expect(pagina.get_by_role('heading', name='Inventario')).to_be_visible()
    finally:
        sitio.cerrar()


def prueba_carrito_y_deshacer(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': '12345670'} if p['id'] == 'p1' else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado)
        pagina.get_by_role('navigation').get_by_role('button', name='Vender').click()
        venta = pagina.get_by_role('dialog', name='Nueva venta')
        resumen = pagina.locator('.resumen-venta')
        expect(resumen).to_have_attribute('aria-expanded', 'false')
        pagina.get_by_label('Paciente', exact=True).fill('Rosa Cauce')
        venta.get_by_role('button', name='Escanear').click()
        pagina.get_by_label('Escribir el código a mano').fill('12345670')
        pagina.get_by_role('button', name='Buscar código').click()
        expect(resumen).to_have_text('Venta · 1 producto')
        expect(pagina.locator('#vTotal')).to_have_text('$ 18,00')
        pagina.locator('#selProd [data-id=p2]').click()
        expect(resumen).to_have_text('Venta · 2 productos')
        resumen.click()
        expect(resumen).to_have_attribute('aria-expanded', 'true')
        primero = pagina.locator('.item-venta').first
        primero.get_by_role('button', name='Sumar uno').click()
        expect(primero.get_by_label('Cantidad', exact=True)).to_have_value('2')
        expect(pagina.locator('#vTotal')).to_have_text('$ 60,00')
        primero.get_by_role('button', name='Restar uno').click()
        primero.get_by_label('Precio c/u ($)').fill('19,50')
        expect(pagina.locator('#vTotal')).to_have_text('$ 43,50')
        pago = pagina.get_by_role('button', name='Tarjeta', exact=True)
        pago.click()
        expect(pago).to_have_attribute('aria-pressed', 'true')
        pagina.get_by_label('Queda pendiente').check()
        pagina.get_by_label('Queda pendiente').uncheck()
        pagina.evaluate("""() => {
          window.guardarOriginal = Storage.prototype.setItem;
          Storage.prototype.setItem = () => { throw new Error('Memoria llena'); };
        }""")
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
        assert datos_guardados(pagina) == estado
        assert pagina.evaluate("['p1', 'p2'].map(stockDe)") == [5, 4]
        assert pagina.evaluate('E.ventas.length') == 1
        pagina.evaluate('() => { Storage.prototype.setItem = window.guardarOriginal; }')
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(pagina.locator('#capas > *')).to_have_count(0)
        ventas = datos_guardados(pagina)['ventas']
        assert ventas[-1]['pago'] == 'Tarjeta' and ventas[-1]['cobrado']
        assert ventas[-1]['items'][0]['precio'] == 19.5

        inventario(pagina, 'ventas')
        pagina.locator('.venta').filter(has_text='Rosa Cauce').click()
        pagina.get_by_role('button', name='Eliminar', exact=True).click()
        confirmacion = pagina.get_by_role('dialog', name='¿Eliminar esta venta?')
        expect(confirmacion.locator('.tirador')).to_be_visible()
        confirmacion.get_by_role('button', name='Eliminar').click()
        deshacer = pagina.get_by_role('button', name='Deshacer', exact=True)
        expect(deshacer).to_be_visible()
        assert datos_guardados(pagina)['ventas'][-1]['borrado']
        assert pagina.evaluate("['p1', 'p2'].map(stockDe)") == [5, 4]
        deshacer.click()
        assert not datos_guardados(pagina)['ventas'][-1]['borrado']
        assert pagina.evaluate("['p1', 'p2'].map(stockDe)") == [4, 3]

        inventario(pagina, 'uso')
        pagina.locator('#listaProd [data-id=p3]').click()
        pagina.get_by_role('button', name='Usar 1 frasco').click()
        expect(pagina.locator('.det-stock .q')).to_have_text('0')
        deshacer.click()
        expect(pagina.locator('.det-stock .q')).to_have_text('1')
        pagina.clock.pause_at(FECHA.replace(minute=30))
        pagina.get_by_role('button', name='Usar 1 frasco').click()
        pagina.clock.run_for(4999)
        expect(deshacer).to_be_visible()
        pagina.clock.run_for(1)
        expect(deshacer).to_be_hidden()
        expect(pagina.locator('.det-stock .q')).to_have_text('0')
    finally:
        sitio.cerrar()


def prueba_formulario_producto(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        pagina = sitio.abrir(estado=ESTADO_V1)
        inventario(pagina, 'venta')
        pagina.get_by_role('button', name='Producto', exact=True).click()
        pagina.get_by_role('group', name='Tipo de producto').get_by_role('button', name='Uso en spa').click()
        pagina.get_by_label('Nombre del producto').fill('Mascarilla de prueba')
        campo = pagina.get_by_label('¿Cuántos tienes ahora? (unidades)')
        campo.fill('2,5')
        campo.locator('..').get_by_role('button', name='Sumar uno').click()
        expect(campo).to_have_value('3,5')
        campo.locator('..').get_by_role('button', name='Restar uno').click()
        expect(campo).to_have_value('2,5')
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(pagina).to_have_url(APP + '#uso-en-spa')
        fila = pagina.locator('#listaProd .fila-lista').filter(has_text='Mascarilla de prueba')
        expect(fila.locator('.stock')).to_have_text('2,5')
        p = datos_guardados(pagina)['productos'][-1]
        assert p['tipo'] == 'uso' and p['nombre'] == 'Mascarilla de prueba'
        assert pagina.evaluate('(id) => stockDe(id)', p['id']) == 2.5
    finally:
        sitio.cerrar()


def prueba_apariencia(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'foto': 'foto-ausente'} if p['id'] == 'p1' else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado)
        expect(pagina.locator('html')).to_have_attribute('data-theme', 'light')
        pagina.keyboard.press('Tab')
        assert pagina.evaluate('document.activeElement.matches(":focus-visible")')
        inventario(pagina, 'venta')
        barra = pagina.locator('.nav').bounding_box()
        circulo = pagina.locator('.nav-vender .circulo').bounding_box()
        escaner = pagina.get_by_role('button', name='Escanear', exact=True)
        assert escaner.bounding_box()['width'] == escaner.bounding_box()['height'] == 50
        assert barra['height'] >= 78 and circulo['width'] == 68
        assert 25 <= barra['y'] - circulo['y'] <= 27
        assert pagina.locator('.chip').first.bounding_box()['height'] >= 44
        assert pagina.locator('#listaProd .av').first.bounding_box()['width'] == 54
        iniciales = pagina.locator('#listaProd [data-id=p1] .av')
        expect(iniciales.locator('img')).to_have_count(0)
        expect(iniciales).to_have_text('SS')
        assert pagina.locator('#qProd').evaluate('(el) => getComputedStyle(el).fontSize') == '16px'
        assert pagina.locator('#app').evaluate('(el) => getComputedStyle(el).animationName') == 'none'
        assert pagina.evaluate('document.documentElement.scrollWidth === innerWidth')
        for esquema in ('light', 'dark'):
            pagina.emulate_media(color_scheme=esquema)
            expect(pagina.locator('html')).to_have_attribute('data-theme', esquema)
            contrastes = pagina.evaluate("""() => {
              const contexto = document.createElement('canvas').getContext('2d');
              const luminancia = color => {
                contexto.fillStyle = color;
                contexto.fillRect(0, 0, 1, 1);
                const canales = [...contexto.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => {
                  const c = n / 255;
                  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
                });
                return canales[0] * .2126 + canales[1] * .7152 + canales[2] * .0722;
              };
              return ['.pill.ok', '.cifra', '.seg .on', '.boton-escanear', '.av'].map(selector => {
                const {color, backgroundColor} = getComputedStyle(document.querySelector(selector));
                const [a, b] = [luminancia(color), luminancia(backgroundColor)].sort((a, b) => a - b);
                return (b + .05) / (a + .05);
              });
            }""")
            assert min(contrastes) >= 4.5, contrastes
        ajustes = abrir_ajustes(pagina)
        tema = ajustes.get_by_role('group', name='Tema')
        tema.get_by_role('button', name='Claro').click()
        expect(pagina.locator('html')).to_have_attribute('data-theme', 'light')
        tema.get_by_role('button', name='Oscuro').click()
        expect(pagina.locator('html')).to_have_attribute('data-theme', 'dark')
        pagina.emulate_media(color_scheme='light')
        expect(pagina.locator('html')).to_have_attribute('data-theme', 'dark')
        assert datos_guardados(pagina)['ajustes']['tema'] == 'dark'
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
        pagina.screenshot(path=carpeta / f'T1-{pantalla}-{sufijo}.png', animations='disabled')

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
            pagina.get_by_role('button', name='Escanear').click()
            guardar(sitio, 'codigo-manual', sufijo)
            cerrar_hoja(pagina)
            inventario(pagina, 'uso')
            pagina.locator('#qProd').fill("AHA's Peel")
            pagina.locator('#listaProd [data-act=verProd]').first.click()
            guardar(sitio, 'cabina', sufijo)
            pagina.get_by_role('button', name='Usar 1 frasco', exact=True).click()
            guardar(sitio, 'deshacer', sufijo)
            pagina.get_by_role('button', name='Deshacer', exact=True).click()
            pagina.clock.fast_forward(5000)
            cerrar_hoja(pagina)
            pagina.get_by_role('navigation').get_by_role('button', name='Pacientes').click()
            guardar(sitio, 'pacientes', sufijo)
            inventario(pagina, 'ventas')
            guardar(sitio, 'reportes', sufijo)
            pagina.locator('.venta').first.click()
            guardar(sitio, 'venta', sufijo)
            cerrar_hoja(pagina)
            pagina.get_by_role('navigation').get_by_role('button', name='Vender').click()
            pagina.get_by_label('Paciente', exact=True).fill('Clara Niebla')
            buscador = pagina.get_by_role('searchbox', name='Buscar producto')
            buscador.fill('azela')
            pagina.locator('#selProd .fila-lista').first.click()
            buscador.fill('hydrating')
            pagina.locator('#selProd .fila-lista').filter(has_text='200 ml').click()
            guardar(sitio, 'venta-nueva', sufijo)
        finally:
            sitio.cerrar()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capturas', action='store_true', help='guardar capturas en modo claro y oscuro')
    args = parser.parse_args()
    with sync_playwright() as p:
        principales = [prueba_estado_v1, prueba_edicion, prueba_navegacion,
                        prueba_buscadores_y_filtros, prueba_carrito_y_deshacer,
                        prueba_formulario_producto, prueba_apariencia]
        for motor in (p.chromium, p.webkit):
            if motor.name == 'webkit' and not Path(motor.executable_path).is_file():
                continue
            with motor.launch() as navegador:
                pruebas = [*principales, prueba_envio_v1, prueba_ejemplo]
                if motor.name == 'chromium':
                    pruebas.append(prueba_sin_conexion)
                for prueba in pruebas:
                    prueba(navegador)
                    print(f'{motor.name}: {prueba.__name__} pasó')
                if motor.name == 'chromium':
                    modelo = 'iPhone 14 Pro' if 'iPhone 14 Pro' in p.devices else 'iPhone 13 Pro'
                    for prueba in principales:
                        prueba(navegador, perfil=p.devices[modelo])
                        print(f'{motor.name} con {modelo}: {prueba.__name__} pasó')
                if args.capturas and motor.name == 'chromium':
                    capturar(navegador)
                    print('Capturas en codex/capturas/')


if __name__ == '__main__':
    main()
