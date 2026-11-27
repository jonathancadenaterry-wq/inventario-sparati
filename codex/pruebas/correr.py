#!/usr/bin/env python3
"""Pruebas de SPARATI Prueba con Playwright. Los archivos se sirven por rutas, sin red."""

import argparse
import csv
import json
import mimetypes
import re
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

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


def interceptar_recordatorios(pagina):
    pagina.add_init_script("""window.recordatoriosPrueba = [];
      window.addEventListener('click', e => {
        const enlace = e.target.closest('[data-enviar-recordatorio]');
        if(!enlace || e.defaultPrevented) return;
        e.preventDefault();
        window.recordatoriosPrueba.push(enlace.href);
      });""")


def simular_camara(pagina, *, detector_local=True):
    if detector_local:
        pagina.add_init_script("Object.defineProperty(window, 'BarcodeDetector', {value: undefined, configurable: true});")
    pagina.add_init_script("""(() => {
      // Conservar el lector de producción y simular únicamente el video de un EAN-13.
      window.camaraPrueba = {solicitudes: [], pistas: [], linterna: [], admiteLinterna: false, modo: 'negada'};
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: async opciones => {
        const camara = window.camaraPrueba;
        camara.solicitudes.push(opciones);
        if(camara.modo === 'negada') throw new DOMException('Permiso denegado', 'NotAllowedError');
        if(camara.modo === 'pendiente') await new Promise(resolver => { camara.otorgar = resolver; });
        const lienzo = document.createElement('canvas');
        lienzo.width = 480;
        lienzo.height = 240;
        const contexto = lienzo.getContext('2d');
        let escena;
        if(camara.modo === 'escena'){
          escena = new Image();
          escena.src = '../codex/diseno/fotos/sunscreen.jpg';
          await escena.decode();
          lienzo.width = 390;
          lienzo.height = 844;
        }
        const codigo = '5901234123457';
        const l = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
        const g = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
        const r = l.map(d => [...d].map(bit => bit === '1' ? '0' : '1').join(''));
        const izquierda = [...codigo.slice(1, 7)].map((d, i) => ('LGGLLG'[i] === 'L' ? l : g)[d]).join('');
        const derecha = [...codigo.slice(7)].map(d => r[d]).join('');
        const barras = '101' + izquierda + '01010' + derecha + '101';
        const flujo = lienzo.captureStream(15), [pista] = flujo.getVideoTracks();
        camara.pistas.push(pista);
        Object.defineProperty(pista, 'getCapabilities', {value: () => ({torch:camara.admiteLinterna})});
        Object.defineProperty(pista, 'applyConstraints', {value: async opciones => { camara.linterna.push(opciones.advanced[0].torch); }});
        function cuadro(){
          if(escena){
            const ancho = Math.round(escena.height * lienzo.width / lienzo.height);
            contexto.drawImage(escena, (escena.width - ancho) / 2, 0, ancho, escena.height, 0, 0, lienzo.width, lienzo.height);
          }else{
            contexto.fillStyle = 'white';
            contexto.fillRect(0, 0, lienzo.width, lienzo.height);
          }
          if(camara.modo === 'ean'){
            const paso = escena ? 3 : 4, x = (lienzo.width - barras.length * paso) / 2;
            const y = escena ? Math.round(lienzo.height * .34) : 55;
            contexto.fillStyle = 'white';
            contexto.fillRect(0, y - 10, lienzo.width, 150);
            contexto.fillStyle = 'black';
            [...barras].forEach((v, i) => { if(v === '1') contexto.fillRect(Math.floor(x + paso * i), y, paso, 130); });
          }
        }
        const reloj = setInterval(() => pista.readyState === 'ended' ? clearInterval(reloj) : cuadro(), 80);
        cuadro();
        return flujo;
      }});
    })();""")


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


def escribir_codigo(escaner, codigo):
    campo = escaner.get_by_label('Escribir el código a mano')
    expect(escaner.locator('[data-estado-camara]')).not_to_have_text('Abriendo la cámara…')
    if not campo.is_visible():
        escaner.get_by_role('button', name='Escribir el código a mano').click()
    campo.fill(codigo)
    escaner.get_by_role('button', name='Buscar código').click()


def nueva_paciente_venta(pagina, nombre, telefono=''):
    pagina.get_by_role('button', name='Nueva', exact=True).click()
    ficha = pagina.get_by_role('dialog', name='Nueva paciente')
    ficha.get_by_label('Nombre', exact=True).fill(nombre)
    if telefono:
        ficha.get_by_label('Teléfono (opcional)').fill(telefono)
    ficha.get_by_role('button', name='Elegir paciente').click()
    expect(pagina.locator('.paciente-venta-nombre b')).to_have_text(nombre.strip())


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
        expect(pagina.locator('.frasco-en-uso .pill')).to_have_text('Abierto hace 13 días')
        expect(pagina.locator('.resumen-cabina .v').first).to_have_text('0 frascos')
        expect(pagina.get_by_role('progressbar')).to_have_count(0)
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
        nueva_paciente_venta(pagina, 'Rosa Cauce')
        pagina.get_by_role('button', name='Cobrar $ 18,00').click()
        expect(pagina.locator('#toast')).to_contain_text('Venta cobrada')
        expect(pagina).to_have_url(APP)
        inventario(pagina, 'venta')
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
        simular_camara(pagina)
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
        inventario(pagina, 'ventas')
        expect(pagina.locator('.cifras-reporte .v').first).to_have_text('$ 42,00')
        assert pagina.evaluate("async () => { const logo = document.querySelector('.cab-impresion-reporte img'); await logo.decode(); return logo.naturalWidth; }") == 480
        archivo = descargar_excel_reporte(pagina, 'sparati-ventas-2026-11.csv')
        assert ['Ventas', 'Vendido', '2026-11', '', '', '42,00'] in archivo
        inventario(pagina, 'inicio')
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
        cerrar_hoja(pagina)
        pagina.locator('#listaProd .fila-lista').click()
        ficha = pagina.get_by_role('dialog', name=re.compile('Péptidos Efecto Botox', re.I))
        asignar = ficha.get_by_role('button', name=re.compile('Asignar con la cámara'))
        pagina.evaluate("camaraPrueba.modo = 'blanca'")
        asignar.click()
        escaner = pagina.get_by_role('dialog', name='Asignar código de barras')
        expect(escaner.get_by_text('Pon el código dentro del recuadro.')).to_be_visible()
        video = escaner.locator('video')
        for atributo in ('playsinline', 'muted', 'autoplay'):
            expect(video).to_have_attribute(atributo, '')
        cerrar_hoja(pagina)
        assert pagina.evaluate('camaraPrueba.pistas[0].readyState') == 'ended'
        expect(asignar).to_be_focused()
        pagina.evaluate("camaraPrueba.modo = 'ean'")
        asignar.click()
        expect(escaner.get_by_label('Escribir el código a mano')).to_have_value('5901234123457')
        expect(escaner.get_by_text('Código leído.', exact=False)).to_be_visible()
        assert pagina.evaluate('camaraPrueba.pistas[1].readyState') == 'ended'
        escaner.get_by_role('button', name='Guardar código').click()
        expect(ficha.get_by_role('button', name='Código de barras Asignado')).to_be_visible()
        assert any(p.get('codigo') == '5901234123457' and 'Péptidos Efecto Botox' in p['nombre']
                   for p in datos_guardados(pagina)['productos'])
        cerrar_hoja(pagina)
        pagina.get_by_role('button', name='Escanear', exact=True).click()
        lector = pagina.get_by_role('dialog', name='Escanear')
        expect(lector.locator('.producto-escaner')).to_contain_text('Péptidos Efecto Botox')
        lector.get_by_role('button', name='Ver producto').click()
        expect(ficha).to_be_visible()
        assert pagina.evaluate('camaraPrueba.pistas.at(-1).readyState') == 'ended'
        cerrar_hoja(pagina)
        inventario(pagina, 'uso')
        pagina.locator('#listaProd [data-id=p3]').click()
        cabina = pagina.get_by_role('region', name='Frasco en uso')
        cabina.get_by_role('button', name='Se terminó', exact=True).click()
        expect(cabina).to_contain_text('Agotado')
        ultimos = datos_guardados(pagina)['movs'][-2:]
        assert [(m['tipo'], m['cant'], m['fecha']) for m in ultimos] == [
            ('apertura', 0, '2026-11-14'), ('uso', -1, '2026-11-27'),
        ]
        expect(pagina.locator('.paso-historial').first).to_contain_text('Duró 13 días')
        pagina.get_by_role('button', name='Deshacer', exact=True).click()
        expect(cabina).to_contain_text('Abierto hace 13 días')
        assert all(m['borrado'] for m in datos_guardados(pagina)['movs'][-2:])
        pagina.get_by_role('navigation', name='Principal').get_by_role('button', name='Vender', exact=True).click()
        venta = pagina.get_by_role('dialog', name='Nueva venta')
        venta.get_by_role('button', name='Escanear código de barras').click()
        lector.get_by_role('button', name='Agregar a la venta').click()
        expect(venta.locator('#resumenVenta')).to_have_text('Venta · 1 producto')
        venta.get_by_role('button', name=re.compile(r'^Cobrar \$')).click()
        expect(pagina.locator('#toast')).to_contain_text('Venta cobrada')
        assert 'Péptidos Efecto Botox' in datos_guardados(pagina)['ventas'][-1]['items'][0]['nombre']
        expect(pagina).to_have_url(APP)
        # El editor de recordatorios usa los datos locales después de recargar sin conexión.
        pagina.evaluate("""() => {
          const productos = E.productos.map(p => p.id === 'p2' ? {...p, duraPac:7} : p);
          guardar({...E, productos});
          refrescar();
        }""")
        pagina.reload()
        expect(pagina.locator('.contador-inicio.paciente b')).to_have_text(re.compile(r'^[1-9]\d*$'))
        pagina.get_by_role('navigation', name='Principal').get_by_role('button', name='Pacientes').click()
        pagina.get_by_role('searchbox', name='Buscar paciente').fill('maría josé')
        pagina.locator('#pacLista .fila-paciente').click()
        ficha = pagina.get_by_role('dialog', name='María José Andrade')
        expect(ficha.get_by_role('textbox', name='Mensaje de recordatorio')).to_have_value(re.compile(r'Azelac Serum'))
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
        pagina.get_by_role('button', name='Llegó más').click()
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
        nueva_paciente_venta(pagina, 'Nombre sin guardar')
        pagina.keyboard.press('Escape')
        expect(pagina.locator('#capas > *')).to_have_count(0)
        expect(pagina.get_by_role('heading', name='Reportes')).to_be_visible()
        barra.get_by_role('button', name='Vender').click()
        expect(pagina.locator('.paciente-venta-nombre b')).to_have_text('Sin nombre')
        assert datos_guardados(pagina) == ESTADO_V1
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
        lector = pagina.get_by_role('dialog', name='Escanear')
        escribir_codigo(lector, 'sin código')
        expect(lector.get_by_role('heading', name='No encontré un producto con ese código')).to_be_visible()
        escribir_codigo(lector, ' sp-abcde ')
        lector.get_by_role('button', name='Ver producto').click()
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
        nueva_paciente_venta(pagina, 'Rosa Cauce')
        venta.get_by_role('button', name='Escanear', exact=True).click()
        lector = pagina.get_by_role('dialog', name='Escanear')
        escribir_codigo(lector, '12345670')
        lector.get_by_role('button', name='Agregar a la venta').click()
        expect(resumen.locator('#resumenVenta')).to_have_text('Venta · 1 producto')
        expect(pagina.locator('#vTotal')).to_have_text('$ 18,00')
        pagina.locator('#selProd [data-id=p2]').click()
        expect(resumen.locator('#resumenVenta')).to_have_text('Venta · 2 productos')
        resumen.click()
        expect(resumen).to_have_attribute('aria-expanded', 'true')
        primero = pagina.locator('.item-venta').first
        primero.get_by_role('button', name='Sumar uno').click()
        expect(primero.get_by_label('Cantidad', exact=True)).to_have_value('2')
        expect(pagina.locator('#vTotal')).to_have_text('$ 60,00')
        primero.get_by_role('button', name='Restar uno').click()
        primero.get_by_role('button', name=re.compile('Editar precio')).click()
        precio = pagina.get_by_role('dialog', name='Editar precio')
        precio.get_by_label('Precio c/u ($)').fill('19,50')
        precio.get_by_role('button', name='Aplicar').click()
        expect(pagina.locator('#vTotal')).to_have_text('$ 43,50')
        pago = pagina.get_by_role('button', name='Tarjeta', exact=True)
        pago.click()
        expect(pago).to_have_attribute('aria-pressed', 'true')
        pagina.get_by_role('button', name='Queda pendiente').click()
        pagina.get_by_role('button', name='Cobrado', exact=True).click()
        pagina.evaluate("""() => {
          window.guardarOriginal = Storage.prototype.setItem;
          Storage.prototype.setItem = () => { throw new Error('Memoria llena'); };
        }""")
        cobrar = pagina.get_by_role('button', name='Cobrar $ 43,50')
        cobrar.click()
        expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
        assert datos_guardados(pagina) == estado
        assert pagina.evaluate("['p1', 'p2'].map(stockDe)") == [5, 4]
        assert pagina.evaluate('E.ventas.length') == 1
        pagina.evaluate('() => { Storage.prototype.setItem = window.guardarOriginal; }')
        cobrar.click()
        expect(pagina.locator('#capas > *')).to_have_count(0)
        ventas = datos_guardados(pagina)['ventas']
        assert ventas[-1]['pago'] == 'tarjeta' and ventas[-1]['cobrado']
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
        terminar = pagina.get_by_role('button', name='Se terminó', exact=True)
        terminar.click()
        expect(pagina.locator('.frasco-en-uso .pill')).to_have_text('Agotado')
        deshacer.click()
        expect(pagina.locator('.frasco-en-uso .pill')).to_have_text('Abierto hace 13 días')
        pagina.clock.pause_at(FECHA.replace(minute=30))
        terminar.click()
        pagina.clock.run_for(4999)
        expect(deshacer).to_be_visible()
        pagina.clock.run_for(1)
        expect(deshacer).to_be_hidden()
        expect(pagina.locator('.frasco-en-uso .pill')).to_have_text('Agotado')
    finally:
        sitio.cerrar()


def prueba_venta_rapida(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        pagina = sitio.abrir(quien='Elba')
        abrir_ajustes(pagina).get_by_role('button', name='Cargar datos de ejemplo').click()
        expect(pagina.locator('#toast')).to_have_text('Datos de ejemplo cargados')
        pagina.clock.fast_forward(5000)
        cerrar_hoja(pagina)
        pagina.evaluate("""() => {
          const {ventas} = E;
          const v = ventas[0], p = productos('venta').find(p => !p.foto);
          const it = {prod:p.id, nombre:p.nombre, cant:100, precio:p.precio};
          const viejas = [
            {...v, id:'fuera-de-plazo', fecha:sumarDias(hoyISO(), -60), items:[it]},
            {...v, id:'borrada', fecha:hoyISO(), items:[it], borrado:true},
            {...v, id:'futura', fecha:sumarDias(hoyISO(), 1), items:[it]},
          ];
          guardar({...E, ventas:ventas.concat(viejas)});
          refrescar();
          window.toquesVenta = [];
          document.addEventListener('click', e => {
            const b = e.target.closest('button[data-act]');
            if(b) window.toquesVenta.push(b.dataset.act);
          }, {capture:true});
        }""")
        antes = datos_guardados(pagina)
        cantidad = {}
        for venta in antes['ventas']:
            if not venta.get('borrado') and '2026-09-29' <= venta['fecha'] <= '2026-11-27':
                for it in venta['items']:
                    cantidad[it['prod']] = cantidad.get(it['prod'], 0) + it['cant']
        assert len(cantidad) == 9

        def tocar(control):
            if perfil:
                control.tap()
            else:
                control.click()

        tocar(pagina.get_by_role('group', name='Acciones rápidas').get_by_role('button', name='Vender', exact=True))
        venta = pagina.get_by_role('dialog', name='Nueva venta')
        tarjetas = venta.locator('.tarjeta-venta')
        expect(tarjetas).to_have_count(9)
        ids = tarjetas.evaluate_all('botones => botones.map(b => b.dataset.id)')
        assert set(ids) == set(cantidad)
        assert [cantidad[id_] for id_ in ids] == sorted(cantidad.values(), reverse=True)
        assert venta.locator('#selProd').evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length") == 3
        for i in range(3):
            tarjeta = tarjetas.nth(i)
            foto = tarjeta.locator('img')
            expect(foto).to_be_visible()
            pagina.wait_for_function('(i) => document.querySelectorAll("#selProd button")[i].querySelector("img").naturalWidth > 0', arg=i)
            tocar(foto)
        expect(venta.locator('#resumenVenta')).to_have_text('Venta · 3 productos')
        expect(venta.locator('.cantidad-tarjeta-venta:visible')).to_have_text(['1', '1', '1'])
        expect(venta.locator('.vista-carrito')).to_contain_text(tarjetas.nth(2).locator('.nombre-tarjeta-venta').inner_text())
        tocar(venta.get_by_role('button', name=re.compile(r'^Cobrar \$')))
        expect(pagina.locator('#capas > *')).to_have_count(0)
        expect(pagina).to_have_url(APP)
        expect(pagina.locator('.toast-venta')).to_contain_text('Venta cobrada')
        expect(pagina.locator('.check-venta')).to_be_visible()
        assert pagina.locator('.check-venta').evaluate('el => getComputedStyle(el).animationName') == 'none'
        assert pagina.evaluate('toquesVenta') == ['vender', 'vAgregar', 'vAgregar', 'vAgregar', 'guardarF']
        estado = datos_guardados(pagina)
        venta = estado['ventas'][-1]
        assert venta['pac'] == '' and venta['pago'] == 'efectivo' and venta['cobrado']
        assert [(it['prod'], it['cant']) for it in venta['items']] == [(id_, 1) for id_ in ids[:3]]
        assert all(m['venta'] == venta['id'] and m['cant'] == -1 for m in estado['movs'][-3:])
        pagina.get_by_role('button', name='Deshacer').click()
        estado = datos_guardados(pagina)
        assert estado['ventas'][-1]['borrado'] and all(m['borrado'] for m in estado['movs'][-3:])
        assert pagina.evaluate('(ids) => ids.map(stockDe)', ids[:3]) == [
            round(sum(m['cant'] for m in antes['movs'] if m['prod'] == id_ and not m.get('borrado')), 2)
            for id_ in ids[:3]
        ]
    finally:
        sitio.cerrar()


def prueba_opciones_venta(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        sitio.pagina.add_init_script("""(() => {
          window.solicitudesWhatsApp = [];
          window.open = url => {
            window.solicitudesWhatsApp.push(url);
            throw new DOMException('Ventana bloqueada', 'NotAllowedError');
          };
        })();""")
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': 'SP-ABCDE'} if p['id'] == 'p1' else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado, quien='Elba')
        pagina.get_by_role('navigation').get_by_role('button', name='Vender').click()
        dialogo = pagina.get_by_role('dialog', name='Nueva venta')
        dialogo.get_by_role('button', name='María José Andrade').click()
        expect(dialogo.locator('.paciente-venta-nombre b')).to_have_text('María José Andrade')
        dialogo.get_by_role('button', name='Cambiar').click()
        pacientes = pagina.get_by_role('dialog', name='Elegir paciente')
        buscar = pacientes.get_by_role('searchbox')
        buscar.fill('MARIA JOSE')
        expect(pacientes.locator('.fila-lista')).to_have_count(1)
        buscar.fill('099 123')
        expect(pacientes.locator('.fila-lista')).to_contain_text('María José Andrade')
        pacientes.get_by_role('button', name='Sin nombre').click()
        expect(dialogo.locator('.paciente-venta-nombre b')).to_have_text('Sin nombre')
        nueva_paciente_venta(pagina, '  Clara Niebla ', '099 555 0123')
        assert datos_guardados(pagina) == estado

        dialogo.get_by_role('button', name='Protector solar', exact=True).click()
        expect(dialogo.locator('.tarjeta-venta')).to_have_count(1)
        buscar = dialogo.get_by_role('searchbox', name='Buscar producto')
        buscar.fill('azelac')
        expect(dialogo.locator('.tarjeta-venta')).to_have_count(0)
        dialogo.get_by_role('button', name='Más vendidos').click()
        expect(dialogo.locator('.tarjeta-venta')).to_contain_text('Azelac')
        buscar.fill('sp-abcde')
        tarjeta = dialogo.locator('.tarjeta-venta')
        expect(tarjeta).to_contain_text('Quedan 5')
        for color in ('light', 'dark'):
            pagina.emulate_media(color_scheme=color)
            expect(pagina.locator('html')).to_have_attribute('data-theme', color)
            razones = contrastes(pagina, [
                ['.nombre-tarjeta-venta', '.tarjeta-venta'],
                ['.stock-tarjeta-venta', '.tarjeta-venta'], ['.pac-nueva', '.paciente-venta'],
                ['.escaner-venta'], ['.fecha-carrito', '.carrito'],
            ])
            assert min(razones) >= 4.5, razones
        assert dialogo.locator('.hoja-cuerpo').evaluate('el => el.scrollWidth === el.clientWidth')
        tarjeta.click()
        resumen = dialogo.locator('.resumen-venta')
        resumen.click()
        item = dialogo.locator('.item-venta')
        item.get_by_role('button', name='Restar uno').click()
        expect(item).to_have_count(0)
        expect(dialogo.get_by_role('button', name='Cobrar', exact=True)).to_be_disabled()
        tarjeta.click()
        item.get_by_label('Cantidad').fill('6')
        descuento = dialogo.get_by_label('Descuento ($)')
        descuento.fill('109')
        dialogo.get_by_role('button', name='Cobrar $ 0,00').click()
        expect(pagina.locator('#toast')).to_contain_text('El descuento tiene que estar')
        descuento.fill('8,5')
        dialogo.get_by_label('Fecha', exact=True).fill('2026-11-26')
        expect(dialogo.locator('#fechaVisible')).to_have_text('26 nov')
        expect(dialogo.locator('#fechaResumen')).to_have_text('26 nov')
        dialogo.get_by_role('button', name='Transferencia', exact=True).click()
        dialogo.get_by_role('button', name='Queda pendiente', exact=True).click()
        dialogo.get_by_label('Enviar comprobante por WhatsApp').check()
        expect(dialogo.locator('#ayudaComprobante')).to_have_text('Para 099 555 0123')
        expect(dialogo.locator('#vTotal')).to_have_text('$ 99,50')
        registrar = dialogo.get_by_role('button', name='Registrar pendiente · $ 99,50')
        registrar.click()
        confirmar = pagina.get_by_role('dialog', name='No alcanza el inventario')
        expect(confirmar).to_contain_text('Sun Screen Clear')
        confirmar.get_by_role('button', name='Cancelar').click()
        expect(confirmar).to_have_count(0)
        assert datos_guardados(pagina) == estado
        assert pagina.evaluate('solicitudesWhatsApp') == []
        registrar.click()
        confirmar.get_by_role('button', name='Registrar igual').click()
        expect(pagina.locator('#toast')).to_contain_text('Venta pendiente · $ 99,50')
        guardado = datos_guardados(pagina)
        v = guardado['ventas'][-1]
        assert (v['pago'], v['cobrado'], v['descuento'], v['fecha']) == ('transferencia', False, 8.5, '2026-11-26')
        assert (v['pac'], v['tel']) == ('Clara Niebla', '099 555 0123')
        assert any((p['nombre'], p['tel']) == (v['pac'], v['tel']) for p in guardado['pacientes'])
        assert pagina.evaluate("stockDe('p1')") == -1
        enlaces = pagina.evaluate('solicitudesWhatsApp')
        assert len(enlaces) == 1
        comprobante = urlsplit(enlaces[0])
        assert (comprobante.scheme, comprobante.netloc, comprobante.path) == ('https', 'wa.me', '/593995550123')
        mensaje = parse_qs(comprobante.query)['text'][0]
        assert all(texto in mensaje for texto in ('Comprobante SPARATI', '6 × Sun Screen Clear', 'Descuento: $ 8,50',
                                                  'Total: $ 99,50', 'Queda pendiente'))
        expect(pagina.get_by_role('link', name='Abrir comprobante en WhatsApp')).to_have_attribute('href', enlaces[0])

        inventario(pagina, 'ventas')
        pagina.locator('.venta').filter(has_text='Clara Niebla').click()
        editar = pagina.get_by_role('dialog', name='Editar venta')
        expect(editar.get_by_role('button', name='Queda pendiente')).to_have_attribute('aria-pressed', 'true')
        expect(editar.get_by_role('button', name='Transferencia')).to_have_attribute('aria-pressed', 'true')
        expect(editar.get_by_label('Descuento ($)')).to_have_value('8,50')
        expect(editar.get_by_role('link', name='Abrir comprobante en WhatsApp')).to_have_attribute('href', enlaces[0])
        editar.get_by_role('button', name='Cobrado', exact=True).click()
        editar.get_by_label('Cantidad').fill('5')
        editar.get_by_role('button', name='Guardar cambios').click()
        expect(editar).to_have_count(0)
        guardado = datos_guardados(pagina)
        actual = guardado['ventas'][-1]
        assert actual['id'] == v['id'] and actual['creado'] == v['creado']
        assert actual['cobrado'] and actual['descuento'] == 8.5
        assert pagina.evaluate("stockDe('p1')") == 0
        assert pagina.evaluate('solicitudesWhatsApp') == enlaces
    finally:
        sitio.cerrar()


def prueba_camara_venta(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        simular_camara(sitio.pagina)
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': '5901234123457'} if p['id'] == 'p1' else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado)
        pagina.get_by_role('navigation').get_by_role('button', name='Vender').click()
        assert pagina.evaluate('camaraPrueba.solicitudes') == []
        dialogo = pagina.get_by_role('dialog', name='Nueva venta')
        dialogo.get_by_role('button', name='Escanear código de barras').click()
        lector = pagina.get_by_role('dialog', name='Escanear')
        expect(lector.get_by_text('No se dio permiso para la cámara', exact=False)).to_be_visible()
        campo = lector.get_by_label('Escribir el código a mano')
        expect(campo).to_be_visible()
        assert campo.evaluate('el => getComputedStyle(el).fontSize') == '16px'
        pagina.evaluate("Object.assign(camaraPrueba, {modo:'blanca', admiteLinterna:true})")
        lector.get_by_role('button', name='Abrir cámara').click()
        expect(lector.locator('video')).to_be_visible()
        for atributo in ('playsinline', 'muted', 'autoplay'):
            expect(lector.locator('video')).to_have_attribute(atributo, '')
        assert pagina.evaluate('camaraPrueba.solicitudes.at(-1)') == {
            'video': {'facingMode': {'ideal': 'environment'}}, 'audio': False,
        }
        linterna = lector.get_by_role('button', name='Linterna')
        linterna.click()
        expect(linterna).to_have_attribute('aria-pressed', 'true')
        linterna.click()
        expect(linterna).to_have_attribute('aria-pressed', 'false')
        assert pagina.evaluate('camaraPrueba.linterna') == [True, False]
        pagina.evaluate("camaraPrueba.modo = 'ean'")
        expect(lector.locator('.resultado-escaner')).to_contain_text('Producto encontrado')
        expect(lector.locator('.producto-escaner')).to_contain_text('Sun Screen Clear')
        expect(lector.locator('.producto-escaner')).to_contain_text('Quedan 5')
        expect(lector.locator('.producto-escaner')).to_contain_text('$ 18,00')
        for tema in ('light', 'dark'):
            pagina.emulate_media(color_scheme=tema)
            expect(pagina.locator('html')).to_have_attribute('data-theme', tema)
            razones = contrastes(pagina, [
                ['.resultado-escaner-titulo', '.escaner-panel'], ['.producto-escaner strong', '.escaner-panel'],
                ['.producto-escaner p', '.escaner-panel'], ['.stock-disponible', '.escaner-panel'],
                ['.acciones-escaner .btn:not(.ghost)'], ['.escaner-controles .link', '.escaner-panel'],
            ])
            assert min(razones) >= 4.5, razones
        assert lector.locator('.escaner-contenido').evaluate('el => el.scrollWidth === el.clientWidth')
        lector.get_by_role('button', name='Escanear otro').click()
        pagina.clock.run_for(400)
        expect(lector.locator('.producto-escaner')).to_have_count(0)
        assert pagina.evaluate('camaraPrueba.solicitudes.length') == 2
        escribir_codigo(lector, '5901234123457')
        lector.get_by_role('button', name='Agregar a la venta').click()
        expect(lector).to_have_count(0)
        expect(dialogo.locator('#resumenVenta')).to_have_text('Venta · 1 producto')
        expect(dialogo.locator('.cantidad-tarjeta-venta:visible')).to_have_text('1')
        assert pagina.evaluate('camaraPrueba.pistas[0].readyState') == 'ended'
        assert datos_guardados(pagina) == estado
    finally:
        sitio.cerrar()


def prueba_escaner_modos(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        simular_camara(sitio.pagina)
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': 'SP-VENTA'} if p['id'] == 'p1' else
            {**p, 'codigo': 'SP-USADO', 'unidad': 'ampollas'} if p['id'] == 'p3' else p
            for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado, quien='Elba')
        inventario(pagina, 'uso')
        pagina.get_by_role('button', name='Escanear', exact=True).click()
        lector = pagina.get_by_role('dialog', name='Escanear')
        modos = lector.get_by_role('group', name='Modo de escaneo')
        expect(modos.get_by_role('button', name='Usé')).to_have_attribute('aria-pressed', 'true')
        escribir_codigo(lector, 'sp-venta')
        expect(lector.get_by_role('button', name='Registrar uso')).to_be_disabled()
        expect(lector.get_by_text('Este producto es para vender.', exact=False)).to_be_visible()
        modos.get_by_role('button', name='Vender').click()
        expect(lector.get_by_role('button', name='Agregar a la venta')).to_be_enabled()
        modos.get_by_role('button', name='Usé').click()
        escribir_codigo(lector, 'SP-USADO')
        expect(lector.locator('.producto-escaner')).to_contain_text('Queda 1')
        lector.get_by_role('button', name='Registrar uso').click()
        uso = pagina.get_by_role('dialog', name=re.compile('^Usar ·'))
        expect(uso.get_by_label('¿Cuánto usaste? (ampollas)')).to_have_value('1')
        uso.get_by_role('button', name='Guardar', exact=True).click()
        expect(uso).to_have_count(0)
        assert pagina.evaluate("stockDe('p3')") == 0

        inventario(pagina, 'inicio')
        escanear_inicio = pagina.get_by_role('button', name='Escanear', exact=True)
        escanear_inicio.click()
        escribir_codigo(lector, 'SP-VENTA')
        lector.get_by_role('button', name='Agregar a la venta').click()
        venta = pagina.get_by_role('dialog', name='Nueva venta')
        expect(venta.locator('#resumenVenta')).to_have_text('Venta · 1 producto')
        venta.get_by_label('Nota (opcional)').fill('Nota de la venta')
        escanear_venta = venta.get_by_role('button', name='Escanear código de barras')
        escanear_venta.click()
        modos.get_by_role('button', name='Llegó').click()
        escribir_codigo(lector, 'SP-VENTA')
        lector.get_by_role('button', name='Registrar entrada').click()
        entrada = pagina.get_by_role('dialog', name=re.compile('^Llegó más ·'))
        entrada.get_by_label('Nota (opcional)').fill('Mercadería de prueba')
        entrada.get_by_role('button', name='Guardar', exact=True).click()
        expect(venta).to_be_visible()
        expect(venta.get_by_label('Nota (opcional)')).to_have_value('Nota de la venta')
        expect(venta.locator('[data-id=p1] .stock-tarjeta-venta')).to_have_text('Quedan 6')

        escanear_venta.click()
        modos.get_by_role('button', name='Contar').click()
        escribir_codigo(lector, 'SP-VENTA')
        lector.get_by_role('button', name='Contar producto').click()
        conteo = pagina.get_by_role('dialog', name=re.compile('^Contar ·'))
        conteo.get_by_label('¿Cuántos hay de verdad? (unidades)').fill('8')
        conteo.get_by_role('button', name='Guardar', exact=True).click()
        expect(venta.locator('[data-id=p1] .stock-tarjeta-venta')).to_have_text('Quedan 8')
        venta.get_by_role('button', name='Cobrar $ 18,00').click()
        expect(pagina.locator('#toast')).to_contain_text('Venta cobrada')
        guardado = datos_guardados(pagina)
        assert guardado['ventas'][-1]['nota'] == 'Nota de la venta'
        uso, entrada, conteo, cobro = guardado['movs'][-4:]
        assert [(m['tipo'], m['prod'], m['cant']) for m in (uso, entrada, conteo, cobro)] == [
            ('uso', 'p3', -1), ('entrada', 'p1', 1), ('ajuste', 'p1', 2), ('venta', 'p1', -1),
        ]
        assert entrada['nota'] == 'Mercadería de prueba' and conteo['motivo'] == 'conteo'
        assert pagina.evaluate("stockDe('p1')") == 7

        for nombre, etiqueta in [('Contar inventario', 'Contar'), ('Llegó mercadería', 'Llegó'), ('Usé en cabina', 'Usé')]:
            pagina.get_by_role('group', name='Acciones rápidas').get_by_role('button', name=nombre).click()
            selector = pagina.get_by_role('dialog', name=nombre)
            selector.get_by_role('button', name='Escanear').click()
            expect(modos.get_by_role('button', name=etiqueta)).to_have_attribute('aria-pressed', 'true')
            cerrar_hoja(pagina)
            expect(selector.get_by_role('button', name='Escanear')).to_be_focused()
            cerrar_hoja(pagina)
    finally:
        sitio.cerrar()


def prueba_escaner_codigo_nuevo(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        simular_camara(sitio.pagina)
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': '0036000291452'} if p['id'] == 'p2' else
            {**p, 'codigo': 'Lote:É<42>'} if p.get('borrado') else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado, quien='Elba')
        pagina.get_by_role('button', name='Escanear', exact=True).click()
        lector = pagina.get_by_role('dialog', name='Escanear')
        escribir_codigo(lector, '036000291452')
        expect(lector.locator('.producto-escaner')).to_contain_text('Azelac Serum')
        escribir_codigo(lector, ' Lote:É<42> ')
        expect(lector.locator('.codigo-leido')).to_have_text('Lote:É<42>')
        assert datos_guardados(pagina) == estado
        lector.get_by_role('button', name='Asignar a un producto').click()
        selector = pagina.get_by_role('dialog', name='Asignar a un producto')
        expect(selector.locator('.fila-lista')).to_have_count(2)
        buscar = selector.get_by_role('searchbox', name='Buscar producto')
        buscar.fill('nipro')
        expect(selector.locator('.vacio')).to_contain_text('No encontré')
        buscar.fill('sun screen')
        fila = selector.locator('.fila-lista')
        expect(fila).to_have_count(1)
        pagina.evaluate("() => { window.guardarOriginal = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('Memoria llena'); }; }")
        fila.click()
        expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
        assert datos_guardados(pagina) == estado
        pagina.evaluate('() => { Storage.prototype.setItem = window.guardarOriginal; }')
        fila.click()
        expect(lector.locator('.producto-escaner')).to_contain_text('Sun Screen Clear')
        guardado = datos_guardados(pagina)
        assert guardado['productos'][0]['codigo'] == 'Lote:É<42>'
        assert guardado['productos'][0]['por'] == 'Elba'
        assert guardado['productos'][0]['mod'] >= int(FECHA.timestamp() * 1000)
        assert guardado['movs'] == estado['movs'] and guardado['ventas'] == estado['ventas']
        lector.get_by_role('button', name='Agregar a la venta').click()
        venta = pagina.get_by_role('dialog', name='Nueva venta')
        escanear = venta.get_by_role('button', name='Escanear código de barras')
        escanear.click()
        escribir_codigo(lector, 'lote:É<42>')
        expect(lector.locator('.resultado-escaner')).to_contain_text('No encontré')
        lector.get_by_role('button', name='Crear producto con este código').click()
        nuevo = pagina.get_by_role('dialog', name='Nuevo producto')
        codigo = nuevo.get_by_label('Código de barras')
        expect(codigo).to_have_value('lote:É<42>')
        nuevo.get_by_label('Nombre del producto').fill('Protector de prueba')
        codigo.fill('036000291452')
        nuevo.get_by_role('button', name='Guardar', exact=True).click()
        expect(pagina.locator('#toast')).to_contain_text('Ese código ya está asignado a Azelac')
        assert datos_guardados(pagina) == guardado
        codigo.fill('0012345678')
        nuevo.get_by_role('button', name='Guardar', exact=True).click()
        expect(venta).to_be_visible()
        expect(venta.locator('#resumenVenta')).to_have_text('Venta · 1 producto')
        venta.get_by_role('searchbox', name='Buscar producto').fill('protector de prueba')
        expect(venta.locator('.tarjeta-venta')).to_contain_text('Protector de prueba')
        escanear.click()
        escribir_codigo(lector, ' 0012345678 ')
        expect(lector.locator('.producto-escaner')).to_contain_text('Protector de prueba')
        assert datos_guardados(pagina)['productos'][-1]['codigo'] == '0012345678'
    finally:
        sitio.cerrar()


def prueba_escaner_cierre(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        simular_camara(sitio.pagina, detector_local=False)
        sitio.pagina.add_init_script("""(() => {
          window.detectorPrueba = {formatos: [], pitidos: [], vibraciones: [], codigo: ''};
          Object.defineProperty(window, 'BarcodeDetector', {value: class {
            static async getSupportedFormats(){ return ['ean_13','ean_8','upc_a','upc_e','code_128','qr_code']; }
            constructor({formats}){ detectorPrueba.formatos.push(formats); }
            async detect(){ return detectorPrueba.codigo ? [{rawValue:detectorPrueba.codigo}] : []; }
          }, configurable: true});
          const empezar = OscillatorNode.prototype.start;
          OscillatorNode.prototype.start = function(...args){
            detectorPrueba.pitidos.push(this.frequency.value);
            return empezar.apply(this, args);
          };
          Object.defineProperty(navigator, 'vibrate', {value: duracion => { detectorPrueba.vibraciones.push(duracion); }});
        })();""")
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': 'SP-NATIV'} if p['id'] == 'p1' else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado)
        boton = pagina.get_by_role('button', name='Escanear', exact=True)
        lector = pagina.get_by_role('dialog', name='Escanear')
        pagina.evaluate("camaraPrueba.modo = 'pendiente'")
        boton.click()
        pagina.wait_for_function("typeof camaraPrueba.otorgar === 'function'")
        cerrar_hoja(pagina)
        expect(boton).to_be_focused()
        pagina.evaluate('camaraPrueba.otorgar()')
        pagina.wait_for_function("camaraPrueba.pistas[0]?.readyState === 'ended'")
        assert pagina.evaluate('detectorPrueba.formatos') == []

        pagina.evaluate("camaraPrueba.modo = 'blanca'")
        boton.click()
        expect(lector.locator('video')).to_be_visible()
        expect(lector.get_by_role('button', name='Linterna')).to_have_count(0)
        pagina.wait_for_function('detectorPrueba.formatos.length === 1')
        assert pagina.evaluate('detectorPrueba.formatos[0]') == ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']
        pagina.evaluate("detectorPrueba.codigo = 'SP-NATIV'")
        expect(lector.locator('.producto-escaner')).to_contain_text('Sun Screen Clear')
        assert pagina.evaluate('detectorPrueba.vibraciones') == [35]
        assert pagina.evaluate('detectorPrueba.pitidos') == [880]
        pagina.clock.run_for(500)
        assert pagina.evaluate('detectorPrueba.vibraciones') == [35]
        pagina.evaluate("window.dispatchEvent(new Event('pagehide'))")
        expect(lector.get_by_text('La cámara se pausó.', exact=False)).to_be_visible()
        assert pagina.evaluate('camaraPrueba.pistas[1].readyState') == 'ended'
        lector.get_by_role('button', name='Escanear otro').click()
        expect(lector.locator('.producto-escaner')).to_contain_text('Sun Screen Clear')
        lector.get_by_role('button', name='Escribir el código a mano').click()
        expect(lector.get_by_label('Escribir el código a mano')).to_be_focused()
        assert pagina.evaluate('camaraPrueba.pistas[2].readyState') == 'ended'
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
        lector = pagina.get_by_role('dialog', name='Escanear')
        escribir_codigo(lector, p['codigo'])
        lector.get_by_role('button', name='Ver producto').click()
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


def prueba_ficha_venta(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        venta = ESTADO_V1['ventas'][0]
        repetida = {**venta, 'id': 'v2', 'pac': 'maria jose andrade', 'fecha': '2026-11-26', 'pago': 'tarjeta'}
        borrada = {**venta, 'id': 'v3', 'pac': 'Ficha borrada', 'borrado': True}
        m4 = ESTADO_V1['movs'][3]
        estado = {**ESTADO_V1,
            'productos': [{**p, 'precio': 16, 'costo': 9.5, 'max': 5, 'vence': '2028-03-10', 'lote': '24A3'}
                          if p['id'] == 'p1' else p for p in ESTADO_V1['productos']],
            'movs': [{**m, 'cant': 1} if m['id'] == 'm1' else m for m in ESTADO_V1['movs']] + [
                {**m4, 'id': 'm10', 'pac': '', 'venta': 'v2', 'fecha': '2026-11-26'},
            ],
            'ventas': [venta, repetida, borrada],
        }
        pagina = sitio.abrir(estado=estado, quien='Elba')
        inventario(pagina, 'venta')
        producto = pagina.locator('#listaProd [data-id=p1]')
        producto.click()
        ficha = pagina.get_by_role('dialog', name=estado['productos'][0]['nombre'])
        stock = ficha.get_by_role('region', name='Existencias')
        historial = ficha.get_by_role('region', name='Historial')
        acciones = ficha.get_by_role('group', name='Acciones del producto')
        deshacer = pagina.get_by_role('button', name='Deshacer')
        expect(ficha.get_by_role('heading', level=1)).to_be_visible()
        expect(ficha.locator('.foto-ficha')).to_have_text('SS')
        expect(stock.locator('.q')).to_have_text('1')
        expect(stock).to_contain_text('Por terminarse')
        expect(stock).to_contain_text('se acabaría en ~14 días')
        expect(stock).to_contain_text('Te aviso cuando queden 2.')
        expect(stock.locator('.barra-stock .lleno')).to_have_count(1)
        expect(ficha.locator('.precios-ficha .cifra')).to_have_text(['Precio$ 16,00', 'Costo$ 9,50', 'Ganancia$ 6,50 41 %'])
        expect(ficha.locator('.datos-ficha')).to_contain_text('mar 2028 · lote 24A3')
        expect(ficha.locator('.datos-ficha')).to_contain_text('1 paciente')
        expect(historial.locator('li')).to_have_count(4)
        expect(historial.locator('li b')).to_have_text(['Venta a maria jose andrade', 'Llegaron 2', 'Venta a María José Andrade', 'Cantidad inicial'])
        expect(historial.locator('li').first).to_contain_text('− 1 · $ 18,00 · Tarjeta')
        barra = ficha.get_by_role('navigation', name='Principal')
        expect(barra.get_by_role('button', name='Inventario')).to_have_attribute('aria-current', 'page')
        assert ficha.locator('.hoja-cuerpo').evaluate('el => el.scrollWidth === el.clientWidth')
        for esquema in ('dark', 'light'):
            pagina.emulate_media(color_scheme=esquema)
            expect(pagina.locator('html')).to_have_attribute('data-theme', esquema)
            razones = contrastes(pagina, [['.stock-ficha .pill'], ['.precios-ficha .ganancia'], ['.dato-ficha .dato-ico']])
            assert min(razones) >= 4.5, razones

        acciones.get_by_role('button', name='Vender', exact=True).click()
        formulario = pagina.get_by_role('dialog', name='Nueva venta')
        expect(formulario.locator('#vTotal')).to_have_text('$ 16,00')
        nueva_paciente_venta(pagina, 'Rosa Cauce')
        formulario.get_by_role('button', name='Cobrar $ 16,00').click()
        expect(pagina).to_have_url(APP)
        inventario(pagina, 'venta')
        producto.click()
        expect(stock.locator('.q')).to_have_text('0')
        expect(stock).to_contain_text('Agotado')
        expect(stock.locator('.barra-stock .lleno')).to_have_count(0)
        expect(historial.locator('li').first).to_contain_text('Venta a Rosa Cauce')
        expect(ficha.locator('.datos-ficha')).to_contain_text('2 pacientes')
        guardado = datos_guardados(pagina)
        assert guardado['movs'][-1]['cant'] == -1 and guardado['movs'][-1]['venta'] == guardado['ventas'][-1]['id']
        deshacer.click()
        expect(stock.locator('.q')).to_have_text('1')
        expect(historial).not_to_contain_text('Rosa Cauce')
        expect(ficha.locator('.datos-ficha')).to_contain_text('1 paciente')
        guardado = datos_guardados(pagina)
        assert guardado['movs'][-1]['borrado'] and guardado['ventas'][-1]['borrado']

        acciones.get_by_role('button', name='Llegó más').click()
        formulario = pagina.get_by_role('dialog', name=re.compile('^Llegó más'))
        formulario.get_by_label('¿Cuántos llegaron?').fill('3')
        formulario.get_by_label('Costo de cada uno').fill('11,75')
        formulario.get_by_label('Vence (opcional)').fill('2027-08-01')
        formulario.get_by_label('Lote (opcional)').fill('LOTE-NUEVO')
        formulario.get_by_role('button', name='Guardar', exact=True).click()
        expect(stock.locator('.q')).to_have_text('4')
        expect(historial.locator('li').first).to_contain_text('Llegaron 3')
        expect(historial.locator('li').first).to_contain_text('Costo $ 11,75 c/u')
        expect(ficha.locator('.datos-ficha')).to_contain_text('ago 2027 · lote LOTE-NUEVO')
        expect(ficha.locator('.precios-ficha')).to_contain_text('$ 11,75')
        guardado = datos_guardados(pagina)
        assert (guardado['movs'][-1]['tipo'], guardado['movs'][-1]['cant'], guardado['movs'][-1]['por']) == ('entrada', 3, 'Elba')
        deshacer.click()
        expect(stock.locator('.q')).to_have_text('1')
        expect(historial).not_to_contain_text('Llegaron 3')
        expect(ficha.locator('.datos-ficha')).to_contain_text('mar 2028 · lote 24A3')
        expect(ficha.locator('.precios-ficha')).to_contain_text('$ 9,50')
        guardado = datos_guardados(pagina)
        assert guardado['movs'][-1]['borrado'] and guardado['productos'][0]['costo'] == 9.5

        ajustar = acciones.get_by_role('button', name='Ajustar cantidad')
        ajustar.click()
        formulario = pagina.get_by_role('dialog', name=re.compile('^Ajustar'))
        motivos = formulario.get_by_role('group', name='Motivo')
        expect(motivos.get_by_role('button')).to_have_text(['Conteo', 'Se dañó', 'Se venció', 'Regalo', 'Otro'])
        real = formulario.get_by_label('¿Cuántos hay de verdad?')
        real.fill('0')
        assert real.evaluate('el => getComputedStyle(el).outlineOffset') == '-3px'
        motivos.get_by_role('button', name='Se dañó').click()
        formulario.get_by_label('Nota (opcional)').fill('Se rompió el envase')
        formulario.get_by_role('button', name='Guardar', exact=True).click()
        expect(stock.locator('.q')).to_have_text('0')
        expect(historial.locator('li').first).to_contain_text('− 1 · Se dañó · Se rompió el envase')
        ajuste = datos_guardados(pagina)['movs'][-1]
        assert (ajuste['tipo'], ajuste['cant'], ajuste['motivo']) == ('ajuste', -1, 'dañado')
        deshacer.click()
        expect(stock.locator('.q')).to_have_text('1')
        expect(historial).not_to_contain_text('Se rompió el envase')
        assert datos_guardados(pagina)['movs'][-1]['borrado']

        ajustar.click()
        expect(motivos.get_by_role('button', name='Conteo')).to_have_attribute('aria-pressed', 'true')
        formulario.get_by_role('button', name='Guardar', exact=True).click()
        expect(historial.locator('li').first).to_contain_text('Conteo de inventario')
        expect(historial.locator('li').first).to_contain_text('Sin diferencia')
        conteo = datos_guardados(pagina)['movs'][-1]
        assert (conteo['tipo'], conteo['cant'], conteo['motivo']) == ('ajuste', 0, 'conteo')
        deshacer.click()
        expect(historial).not_to_contain_text('Conteo de inventario')

        barra.get_by_role('button', name='Vender otros productos').click()
        expect(pagina.locator('#vTotal')).to_have_text('$ 0,00')
        cerrar_hoja(pagina)
        expect(ficha).to_be_visible()
        barra.get_by_role('button', name='Reportes').click()
        expect(pagina.locator('#capas > *')).to_have_count(0)
        expect(pagina).to_have_url(APP + '#reportes')
        pagina.evaluate('history.back()')
        expect(producto).to_be_visible()
        expect(pagina.locator('#capas > *')).to_have_count(0)
    finally:
        sitio.cerrar()


def prueba_frascos_cabina(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        pagina = sitio.abrir(quien='Elba')
        pagina.clock.set_fixed_time(FECHA)
        abrir_ajustes(pagina).get_by_role('button', name='Cargar datos de ejemplo').click()
        expect(pagina.locator('#toast')).to_have_text('Datos de ejemplo cargados')
        estado = verificar_ejemplo(pagina)
        apertura = next(m for m in estado['movs'] if m['tipo'] == 'apertura')
        producto = next(p for p in estado['productos'] if p['id'] == apertura['prod'])
        pid = producto['id']
        pagina.evaluate("""id => {
          const movs = E.movs.map(m => m.prod === id && m.tipo === 'inicial' ?
            {...m, cant:m.cant + 1, fecha:'2026-08-01'} : m);
          // Una pareja más antigua y una terminación borrada no pesan en los últimos tres frascos.
          movs.push(
            {id:'antiguo-fin', prod:id, tipo:'uso', cant:-1, motivo:'terminado', fecha:'2026-09-24'},
            {id:'antiguo-abrir', prod:id, tipo:'apertura', cant:0, fecha:'2026-08-02'},
            {id:'fin-borrado', prod:id, tipo:'uso', cant:-1, motivo:'terminado', fecha:'2026-11-26', borrado:true});
          guardar({...E, movs});
        }""", pid)
        cerrar_hoja(pagina)
        inventario(pagina, 'uso')
        pagina.locator('#qProd').fill(producto['nombre'])
        pagina.locator(f'#listaProd [data-id="{pid}"]').click()
        ficha = pagina.get_by_role('dialog', name=producto['nombre'])
        tarjeta = ficha.get_by_role('region', name='Frasco en uso')
        historial = ficha.get_by_role('region', name='Historial')
        barra = tarjeta.get_by_role('progressbar')
        stock = ficha.locator('.resumen-cabina .cifra:first-child .v')
        costo = ficha.locator('.costo-dia .v')
        terminar = tarjeta.get_by_role('button', name='Se terminó', exact=True)
        abrir = tarjeta.get_by_role('button', name='Abrí uno nuevo', exact=True)
        deshacer = pagina.get_by_role('button', name='Deshacer', exact=True)
        expect(ficha.get_by_role('navigation').get_by_role('button', name='Inventario')).to_have_attribute('aria-current', 'page')
        expect(barra).to_have_attribute('aria-valuenow', '38')
        expect(tarjeta).to_contain_text('unos 16 días (promedio de tus últimos 3 frascos)')
        expect(tarjeta.locator('time').nth(0)).to_have_attribute('datetime', '2026-11-21')
        expect(tarjeta.locator('time').nth(1)).to_have_attribute('datetime', '2026-12-07')
        expect(costo).to_have_text('$ 0,77')
        expect(stock).to_have_text('0 frascos')
        expect(historial.locator('[data-mov=terminado]')).to_have_count(4)
        expect(historial.locator('[data-mov=terminado]').first).to_contain_text('Duró 17 días')
        expect(ficha.get_by_role('button', name=re.compile('^Usar '))).to_have_count(0)
        for tema in ('light', 'dark'):
            pagina.emulate_media(color_scheme=tema)
            razones = contrastes(pagina, [['.frasco-cab .pill'], ['.frasco-en-uso .btn.ghost'], ['.costo-dia .v', '.costo-dia']])
            assert min(razones) >= 4.5, razones
        assert abrir.bounding_box()['height'] >= 44
        assert terminar.bounding_box()['width'] >= 44

        antes = datos_guardados(pagina)
        abrir.click()
        expect(pagina.locator('#toast')).to_contain_text('Primero anota que se terminó')
        assert datos_guardados(pagina) == antes
        pagina.evaluate("""() => {
          window.setItemOriginal = Storage.prototype.setItem;
          Storage.prototype.setItem = () => { throw new Error('Memoria llena'); };
        }""")
        terminar.click()
        expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
        assert datos_guardados(pagina) == antes
        assert pagina.evaluate('id => prodPorId(id).abierto', pid) == producto['abierto']
        pagina.evaluate('() => { Storage.prototype.setItem = window.setItemOriginal; }')

        terminar.click()
        expect(tarjeta).to_contain_text('Agotado')
        expect(historial.locator('[data-mov=terminado]').first).to_contain_text('Duró 6 días')
        expect(costo).to_have_text('$ 0,92')
        expect(abrir).to_be_disabled()
        guardado = datos_guardados(pagina)
        m = guardado['movs'][-1]
        assert (m['prod'], m['tipo'], m['cant'], m['motivo'], m['fecha'], m['costo']) == (pid, 'uso', -1, 'terminado', '2026-11-27', 12)
        assert next(p for p in guardado['productos'] if p['id'] == pid)['abierto'] == ''
        deshacer.click()
        expect(barra).to_have_attribute('aria-valuenow', '38')
        expect(costo).to_have_text('$ 0,77')
        assert datos_guardados(pagina)['movs'][-1]['id'] == m['id']
        assert datos_guardados(pagina)['movs'][-1]['borrado']

        ficha.get_by_role('button', name='Llegó más').click()
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(stock).to_have_text('1 frasco')
        terminar.click()
        expect(terminar).to_be_disabled()
        expect(stock).to_have_text('1 frasco')
        abrir.click()
        expect(tarjeta).to_contain_text('Abierto hoy')
        expect(barra).to_have_attribute('aria-valuenow', '0')
        expect(stock).to_have_text('0 frascos')
        assert pagina.evaluate('stockDe', pid) == 1
        a = datos_guardados(pagina)['movs'][-1]
        assert (a['prod'], a['tipo'], a['cant'], a['fecha'], a['por']) == (pid, 'apertura', 0, '2026-11-27', 'Elba')
        actual = next(p for p in datos_guardados(pagina)['productos'] if p['id'] == pid)
        assert (actual['abierto'], actual['mod'], actual['por']) == (a['fecha'], a['mod'], a['por'])
        deshacer.click()
        expect(tarjeta).to_contain_text('Anota cuándo abres un frasco nuevo')
        expect(stock).to_have_text('1 frasco')
        assert datos_guardados(pagina)['movs'][-1]['borrado']
        pagina.clock.set_fixed_time(FECHA + timedelta(days=1))
        abrir.click()
        apertura_id = datos_guardados(pagina)['movs'][-1]['id']
        editar = ficha.get_by_role('button', name='Editar producto')
        editar.click()
        pagina.get_by_label('Fecha en que se abrió').fill('2026-11-26')
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(pagina.locator('#toast')).to_contain_text('El frasco anterior se terminó el 27 nov')
        assert datos_guardados(pagina)['movs'][-1]['fecha'] == '2026-11-28'
        cerrar_hoja(pagina)
        for fecha, mensaje, avance in [('2026-11-27', 'Abierto hace 1 día', '8'), ('2026-11-28', 'Abierto hoy', '0')]:
            editar.click()
            pagina.get_by_label('Fecha en que se abrió').fill(fecha)
            pagina.get_by_role('button', name='Guardar', exact=True).click()
            expect(tarjeta).to_contain_text(mensaje)
            expect(barra).to_have_attribute('aria-valuenow', avance)
            a = datos_guardados(pagina)['movs'][-1]
            assert (a['id'], a['tipo'], a['fecha']) == (apertura_id, 'apertura', fecha)
        terminar.click()
        expect(historial.locator('[data-mov=terminado]').first).to_contain_text('Duró 1 día')
        expect(costo).to_have_text('$ 1,50')
        expect(stock).to_have_text('0 frascos')
        pagina.reload()
        expect(pagina.locator(f'#listaProd [data-id="{pid}"] .stock')).to_have_text('Agotado')
    finally:
        sitio.cerrar()


def prueba_tratamientos_cabina(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        # El saldo inicial del producto v1 queda en 5 ml tras el movimiento previo.
        pagina = sitio.abrir(estado={**ESTADO_V1,
            'productos': [{**p, 'unidad': 'ml', 'gasto': .5, 'abierto': '2026-10-26', 'pao': 1}
                          if p['id'] == 'p3' else p for p in ESTADO_V1['productos']],
            'movs': [{**m, 'cant': 6} if m['id'] == 'm3' else m for m in ESTADO_V1['movs']],
        })
        inventario(pagina, 'uso')
        pagina.locator('#listaProd [data-id=p3]').click()
        ficha = pagina.get_by_role('dialog', name=ESTADO_V1['productos'][2]['nombre'])
        existencias = ficha.get_by_role('region', name='Existencias')
        expect(existencias.locator('.q')).to_have_text('5')
        expect(existencias.get_by_text('Ya pasó el tiempo de uso después de abierto', exact=False)).to_be_visible()
        expect(ficha.get_by_role('region', name='Frasco en uso')).to_have_count(0)
        rapido = existencias.get_by_role('button', name='Usar 0,5 ml')
        rapido.click()
        expect(existencias.locator('.q')).to_have_text('4,5')
        uso = datos_guardados(pagina)['movs'][-1]
        assert (uso['cant'], uso['costo']) == (-.5, 24)
        pagina.get_by_role('button', name='Deshacer', exact=True).click()
        expect(existencias.locator('.q')).to_have_text('5')
        existencias.get_by_role('button', name='Otra cantidad').click()
        pagina.get_by_label('¿Cuánto usaste?').fill('1,75')
        pagina.get_by_label('Tratamiento (opcional)').fill('Facial')
        pagina.get_by_role('button', name='Guardar', exact=True).click()
        expect(existencias.locator('.q')).to_have_text('3,25')
        uso = datos_guardados(pagina)['movs'][-1]
        assert (uso['cant'], uso['costo']) == (-1.75, 24)
        expect(ficha.locator('.paso-historial').first).to_contain_text('− 1,75 · Facial')
        ficha.get_by_role('button', name='Lo abrí hoy').click()
        expect(existencias.get_by_text('Ya pasó el tiempo de uso después de abierto', exact=False)).to_have_count(0)
        assert next(p for p in datos_guardados(pagina)['productos'] if p['id'] == 'p3')['abierto'] == '2026-11-27'
        ficha.get_by_role('button', name='Volver').click()
        pagina.get_by_role('button', name='Inicio', exact=True).click()
        pagina.get_by_role('button', name='Usé en cabina').click()
        pagina.get_by_role('dialog', name='Usé en cabina').locator('[data-id=p3]').click()
        expect(pagina.get_by_label('¿Cuánto usaste?')).to_have_value('0,5')
    finally:
        sitio.cerrar()


def prueba_asignar_codigo(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        sitio.pagina.add_init_script("""(() => {
          window.solicitudesCamara = 0;
          Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: async () => {
            solicitudesCamara++;
            throw new DOMException('Permiso denegado', 'NotAllowedError');
          }});
        })();""")
        estado = {**ESTADO_V1, 'productos': [
            {**p, 'codigo': 'SP-ABCDE'} if p['id'] == 'p3' else p for p in ESTADO_V1['productos']
        ]}
        pagina = sitio.abrir(estado=estado)
        inventario(pagina, 'venta')
        producto = pagina.locator('#listaProd [data-id=p1]')
        producto.click()
        assert pagina.evaluate('solicitudesCamara') == 0
        ficha = pagina.get_by_role('dialog', name=ESTADO_V1['productos'][0]['nombre'])
        boton = ficha.get_by_role('button', name='Código de barras Asignar con la cámara')
        boton.tap() if perfil else boton.click()
        escaner = pagina.get_by_role('dialog', name='Asignar código de barras')
        expect(escaner.get_by_text('No se dio permiso para la cámara.', exact=False)).to_be_visible()
        assert pagina.evaluate('solicitudesCamara') == 1
        campo = escaner.get_by_label('Escribir el código a mano')
        assert campo.evaluate('el => getComputedStyle(el).fontSize') == '16px'
        guardar = escaner.get_by_role('button', name='Guardar código')
        campo.fill(' sp-abcde ')
        guardar.click()
        expect(escaner.locator('#errorAsignar')).to_contain_text('Ese código ya está asignado')
        assert datos_guardados(pagina) == estado
        campo.fill(' 0012345678905 ')
        guardar.click()
        asignado = ficha.get_by_role('button', name='Código de barras Asignado')
        expect(asignado).to_be_visible()
        guardado = datos_guardados(pagina)
        assert guardado['productos'][0]['codigo'] == '0012345678905'
        assert guardado['productos'][0]['por'] == 'Jonathan'
        assert guardado['movs'] == estado['movs'] and guardado['ventas'] == estado['ventas']
        asignado.click()
        expect(campo).to_have_value('0012345678905')
        assert pagina.evaluate('solicitudesCamara') == 1
        cerrar_hoja(pagina)
        expect(asignado).to_be_focused()
        cerrar_hoja(pagina)
        pagina.reload()
        pagina.get_by_role('button', name='Escanear').click()
        lector = pagina.get_by_role('dialog', name='Escanear')
        escribir_codigo(lector, '0012345678905')
        lector.get_by_role('button', name='Ver producto').click()
        expect(asignado).to_be_visible()
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
        lector = pagina.get_by_role('dialog', name='Escanear')
        escribir_codigo(lector, 'sp-claro')
        lector.get_by_role('button', name='Ver producto').click()
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
        ficha = pagina.get_by_role('dialog', name=ESTADO_V1['productos'][2]['nombre'])
        ficha.get_by_role('button', name='Se terminó', exact=True).click()
        expect(ficha.locator('.frasco-en-uso .pill')).to_have_text('Agotado')
        assert datos_guardados(pagina)['movs'][-1]['tipo'] == 'uso'
        pagina.get_by_role('button', name='Deshacer').click()
        cerrar_hoja(pagina)
        expect(selector.locator('[data-id=p3] .stock')).to_have_text('Queda 1')
        expect(buscador).to_have_value('mascarilla hidroplastica')
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
        interceptar_recordatorios(sitio.pagina)
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
            enviar = aviso.get_by_role('link', name='Enviar recordatorio')
            expect(enviar).to_have_attribute(
                'href', re.compile(r'^https://wa\.me/593991234567\?text='))
            expect(aviso.get_by_role('textbox', name='Mensaje de recordatorio')).to_have_value(
                re.compile(r'^Hola, María José Andrade\.'))
            enviar.click()
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


def prueba_ficha_paciente(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        v = ESTADO_V1['ventas'][0]
        otra = {'id': 'paciente:ines cauce', 'nombre': 'Inés Cauce', 'tel': '', 'notas': ''}
        nombre = v['pac']
        pagina = sitio.abrir(estado={**ESTADO_V1, 'pacientes': [otra], 'ventas': [
            v,
            {**v, 'id': 'compra-anterior', 'pac': 'maria jose andrade', 'fecha': '2026-10-26',
             'items': [v['items'][1]], 'descuento': 4, 'cobrado': False, 'pago': 'efectivo'},
            {**v, 'id': 'compra-mismo-dia', 'items': [v['items'][0]]},
            {**v, 'id': 'venta-borrada', 'borrado': True},
        ]})
        barra = pagina.get_by_role('navigation', name='Principal')
        barra.get_by_role('button', name='Pacientes').click()
        buscador = pagina.get_by_role('searchbox', name='Buscar paciente')
        expect(pagina.locator('#pacLista .fila-paciente')).to_have_count(2)
        buscador.fill('099 123 4567')
        filas = pagina.locator('#pacLista .fila-paciente')
        expect(filas).to_have_count(1)
        expect(filas).to_contain_text('Última compra · 20 nov')
        expect(filas).to_contain_text('$ 80,00')
        filas.click()

        ficha = pagina.get_by_role('dialog', name=nombre)
        expect(ficha.get_by_role('heading', name=nombre)).to_be_visible()
        expect(ficha.locator('.cab-paciente .av')).to_have_text('MJ')
        expect(ficha.locator('.cab-paciente p')).to_contain_text('0991234567')
        expect(ficha.get_by_role('group', name='Resumen de compras').locator('.v')).to_have_text(
            ['$ 80,00', '3', '~25 días'])
        expect(barra.get_by_role('button', name='Pacientes')).to_have_attribute('aria-current', 'page')
        compras = ficha.get_by_role('region', name='Compras')
        expect(compras.locator('.compra-paciente')).to_have_count(3)
        vieja = compras.locator('[data-id=compra-anterior]')
        expect(vieja).to_contain_text('Efectivo · Por cobrar')
        expect(vieja).to_contain_text('$ 20,00')
        vieja.click()
        expect(pagina.get_by_role('dialog', name='Editar venta')).to_be_visible()
        cerrar_hoja(pagina)
        expect(vieja).to_be_focused()

        paciente_editar = ficha.get_by_role('button', name='Editar paciente')
        paciente_editar.click()
        editar = pagina.get_by_role('dialog', name='Editar paciente')
        editar.get_by_label('Teléfono (opcional)').fill('099 876 5432')
        notas = 'Prefiere protector sin color.\nConsulta antes de separar.'
        editar.get_by_label('Notas').fill(notas)
        antes = datos_guardados(pagina)
        pagina.evaluate("""() => {
          window.guardadoOriginal = Storage.prototype.setItem;
          Storage.prototype.setItem = () => { throw new Error('Memoria llena'); };
        }""")
        guardar = editar.get_by_role('button', name='Guardar', exact=True)
        guardar.click()
        expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
        assert datos_guardados(pagina) == antes
        pagina.evaluate('() => { Storage.prototype.setItem = guardadoOriginal; }')
        guardar.click()
        expect(editar).to_have_count(0)
        expect(ficha.get_by_role('region', name='Notas').locator('p')).to_have_text(
            'Prefiere protector sin color. Consulta antes de separar.')
        expect(ficha.get_by_role('link', name='WhatsApp', exact=True)).to_have_attribute(
            'href', re.compile(r'^https://wa\.me/593998765432\?text='))
        estado = datos_guardados(pagina)
        paciente = next(p for p in estado['pacientes'] if p['nombre'] == nombre)
        assert (paciente['id'], paciente['notas'], paciente['por']) == (
            'paciente:maria jose andrade', notas, 'Jonathan')
        assert estado['ventas'] == antes['ventas']
        expect(paciente_editar).to_be_focused()

        nueva = ficha.get_by_role('button', name='Nueva venta')
        nueva.click()
        venta = pagina.get_by_role('dialog', name='Nueva venta')
        expect(venta.locator('.paciente-venta-nombre b')).to_have_text(nombre)
        venta.get_by_role('searchbox', name='Buscar producto').fill('Azelac')
        venta.locator('.tarjeta-venta').click()
        venta.get_by_role('button', name=re.compile(r'^Cobrar \$')).click()
        expect(pagina.locator('#toast')).to_contain_text('Venta cobrada')
        final = datos_guardados(pagina)['ventas'][-1]
        assert (final['pac'], final['tel']) == (nombre, '099 876 5432')

        pagina.reload()
        barra.get_by_role('button', name='Pacientes').click()
        buscador.fill('nada coincide')
        expect(pagina.locator('#pacLista')).to_contain_text('No encontré pacientes')
        buscador.fill('ines')
        filas.click()
        infrecuente = pagina.get_by_role('dialog', name='Inés Cauce')
        expect(infrecuente.get_by_text('Todavía no hay compras.')).to_be_visible()
        expect(infrecuente.locator('.recompra-paciente')).to_have_count(0)
        expect(infrecuente.locator('.cab-paciente p')).to_contain_text('Sin teléfono')
        barra.get_by_role('button', name='Reportes').click()
        expect(pagina.get_by_role('heading', name='Reportes')).to_be_visible()
    finally:
        sitio.cerrar()


def prueba_recordatorios_paciente(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        interceptar_recordatorios(sitio.pagina)
        v = ESTADO_V1['ventas'][0]
        nombre = v['pac']
        pagina = sitio.abrir(estado={**ESTADO_V1, 'productos': [
            {**p, 'duraPac': {'p1': 12, 'p2': 7}.get(p['id'], 0)} for p in ESTADO_V1['productos']
        ], 'ventas': [
            {**v, 'id': 'anterior', 'fecha': '2026-10-20', 'recordados': {'p1': True, 'p2': True}},
            v,
            {**v, 'id': 'fecha-futura', 'fecha': '2026-11-28'},
        ]}, quien='Elba')
        ajustes = abrir_ajustes(pagina)
        plantilla = 'Hola, {nombre}. ¿Te guardo {producto}?\nElba & SPARATI'
        campo = ajustes.get_by_label('Mensaje base para WhatsApp')
        expect(campo).to_have_value(re.compile(r'\{nombre\}.*\{producto\}'))
        campo.fill(plantilla)
        ajustes.get_by_role('button', name='Guardar mensaje base').click()
        expect(pagina.locator('#toast')).to_have_text('Mensaje base guardado')
        assert datos_guardados(pagina)['ajustes']['plantillaRecordatorio'] == plantilla
        pagina.reload()
        expect(pagina.locator('.contador-inicio.paciente b')).to_have_text('1')
        barra = pagina.get_by_role('navigation', name='Principal')
        barra.get_by_role('button', name='Pacientes').click()
        pagina.locator('#pacLista .fila-paciente').click()
        ficha = pagina.get_by_role('dialog', name=nombre)
        recordatorios = ficha.get_by_role('region', name='Le toca volver a comprar')
        opciones = recordatorios.get_by_role('group', name='Producto para recordar')
        expect(opciones.locator('button')).to_have_count(2)
        expect(opciones.locator('button').first).to_contain_text('Se le acaba ~27 nov')
        expect(opciones.locator('button').last).to_contain_text('Se le acaba ~2 dic')
        texto = recordatorios.get_by_role('textbox', name='Mensaje de recordatorio')
        expect(texto).to_have_value(plantilla.format(nombre=nombre, producto=v['items'][1]['nombre']))
        assert texto.evaluate('el => el.scrollHeight <= el.clientHeight + 1')
        assert recordatorios.get_by_role('link', name='Enviar recordatorio').bounding_box()['height'] >= 44
        for tema in ('dark', 'light'):
            pagina.evaluate('(tema) => document.documentElement.dataset.theme = tema', tema)
            razones = contrastes(pagina, [
                ['.producto-recompra small', '.recompra-paciente'],
                ['.editor-recordatorio .btn'], ['.mensaje-recordatorio textarea'],
                ['.acciones-paciente .btn.soft'], ['.cab-paciente .av'],
            ])
            assert min(razones) >= 4.5, (tema, razones)
        sun = opciones.get_by_role('button', name=re.compile('Sun Screen'))
        sun.click()
        expect(sun).to_have_attribute('aria-pressed', 'true')
        expect(texto).to_have_value(plantilla.format(nombre=nombre, producto=v['items'][0]['nombre']))
        enviar = recordatorios.get_by_role('link', name='Enviar recordatorio')
        texto.fill('   ')
        enviar.click()
        assert pagina.evaluate('recordatoriosPrueba') == []
        assert datos_guardados(pagina)['ventas'][1]['recordados'] == {}
        borrador = 'Hola, María José.\n¿Te separo un protector? & gracias.'
        texto.fill(borrador)
        opciones.locator('button').first.click()
        sun.click()
        expect(texto).to_have_value(borrador)

        pagina.evaluate("""() => {
          window.guardadoOriginal = Storage.prototype.setItem;
          Storage.prototype.setItem = () => { throw new Error('Memoria llena'); };
        }""")
        enviar.click()
        expect(pagina.locator('#toast')).to_contain_text('No se pudo guardar')
        expect(texto).to_have_value(borrador)
        assert pagina.evaluate('recordatoriosPrueba') == []
        pagina.evaluate('() => { Storage.prototype.setItem = guardadoOriginal; }')
        enviar.click()
        expect(opciones.locator('button')).to_have_count(1)
        assert datos_guardados(pagina)['ventas'][1]['recordados'] == {'p1': True}
        url = urlsplit(pagina.evaluate('recordatoriosPrueba[0]'))
        assert (url.scheme, url.netloc, url.path) == ('https', 'wa.me', '/593991234567')
        assert parse_qs(url.query)['text'] == [borrador]
        pagina.get_by_role('button', name='Deshacer').click()
        expect(opciones.locator('button')).to_have_count(2)
        assert datos_guardados(pagina)['ventas'][1]['recordados'] == {}
        opciones.get_by_role('button', name=re.compile('Sun Screen')).click()
        enviar.click()
        expect(opciones.locator('button')).to_have_count(1)
        barra.get_by_role('button', name='Inicio').click()

        pagina.get_by_role('button', name='1 Pacientes por recordar').click()
        lista = pagina.get_by_role('dialog', name='Pacientes por recordar')
        expect(lista.locator('li')).to_have_count(1)
        lista.locator('[data-p=p2]').click()
        aviso = pagina.get_by_role('dialog', name='Recordatorio')
        expect(aviso.get_by_role('textbox', name='Mensaje de recordatorio')).to_have_value(
            plantilla.format(nombre=nombre, producto=v['items'][1]['nombre']))
        aviso.get_by_role('link', name='Enviar recordatorio').click()
        expect(lista.locator('li')).to_have_count(0)
        assert datos_guardados(pagina)['ventas'][1]['recordados'] == {'p1': True, 'p2': True}
        cerrar_hoja(pagina)
        expect(pagina.locator('.contador-inicio.paciente b')).to_have_text('0')
        barra.get_by_role('button', name='Pacientes').click()
        pagina.locator('#pacLista .fila-paciente').click()
        expect(ficha.locator('.recompra-paciente')).to_have_count(0)
    finally:
        sitio.cerrar()


def descargar_excel_reporte(pagina, nombre):
    with pagina.expect_download() as descarga:
        pagina.get_by_role('button', name='Excel').click()
    assert descarga.value.suggested_filename == nombre
    datos = descarga.value.path().read_bytes()
    assert datos.startswith(b'\xef\xbb\xbf') and b'\r\n' in datos
    filas = list(csv.reader(datos.decode('utf-8-sig').splitlines(), delimiter=';'))
    assert filas[0] == ['Sección', 'Concepto', 'Fecha o período', 'Cantidad', 'Unidad', 'Monto (USD)']
    assert all(len(fila) == len(filas[0]) for fila in filas)
    return filas


def prueba_reporte_ventas(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        base = ESTADO_V1['ventas'][0]
        producto = base['items'][0]
        ventas = [
            base,
            {**base, 'id': 'efectivo', 'fecha': '2026-11-01', 'pago': 'Efectivo', 'descuento': .25,
             'pac': ' maria jose  andrade ', 'items': [{**producto, 'cant': 2, 'precio': 10, 'costo': 4}]},
            {**base, 'id': 'tarjeta', 'fecha': '2026-11-08', 'pago': 'tarjeta', 'pac': 'Sofía',
             'items': [{'prod': 'brillo', 'nombre': '=Brillo; "coral"', 'cant': 1, 'precio': 23.25, 'costo': 8}]},
            {**base, 'id': 'pendiente', 'fecha': '2026-11-15', 'cobrado': False, 'pago': 'efectivo', 'pac': '',
             'items': [{**producto, 'precio': 15, 'costo': 10}]},
            {**base, 'id': 'sin-forma', 'fecha': '2026-11-25', 'pago': '', 'pac': '',
             'items': [{**producto, 'precio': 5, 'costo': 0}]},
            {**base, 'id': 'otra-fecha', 'fecha': '2026-10-29', 'pac': 'Celia'},
            {**base, 'id': 'borrada', 'fecha': '2026-11-29', 'borrado': True},
        ]
        sitio.pagina.add_init_script('window.impresionesPrueba = 0; window.print = () => window.impresionesPrueba++')
        pagina = sitio.abrir(estado={**ESTADO_V1, 'ventas': ventas})
        inventario(pagina, 'ventas')
        cifras = pagina.locator('.cifras-reporte .v')
        expect(pagina.locator('.mes b')).to_have_text('Noviembre 2026')
        expect(cifras).to_have_text(['$ 105,00', '$ 54,50', '5', '$ 21,00'])
        expect(pagina.locator('.nota-cifra')).to_have_text('51,9 % del total')
        semanas = pagina.get_by_role('list', name='Ventas por semana')
        expect(semanas.locator('strong')).to_have_text(['$ 19,75', '$ 23,25', '$ 57,00', '$ 5,00', '$ 0,00'])
        expect(semanas.locator('.semana-actual')).to_have_attribute('title', 'Del 22 al 28')
        expect(pagina.get_by_text('Montos antes de los descuentos.')).to_be_visible()
        expect(pagina.locator('.ranking-reporte li').first).to_contain_text('$ 58,00')
        expect(pagina.locator('.totales-reporte').first).to_contain_text('Pacientes que compraron2')
        pagos = pagina.locator('.tarjeta-reporte').filter(has=pagina.get_by_role('heading', name='Formas de pago'))
        expect(pagos.locator('li')).to_have_text([
            'Efectivo$ 19,75', 'Transferencia$ 42,00', 'Tarjeta$ 23,25', 'Sin forma de pago$ 5,00', 'Por cobrar$ 15,00',
        ])
        for tema in ('light', 'dark'):
            pagina.emulate_media(color_scheme=tema)
            contrastes_reporte = contrastes(pagina, [
                ['.ganancia-reporte .v', '.ganancia-reporte'], ['.nota-cifra', '.ganancia-reporte'],
                ['.acciones-reporte .soft'], ['.acciones-reporte .ghost'], ['.acciones-reporte .btn:first-child'],
            ])
            assert min(contrastes_reporte) >= 4.5, contrastes_reporte
            assert pagina.evaluate('document.documentElement.scrollWidth === innerWidth')
        enlace = pagina.get_by_role('link', name='Enviar por WhatsApp')
        url = urlsplit(enlace.get_attribute('href'))
        mensaje = parse_qs(url.query)['text'][0]
        assert (url.scheme, url.netloc, url.path) == ('https', 'wa.me', '/')
        assert 'SPARATI · Ventas · Noviembre 2026' in mensaje and 'Por cobrar: $ 15,00' in mensaje
        assert base['pac'] not in mensaje and base['tel'] not in mensaje

        filas = descargar_excel_reporte(pagina, 'sparati-ventas-2026-11.csv')
        assert ['Ventas', 'Vendido', '2026-11', '', '', '105,00'] in filas
        assert ['Formas de pago', 'Efectivo', '2026-11', '1', '', '19,75'] in filas
        assert ['Lo más vendido antes de descuentos', '\'=Brillo; "coral"', '2026-11', '1', 'u.', '23,25'] in filas
        for grupo in ('Ventas por semana', 'Formas de pago'):
            assert sum(round(float(f[-1].replace(',', '.')) * 100) for f in filas if f[0] == grupo) == 10500

        pagina.get_by_role('button', name='Descargar PDF').click()
        assert pagina.evaluate('impresionesPrueba') == 1
        pagina.emulate_media(media='print')
        cabecera = pagina.locator('.cab-impresion-reporte')
        expect(cabecera).to_be_visible()
        expect(cabecera).to_contain_text('Reporte de ventas')
        expect(cabecera).to_contain_text('Noviembre 2026')
        assert cabecera.locator('img').evaluate('async img => { await img.decode(); return img.naturalWidth; }') == 480
        expect(pagina.get_by_role('navigation')).to_have_count(0)
        expect(pagina.get_by_role('searchbox')).to_have_count(0)
        expect(pagina.get_by_role('button', name='Descargar PDF')).to_have_count(0)
        expect(cifras.first).to_be_visible()
        pagina.emulate_media(media='screen')

        pagina.get_by_role('button', name='Mes anterior').click()
        expect(pagina.get_by_role('button', name='Mes anterior')).to_be_focused()
        expect(pagina.locator('.mes b')).to_have_text('Octubre 2026')
        expect(pagina.locator('#anuncio')).to_have_text('Octubre 2026')
        expect(semanas.locator('li').last).to_have_attribute('title', 'Del 29 al 31')
        expect(semanas.locator('strong').last).to_have_text('$ 42,00')
        pagina.get_by_role('button', name='Mes siguiente').click()
        expect(pagina.get_by_role('button', name='Mes siguiente')).to_be_disabled()
        buscar = pagina.get_by_role('searchbox', name='Buscar por paciente o producto')
        buscar.fill('Celia')
        pagina.locator('#listaVentas').get_by_role('button', name=re.compile('Celia')).click()
        expect(pagina.get_by_role('dialog', name='Editar venta')).to_be_visible()
        cerrar_hoja(pagina)
        expect(buscar).to_have_value('Celia')
        expect(cifras.first).to_have_text('$ 105,00')
    finally:
        sitio.cerrar()


def prueba_reporte_cabina_inventario(navegador, perfil=None):
    sitio = Sitio(navegador, perfil=perfil)
    try:
        base = ESTADO_V1['productos']
        productos = [base[0], {**base[1], 'vence': '2026-11-27'}, base[2], base[3],
                     {**base[2], 'id': 'p5', 'nombre': 'Ampollas de prueba', 'unidad': 'ampollas', 'costo': 8},
                     {**base[0], 'id': 'p6', 'nombre': 'Sin movimiento', 'costo': 4, 'precio': 10, 'vence': '2027-02-25'},
                     {**base[0], 'id': 'p7', 'nombre': 'Movimiento en el límite', 'costo': 3, 'precio': 9, 'vence': '2027-02-26'},
                     {**base[0], 'id': 'p8', 'nombre': 'Venció ayer', 'costo': 2, 'precio': 5, 'vence': '2026-11-26'}]

        def mov(id, prod, tipo, cant, fecha, **campos):
            return {'id': id, 'prod': prod, 'tipo': tipo, 'cant': cant, 'fecha': fecha, 'creado': 1, **campos}

        movimientos = [
            mov('terminado', 'p3', 'uso', -1, '2026-11-23', costo=12, motivo='terminado'),
            mov('ampollas-inicial', 'p5', 'inicial', 7, '2026-09-01'),
            mov('ampollas-v1', 'p5', 'uso', -1.5, '2026-11-05'),
            mov('ampollas-v2', 'p5', 'uso', -.5, '2026-11-22', costo=6),
            mov('ampollas-borrado', 'p5', 'uso', -2, '2026-11-23', costo=8, borrado=True),
            mov('sin-movimiento', 'p6', 'inicial', 3, '2026-09-28'),
            mov('conteo-sin-cambio', 'p6', 'ajuste', 0, '2026-11-27'),
            mov('entrada-futura', 'p6', 'entrada', 100, '2026-11-28'),
            mov('movimiento-borrado', 'p6', 'entrada', 100, '2026-11-20', borrado=True),
            mov('limite-60', 'p7', 'inicial', 1, '2026-09-29'),
            mov('stock-vencido', 'p8', 'inicial', 2, '2026-11-27'),
            mov('stock-eliminado', 'p4', 'inicial', 100, '2026-11-27'),
        ]
        pagina = sitio.abrir(estado={**ESTADO_V1, 'productos': productos, 'movs': ESTADO_V1['movs'] + movimientos})
        inventario(pagina, 'ventas')
        grupo = pagina.get_by_role('group', name='Tipo de reporte')
        cifras = pagina.locator('.cifras-reporte .v')
        cabina = grupo.get_by_role('button', name='Cabina')
        cabina.click()
        expect(cabina).to_be_focused()
        expect(cabina).to_have_attribute('aria-pressed', 'true')
        expect(cifras).to_have_text(['$ 27,00', '2'])
        expect(pagina.locator('.ranking-reporte li').first).to_contain_text('2 ampollas · $ 15,00')
        expect(pagina.get_by_text('Para usos antiguos sin costo registrado se usa el costo actual.')).to_be_visible()
        enlace_cabina = pagina.get_by_role('link', name='Enviar por WhatsApp')
        assert 'Frascos terminados: 2' in parse_qs(urlsplit(enlace_cabina.get_attribute('href')).query)['text'][0]
        filas = descargar_excel_reporte(pagina, 'sparati-cabina-2026-11.csv')
        assert ['Lo que más se gastó', 'Ampollas de prueba', '2026-11', '2', 'ampollas', '15,00'] in filas
        pagina.get_by_role('button', name='Mes anterior').click()
        expect(cifras).to_have_text(['$ 0,00', '0'])
        pagina.get_by_role('button', name='Mes siguiente').click()

        grupo.get_by_role('button', name='Inventario').click()
        expect(cifras).to_have_text(['$ 167,50', '$ 235,00'])
        expect(pagina.get_by_text('Existencias al 27 nov', exact=False)).to_be_visible()
        quietos = pagina.locator('.tarjeta-reporte').filter(has=pagina.get_by_role('heading', name='Sin movimiento en 60 días'))
        expect(quietos.locator('li')).to_have_count(1)
        expect(quietos.get_by_role('button')).to_contain_text('3 unidades · $ 12,00')
        por_vencer = pagina.locator('.tarjeta-reporte').filter(has=pagina.get_by_role('heading', name='Vencen en los próximos 90 días'))
        expect(por_vencer.locator('li strong')).to_have_text([base[1]['nombre'], 'Sin movimiento'])
        expect(por_vencer.locator('li').last).to_contain_text('Vence el 25 feb 2027')
        quietos.get_by_role('button').click()
        expect(pagina.get_by_role('dialog', name='Sin movimiento')).to_be_visible()
        cerrar_hoja(pagina)
        filas = descargar_excel_reporte(pagina, 'sparati-inventario-2026-11.csv')
        assert ['Sin movimiento en 60 días', 'Sin movimiento', '2026-11-27', '3', 'unidades', '12,00'] in filas
        assert ['Vencen en los próximos 90 días', 'Sin movimiento', '2027-02-25', '3', 'unidades', '12,00'] in filas
        assert pagina.evaluate('document.documentElement.scrollWidth === innerWidth')
        pagina.get_by_role('button', name='Mes anterior').click()
        expect(cifras).to_have_text(['$ 71,00', '$ 39,00'])
        expect(pagina.get_by_text('Existencias al 31 oct', exact=False)).to_be_visible()
        inventario(pagina, 'inicio')
        pagina.get_by_role('region', name='Ventas de noviembre').get_by_role('button').click()
        expect(grupo.get_by_role('button', name='Ventas')).to_have_attribute('aria-pressed', 'true')
        expect(pagina.locator('.mes b')).to_have_text('Noviembre 2026')
    finally:
        sitio.cerrar()


def capturar(navegador, tarea):
    carpeta = RAIZ / 'codex/capturas'
    fecha = FECHA.replace(hour=20) - timedelta(days=1 if tarea == 'T5' else 0)
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
            if tarea in ('T4', 'T6', 'T7'):
                simular_camara(sitio.pagina)
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
            if tarea == 'T9':
                pagina.evaluate("""() => {
                  const inicial = E.movs.find(m => m.tipo === 'inicial' && m.cant > 0 &&
                    !E.movs.some(otro => otro.prod === m.prod && otro.tipo !== 'inicial'));
                  guardar({...E, movs:E.movs.map(m => m === inicial ? {...m, fecha:sumarDias(hoyISO(), -72)} : m)});
                }""")
                inventario(pagina, 'ventas')
                grupo = pagina.get_by_role('group', name='Tipo de reporte')
                guardar(sitio, 'ventas', tema)
                pagina.get_by_role('heading', name='Lo más vendido').evaluate("el => el.scrollIntoView({block:'start'})")
                pagina.evaluate('window.scrollBy(0, -40)')
                guardar(sitio, 'ventas-productos', tema)
                pagina.locator('.acciones-reporte').evaluate("el => el.scrollIntoView({block:'center'})")
                guardar(sitio, 'ventas-exportar', tema)
                pagina.evaluate('window.scrollTo(0, 0)')
                grupo.get_by_role('button', name='Cabina').click()
                guardar(sitio, 'cabina', tema)
                grupo.get_by_role('button', name='Inventario').click()
                guardar(sitio, 'inventario', tema)
                grupo.get_by_role('button', name='Ventas').click()
                pagina.emulate_media(media='print')
                guardar(sitio, 'impresion', tema)
                continue
            elif tarea == 'T8':
                pagina.evaluate("""v => {
                  const ficha = {...pacienteNuevo(v.pac, '0991 234 567'),
                    notas:'Piel mixta. Prefiere protector sin color.', creado:aFecha('2026-05-01').getTime()};
                  const ventaDe = (fecha, productos, i) => ({...v, id:'captura-' + i, tel:ficha.tel, fecha,
                    items:productos.map(([p, precio]) => ({prod:p.id, nombre:p.nombre, cant:1, precio, costo:p.costo})),
                    pago:i === 0 ? 'transferencia' : 'efectivo'});
                  const azelac = E.productos.find(p => p.nombre.startsWith('Azelac Serum ('));
                  const protector = E.productos.find(p => p.nombre.startsWith('Sun Screen Clear SPF 50+'));
                  const niacin = E.productos.find(p => p.nombre.startsWith('Niacinamide 10 %'));
                  const compras = [
                    ['2026-11-02', [[azelac, 24], [protector, 18]]],
                    ['2026-10-08', [[niacin, 22]]],
                    ['2026-09-10', [[azelac, 24]]],
                    ...['2026-08-16', '2026-07-22', '2026-06-27', '2026-06-05'].map(fecha => [fecha, [[azelac, 24.5]]]),
                  ].map(([fecha, items], i) => ventaDe(fecha, items, i));
                  const productos = E.productos.map(p =>
                    p === azelac ? {...p, duraPac:26} : p === protector ? {...p, duraPac:30} : p === niacin ? {...p, duraPac:0} : p);
                  guardar({...E, productos, ventas:[...E.ventas, ...compras], pacientes:[...E.pacientes, ficha]});
                  refrescar();
                }""", ESTADO_V1['ventas'][0])
                nombre = ESTADO_V1['ventas'][0]['pac']
                barra = pagina.get_by_role('navigation', name='Principal')
                barra.get_by_role('button', name='Pacientes').click()
                guardar(sitio, 'pacientes-lista', tema)
                pagina.locator('#pacLista .fila-paciente').filter(has_text=nombre).click()
                ficha = pagina.get_by_role('dialog', name=nombre)
                ficha.locator('.recompra-paciente img').first.evaluate('img => img.decode()')
                guardar(sitio, 'paciente-ficha', tema)
                recompra = ficha.get_by_role('region', name='Le toca volver a comprar')
                recompra.evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'paciente-recompra', tema)
                ficha.get_by_role('region', name='Notas').evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'paciente-compras', tema)
                ficha.get_by_role('button', name='Editar paciente').click()
                guardar(sitio, 'paciente-editar', tema)
                cerrar_hoja(pagina)
                ficha.get_by_role('button', name='Nueva venta').click()
                guardar(sitio, 'paciente-nueva-venta', tema)
                cerrar_hoja(pagina)
                barra.get_by_role('button', name='Inicio').click()
                pagina.locator('.contador-inicio.paciente').click()
                avisos = pagina.get_by_role('dialog', name='Pacientes por recordar')
                avisos.get_by_role('button', name=re.compile('Escribir · María José Andrade · Azelac')).click()
                guardar(sitio, 'paciente-recordatorio-inicio', tema)
                cerrar_hoja(pagina)
                cerrar_hoja(pagina)
                ajustes = abrir_ajustes(pagina)
                plantilla = ajustes.locator('#formPlantillaRecordatorio')
                plantilla.evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'paciente-plantilla', tema)
                continue
            if tarea == 'T7':
                pagina.evaluate("""() => {
                  const productos = E.productos.map(p => p.nombre.startsWith('Sun Screen Clear SPF 50+') ?
                    {...p, codigo:'5901234123457'} : p);
                  guardar({...E, productos});
                  Object.assign(camaraPrueba, {modo:'escena', admiteLinterna:true});
                }""")
                escanear = pagina.get_by_role('button', name='Escanear', exact=True)
                lector = pagina.get_by_role('dialog', name='Escanear')
                escanear.click()
                expect(lector.locator('video')).to_be_visible()
                pagina.wait_for_function("document.querySelector('.vista-escaner video').readyState >= 2")
                guardar(sitio, 'camara', tema)
                pagina.evaluate("camaraPrueba.modo = 'ean'")
                expect(lector.locator('.producto-escaner')).to_contain_text('Sun Screen Clear SPF 50+')
                pagina.evaluate("camaraPrueba.modo = 'escena'")
                pagina.clock.run_for(200)
                guardar(sitio, 'encontrado', tema)
                cerrar_hoja(pagina)

                pagina.evaluate("camaraPrueba.modo = 'negada'")
                escanear.click()
                expect(lector.get_by_text('No se dio permiso', exact=False)).to_be_visible()
                guardar(sitio, 'permiso-manual', tema)
                escribir_codigo(lector, 'SP-NUEVO')
                guardar(sitio, 'sin-producto', tema)
                lector.get_by_role('button', name='Asignar a un producto').click()
                selector = pagina.get_by_role('dialog', name='Asignar a un producto')
                selector.get_by_role('searchbox').fill('azelac')
                expect(selector.locator('.fila-lista').first).to_be_visible()
                guardar(sitio, 'asignar', tema)
                cerrar_hoja(pagina)
                lector.get_by_role('button', name='Crear producto con este código').click()
                expect(pagina.get_by_label('Código de barras')).to_have_value('SP-NUEVO')
                guardar(sitio, 'crear', tema)
                cerrar_hoja(pagina)

                pagina.get_by_role('group', name='Acciones rápidas').get_by_role('button', name='Contar inventario').click()
                selector = pagina.get_by_role('dialog', name='Contar inventario')
                guardar(sitio, 'selector-conteo', tema)
                selector.get_by_role('button', name='Escanear').click()
                escribir_codigo(lector, '5901234123457')
                expect(lector.get_by_role('button', name='Contar producto')).to_be_visible()
                guardar(sitio, 'contar', tema)
                continue
            if tarea == 'T6':
                pagina.get_by_role('group', name='Acciones rápidas').get_by_role('button', name='Vender', exact=True).click()
                venta = pagina.get_by_role('dialog', name='Nueva venta')
                recientes = venta.locator('.paciente-venta-recientes')
                recientes.locator('[data-act=vEligePaciente]').first.click()
                tarjetas = venta.locator('.tarjeta-venta')
                expect(tarjetas).to_have_count(9)
                guardar(sitio, 'venta-productos', tema)

                venta.get_by_role('button', name='Cambiar').click()
                pacientes = pagina.get_by_role('dialog', name='Elegir paciente')
                pacientes.get_by_role('searchbox').fill('diana')
                guardar(sitio, 'venta-paciente', tema)
                pacientes.get_by_role('button', name='Diana Albor', exact=True).click()
                recientes.get_by_role('button', name='Nueva', exact=True).click()
                formulario = pagina.get_by_role('dialog', name='Nueva paciente')
                formulario.get_by_label('Nombre').fill('Rosa Cauce')
                guardar(sitio, 'venta-nueva-paciente', tema)
                formulario.get_by_role('button', name='Cancelar').click()

                tarjetas.nth(0).click()
                tarjetas.nth(1).click()
                venta.locator('.resumen-venta').click()
                venta.get_by_role('button', name='Transferencia').click()
                guardar(sitio, 'venta-carrito', tema)
                venta.get_by_label('Descuento ($)').fill('2,50')
                venta.get_by_role('button', name='Queda pendiente').click()
                venta.get_by_label('Enviar comprobante por WhatsApp').check()
                venta.get_by_label('Descuento ($)').evaluate("el => el.scrollIntoView({block:'center'})")
                guardar(sitio, 'venta-descuento', tema)
                venta.get_by_label('Enviar comprobante por WhatsApp').uncheck()
                venta.get_by_role('button', name='Cobrado', exact=True).click()

                venta.get_by_role('button', name='Escanear código de barras').click()
                lector = pagina.get_by_role('dialog', name='Escanear')
                expect(lector.get_by_text('No se dio permiso', exact=False)).to_be_visible()
                guardar(sitio, 'venta-escaner', tema)
                cerrar_hoja(pagina)

                venta.get_by_role('button', name=re.compile(r'^Cobrar \$')).click()
                expect(pagina.locator('.toast-venta')).to_contain_text('Venta cobrada')
                guardar(sitio, 'venta-exito', tema)
                continue
            if tarea == 'T5':
                inventario(pagina, 'uso')
                nombre = 'Mascarilla hidroplástica Pure Radiance · 280 g'
                # Usar la foto del catálogo con las cantidades y el historial de Cabina.png.
                pagina.evaluate("""nombre => {
                  const p = E.productos.find(p => p.nombre === nombre);
                  const productos = E.productos.map(x => x === p ?
                    {...p, unidad:'frascos', costo:24, pao:12, abierto:'2026-11-14', vence:'2027-08-30', prov:'Distribuidora'} : x);
                  const ciclo = [
                    ['inicial', 5, '2026-08-15'], ['apertura', 0, '2026-08-16'], ['uso', -1, '2026-09-14'],
                    ['apertura', 0, '2026-09-14'], ['uso', -1, '2026-10-14'], ['apertura', 0, '2026-10-14'],
                    ['uso', -1, '2026-11-14'], ['apertura', 0, '2026-11-14'],
                  ];
                  const movs = E.movs.filter(m => m.prod !== p.id).concat(ciclo.map(([tipo, cant, fecha], i) =>
                    ({id:'captura-cabina-' + i, prod:p.id, tipo, cant, fecha, motivo:tipo === 'uso' ? 'terminado' : '', creado:i})));
                  guardar({...E, productos, movs});
                  refrescar();
                }""", nombre)
                buscador = pagina.get_by_role('searchbox', name='Buscar en el inventario')
                buscador.fill(nombre)
                pagina.locator('#listaProd .fila-lista').click()
                ficha = pagina.get_by_role('dialog', name=nombre)
                ficha.locator('.foto-ficha img').evaluate('img => img.decode()')
                guardar(sitio, 'cabina-ficha', tema)
                frasco = ficha.get_by_role('region', name='Frasco en uso')
                frasco.evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'cabina-rendimiento', tema)
                ficha.get_by_role('region', name='Historial').evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'cabina-historial', tema)

                frasco.get_by_role('button', name='Se terminó', exact=True).click()
                frasco.evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'cabina-terminado', tema)
                frasco.get_by_role('button', name='Abrí uno nuevo', exact=True).click()
                guardar(sitio, 'cabina-apertura', tema)
                pagina.clock.fast_forward(5000)
                pagina.clock.set_system_time(fecha + timedelta(days=366))
                pagina.evaluate('refrescar()')
                expect(frasco.get_by_text('Ya pasó el tiempo de uso después de abierto', exact=False)).to_be_visible()
                guardar(sitio, 'cabina-aviso', tema)

                cerrar_hoja(pagina)
                pagina.clock.set_system_time(fecha)
                tratamiento = pagina.evaluate("productos('uso').find(p => p.unidad === 'ml' && stockDe(p.id) > 0) || "
                                             "productos('uso').find(p => p.unidad === 'ampollas' && stockDe(p.id) > 0)")
                buscador.fill(tratamiento['nombre'])
                pagina.locator(f"#listaProd [data-id={tratamiento['id']}]").click()
                guardar(sitio, 'cabina-tratamiento', tema)
                continue
            if tarea == 'T4':
                inventario(pagina, 'venta')
                nombre = 'Hydrating Foaming Cleanser · 200 ml'
                # Conservar la foto y el historial de ejemplo y preparar la ficha del diseño.
                pagina.evaluate("""nombre => {
                  const productos = E.productos.map(p => p.nombre === nombre ?
                    {...p, min:2, precio:16, costo:9.5, vence:'2028-03-10', lote:'24A3'} : p);
                  guardar({...E, productos});
                  refrescar();
                }""", nombre)
                pagina.get_by_role('searchbox', name='Buscar en el inventario').fill(nombre)
                pagina.locator('#listaProd .fila-lista').click()
                ficha = pagina.get_by_role('dialog', name=nombre)
                foto = ficha.locator('.foto-ficha img')
                foto.evaluate('img => img.decode()')
                guardar(sitio, 'producto-ficha', tema)
                ficha.locator('.stock-ficha').evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'producto-precios', tema)

                acciones = ficha.get_by_role('group', name='Acciones del producto')
                acciones.get_by_role('button', name='Vender', exact=True).click()
                guardar(sitio, 'producto-vender', tema)
                cerrar_hoja(pagina)
                acciones.get_by_role('button', name='Llegó más').click()
                llegada = pagina.get_by_role('dialog', name=re.compile('^Llegó más'))
                llegada.get_by_label('¿Cuántos llegaron?').fill('3')
                guardar(sitio, 'producto-entrada', tema)
                llegada.get_by_role('button', name='Guardar', exact=True).click()
                expect(pagina.get_by_role('button', name='Deshacer')).to_be_visible()
                guardar(sitio, 'producto-deshacer', tema)
                pagina.clock.fast_forward(5000)

                acciones.get_by_role('button', name='Ajustar cantidad').click()
                ajuste = pagina.get_by_role('dialog', name=re.compile('^Ajustar'))
                guardar(sitio, 'producto-ajuste', tema)
                ajuste.get_by_role('button', name='Guardar', exact=True).click()
                expect(pagina.get_by_role('button', name='Deshacer')).to_be_visible()
                pagina.clock.fast_forward(5000)

                ficha.get_by_role('button', name=re.compile('Asignar con la cámara')).click()
                codigo = pagina.get_by_role('dialog', name='Asignar código de barras')
                expect(codigo.get_by_text('No se dio permiso', exact=False)).to_be_visible()
                guardar(sitio, 'producto-codigo', tema)
                codigo.get_by_label('Escribir el código a mano').fill('5901234123457')
                codigo.get_by_role('button', name='Guardar código').click()
                expect(ficha.get_by_role('button', name='Código de barras Asignado')).to_be_visible()
                pagina.clock.fast_forward(5000)
                ficha.locator('.datos-ficha').evaluate("el => el.scrollIntoView({block:'start'})")
                guardar(sitio, 'producto-historial', tema)
                continue
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
    parser.add_argument('--capturas', nargs='?', const='T9', choices=['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'],
                        help='guardar capturas en modo claro y oscuro (T9 por omisión)')
    args = parser.parse_args()
    with sync_playwright() as p:
        principales = [prueba_estado_v1, prueba_edicion, prueba_navegacion,
                        prueba_buscadores_y_filtros, prueba_carrito_y_deshacer,
                        prueba_venta_rapida, prueba_opciones_venta, prueba_camara_venta,
                        prueba_escaner_modos, prueba_escaner_codigo_nuevo, prueba_escaner_cierre,
                        prueba_formulario_producto, prueba_inventario_resumen_y_orden,
                        prueba_inventario_300_productos, prueba_ficha_venta, prueba_asignar_codigo,
                        prueba_frascos_cabina, prueba_tratamientos_cabina, prueba_apariencia,
                        prueba_inicio_resumen, prueba_inicio_accesos, prueba_inicio_avisos,
                        prueba_ficha_paciente, prueba_recordatorios_paciente,
                        prueba_reporte_ventas, prueba_reporte_cabina_inventario]
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
