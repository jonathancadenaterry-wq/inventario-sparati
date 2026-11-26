/* Guarda la app en el celular para que abra sin internet.
   Con internet trae la versión nueva; sin internet, o si la red tarda más de 4 segundos, usa la copia guardada.
   Solo toca sus propias copias (las que empiezan con «sp-»): en el mismo sitio vive también Cuentas de la casa y el Diario de Inglés. */
const VERSION = 'sp-v1';
const ARCHIVOS = ['./', './index.html', './app.js?v=1', './manifest.webmanifest', './icono-192.png', './icono-512.png', './icono-180.png'];

function guardarTodo(){
  return caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, {cache: 'reload'}))));
}
self.addEventListener('install', e => {
  e.waitUntil(guardarTodo().then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k.startsWith('sp-') && k !== VERSION).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
// La página pide revisar la copia al abrir con internet: si falta algo, se vuelve a guardar
self.addEventListener('message', e => {
  if (e.data !== 'revisar') return;
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    const faltan = [];
    for (const u of ARCHIVOS) if (!(await c.match(u))) faltan.push(u);
    if (faltan.length) await c.addAll(faltan.map(u => new Request(u, {cache: 'reload'}))).catch(() => {});
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const nav = e.request.mode === 'navigate';
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const clave = nav ? './index.html' : e.request;
    const red = fetch(nav ? url.origin + url.pathname : e.request.url, {cache: 'no-cache', credentials: 'same-origin'})
      .then(r => { if (r && r.ok) c.put(clave, r.clone()); return r; })
      .catch(() => null);
    e.waitUntil(red);
    const espera = new Promise(r => setTimeout(() => r(null), 4000));
    const r = await Promise.race([red, espera]);
    if (r && r.ok) return r;
    const guardado = await c.match(clave, {ignoreSearch: false});
    if (guardado) return guardado;
    return (await red) || new Response('Sin conexión', {status: 503});
  })());
});
