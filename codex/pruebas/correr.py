#!/usr/bin/env python3
"""Pruebas de SPARATI Prueba con Playwright. Los archivos se sirven por rutas, sin red."""

import argparse
import json
import mimetypes
import re
from datetime import datetime, timedelta
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


def contrastes(pagina, pares):
    return pagina.evaluate("""pares => {
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
      return pares.map(([texto, fondo = texto]) => {
        const color = getComputedStyle(document.querySelector(texto)).color;
        const background = getComputedStyle(document.querySelector(fondo)).backgroundColor;
        const [a, b] = [luminancia(color), luminancia(background)].sort((a, b) => a - b);
        return (b + .05) / (a + .05);
      });
    }""", pares)


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
        expect(pagina.get_by_role('group', name='Acciones rápidas')).to_be_visible()
        expect(pagina.get_by_role('list', name='Ventas de los últimos 7 días').locator('.barra')).to_have_count(7)
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
        pagina.get_by_label('Ordenar dentro de cada marca').select_option('venta')
        pagina.get_by_role('searchbox', name='Buscar en el inventario').fill('PEPTIDOS EFECTO BOTOX')
        expect(pagina.locator('#listaProd .fila-lista')).to_have_count(1)
        pagina.wait_for_function("document.querySelector('#listaProd img')?.naturalWidth > 0")
        pagina.get_by_role('button', name='Producto', exact=True).click()
        expect(pagina.get_by_label('Código de barras')).to_be_visible()
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
        pagina.get_by_label('Código de barras').fill(' 0012345678905 ')
        pagina.get_by_role('group', name='Tipo de producto').get_by_role('button', name='Uso en spa').click()
        expect(pagina.get_by_label('Código de barras')).to_have_value(' 0012345678905 ')
        pagina.get_by_label('Nombre del producto').fill('Mascarilla de prueba')
        campo = pagina.get_by_label('¿Cuántos tienes ahora? (unidades)')
        campo.fill('2,5')
        campo.locator('..').get_by_role('button', name='Sumar uno').click()
        expect(campo).to_have_value('3,5')
        campo.locator('..').get_by_role('button', name='Restar uno').click()
        expect(campo).to_have_value('2,5')
        ideal = pagina.get_by_label('Cantidad ideal para pedir (unidades)')
        guardar = pagina.get_by_role('button', name='Guardar', exact=True)
        ideal.fill('2 cajas')
        guardar.click()
        expect(pagina.locator('#toast')).to_contain_text('cantidad ideal para pedir')
        assert datos_guardados(pagina) == ESTADO_V1
        ideal.fill('6,5')
        ideal.locator('..').get_by_role('button', name='Sumar uno').click()
        expect(ideal).to_have_value('7,5')
        pagina.locator('#inFoto').set_input_files(RAIZ / CATALOGO[0]['foto'])
        pagina.wait_for_function("document.querySelector('.foto-campo img')?.naturalWidth > 0")
        fotos = pagina.evaluate('FDB.claves()')
        assert len(fotos) == 1
        pagina.evaluate("""() => {
          window.guardarOriginal = Storage.prototype.setItem;
          Storage.prototype.setItem = () => { throw new Error('Memoria llena'); };
        }""")
        guardar.click()
        expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
        assert datos_guardados(pagina) == ESTADO_V1
        assert pagina.evaluate('[E.productos.length, E.movs.length]') == [4, 9]
        assert pagina.evaluate('FDB.claves()') == fotos
        pagina.evaluate('() => { Storage.prototype.setItem = window.guardarOriginal; }')
        guardar.click()
        expect(pagina).to_have_url(APP + '#uso-en-spa')
        fila = pagina.locator('#listaProd .fila-lista').filter(has_text='Mascarilla de prueba')
        expect(fila.locator('.stock')).to_have_text('2,5')
        estado = datos_guardados(pagina)
        p = estado['productos'][-1]
        assert p['tipo'] == 'uso' and p['nombre'] == 'Mascarilla de prueba'
        assert p['codigo'] == '0012345678905' and p['max'] == 7.5
        assert p['creado'] == p['mod'] and p['por'] == 'Jonathan'
        assert p['foto'] == fotos[0]
        assert len(estado['productos']) == 5 and len(estado['movs']) == 10
        assert pagina.evaluate('(id) => stockDe(id)', p['id']) == 2.5

        pagina.get_by_role('searchbox', name='Buscar en el inventario').fill(p['codigo'])
        expect(pagina.locator('#listaProd .fila-lista')).to_have_count(1)
        pagina.get_by_role('button', name='Escanear').click()
        pagina.get_by_label('Escribir el código a mano').fill(p['codigo'])
        pagina.get_by_role('button', name='Buscar código').click()
        expect(pagina.get_by_role('heading', name=p['nombre'])).to_be_visible()
        pagina.get_by_role('button', name='Editar producto').click()
        expect(pagina.get_by_label('Código de barras')).to_have_value(p['codigo'])
        expect(ideal).to_have_value('7,5')
        expect(pagina.get_by_label('¿Cuántos tienes ahora? (unidades)')).to_have_count(0)
        pagina.get_by_label('Código de barras').clear()
        ideal.clear()
        pagina.clock.set_fixed_time(FECHA + timedelta(minutes=5))
        guardar.click()
        expect(pagina.locator('#capas > *')).to_have_count(1)
        p_editado = datos_guardados(pagina)['productos'][-1]
        assert p_editado == {**p, 'codigo': '', 'max': 0, 'mod': int((FECHA + timedelta(minutes=5)).timestamp() * 1000)}
        assert datos_guardados(pagina)['movs'] == estado['movs']
    finally:
        sitio.cerrar()


def prueba_inventario_resumen_y_orden(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        venta, _, uso, _ = ESTADO_V1['productos']
        estado = {**ESTADO_V1, 'productos': [*ESTADO_V1['productos'],
            {**venta, 'id': 'p5', 'nombre': 'Aceite para el cuerpo', 'cat': 'Corporal', 'precio': 12, 'min': 6},
            {**venta, 'id': 'p6', 'nombre': 'Aceite cítrico', 'marca': 'Otra marca', 'precio': 50},
            {**uso, 'id': 'p7', 'nombre': 'Loción de prueba', 'cat': 'Limpieza', 'unidad': 'ml', 'costo': 1.2},
        ]}
        estado['movs'] = [*ESTADO_V1['movs'], *[
            {'id': 'm-' + p, 'prod': p, 'tipo': 'inicial', 'cant': cantidad, 'fecha': '2026-11-01'}
            for p, cantidad in [('p5', 6), ('p6', -2), ('p7', 12.5)]
        ]]
        anterior = ESTADO_V1['ventas'][0]
        estado['ventas'] = [anterior,
            {**anterior, 'id': 'v2', 'fecha': '2026-11-25', 'items': [anterior['items'][0]]},
            {**anterior, 'id': 'v3', 'fecha': '2026-11-26', 'items': [anterior['items'][1]], 'borrado': True},
        ]
        pagina = sitio.abrir(estado=estado)
        inventario(pagina, 'venta')
        tipos = pagina.get_by_role('group', name='Tipo de inventario')
        expect(tipos.get_by_role('button', name='Para vender · 4')).to_have_attribute('aria-pressed', 'true')
        expect(tipos.get_by_role('button', name='Uso en spa · 2')).to_have_attribute('aria-pressed', 'false')
        cifras = pagina.locator('.estadisticas-inventario .cifra')
        expect(cifras.locator('.v')).to_have_text(['15', '$ 258,00'])
        expect(pagina.locator('#listaProd h2')).to_have_text(['Professional Spa', 'Otra marca'])
        expect(pagina.locator('#listaProd [data-id=p6] .stock')).to_have_text('Agotado')

        def ids():
            return pagina.locator('#listaProd .fila-lista').evaluate_all('filas => filas.map(f => f.dataset.id)')

        orden = pagina.get_by_label('Ordenar dentro de cada marca')
        assert ids() == ['p5', 'p2', 'p1', 'p6']
        orden.select_option('stock')
        assert ids() == ['p2', 'p1', 'p5', 'p6']
        orden.select_option('venta')
        assert ids() == ['p1', 'p2', 'p5', 'p6']
        pagina.get_by_role('button', name='Por terminarse').click()
        assert ids() == ['p6', 'p5']
        expect(cifras.locator('.v')).to_have_text(['15', '$ 258,00'])

        inventario(pagina, 'uso')
        expect(orden).to_have_value('nombre')
        expect(cifras.last).to_contain_text('Valor a costo')
        expect(cifras.last.locator('.v')).to_have_text('$ 39,00')
        detalle = cifras.first.locator('ul')
        expect(detalle).to_be_hidden()
        cifras.first.locator('summary').click()
        expect(detalle.locator('li')).to_have_text(['1 frasco', '12,5 ml'])
        expect(cifras.first).to_have_attribute('open', '')
        orden.select_option('stock')
        assert ids() == ['p3', 'p7']

        # La última categoría requiere desplazar horizontalmente la tira.
        filtros = pagina.get_by_role('group', name='Filtrar productos')
        limpieza = filtros.get_by_role('button', name='Limpieza')
        assert limpieza.evaluate('(b) => b.getBoundingClientRect().left >= innerWidth')
        if perfil:
            caja = filtros.bounding_box()
            sesion = pagina.context.new_cdp_session(pagina)
            x, y = caja['x'] + caja['width'] - 30, caja['y'] + caja['height'] / 2
            sesion.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            for avance in range(40, 321, 40):
                sesion.send('Input.dispatchTouchEvent', {
                    'type': 'touchMove', 'touchPoints': [{'x': x - avance, 'y': y}],
                })
            sesion.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            pagina.wait_for_function("""() => {
              const tira = document.querySelector('.filtros-inventario');
              return tira.scrollLeft > 0 && tira.lastElementChild.getBoundingClientRect().right <= innerWidth;
            }""")
            sesion.detach()
            limpieza.tap()
        else:
            limpieza.click()
        assert filtros.evaluate('(f) => f.scrollLeft') > 0
        expect(limpieza).to_have_attribute('aria-pressed', 'true')
        assert ids() == ['p7']
        buscador = pagina.get_by_role('searchbox', name='Buscar en el inventario')
        buscador.fill('LOCION')
        assert ids() == ['p7']
        buscador.fill('Mascarilla')
        expect(pagina.locator('#listaProd .vacio')).to_have_text('No hay productos con ese filtro.')
        inventario(pagina, 'venta')
        expect(orden).to_have_value('venta')
        expect(pagina.get_by_role('button', name='Por terminarse')).to_have_attribute('aria-pressed', 'true')
        assert ids() == ['p6', 'p5']

        pagina.get_by_role('button', name='Lista de compras').click()
        expect(pagina.get_by_role('heading', name='Lista de compras')).to_be_visible()
        cerrar_hoja(pagina)
    finally:
        sitio.cerrar()


def prueba_inventario_300_productos(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        base = ESTADO_V1['productos'][0]
        estado = {**ESTADO_V1, 'productos': [
            {**base, 'id': f'p{i:03d}', 'nombre': f'Artículo {i:03d}', 'foto': 'foto-prueba',
             'cat': 'Facial' if i % 2 else 'Corporal'}
            for i in range(1, 301)
        ], 'ventas': [], 'movs': [
            {'id': f'm{i:03d}', 'prod': f'p{i:03d}', 'tipo': 'inicial', 'cant': 4, 'fecha': '2026-11-01'}
            for i in range(1, 301)
        ]}
        pagina = sitio.abrir(estado=estado)
        pagina.evaluate("""async (ruta) => {
          await FDB.put('foto-prueba', await (await fetch(ruta)).blob());
        }""", '../' + CATALOGO[0]['foto'])
        inventario(pagina, 'venta')
        filas = pagina.locator('#listaProd .fila-lista')
        expect(pagina.get_by_role('button', name='Para vender · 300')).to_be_visible()
        expect(filas).to_have_count(300)
        expect(pagina.locator('#listaProd h2')).to_have_text('Professional Spa')
        assert filas.first.evaluate('(f) => getComputedStyle(f).contentVisibility') == 'auto'
        pagina.wait_for_function("document.querySelector('[data-id=p001] img')?.naturalWidth > 0")
        assert filas.last.locator('img').get_attribute('src') is None
        pagina.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
        pagina.wait_for_function("document.querySelector('[data-id=p300] img')?.naturalWidth > 0")
        ultima = filas.last
        assert ultima.bounding_box()['y'] + ultima.bounding_box()['height'] < pagina.locator('.nav-vender .circulo').bounding_box()['y']
        ultima.click()
        expect(pagina.get_by_role('heading', name='Artículo 300')).to_be_visible()
        cerrar_hoja(pagina)
        pagina.locator('#qProd').fill('ARTICULO 300')
        expect(filas).to_have_count(1)
        expect(filas.first).to_contain_text('Artículo 300')
        pagina.get_by_role('button', name='Facial', exact=True).click()
        expect(filas).to_have_count(0)
        pagina.locator('#qProd').fill('')
        expect(filas).to_have_count(150)
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
            razones = contrastes(pagina, [[s] for s in ['.pill.ok', '.cifra', '.seg .on', '.boton-escanear', '.av']])
            assert min(razones) >= 4.5, razones
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


def prueba_inicio_resumen(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        fecha = datetime.fromisoformat('2027-01-03T15:30:00-05:00')
        sitio.pagina.clock.set_fixed_time(fecha)
        base = ESTADO_V1['ventas'][0]
        ventas = [
            {**base, 'id': 'd1', 'fecha': '2026-12-15', 'items': [{**base['items'][0], 'precio': 30, 'costo': 10}]},
            {**base, 'id': 'd2', 'fecha': '2026-12-31', 'items': [{**base['items'][0], 'precio': 20, 'costo': 10}]},
            {**base, 'id': 'e1', 'fecha': '2027-01-01', 'descuento': 5,
             'items': [{**base['items'][0], 'cant': 2, 'precio': 20, 'costo': 5}]},
            {**base, 'id': 'e2', 'fecha': '2027-01-03', 'cobrado': False,
             'items': [{**base['items'][1], 'cant': 1, 'precio': 50, 'costo': 10}]},
            {**base, 'id': 'e3', 'fecha': '2027-01-03', 'borrado': True},
        ]
        pagina = sitio.abrir(estado={**ESTADO_V1, 'ventas': ventas}, quien='Elba')
        expect(pagina.get_by_role('heading', name='Buenas tardes, Elba')).to_be_visible()
        expect(pagina.locator('.cab-inicio .sub')).to_have_text('Domingo 3 de enero')
        tarjeta = pagina.get_by_role('region', name='Ventas de enero')
        expect(tarjeta.get_by_role('button')).to_have_text('$ 85,00')
        expect(tarjeta.locator('.comparacion')).to_have_text('+70 % vs diciembre')
        expect(tarjeta.locator('p')).to_have_text('2 ventas · $ 65,00 de ganancia')
        expect(tarjeta.get_by_role('list', name='Ventas de los últimos 7 días').locator('.solo-lectura')).to_have_text([
            'Lunes 28 de diciembre · $ 0,00', 'Martes 29 de diciembre · $ 0,00',
            'Miércoles 30 de diciembre · $ 0,00', 'Jueves 31 de diciembre · $ 20,00',
            'Viernes 1 de enero · $ 35,00', 'Sábado 2 de enero · $ 0,00', 'Domingo 3 de enero · $ 50,00',
        ])
        assert tarjeta.locator('.barra').evaluate_all('(barras) => barras.map(b => b.offsetHeight)') == [2, 2, 2, 32, 56, 2, 80]
        expect(pagina.locator('.pendiente-inicio')).to_contain_text('$ 50,00')
        assert pagina.evaluate('document.documentElement.scrollWidth === innerWidth')
        for esquema in ('light', 'dark'):
            pagina.emulate_media(color_scheme=esquema)
            expect(pagina.locator('html')).to_have_attribute('data-theme', esquema)
            razones = contrastes(pagina, [
                ['.ventas-inicio h2', '.ventas-inicio'], ['.ventas-inicio p', '.ventas-inicio'],
                ['.ventas-inicio-total', '.ventas-inicio'], ['.comparacion'],
                ['.contador-inicio.stock b', '.contador-inicio.stock'],
                ['.contador-inicio.fecha b', '.contador-inicio.fecha'],
                ['.contador-inicio.paciente b', '.contador-inicio.paciente'], ['.atencion-fila .btn'],
            ])
            assert min(razones) >= 4.5, razones

        inventario(pagina, 'ventas')
        pagina.get_by_role('button', name='Mes anterior').click()
        expect(pagina.locator('.mes b')).to_have_text('Diciembre 2026')
        inventario(pagina, 'inicio')
        tarjeta.get_by_role('button').click()
        expect(pagina.locator('.mes b')).to_have_text('Enero 2027')
        expect(pagina.locator('.cifra .v').nth(0)).to_have_text('$ 85,00')
        expect(pagina.locator('.cifra .v').nth(1)).to_have_text('$ 65,00')
        pagina.clock.set_fixed_time(fecha.replace(hour=20))
        pagina.evaluate('history.back()')
        expect(pagina.get_by_role('heading', name='Buenas noches, Elba')).to_be_visible()
        pagina.clock.set_fixed_time(fecha.replace(hour=8))
        pagina.reload()
        expect(pagina.get_by_role('heading', name='Buenos días, Elba')).to_be_visible()
        pagina.clock.set_fixed_time(fecha.replace(month=2))
        pagina.reload()
        expect(pagina.locator('.comparacion')).to_have_text('-100 % vs enero')
        pagina.clock.set_fixed_time(fecha.replace(month=3))
        pagina.reload()
        expect(pagina.locator('.comparacion')).to_have_text('Sin ventas en febrero')
    finally:
        sitio.cerrar()


def prueba_inicio_accesos(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        pagina = sitio.abrir(estado={**ESTADO_V1,
            'pacientes': [{'id': 'paciente:ines cauce', 'nombre': 'Inés Cauce', 'tel': '', 'notas': ''}],
            'productos': [{**p, 'codigo': 'SP-CLARO'} if p['id'] == 'p1' else p for p in ESTADO_V1['productos']],
        })
        global_ = pagina.get_by_role('searchbox', name='Buscar producto o paciente')
        global_.fill('Ines Cauce')
        pagina.locator('#resultadosInicio [data-act=verPaciente]').click()
        expect(pagina.get_by_role('dialog', name='Inés Cauce')).to_be_visible()
        cerrar_hoja(pagina)
        global_.fill('')
        pagina.get_by_role('button', name='Escanear').click()
        pagina.get_by_label('Escribir el código a mano').fill('sp-claro')
        pagina.get_by_role('button', name='Buscar código').click()
        expect(pagina.get_by_role('dialog', name=ESTADO_V1['productos'][0]['nombre'])).to_be_visible()
        cerrar_hoja(pagina)

        acciones = pagina.get_by_role('group', name='Acciones rápidas')
        acciones.get_by_role('button', name='Vender').click()
        expect(pagina.get_by_role('dialog', name='Nueva venta')).to_be_visible()
        cerrar_hoja(pagina)

        usar = acciones.get_by_role('button', name='Usé en cabina')
        if perfil:
            usar.tap()
        else:
            usar.click()
        selector = pagina.get_by_role('dialog', name='Usé en cabina')
        buscador = selector.get_by_role('searchbox', name='Buscar producto')
        buscador.fill('sun screen')
        expect(selector.locator('.vacio')).to_contain_text('No encontré')
        buscador.fill('mascarilla hidroplastica')
        selector.locator('[data-id=p3]').click()
        expect(pagina.get_by_role('heading', name='Usar · ' + ESTADO_V1['productos'][2]['nombre'])).to_be_visible()
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(selector.locator('[data-id=p3] .stock')).to_have_text('Agotado')
        expect(buscador).to_have_value('mascarilla hidroplastica')
        assert datos_guardados(pagina)['movs'][-1]['tipo'] == 'uso'
        pagina.get_by_role('button', name='Deshacer').click()
        expect(selector.locator('[data-id=p3] .stock')).to_have_text('Queda 1')
        cerrar_hoja(pagina)

        for titulo, formulario, accion, cantidad in [
            ('Llegó mercadería', 'Llegó más', 'entrada', 1),
            ('Contar inventario', 'Contar', 'ajuste', 2),
        ]:
            acciones.get_by_role('button', name=titulo).click()
            selector = pagina.get_by_role('dialog', name=titulo)
            expect(selector.locator('.fila-lista')).to_have_count(3)
            selector.get_by_role('searchbox').fill('sun screen')
            selector.locator('[data-id=p1]').click()
            expect(pagina.get_by_role('heading', name=formulario + ' · ' + ESTADO_V1['productos'][0]['nombre'])).to_be_visible()
            if accion == 'ajuste':
                pagina.locator('#paso-real').fill('8')
                expect(pagina.locator('#aDif')).to_have_text('Diferencia: +2')
            antes = datos_guardados(pagina)
            pagina.evaluate("""() => {
              window.setItemOriginal = Storage.prototype.setItem;
              Storage.prototype.setItem = () => { throw new Error('Memoria llena'); };
            }""")
            guardar = pagina.get_by_role('button', name='Guardar', exact=True)
            guardar.click()
            expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
            assert datos_guardados(pagina) == antes
            assert pagina.evaluate('E.movs.length') == len(antes['movs'])
            pagina.evaluate('() => { Storage.prototype.setItem = window.setItemOriginal; }')
            guardar.click()
            expect(pagina.locator('[data-tipo=form]')).to_have_count(0)
            despues = datos_guardados(pagina)
            assert len(despues['movs']) == len(antes['movs']) + 1
            movimiento = despues['movs'][-1]
            assert (movimiento['prod'], movimiento['tipo'], movimiento['cant']) == ('p1', accion, cantidad)
            expect(selector.locator('[data-id=p1] .stock')).to_have_text('6' if accion == 'entrada' else '8')
            cerrar_hoja(pagina)
    finally:
        sitio.cerrar()


def prueba_inicio_avisos(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        sitio.pagina.clock.set_fixed_time(FECHA)
        hoy = int(FECHA.timestamp() * 1000)
        cambios = {
            'p1': {'min': 5, 'duraPac': 10, 'vence': '2027-01-11', 'mod': hoy},
            'p2': {'duraPac': 7, 'vence': '2026-11-26'},
            'p3': {'vence': '2026-11-30', 'abierto': '2026-10-27', 'pao': 1},
        }
        v = ESTADO_V1['ventas'][0]
        previa = {**v, 'id': 'anterior', 'pac': 'Maria Jose Andrade', 'creado': v['creado'] - 1}
        pagina = sitio.abrir(estado={
            **ESTADO_V1, 'productos': [{**p, **cambios.get(p['id'], {})} for p in ESTADO_V1['productos']],
            'ventas': [v, previa], 'sync': {**ESTADO_V1['sync'], 'envio': hoy - 9 * 86400000},
        }, quien='Elba')
        assert pagina.evaluate("sumarMeses('2027-01-31', 1)") == '2027-02-28'
        assert pagina.evaluate("""() => {
          const envio = E.sync.envio, creado = E.creado, sieteDias = 7 * 86400000;
          E.sync.envio = Date.now() - sieteDias;
          const alCumplirSiete = avisosInicio().envio.length;
          E.sync.envio--;
          const despuesDeSiete = avisosInicio().envio.length;
          E.sync.envio = 0;
          E.creado = Date.now() - 86400000;
          const nuevoSinEnvio = avisosInicio().envio.length;
          E.creado = Date.now() - 8 * 86400000;
          const antiguoSinEnvio = avisosInicio().envio.length;
          E.sync.envio = envio;
          E.creado = creado;
          return [alCumplirSiete, despuesDeSiete, nuevoSinEnvio, antiguoSinEnvio];
        }""") == [0, 1, 0, 1]
        contadores = pagina.get_by_role('group', name='Resumen de avisos')
        expect(contadores.locator('b')).to_have_text(['2', '3', '1'])
        previa = pagina.locator('.atencion-inicio')
        expect(previa.locator('li')).to_have_count(4)
        expect(previa).to_contain_text('Jonathan no tiene tus cambios')
        expect(previa).to_contain_text('Último envío hace 9 días')

        campana = pagina.get_by_role('button', name='Avisos, 7 pendientes')
        campana.click()
        hoja = pagina.get_by_role('dialog', name='Necesita atención')
        expect(hoja.locator('li')).to_have_count(8)
        expect(hoja.locator('li').filter(has_text='Hoy se cumple')).to_contain_text('Vence en 3 días · 30 nov')
        expect(hoja).to_contain_text('Venció el 26 nov')
        cerrar_hoja(pagina)
        expect(campana).to_be_focused()
        previa.get_by_role('button', name='Ver todo').click()
        expect(hoja.locator('li')).to_have_count(8)
        cerrar_hoja(pagina)

        contadores.get_by_role('button', name='2 Por terminarse').click()
        lista = pagina.get_by_role('dialog', name='Por terminarse')
        expect(lista.locator('li')).to_have_count(2)
        lista.locator('li [data-id=p1]').click()
        compras = pagina.get_by_role('dialog', name='Lista de compras')
        expect(compras.locator('button.alerta')).to_have_count(1)
        expect(compras).to_contain_text(ESTADO_V1['productos'][0]['nombre'])
        cerrar_hoja(pagina)
        cerrar_hoja(pagina)

        contadores.get_by_role('button', name='3 Vencen pronto').click()
        lista = pagina.get_by_role('dialog', name='Vencen pronto')
        expect(lista.locator('li')).to_have_count(3)
        lista.locator('li [data-id=p2]').click()
        expect(pagina.get_by_role('dialog', name=ESTADO_V1['productos'][1]['nombre'])).to_be_visible()
        cerrar_hoja(pagina)
        cerrar_hoja(pagina)

        contadores.get_by_role('button', name='1 Pacientes por recordar').click()
        lista = pagina.get_by_role('dialog', name='Pacientes por recordar')
        expect(lista.locator('li')).to_have_count(2)
        for producto, restantes in [('p2', 1), ('p1', 0)]:
            lista.locator(f'[data-p={producto}]').click()
            aviso = pagina.get_by_role('dialog', name='Recordatorio')
            expect(aviso.get_by_role('link', name='Abrir WhatsApp')).to_have_attribute(
                'href', re.compile(r'^https://wa\.me/593991234567\?text='))
            expect(aviso).to_contain_text('Hola María')
            aviso.get_by_role('button', name='Ya le escribí').click()
            expect(lista.locator('li')).to_have_count(restantes)
        assert datos_guardados(pagina)['ventas'][0]['recordados'] == {'p2': True, 'p1': True}
        cerrar_hoja(pagina)
        expect(contadores.locator('.paciente b')).to_have_text('0')

        # Descargar el envío de prueba quita el aviso sin abrir ninguna aplicación externa.
        pagina.evaluate("Object.defineProperty(navigator, 'canShare', {value: () => false})")
        with pagina.expect_download() as descarga:
            previa.get_by_role('button', name='Enviar · Jonathan no tiene tus cambios').click()
        archivo = descarga.value
        assert archivo.suggested_filename == 'inventario-sparati-prueba-elba-2026-11-27.txt'
        assert json.loads(archivo.path().read_text(encoding='utf-8'))['app'] == 'sparati-inventario'
        expect(previa.get_by_text('Jonathan no tiene tus cambios')).to_have_count(0)
        assert datos_guardados(pagina)['sync']['envio'] >= hoy

        ajustes = abrir_ajustes(pagina)
        ajustes.get_by_role('button', name='30 días').click()
        cerrar_hoja(pagina)
        expect(contadores.locator('.fecha b')).to_have_text('2')
    finally:
        sitio.cerrar()


def capturar(navegador, tarea):
    carpeta = RAIZ / 'codex/capturas'
    fecha = FECHA.replace(hour=20)
    envio = int((fecha - timedelta(days=9)).timestamp() * 1000)

    def guardar(sitio, pantalla, tema):
        pagina = sitio.pagina
        pagina.evaluate('document.fonts.ready')
        pagina.evaluate("""async () => {
          await Promise.all(Array.from(document.images).filter(i => i.src).map(i => i.decode().catch(() => {})));
        }""")
        pagina.screenshot(path=carpeta / f'{tarea}-{pantalla}-{tema}.png', animations='disabled')

    for color, tema in [('light', 'claro'), ('dark', 'oscuro')]:
        sitio = Sitio(navegador, color=color)
        try:
            sitio.pagina.clock.set_system_time(fecha)
            pagina = sitio.abrir(quien='Elba', estado={
                'v': 1, 'productos': [], 'movs': [], 'ventas': [],
                'sync': {'envio': envio, 'recibo': 0, 'de': ''}, 'creado': envio,
            })
            ajustes = abrir_ajustes(pagina)
            ajustes.get_by_role('button', name='Cargar datos de ejemplo').click()
            expect(pagina.locator('#toast')).to_have_text('Datos de ejemplo cargados')
            pagina.clock.fast_forward(5000)
            cerrar_hoja(pagina)
            pagina.evaluate('window.scrollTo(0, 0)')
            if tarea == 'T3':
                inventario(pagina, 'venta')
                pagina.wait_for_function("document.querySelector('#listaProd img')?.naturalWidth > 0")
                guardar(sitio, 'inventario-venta', tema)
                pagina.get_by_role('button', name='Producto', exact=True).click()
                guardar(sitio, 'producto-nuevo', tema)
                cerrar_hoja(pagina)
                pagina.locator('#listaProd .fila-lista').first.click()
                pagina.get_by_role('button', name='Editar producto').click()
                pagina.get_by_label('Cantidad ideal para pedir').fill('8')
                existencias = pagina.get_by_role('heading', name='Existencias')
                existencias.locator('..').evaluate("(el) => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'editar-existencias', tema)
                cerrar_hoja(pagina)
                cerrar_hoja(pagina)
                inventario(pagina, 'uso')
                pagina.locator('#ordenProd').select_option('stock')
                guardar(sitio, 'inventario-uso', tema)
                pagina.locator('.cantidades-inventario summary').click()
                guardar(sitio, 'inventario-cantidades', tema)
                continue
            guardar(sitio, 'inicio', tema)

            pagina.evaluate("window.scrollTo(0, document.querySelector('.contadores-inicio').offsetTop - 48)")
            atencion = pagina.locator('.atencion-inicio')
            expect(atencion.locator('li')).to_have_count(4)
            guardar(sitio, 'atencion', tema)
            atencion.get_by_role('button', name='Ver todo').click()
            guardar(sitio, 'avisos', tema)
            cerrar_hoja(pagina)

            atencion.locator('[data-act=recompra]').click()
            guardar(sitio, 'recordatorio', tema)
            cerrar_hoja(pagina)

            acciones = pagina.get_by_role('group', name='Acciones rápidas')
            for accion, pantalla in [('Usé en cabina', 'elegir-cabina'),
                                     ('Llegó mercadería', 'elegir-entrada'),
                                     ('Contar inventario', 'elegir-conteo')]:
                pagina.evaluate('window.scrollTo(0, 0)')
                acciones.get_by_role('button', name=accion).click()
                guardar(sitio, pantalla, tema)
                cerrar_hoja(pagina)
        finally:
            sitio.cerrar()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capturas', nargs='?', const='T3', choices=['T2', 'T3'],
                        help='guardar capturas en modo claro y oscuro (T3 por omisión)')
    args = parser.parse_args()
    with sync_playwright() as p:
        principales = [prueba_estado_v1, prueba_edicion, prueba_navegacion,
                        prueba_buscadores_y_filtros, prueba_carrito_y_deshacer,
                        prueba_formulario_producto, prueba_inventario_resumen_y_orden,
                        prueba_inventario_300_productos, prueba_apariencia,
                        prueba_inicio_resumen, prueba_inicio_accesos, prueba_inicio_avisos]
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
                    capturar(navegador, args.capturas)
                    print('Capturas en codex/capturas/')


if __name__ == '__main__':
    main()
