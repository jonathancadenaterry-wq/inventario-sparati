/* Guarda una copia de SPARATI Prueba con su catálogo y sus fotos de ejemplo.
   Comparte el dominio con otras apps. Solo borra cachés que empiezan con «spp-». */
const VERSION = 'spp-v2-11';
const BASE = new URL(self.registration.scope);
const PORTADA = new URL('index.html', BASE).href;
const CATALOGO = new URL('../codex/catalogo.json', BASE).href;
const CARPETA_FOTOS = new URL('../codex/diseno/fotos/', BASE).href;
const ARCHIVOS = [
  './', './index.html', './app.js?v=2.10', './estilos.css', './manifest.webmanifest',
  './icono-192.png', './icono-512.png', './icono-180.png',
  './emblema.png', './logo-texto.png', './logo-completo.png',
  './fuentes/inter-latin-400-normal.woff2', './fuentes/inter-latin-600-normal.woff2',
  './fuentes/inter-latin-700-normal.woff2', './fuentes/playfair-display-latin-600-normal.woff2',
  './vendor/barcode-detector.js', './vendor/zxing_reader.wasm',
].map(ruta => new URL(ruta, BASE).href).concat(CATALOGO);

function esFoto(url){
  return url.startsWith(CARPETA_FOTOS) && /^[a-z0-9-]+\.jpg$/i.test(url.slice(CARPETA_FOTOS.length));
}

async function guardarFaltantes(cache, urls){
  const faltantes = [];
  for(const url of urls) if(!await cache.match(url)) faltantes.push(new Request(url, {cache:'reload'}));
  if(faltantes.length) await cache.addAll(faltantes);
}

async function guardarTodo(){
  const cache = await caches.open(VERSION);
  await guardarFaltantes(cache, ARCHIVOS);
  const respuesta = await cache.match(CATALOGO);
  const {productos} = await respuesta.json();
  const fotos = productos.filter(p => p.foto).map(p => new URL('../' + p.foto, BASE).href).filter(esFoto);
  await guardarFaltantes(cache, [...new Set(fotos)]);
}

self.addEventListener('install', evento => {
  evento.waitUntil(guardarTodo().then(() => self.skipWaiting()));
});

self.addEventListener('activate', evento => {
  evento.waitUntil(caches.keys().then(claves => Promise.all(
    claves.filter(k => k.startsWith('spp-') && k !== VERSION).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('message', evento => {
  if(evento.data === 'revisar') evento.waitUntil(guardarTodo().catch(() => {}));
});

self.addEventListener('fetch', evento => {
  const {request} = evento;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  const esPortada = url.origin === BASE.origin &&
    (url.pathname === BASE.pathname || url.pathname === new URL(PORTADA).pathname);
  const navegacion = request.mode === 'navigate';
  if(navegacion ? !esPortada : !ARCHIVOS.includes(url.href) && !esFoto(url.href)) return;

  evento.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const clave = navegacion ? PORTADA : request;
    const guardado = await cache.match(clave);
    if(guardado) return guardado;
    try{
      const respuesta = await fetch(clave);
      if(respuesta.ok) await cache.put(clave, respuesta.clone()).catch(() => {});
      return respuesta;
    }catch(e){
      return new Response('Sin conexión', {status:503});
    }
  })());
});
