'use strict';
/* SPARATI · Inventario
   Dos inventarios (para vender y de uso en el spa), avisos de lo que se termina o vence,
   ventas con paciente y fecha, y sincronización por archivo entre el celular de Elba y el de Jonathan.
   La cantidad de cada producto no se guarda: se calcula sumando sus movimientos. Así, al juntar
   lo que registró cada uno en su celular, nada se pisa. */
const VERSION_APP = 1;
const CLAVE = 'sparati_inventario_v1';
const CLAVE_YO = 'sparati_inventario_yo';
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DIAS_C = ['dom','lun','mar','mié','jue','vie','sáb'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const CATS = {
  venta:['Facial','Corporal','Protector solar','Capilar','Suplementos','Otros'],
  uso:['Activos e inyectables','Faciales','Corporales','Descartables','Aparatología','Limpieza','Otros'],
};
const UNIDADES = ['unidades','frascos','cajas','ampollas','jeringas','sobres','ml','g','pares'];
const PAGOS = ['Efectivo','Transferencia','Tarjeta','Por cobrar'];
const MOTIVOS = ['Conteo','Vencido','Dañado','Muestra o regalo','Otro'];
const COLORES_AV = ['#6E3460','#B07F5E','#3F6E6A','#8A4F7D','#9C6B4E','#5A5F8C','#7D5A50'];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const ahora = () => Date.now();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function num(v){
  if(typeof v === 'number') return isFinite(v) ? v : NaN;
  let s = String(v ?? '').trim().replace(/\s|\$/g, '');
  if(!s) return NaN;
  if(s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}
const red = n => Math.round(n * 100) / 100;
const fCant = n => (Math.round(n * 100) / 100).toLocaleString('es-EC', {maximumFractionDigits:2, useGrouping:false});
const SING = {unidades:'unidad', frascos:'frasco', cajas:'caja', ampollas:'ampolla', jeringas:'jeringa', sobres:'sobre', pares:'par'};
const singular = u => SING[u] || u || 'unidad';
const uTxt = (n, u) => Math.abs(n) === 1 ? singular(u) : (u || 'unidades');
const dinero = n => '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('es-EC', {minimumFractionDigits:2, maximumFractionDigits:2});
const dineroIn = n => (n || n === 0) && isFinite(n) ? (red(n) % 1 ? red(n).toFixed(2) : String(red(n))).replace('.', ',') : '';

// ---------- Fechas ----------
function iso(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
const hoyISO = () => iso(new Date());
function aFecha(s){ const [y,m,d] = String(s).split('-').map(Number); return new Date(y, (m||1)-1, d||1); }
function fCorta(s){ if(!s) return ''; const d = aFecha(s); return d.getDate() + ' ' + MESES_C[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); }
function fDia(s){ const d = aFecha(s); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
function diasHasta(s){ const h = aFecha(hoyISO()); return Math.round((aFecha(s) - h) / 86400000); }
function diasDesde(s){ return -diasHasta(s); }
function sumarMeses(s, m){ const d = aFecha(s); d.setMonth(d.getMonth() + m); return iso(d); }
function haceTxt(ms){
  if(!ms) return 'nunca';
  const d = Math.floor((ahora() - ms) / 86400000);
  if(d <= 0){ const h = Math.floor((ahora() - ms) / 3600000); return h <= 0 ? 'hace un momento' : 'hace ' + h + (h === 1 ? ' hora' : ' horas'); }
  return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}

// ---------- Estado ----------
function estadoInicial(){
  return {v:1, productos:[], movs:[], ventas:[], cats:{venta:[], uso:[]},
    ajustes:{diasVence:60, tema:'auto'}, sync:{envio:0, recibo:0, de:''}, creado:ahora()};
}
let E, YO;
function cargar(){
  try{ E = JSON.parse(localStorage.getItem(CLAVE)); }catch(e){ E = null; }
  if(!E || !Array.isArray(E.productos)) E = estadoInicial();
  const b = estadoInicial();
  for(const k of ['movs','ventas']) if(!Array.isArray(E[k])) E[k] = [];
  E.cats = Object.assign(b.cats, E.cats || {});
  E.ajustes = Object.assign(b.ajustes, E.ajustes || {});
  E.sync = Object.assign(b.sync, E.sync || {});
  try{ YO = JSON.parse(localStorage.getItem(CLAVE_YO)); }catch(e){ YO = null; }
}
function guardar(){
  try{ localStorage.setItem(CLAVE, JSON.stringify(E)); }
  catch(e){ toast('No se pudo guardar: la memoria del navegador está llena.'); return false; }
  calcular(); actualizarAvisos();
  return true;
}
const quien = () => (YO && YO.quien) || '';
const otro = () => quien() === 'Elba' ? 'Jonathan' : 'Elba';
const marcar = (o, nuevo) => { o.mod = ahora(); o.por = quien(); if(nuevo) o.creado = o.mod; return o; };

// ---------- Cálculos ----------
let STOCK = new Map(), CONSUMO = new Map();
const vivos = l => l.filter(x => !x.borrado);
const productos = tipo => vivos(E.productos).filter(p => !tipo || p.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
const prodPorId = id => E.productos.find(p => p.id === id);
const stockDe = id => red(STOCK.get(id) || 0);
function calcular(){
  STOCK = new Map(); CONSUMO = new Map();
  const primero = new Map(), salidas = new Map(), nSal = new Map();
  for(const m of E.movs){
    if(m.borrado) continue;
    STOCK.set(m.prod, (STOCK.get(m.prod) || 0) + m.cant);
    if(!primero.has(m.prod) || m.fecha < primero.get(m.prod)) primero.set(m.prod, m.fecha);
    if((m.tipo === 'venta' || m.tipo === 'uso') && m.cant < 0 && diasDesde(m.fecha) <= 60){
      salidas.set(m.prod, (salidas.get(m.prod) || 0) - m.cant);
      nSal.set(m.prod, (nSal.get(m.prod) || 0) + 1);
    }
  }
  for(const [id, s] of salidas){
    if((nSal.get(id) || 0) < 2) continue;
    const span = Math.min(60, Math.max(14, diasDesde(primero.get(id)) + 1));
    CONSUMO.set(id, s / span);
  }
}
// Avisos de un producto: lo que se termina y lo que vence
function avisosDe(p){
  const s = stockDe(p.id), out = [];
  const min = p.min || 0, c = CONSUMO.get(p.id);
  if(s <= 0) out.push({clase:'stock', nivel:'bad', txt:'Agotado', orden:0});
  else if(min > 0 && s <= min) out.push({clase:'stock', nivel:'warn', txt:`Quedan ${fCant(s)} (avisar con ${fCant(min)})`, orden:1});
  else if(c && s / c <= 14) out.push({clase:'stock', nivel:'warn', txt:`Alcanza para unos ${Math.max(1, Math.round(s / c))} días`, orden:2});
  if(s > 0 && p.vence){
    const d = diasHasta(p.vence);
    if(d < 0) out.push({clase:'fecha', nivel:'bad', txt:'Venció el ' + fCorta(p.vence), orden:0});
    else if(d <= E.ajustes.diasVence) out.push({clase:'fecha', nivel:'warn', txt:d === 0 ? 'Vence hoy' : `Vence en ${d} ${d===1?'día':'días'} (${fCorta(p.vence)})`, orden:1});
  }
  if(s > 0 && p.abierto && p.pao > 0){
    const lim = sumarMeses(p.abierto, p.pao), d = diasHasta(lim);
    if(d < 0) out.push({clase:'fecha', nivel:'bad', txt:'Abierto: pasó su tiempo de uso (' + fCorta(lim) + ')', orden:0});
    else if(d <= 30) out.push({clase:'fecha', nivel:'warn', txt:`Abierto: úsalo antes del ${fCorta(lim)}`, orden:1});
  }
  return out;
}
function todosLosAvisos(){
  const r = {stock:[], fecha:[]};
  for(const p of productos()) for(const a of avisosDe(p)) r[a.clase].push(Object.assign({p}, a));
  const ord = (a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'bad' ? -1 : 1) || a.orden - b.orden || a.p.nombre.localeCompare(b.p.nombre, 'es');
  r.stock.sort(ord); r.fecha.sort(ord);
  return r;
}
function paraPedir(){
  return productos().filter(p => avisosDe(p).some(a => a.clase === 'stock')).map(p => {
    const s = stockDe(p.id), c = CONSUMO.get(p.id);
    let sug = p.min > 0 ? Math.ceil(p.min * 2 - s) : 0;
    if(c) sug = Math.max(sug, Math.ceil(c * 30 - s));
    return {p, s, sug:Math.max(1, sug)};
  });
}
// Pacientes a quienes conviene volver a ofrecer un producto (según cuántos días le dura)
function recompras(){
  const ult = new Map();
  for(const v of vivos(E.ventas)) for(const it of v.items){
    const p = prodPorId(it.prod);
    if(!p || p.borrado || !(p.duraPac > 0) || !v.pac) continue;
    const k = norm(v.pac) + '|' + it.prod, x = ult.get(k);
    if(!x || v.fecha > x.v.fecha) ult.set(k, {v, p});
  }
  const r = [];
  for(const {v, p} of ult.values()){
    if(v.recordados && v.recordados[p.id]) continue;
    const d = diasDesde(v.fecha);
    if(d >= p.duraPac - 5 && d <= p.duraPac + 60) r.push({v, p, d});
  }
  return r.sort((a, b) => b.d - a.d);
}
const porCobrar = () => vivos(E.ventas).filter(v => !v.cobrado).sort((a, b) => b.fecha.localeCompare(a.fecha));
const totalVenta = v => red(v.items.reduce((s, it) => s + it.cant * it.precio, 0));
const costoVenta = v => red(v.items.reduce((s, it) => s + it.cant * (it.costo || 0), 0));
function pacientes(){
  const m = new Map();
  for(const v of vivos(E.ventas)) if(v.pac){ const k = norm(v.pac); const x = m.get(k); if(!x || v.fecha >= x.fecha) m.set(k, {nombre:v.pac, tel:v.tel || (x && x.tel) || '', fecha:v.fecha}); else if(!x.tel && v.tel) x.tel = v.tel; }
  for(const mv of vivos(E.movs)) if(mv.pac && !m.has(norm(mv.pac))) m.set(norm(mv.pac), {nombre:mv.pac, tel:'', fecha:mv.fecha});
  return Array.from(m.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function actualizarAvisos(){
  const nV = productos('venta').filter(p => avisosDe(p).length).length;
  const nU = productos('uso').filter(p => avisosDe(p).length).length;
  const pon = (id, n) => { const e = document.getElementById(id); if(e){ e.hidden = !n; e.textContent = n > 99 ? '99+' : n; } };
  pon('nVenta', nV); pon('nUso', nU);
  try{
    if(navigator.setAppBadge){ const t = nV + nU; if(t) navigator.setAppBadge(t).catch(() => {}); else navigator.clearAppBadge().catch(() => {}); }
  }catch(e){}
}

// ---------- Fotos ----------
const FDB = {
  _db:null,
  abrir(){
    if(this._db) return Promise.resolve(this._db);
    return new Promise((ok, mal) => {
      const r = indexedDB.open('sparati_fotos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotos');
      r.onsuccess = () => { this._db = r.result; ok(r.result); };
      r.onerror = () => mal(r.error);
    });
  },
  async tx(modo, fn){
    const db = await this.abrir();
    return new Promise((ok, mal) => {
      const t = db.transaction('fotos', modo), q = fn(t.objectStore('fotos'));
      t.oncomplete = () => ok(q ? q.result : undefined);
      t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
    });
  },
  put(id, b){ return this.tx('readwrite', s => s.put(b, id)); },
  get(id){ return this.tx('readonly', s => s.get(id)); },
  del(id){ return this.tx('readwrite', s => s.delete(id)); },
  claves(){ return this.tx('readonly', s => s.getAllKeys()); },
  vaciar(){ return this.tx('readwrite', s => s.clear()); },
};
const URLS = {};
async function urlFoto(id){
  if(URLS[id]) return URLS[id];
  const b = await FDB.get(id).catch(() => null);
  if(!b) return null;
  return (URLS[id] = URL.createObjectURL(b));
}
function cargarFotos(raiz){
  $$('img[data-foto]', raiz).forEach(async img => { const u = await urlFoto(img.dataset.foto); if(u) img.src = u; else img.remove(); });
}
async function cargarImagen(file){
  try{ return await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch(e){
    const url = URL.createObjectURL(file);
    try{ return await new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = url; }); }
    finally{ setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}
async function comprimir(file){
  try{
    const bmp = await cargarImagen(file);
    const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(r => cv.toBlob(b => r(b || file), 'image/jpeg', 0.72));
  }catch(e){ return file; }
}
function avatar(p, cls = ''){
  const ini = (p.nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const col = COLORES_AV[[...(p.nombre || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORES_AV.length];
  return `<span class="av ${cls}" style="background:${col}">${p.foto ? `<img data-foto="${esc(p.foto)}" alt="">` : esc(ini)}</span>`;
}

// ---------- Capas, diálogos y mensajes ----------
const pila = [];
function abrirCapa(html, op = {}){
  const d = document.createElement('div');
  d.className = op.cls || 'hoja';
  d.innerHTML = html;
  if(op.tipo) d.dataset.tipo = op.tipo;
  $('#capas').appendChild(d);
  pila.push({el:d, alCerrar:op.alCerrar, fija:op.fija});
  history.pushState({capa:pila.length}, '');
  document.body.classList.add('bloqueo');
  return d;
}
function cerrarCapa(desdeAtras){
  const c = pila.pop();
  if(!c) return;
  try{ c.alCerrar && c.alCerrar(); }catch(e){}
  c.el.remove();
  if(!pila.length) document.body.classList.remove('bloqueo');
  if(!desdeAtras) history.back();
}
window.addEventListener('popstate', e => {
  const prof = (e.state && e.state.capa) || 0;
  while(pila.length > prof){
    if(pila[pila.length-1].fija){ history.pushState({capa:pila.length}, ''); break; }
    cerrarCapa(true);
  }
});
const capaArriba = tipo => { const c = pila.slice().reverse().find(x => x.el.dataset.tipo === tipo); return c ? c.el : null; };
function cabecera(titulo, extra = ''){
  return `<header class="hoja-cab"><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${IC.x}</button><h2>${titulo}</h2>${extra}</header>`;
}
function confirmar(titulo, texto, ok = 'Sí', peligro = false){
  return new Promise(res => {
    let r = false;
    const d = abrirCapa(`<div class="dlg" role="dialog" aria-modal="true"><h3>${esc(titulo)}</h3><p>${texto}</p>
      <div class="fila"><button class="btn ghost" data-r="0">Cancelar</button><button class="btn ${peligro?'danger':''}" data-r="1">${esc(ok)}</button></div></div>`,
      {cls:'dlg-fondo', alCerrar:() => res(r)});
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if(b){ r = b.dataset.r === '1'; cerrarCapa(); }
      else if(e.target === d) cerrarCapa();
    });
  });
}
let tToast;
function toast(msg, accion){
  let t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(msg)}</span>` + (accion ? `<button type="button">${esc(accion.txt)}</button>` : '');
  if(accion) $('button', t).onclick = () => { t.hidden = true; accion.fn(); };
  t.hidden = false;
  clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, accion ? 6000 : 3400);
}

const IC = {
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  engr:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  lapiz:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  lupa:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  sync:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/></svg>',
};

// ---------- Vistas principales ----------
const U = {tab:'inicio', q:{venta:'', uso:''}, filtro:{venta:'todos', uso:'todos'}, mes:hoyISO().slice(0, 7), qVentas:''};

function render(){
  calcular();
  const app = $('#app');
  app.innerHTML = U.tab === 'inicio' ? vInicio() : U.tab === 'ventas' ? vVentas() : vLista(U.tab);
  $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === U.tab));
  const fab = $('#fab');
  const txt = {venta:'＋ Producto para vender', uso:'＋ Producto de uso', ventas:'＋ Nueva venta', inicio:productos('venta').length ? '＋ Nueva venta' : ''}[U.tab];
  fab.hidden = !txt; if(txt) fab.textContent = txt;
  cargarFotos(app);
  actualizarAvisos();
  const qb = $('#qProd');
  if(qb) qb.addEventListener('input', () => { U.q[U.tab] = qb.value; const l = $('#listaProd'); if(l){ l.innerHTML = listaHTML(U.tab); cargarFotos(l); } });
  const qv = $('#qVentas');
  if(qv) qv.addEventListener('input', () => { U.qVentas = qv.value; const l = $('#listaVentas'); if(l) l.innerHTML = listaVentasHTML(); });
}

function vInicio(){
  let h = `<div class="top"><div><div class="marca">SPARATI</div><div class="sub">Inventario · ${esc(fDia(hoyISO()))}</div></div>
    <button class="icon-btn" data-act="ajustes" aria-label="Ajustes">${IC.engr}</button></div>`;
  const n = productos().length;
  // Compartir entre los dos celulares
  const envio = E.sync.envio, recibo = E.sync.recibo;
  if(quien()){
    const cambios = ultimoCambio() > envio;
    if(cambios && n && (!envio || ahora() - envio > 3 * 86400000))
      h += `<div class="aviso"><div>📲 Hay cambios que ${esc(otro())} todavía no tiene${envio ? ' (último envío: ' + haceTxt(envio) + ')' : ''}.</div>
        <div class="fila"><button class="btn sm" data-act="enviar">Enviar a ${esc(otro())}</button></div></div>`;
    if(recibo) h += `<div class="peq muted" style="padding:0 4px">Último archivo recibido de ${esc(E.sync.de || otro())}: ${haceTxt(recibo)}. <button class="link" data-act="recibir">Recibir otro</button></div>`;
  }
  if(!n){
    h += `<section class="card"><h3>Bienvenida 🌿</h3>
      <div class="peq">Empieza agregando tus productos. Para cada uno pones cuántos hay y desde cuántos quieres que la app te avise.</div>
      <div class="acc-grid"><button class="btn" data-act="nuevoProd" data-tipo="venta">＋ Para vender</button><button class="btn gold" data-act="nuevoProd" data-tipo="uso">＋ Uso en spa</button></div>
      ${quien() === 'Jonathan' ? `<button class="btn ghost" data-act="recibir">📥 Recibir el inventario de Elba</button>` : ''}</section>`;
    return h;
  }
  const av = todosLosAvisos(), rc = recompras(), pc = porCobrar();
  if(!av.stock.length && !av.fecha.length && !rc.length && !pc.length)
    h += `<div class="estado-ok"><span>✓</span><div>Todo en orden. No hay productos por terminarse ni por vencer.</div></div>`;
  if(av.stock.length) h += `<section class="card"><div class="card-cab"><h3>Se están terminando (${av.stock.length})</h3><button class="btn sm gold" data-act="compras">🛒 Qué pedir</button></div>${av.stock.map(filaAviso).join('')}</section>`;
  if(av.fecha.length) h += `<section class="card"><h3>Fechas de vencimiento (${av.fecha.length})</h3>${av.fecha.map(filaAviso).join('')}</section>`;
  if(rc.length) h += `<section class="card"><h3>Volver a ofrecer (${rc.length})</h3><div class="peq muted">Pacientes que ya deberían estar terminando el producto que compraron.</div>${rc.map(r =>
    `<div class="alerta"><span class="av sm" style="background:var(--gold)">${esc((r.v.pac||'?')[0].toUpperCase())}</span><div class="tx"><b>${esc(r.v.pac)}</b><div class="d">${esc(r.p.nombre)} · compró ${haceTxtDias(r.d)}</div></div>
      <button class="btn sm soft" data-act="recompra" data-v="${r.v.id}" data-p="${r.p.id}">Escribir</button></div>`).join('')}</section>`;
  if(pc.length) h += `<section class="card"><div class="card-cab"><h3>Por cobrar</h3><b class="num">${dinero(pc.reduce((s, v) => s + totalVenta(v), 0))}</b></div>${pc.slice(0, 6).map(v =>
    `<button class="alerta" data-act="editarVenta" data-id="${v.id}"><div class="tx"><b>${esc(v.pac || 'Sin nombre')}</b><div class="d">${esc(fCorta(v.fecha))} · ${esc(v.items.map(i => i.nombre).join(', '))}</div></div><span class="pill warn num">${dinero(totalVenta(v))}</span></button>`).join('')}</section>`;

  // Cifras
  const mes = hoyISO().slice(0, 7), vm = vivos(E.ventas).filter(v => v.fecha.startsWith(mes));
  const totMes = vm.reduce((s, v) => s + totalVenta(v), 0), ganMes = totMes - vm.reduce((s, v) => s + costoVenta(v), 0);
  const valor = productos().reduce((s, p) => s + Math.max(0, stockDe(p.id)) * (p.costo || 0), 0);
  const usoMes = vivos(E.movs).filter(m => m.tipo === 'uso' && m.fecha.startsWith(mes)).reduce((s, m) => { const p = prodPorId(m.prod); return s + (-m.cant) * ((p && p.costo) || 0); }, 0);
  h += `<div class="sec-tit">Este mes</div><div class="cifras">
    <button class="cifra" data-act="tab" data-tab="ventas"><span class="v num">${dinero(totMes)}</span><span class="l">Vendido en ${MESES[new Date().getMonth()]} · ${vm.length} ${vm.length===1?'venta':'ventas'}</span></button>
    <div class="cifra"><span class="v num">${dinero(ganMes)}</span><span class="l">Ganancia en ventas</span></div>
    <div class="cifra"><span class="v num">${dinero(usoMes)}</span><span class="l">Insumos usados en el spa</span></div>
    <div class="cifra"><span class="v num">${dinero(valor)}</span><span class="l">Valor del inventario (a costo)</span></div></div>`;
  return h;
}
function haceTxtDias(d){ return d === 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días'; }
function filaAviso(a){
  return `<button class="alerta" data-act="verProd" data-id="${a.p.id}">${avatar(a.p, 'sm')}<div class="tx"><b>${esc(a.p.nombre)}</b><div class="d">${a.p.tipo === 'venta' ? 'Para vender' : 'Uso en spa'} · <span class="${a.nivel}">${esc(a.txt)}</span></div></div><span class="chev">›</span></button>`;
}
function ultimoCambio(){ let m = 0; for(const k of ['productos','movs','ventas']) for(const x of E[k]) if(x.por === quien() && x.mod > m) m = x.mod; return m; }

function vLista(tipo){
  const titulo = tipo === 'venta' ? 'Para vender' : 'Uso en spa';
  const sub = tipo === 'venta' ? 'Productos que vendes a tus pacientes' : 'Lo que usas en los tratamientos';
  const ps = productos(tipo), conAviso = ps.filter(p => avisosDe(p).length).length;
  const cats = Array.from(new Set(ps.map(p => p.cat).filter(Boolean)));
  const f = U.filtro[tipo];
  let h = `<div class="top"><div><h1>${titulo}</h1><div class="sub">${sub}</div></div><button class="icon-btn" data-act="compras" aria-label="Lista de compras">🛒</button></div>`;
  if(ps.length){
    h += `<label class="buscar">${IC.lupa}<input type="search" id="qProd" placeholder="Buscar producto o marca" value="${esc(U.q[tipo])}" autocomplete="off"></label>
      <div class="chips scroll"><button class="chip ${f==='todos'?'on':''}" data-act="filtro" data-f="todos">Todos (${ps.length})</button>
      <button class="chip ${f==='avisos'?'on':''}" data-act="filtro" data-f="avisos">Con avisos${conAviso ? `<span class="n">${conAviso}</span>` : ''}</button>
      ${cats.map(c => `<button class="chip ${f===c?'on':''}" data-act="filtro" data-f="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  }
  h += `<div id="listaProd" style="display:flex;flex-direction:column;gap:10px">${listaHTML(tipo)}</div>`;
  return h;
}
function listaHTML(tipo){
  const all = productos(tipo);
  if(!all.length) return `<div class="vacio"><span class="e">${tipo === 'venta' ? '🛍️' : '🧴'}</span>Todavía no hay productos ${tipo === 'venta' ? 'para vender' : 'de uso en el spa'}.<br>Toca el botón de abajo para agregar el primero.</div>`;
  const q = norm(U.q[tipo]), f = U.filtro[tipo];
  let ps = all.filter(p => !q || norm(p.nombre + ' ' + (p.marca || '') + ' ' + (p.cat || '')).includes(q));
  if(f === 'avisos') ps = ps.filter(p => avisosDe(p).length);
  else if(f !== 'todos') ps = ps.filter(p => p.cat === f);
  // Primero los que tienen avisos
  ps.sort((a, b) => (avisosDe(b).length ? 1 : 0) - (avisosDe(a).length ? 1 : 0) || a.nombre.localeCompare(b.nombre, 'es'));
  if(!ps.length) return `<div class="vacio">No hay productos con ese filtro.</div>`;
  return ps.map(p => tarjetaProd(p)).join('');
}
function tarjetaProd(p){
  const s = stockDe(p.id), avs = avisosDe(p);
  const nivel = avs.some(a => a.clase === 'stock' && a.nivel === 'bad') ? 'bad' : avs.some(a => a.clase === 'stock') ? 'warn' : '';
  const sub = [p.marca, p.tipo === 'venta' && p.precio ? dinero(p.precio) : '', p.cat].filter(Boolean).map(esc).join(' · ');
  const gasto = p.gasto > 0 ? p.gasto : 1;
  return `<div class="prod"><button class="prod-main" data-act="verProd" data-id="${p.id}">${avatar(p)}
      <div class="tx"><b>${esc(p.nombre)}</b><div class="m">${sub || '&nbsp;'}</div>${avs.length ? `<div class="pills">${avs.map(a => `<span class="pill ${a.nivel}">${esc(a.txt)}</span>`).join('')}</div>` : ''}</div>
      <div class="stock ${nivel}"><div class="q num">${fCant(s)}</div><div class="u">${esc(uTxt(s, p.unidad))}</div></div></button>
    <div class="prod-acc">${p.tipo === 'venta'
      ? `<button data-act="vender" data-id="${p.id}">Vender</button>`
      : `<button data-act="usarRapido" data-id="${p.id}">Usar ${fCant(gasto)} ${esc(uTxt(gasto, p.unidad))}</button><button data-act="usar" data-id="${p.id}">Otra cantidad</button>`}
      <button data-act="entrada" data-id="${p.id}">Llegó más</button></div></div>`;
}

function vVentas(){
  const [y, m] = U.mes.split('-').map(Number);
  const vm = vivos(E.ventas).filter(v => v.fecha.startsWith(U.mes));
  const tot = vm.reduce((s, v) => s + totalVenta(v), 0), gan = tot - vm.reduce((s, v) => s + costoVenta(v), 0);
  const cobrar = vm.filter(v => !v.cobrado).reduce((s, v) => s + totalVenta(v), 0);
  const top = new Map();
  for(const v of vm) for(const it of v.items){ const x = top.get(it.prod) || {n:it.nombre, c:0, t:0}; x.c += it.cant; x.t += it.cant * it.precio; top.set(it.prod, x); }
  const tops = Array.from(top.values()).sort((a, b) => b.t - a.t).slice(0, 5), maxT = tops.length ? tops[0].t : 1;
  let h = `<div class="top"><div><h1>Ventas</h1><div class="sub">Qué vendiste, a quién y cuándo</div></div><button class="icon-btn" data-act="pacientes" aria-label="Pacientes">👥</button></div>
    <div class="mes"><button data-act="mes" data-d="-1" aria-label="Mes anterior">‹</button><b>${MESES[m-1]} ${y}</b><button data-act="mes" data-d="1" aria-label="Mes siguiente" ${U.mes >= hoyISO().slice(0, 7) ? 'disabled' : ''}>›</button></div>
    <div class="cifras"><div class="cifra"><span class="v num">${dinero(tot)}</span><span class="l">${vm.length} ${vm.length===1?'venta':'ventas'}</span></div>
      <div class="cifra"><span class="v num">${dinero(gan)}</span><span class="l">Ganancia (venta − costo)</span></div>
      ${cobrar ? `<div class="cifra ancha"><span class="v num" style="color:var(--warn)">${dinero(cobrar)}</span><span class="l">Por cobrar este mes</span></div>` : ''}</div>`;
  if(tops.length) h += `<section class="card"><h3>Lo más vendido</h3>${tops.map(t => `<div class="top-prod"><span class="n">${esc(t.n)} <span class="muted">· ${fCant(t.c)}</span></span><span class="b" style="width:${Math.max(8, Math.round(t.t / maxT * 70))}px"></span><b class="num">${dinero(t.t)}</b></div>`).join('')}</section>`;
  h += `<label class="buscar">${IC.lupa}<input type="search" id="qVentas" placeholder="Buscar por paciente o producto" value="${esc(U.qVentas)}" autocomplete="off"></label>
    <div id="listaVentas" style="display:flex;flex-direction:column;gap:10px">${listaVentasHTML()}</div>`;
  return h;
}
function listaVentasHTML(){
  const q = norm(U.qVentas);
  let vs = vivos(E.ventas);
  vs = q ? vs.filter(v => norm(v.pac + ' ' + v.items.map(i => i.nombre).join(' ')).includes(q)) : vs.filter(v => v.fecha.startsWith(U.mes));
  vs.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
  if(!vs.length) return `<div class="vacio"><span class="e">🧾</span>${q ? 'No hay ventas con esa búsqueda.' : 'No hay ventas en este mes.'}</div>`;
  let h = '', dia = '';
  for(const v of vs){
    if(v.fecha !== dia){ dia = v.fecha; h += `<div class="dia-tit">${esc(fDia(v.fecha))}${q && v.fecha.slice(0,4) !== String(new Date().getFullYear()) ? ' ' + v.fecha.slice(0,4) : ''}</div>`; }
    h += `<button class="venta" data-act="editarVenta" data-id="${v.id}"><div class="c"><span class="pac">${esc(v.pac || 'Sin nombre')}</span><span class="tot num">${dinero(totalVenta(v))}</span></div>
      <div class="it">${esc(v.items.map(i => fCant(i.cant) + ' × ' + i.nombre).join(' · '))}</div>
      <div class="c"><span class="pill ${v.cobrado ? 'acc' : 'warn'}">${esc(v.cobrado ? v.pago : 'Por cobrar')}</span>${v.por ? `<span class="peq muted">Registró ${esc(v.por)}</span>` : ''}</div></button>`;
  }
  return h;
}

// ---------- Detalle de producto ----------
function verProd(id){
  const d = abrirCapa('', {tipo:'prod'});
  d.dataset.id = id;
  pintarProd(d);
}
function pintarProd(d){
  const p = prodPorId(d.dataset.id);
  if(!p || p.borrado){ cerrarCapa(); return; }
  calcular();
  const s = stockDe(p.id), avs = avisosDe(p), c = CONSUMO.get(p.id);
  const movs = vivos(E.movs).filter(m => m.prod === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
  const datos = [];
  if(p.tipo === 'venta'){
    if(p.precio) datos.push(['Precio de venta', dinero(p.precio)]);
    if(p.costo) datos.push(['Costo', dinero(p.costo)]);
    if(p.precio && p.costo) datos.push(['Ganancia por unidad', dinero(p.precio - p.costo) + ' (' + Math.round((p.precio - p.costo) / p.precio * 100) + ' %)']);
    if(p.duraPac) datos.push(['A la paciente le dura', 'unos ' + p.duraPac + ' días']);
  } else {
    if(p.costo) datos.push(['Costo', dinero(p.costo) + ' por ' + singular(p.unidad)]);
    if(p.gasto) datos.push(['Gasto por tratamiento', fCant(p.gasto) + ' ' + uTxt(p.gasto, p.unidad)]);
  }
  datos.push(['Avisar cuando queden', p.min ? fCant(p.min) + ' ' + uTxt(p.min, p.unidad) : 'No configurado']);
  if(c) datos.push(['Gasto promedio', fCant(c * 30) + ' ' + (p.unidad || '') + ' al mes']);
  if(p.vence) datos.push(['Vence', fCorta(p.vence)]);
  if(p.lote) datos.push(['Lote', p.lote]);
  if(p.pao) datos.push(['Dura abierto', p.pao + (p.pao === 1 ? ' mes' : ' meses')]);
  if(p.abierto) datos.push(['Se abrió', fCorta(p.abierto) + (p.pao ? ' · usar antes del ' + fCorta(sumarMeses(p.abierto, p.pao)) : '')]);
  if(p.prov) datos.push(['Proveedor', p.prov + (p.telProv ? ' · ' + p.telProv : '')]);
  const etiqueta = {inicial:'Cantidad inicial', entrada:'Llegó', venta:'Venta', uso:'Uso en tratamiento', ajuste:'Ajuste'};
  d.innerHTML = cabecera(esc(p.nombre), `<button class="icon-btn" data-act="editarProd" data-id="${p.id}" aria-label="Editar">${IC.lapiz}</button>`) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="det-cab">${avatar(p, 'xl')}<div><h3>${esc(p.nombre)}</h3><div class="muted">${esc([p.marca, p.cat].filter(Boolean).join(' · '))}</div>
      <div class="chips" style="margin-top:6px"><span class="pill ${p.tipo === 'venta' ? 'acc' : 'gold'}">${p.tipo === 'venta' ? 'Para vender' : 'Uso en spa'}</span></div></div></div>
    <section class="card"><div class="det-stock"><span class="q num" style="color:${avs.some(a => a.clase==='stock' && a.nivel==='bad') ? 'var(--bad)' : avs.some(a => a.clase==='stock') ? 'var(--warn)' : 'inherit'}">${fCant(s)}</span><span class="u">${esc(uTxt(s, p.unidad))}</span></div>
      ${avs.length ? `<div class="chips" style="justify-content:center">${avs.map(a => `<span class="pill ${a.nivel}">${esc(a.txt)}</span>`).join('')}</div>` : '<div class="chips" style="justify-content:center"><span class="pill ok">✓ Sin avisos</span></div>'}
      <div class="acc-grid">${p.tipo === 'venta' ? `<button class="btn" data-act="vender" data-id="${p.id}">Vender</button>` : `<button class="btn" data-act="usar" data-id="${p.id}">Usar</button>`}
        <button class="btn gold" data-act="entrada" data-id="${p.id}">Llegó más</button>
        <button class="btn ghost" data-act="ajuste" data-id="${p.id}">Contar / corregir</button>
        ${p.pao ? `<button class="btn ghost" data-act="abrirHoy" data-id="${p.id}">Lo abrí hoy</button>` : `<button class="btn ghost" data-act="editarProd" data-id="${p.id}">Editar datos</button>`}</div>
      ${p.telProv ? `<a class="btn soft" href="${waLink(p.telProv, `Hola, quisiera pedir ${p.nombre}${p.marca ? ' (' + p.marca + ')' : ''}. ¿Tienen disponible?`)}" target="_blank" rel="noopener">💬 Pedir al proveedor por WhatsApp</a>` : ''}</section>
    <section class="card" style="gap:0"><h3 style="margin-bottom:4px">Datos</h3>${datos.map(x => `<div class="dato"><span>${esc(x[0])}</span><span>${esc(x[1])}</span></div>`).join('')}
      ${p.notas ? `<div class="dato"><span>Notas</span><span style="font-weight:500">${esc(p.notas)}</span></div>` : ''}</section>
    <section class="card" style="gap:0"><h3 style="margin-bottom:4px">Movimientos</h3>${movs.length ? movs.slice(0, 60).map(m => `<div class="mov"><span>${esc(etiqueta[m.tipo] || m.tipo)}${m.pac ? ' · ' + esc(m.pac) : ''}</span><span class="q num ${m.cant >= 0 ? 'mas' : 'menos'}">${m.cant >= 0 ? '+' : '−'}${fCant(Math.abs(m.cant))}</span>
      <span class="s">${esc(fCorta(m.fecha))}${m.trat ? ' · ' + esc(m.trat) : ''}${m.motivo ? ' · ' + esc(m.motivo) : ''}${m.nota ? ' · ' + esc(m.nota) : ''}${m.por ? ' · ' + esc(m.por) : ''}</span></div>`).join('') : '<div class="muted peq">Sin movimientos.</div>'}</section>
    <button class="btn danger full" data-act="borrarProd" data-id="${p.id}">Eliminar producto</button>
  </div></div>`;
  cargarFotos(d);
}
function waLink(tel, texto){
  let t = String(tel || '').replace(/\D/g, '');
  if(t.startsWith('0')) t = '593' + t.slice(1);
  return 'https://wa.me/' + t + '?text=' + encodeURIComponent(texto);
}
function refrescar(){
  render();
  for(const c of pila){ if(c.el.dataset.tipo === 'prod') pintarProd(c.el); if(c.el.dataset.tipo === 'paciente') pintarPaciente(c.el); if(c.el.dataset.tipo === 'compras') pintarCompras(c.el); }
}

// ---------- Formularios (estado F + campos data-f) ----------
let F = null;
function hojaForm(titulo, tipo, pintar, alCerrar){
  const d = abrirCapa(cabecera(titulo) + `<div class="hoja-cuerpo"><div class="hoja-in" id="fCuerpo"></div></div>
    <footer class="hoja-pie"><div class="in"><button class="btn ghost" data-act="cerrar">Cancelar</button><button class="btn" data-act="guardarF">Guardar</button></div></footer>`,
    {tipo, alCerrar:() => { if(alCerrar) alCerrar(); F = null; }});
  F.pintar = pintar;
  pintar();
  return d;
}
function repintar(){
  const cu = $('#fCuerpo'); if(!cu || !F) return;
  const sc = cu.parentElement.scrollTop;
  F.pintar();
  cu.parentElement.scrollTop = sc;
}
function campo(label, f, op = {}){
  const v = F[f] ?? '';
  const tipo = op.tipo || 'text';
  const attrs = (op.modo ? ` inputmode="${op.modo}"` : '') + (op.ph ? ` placeholder="${esc(op.ph)}"` : '') + (op.lista ? ` list="${op.lista}"` : '') + (op.max ? ` max="${op.max}"` : '') + ' autocomplete="off"';
  const input = op.area ? `<textarea data-f="${f}"${attrs}>${esc(v)}</textarea>` : `<input type="${tipo}" data-f="${f}" value="${esc(v)}"${attrs}>`;
  return `<div class="campo"><label>${label}</label>${input}${op.ayuda ? `<span class="ayuda">${op.ayuda}</span>` : ''}</div>`;
}
function pasos(label, f, unidad){
  return `<div class="campo"><span class="lbl">${label}${unidad ? ' (' + esc(unidad) + ')' : ''}</span><div class="paso"><button type="button" data-act="paso" data-f="${f}" data-d="-1" aria-label="Menos">−</button>
    <input type="text" inputmode="decimal" data-f="${f}" value="${esc(F[f] ?? '')}"><button type="button" data-act="paso" data-f="${f}" data-d="1" aria-label="Más">+</button></div></div>`;
}
function chipsF(f, opciones, op = {}){
  return `<div class="chips">${opciones.map(o => `<button type="button" class="chip ${F[f] === o ? 'on' : ''}" data-act="fChip" data-f="${f}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}${op.extra || ''}</div>`;
}
function listaPacientes(){ return `<datalist id="dlPac">${pacientes().map(p => `<option value="${esc(p.nombre)}">`).join('')}</datalist>`; }
document.addEventListener('input', e => {
  const f = e.target.dataset && e.target.dataset.f;
  if(F && f){ F[f] = e.target.value; if(F.alCambiar) F.alCambiar(f, e.target); }
});

// Producto nuevo o editar
function formProd(id, tipo){
  const p = id ? prodPorId(id) : null;
  F = p ? {id:p.id, tipo:p.tipo, nombre:p.nombre, marca:p.marca || '', cat:p.cat || '', unidad:p.unidad || 'unidades', inicial:'',
      min:p.min ? fCant(p.min) : '', costo:dineroIn(p.costo), precio:dineroIn(p.precio), gasto:p.gasto ? fCant(p.gasto) : '', duraPac:p.duraPac || '',
      vence:p.vence || '', lote:p.lote || '', abierto:p.abierto || '', pao:p.pao || '', prov:p.prov || '', telProv:p.telProv || '', notas:p.notas || '', foto:p.foto || '', fotoNueva:null}
    : {id:null, tipo:tipo || 'venta', nombre:'', marca:'', cat:'', unidad:'unidades', inicial:'', min:'', costo:'', precio:'', gasto:'1', duraPac:'',
      vence:'', lote:'', abierto:'', pao:'', prov:'', telProv:'', notas:'', foto:'', fotoNueva:null};
  F.guardar = guardarProd;
  hojaForm(p ? 'Editar producto' : (F.tipo === 'venta' ? 'Producto para vender' : 'Producto de uso en el spa'), 'form', pintarFormProd, () => { if(F && F.fotoNueva && !F.guardado) FDB.del(F.fotoNueva).catch(() => {}); });
}
function pintarFormProd(){
  const cu = $('#fCuerpo');
  const cats = Array.from(new Set(CATS[F.tipo].concat(E.cats[F.tipo] || [])));
  const provs = Array.from(new Set(vivos(E.productos).map(p => p.prov).filter(Boolean)));
  const fotoId = F.fotoNueva || F.foto;
  cu.innerHTML = `
    <div class="seg"><button type="button" class="${F.tipo==='venta'?'on':''}" data-act="fChip" data-f="tipo" data-v="venta">Para vender</button><button type="button" class="${F.tipo==='uso'?'on':''}" data-act="fChip" data-f="tipo" data-v="uso">Uso en el spa</button></div>
    <div class="foto-campo">${fotoId ? `<span class="av xl"><img data-foto="${esc(fotoId)}" alt=""></span>` : `<span class="av xl" style="background:var(--line);color:var(--muted)">📷</span>`}
      <div style="display:flex;flex-direction:column;gap:8px"><button type="button" class="btn sm soft" data-act="fFoto">${fotoId ? 'Cambiar foto' : 'Agregar foto'}</button>${fotoId ? '<button type="button" class="btn sm ghost" data-act="fSinFoto">Quitar foto</button>' : '<span class="peq muted">Opcional: ayuda a reconocerlo rápido.</span>'}</div></div>
    ${campo('Nombre del producto *', 'nombre', {ph: F.tipo === 'venta' ? 'Ej.: Protector solar FPS 50' : 'Ej.: Ácido hialurónico HydraFiller'})}
    ${campo('Marca (opcional)', 'marca', {ph:'Ej.: La Roche-Posay'})}
    <div class="campo"><span class="lbl">Categoría</span>${chipsF('cat', cats, {extra:`<button type="button" class="chip" data-act="nuevaCat">＋ Otra</button>`})}</div>
    <div class="campo"><span class="lbl">Se cuenta en</span>${chipsF('unidad', UNIDADES)}</div>
    ${!F.id ? pasos('¿Cuántos tienes ahora?', 'inicial', F.unidad) : ''}
    ${pasos('Avisarme cuando queden', 'min', F.unidad)}
    <span class="ayuda peq muted" style="margin-top:-8px">Cuando llegue a esa cantidad, el producto aparece en «Se están terminando».</span>
    ${F.tipo === 'uso' ? pasos('Gasto por tratamiento', 'gasto', F.unidad) + '<span class="ayuda peq muted" style="margin-top:-8px">Es lo que descuenta el botón «Usar» con un solo toque.</span>' : ''}
    <div class="fila2">${campo('Costo de compra ($)', 'costo', {modo:'decimal', ph:'0,00', ayuda:'Por ' + singular(F.unidad)})}
      ${F.tipo === 'venta' ? campo('Precio de venta ($)', 'precio', {modo:'decimal', ph:'0,00'}) : '<div></div>'}</div>
    ${F.tipo === 'venta' ? `<div class="peq" id="margen" style="margin-top:-6px">${textoMargen()}</div>` : ''}
    <div class="sec-tit">Vencimiento</div>
    <div class="fila2">${campo('Fecha de vencimiento', 'vence', {tipo:'date'})}${campo('Lote (opcional)', 'lote')}</div>
    <div class="fila2">${campo('Dura abierto (meses)', 'pao', {modo:'numeric', ph:'Ej.: 12', ayuda:'El número del frasquito abierto: 6M, 12M…'})}${campo('Fecha en que se abrió', 'abierto', {tipo:'date', max:hoyISO()})}</div>
    ${F.tipo === 'venta' ? `<div class="sec-tit">Para volver a ofrecer</div>${campo('A la paciente le dura (días)', 'duraPac', {modo:'numeric', ph:'Ej.: 60', ayuda:'Opcional. La app te recordará ofrecérselo de nuevo cuando ya se le esté terminando.'})}` : ''}
    <div class="sec-tit">Proveedor</div>
    <div class="fila2">${campo('Proveedor', 'prov', {lista:'dlProv', ph:'Nombre'})}${campo('WhatsApp del proveedor', 'telProv', {tipo:'tel', ph:'09…'})}</div>
    <datalist id="dlProv">${provs.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    ${campo('Notas (opcional)', 'notas', {area:true, ph:'Ej.: guardar en refrigeración'})}
    ${F.id ? '' : '<div class="peq muted">Solo el nombre es obligatorio. Lo demás lo puedes completar después.</div>'}`;
  cargarFotos(cu);
  F.alCambiar = f => { if(f === 'precio' || f === 'costo'){ const m = $('#margen'); if(m) m.innerHTML = textoMargen(); } };
}
function textoMargen(){
  const pr = num(F.precio), co = num(F.costo);
  return pr > 0 && co > 0 ? `Ganas <b>${dinero(pr - co)}</b> por cada uno (${Math.round((pr - co) / pr * 100)} %).` : '';
}
async function guardarProd(){
  const nombre = F.nombre.trim();
  if(!nombre){ toast('Escribe el nombre del producto'); return; }
  const min = num(F.min), costo = num(F.costo), precio = num(F.precio), gasto = num(F.gasto), pao = parseInt(F.pao, 10), dura = parseInt(F.duraPac, 10), ini = num(F.inicial);
  if(F.abierto && F.abierto > hoyISO()){ toast('La fecha de apertura no puede ser futura'); return; }
  const datos = {tipo:F.tipo, nombre, marca:F.marca.trim(), cat:F.cat, unidad:F.unidad || 'unidades',
    min:min > 0 ? red(min) : 0, costo:costo > 0 ? red(costo) : 0, precio:F.tipo === 'venta' && precio > 0 ? red(precio) : 0,
    gasto:F.tipo === 'uso' && gasto > 0 ? red(gasto) : 0, duraPac:F.tipo === 'venta' && dura > 0 ? dura : 0,
    vence:F.vence || '', lote:F.lote.trim(), abierto:F.abierto || '', pao:pao > 0 ? pao : 0,
    prov:F.prov.trim(), telProv:F.telProv.trim(), notas:F.notas.trim(), foto:F.fotoNueva || F.foto || ''};
  let id = F.id, fotoVieja = null;
  if(id){
    const p = prodPorId(id);
    if(p.foto && p.foto !== datos.foto) fotoVieja = p.foto;
    Object.assign(p, datos); marcar(p);
  } else {
    id = uid();
    E.productos.push(marcar(Object.assign({id}, datos), true));
    if(ini > 0) E.movs.push(marcar({id:uid(), prod:id, tipo:'inicial', cant:red(ini), fecha:hoyISO(), costo:datos.costo}, true));
  }
  F.guardado = true;
  if(!guardar()) return;
  if(fotoVieja) FDB.del(fotoVieja).catch(() => {});
  const nuevo = !F.id, tipo = datos.tipo;
  cerrarCapa();
  if(nuevo && U.tab !== tipo && U.tab !== 'inicio'){ U.tab = tipo; }
  refrescar();
  toast(nuevo ? 'Producto agregado' : 'Cambios guardados');
}

// Llegó mercadería
function formEntrada(id){
  const p = prodPorId(id);
  F = {prod:id, cant:'1', costo:dineroIn(p.costo), fecha:hoyISO(), vence:'', lote:'', nota:'', guardar:guardarEntrada};
  hojaForm('Llegó más · ' + esc(p.nombre), 'form', () => {
    $('#fCuerpo').innerHTML = `<div class="peq muted">Ahora hay <b>${fCant(stockDe(id))} ${esc(p.unidad)}</b>.</div>
      ${pasos('¿Cuántos llegaron?', 'cant', p.unidad)}
      <div class="fila2">${campo('Costo de cada uno ($)', 'costo', {modo:'decimal', ph:'0,00'})}${campo('Fecha', 'fecha', {tipo:'date', max:hoyISO()})}</div>
      <div class="fila2">${campo('Vence (opcional)', 'vence', {tipo:'date'})}${campo('Lote (opcional)', 'lote')}</div>
      ${campo('Nota (opcional)', 'nota', {ph:'Ej.: factura 123, pedido a…'})}`;
  });
}
function guardarEntrada(){
  const p = prodPorId(F.prod), c = num(F.cant), costo = num(F.costo);
  if(!(c > 0)){ toast('Escribe cuántos llegaron'); return; }
  if(!F.fecha || F.fecha > hoyISO()){ toast('Revisa la fecha'); return; }
  E.movs.push(marcar({id:uid(), prod:p.id, tipo:'entrada', cant:red(c), fecha:F.fecha, costo:costo > 0 ? red(costo) : 0, nota:F.nota.trim()}, true));
  if(costo > 0) p.costo = red(costo);
  // Se guarda la fecha de vencimiento más próxima de lo que hay
  if(F.vence){ if(!p.vence || stockDe(p.id) <= 0 || F.vence < p.vence) p.vence = F.vence; }
  if(F.lote.trim()) p.lote = F.lote.trim();
  marcar(p);
  if(!guardar()) return;
  cerrarCapa(); refrescar();
  toast(`+${fCant(c)} ${p.unidad} de ${p.nombre}`);
}

// Usar en tratamiento
function formUso(id){
  const p = prodPorId(id);
  F = {prod:id, cant:fCant(p.gasto > 0 ? p.gasto : 1), fecha:hoyISO(), pac:'', trat:'', nota:'', guardar:guardarUso};
  hojaForm('Usar · ' + esc(p.nombre), 'form', () => {
    $('#fCuerpo').innerHTML = `<div class="peq muted">Hay <b>${fCant(stockDe(id))} ${esc(p.unidad)}</b>.</div>
      ${pasos('¿Cuánto usaste?', 'cant', p.unidad)}
      ${campo('Fecha', 'fecha', {tipo:'date', max:hoyISO()})}
      ${campo('Paciente (opcional)', 'pac', {lista:'dlPac', ph:'Nombre'})}${listaPacientes()}
      ${campo('Tratamiento (opcional)', 'trat', {ph:'Ej.: Carboxiterapia en ojeras'})}
      ${p.lote ? `<div class="peq muted">Lote en uso: ${esc(p.lote)}. Queda anotado con este registro.</div>` : ''}`;
  });
}
function guardarUso(){
  const p = prodPorId(F.prod), c = num(F.cant);
  if(!(c > 0)){ toast('Escribe cuánto usaste'); return; }
  if(!F.fecha || F.fecha > hoyISO()){ toast('Revisa la fecha'); return; }
  E.movs.push(marcar({id:uid(), prod:p.id, tipo:'uso', cant:-red(c), fecha:F.fecha, pac:F.pac.trim(), trat:F.trat.trim(), nota:p.lote ? 'Lote ' + p.lote : ''}, true));
  if(!guardar()) return;
  cerrarCapa(); refrescar();
  toast(`−${fCant(c)} ${p.unidad} de ${p.nombre}`);
}
function usarRapido(id){
  const p = prodPorId(id), c = p.gasto > 0 ? p.gasto : 1;
  const m = marcar({id:uid(), prod:id, tipo:'uso', cant:-c, fecha:hoyISO(), nota:p.lote ? 'Lote ' + p.lote : ''}, true);
  E.movs.push(m); guardar(); refrescar();
  toast(`−${fCant(c)} ${uTxt(c, p.unidad)} de ${p.nombre}. Quedan ${fCant(stockDe(id))}`, {txt:'Deshacer', fn:() => { m.borrado = true; marcar(m); guardar(); refrescar(); toast('Listo, se deshizo'); }});
}

// Contar / corregir
function formAjuste(id){
  const p = prodPorId(id);
  F = {prod:id, real:fCant(stockDe(id)), motivo:'Conteo', nota:'', guardar:guardarAjuste};
  hojaForm('Contar · ' + esc(p.nombre), 'form', () => {
    const dif = red(num(F.real) - stockDe(id));
    $('#fCuerpo').innerHTML = `<div class="peq muted">Según la app hay <b>${fCant(stockDe(id))} ${esc(p.unidad)}</b>. Escribe lo que realmente hay.</div>
      ${pasos('¿Cuántos hay de verdad?', 'real', p.unidad)}
      <div class="peq" id="aDif">${isFinite(dif) && dif ? `Diferencia: <b style="color:${dif < 0 ? 'var(--bad)' : 'var(--ok)'}">${dif > 0 ? '+' : '−'}${fCant(Math.abs(dif))}</b>` : 'Sin diferencia.'}</div>
      <div class="campo"><span class="lbl">Motivo</span>${chipsF('motivo', MOTIVOS)}</div>
      ${campo('Nota (opcional)', 'nota')}`;
  });
  F.alCambiar = f => { if(f === 'real'){ const dif = red(num(F.real) - stockDe(id)); const e = $('#aDif'); if(e) e.innerHTML = isFinite(dif) && dif ? `Diferencia: <b style="color:${dif < 0 ? 'var(--bad)' : 'var(--ok)'}">${dif > 0 ? '+' : '−'}${fCant(Math.abs(dif))}</b>` : 'Sin diferencia.'; } };
}
function guardarAjuste(){
  const p = prodPorId(F.prod), real = num(F.real);
  if(!(real >= 0)){ toast('Escribe la cantidad que hay'); return; }
  const dif = red(real - stockDe(p.id));
  if(!dif){ cerrarCapa(); toast('La cantidad ya estaba bien'); return; }
  E.movs.push(marcar({id:uid(), prod:p.id, tipo:'ajuste', cant:dif, fecha:hoyISO(), motivo:F.motivo, nota:F.nota.trim()}, true));
  if(!guardar()) return;
  cerrarCapa(); refrescar();
  toast(`${p.nombre}: ahora hay ${fCant(real)}`);
}

// ---------- Ventas ----------
function formVenta(id, prodId){
  const v = id ? E.ventas.find(x => x.id === id) : null;
  F = v ? {id:v.id, pac:v.pac || '', tel:v.tel || '', fecha:v.fecha, pago:v.cobrado ? v.pago : 'Por cobrar', pagoReal:v.pago, nota:v.nota || '',
        items:v.items.map(i => ({prod:i.prod, nombre:i.nombre, cant:fCant(i.cant), precio:dineroIn(i.precio), costo:i.costo || 0})), buscar:'', guardar:guardarVenta}
    : {id:null, pac:'', tel:'', fecha:hoyISO(), pago:'Efectivo', nota:'', items:[], buscar:'', guardar:guardarVenta};
  if(prodId) agregarItem(prodId);
  const d = hojaForm(v ? 'Editar venta' : 'Nueva venta', 'form', pintarVenta);
  if(v){
    const pie = $('.hoja-pie .in', d);
    pie.insertAdjacentHTML('afterbegin', `<button class="btn danger" data-act="borrarVenta" style="flex:0 0 auto">Eliminar</button>`);
  }
  F.alCambiar = (f, el) => {
    if(f === 'pac'){ const x = pacientes().find(p => norm(p.nombre) === norm(F.pac)); if(x && x.tel && !F.tel){ F.tel = x.tel; const t = $('[data-f="tel"]'); if(t) t.value = x.tel; } }
    if(f === 'buscar'){ const s = $('#selProd'); if(s){ s.innerHTML = selectorHTML(); cargarFotos(s); } }
  };
  F.alItem = () => { const t = $('#vTotal'); if(t) t.textContent = dinero(totalF()); $$('[data-sub]').forEach(e => { const it = F.items[+e.dataset.sub]; e.textContent = it ? dinero((num(it.cant) || 0) * (num(it.precio) || 0)) : ''; }); };
}
function agregarItem(pid){
  const p = prodPorId(pid);
  const ya = F.items.find(i => i.prod === pid);
  if(ya){ ya.cant = fCant((num(ya.cant) || 0) + 1); return; }
  F.items.push({prod:pid, nombre:p.nombre, cant:'1', precio:dineroIn(p.precio), costo:p.costo || 0});
}
const totalF = () => red(F.items.reduce((s, i) => s + (num(i.cant) || 0) * (num(i.precio) || 0), 0));
function selectorHTML(){
  const q = norm(F.buscar);
  const ps = productos('venta').filter(p => !q || norm(p.nombre + ' ' + (p.marca || '')).includes(q)).slice(0, 30);
  if(!productos('venta').length) return '<div class="peq muted">No hay productos para vender. Agrégalos en la pestaña «Para vender».</div>';
  if(!ps.length) return '<div class="peq muted">No encontré ese producto.</div>';
  return ps.map(p => `<button type="button" class="sel-item" data-act="vAgregar" data-id="${p.id}">${avatar(p, 'sm')}<span class="tx"><b>${esc(p.nombre)}</b><span class="peq muted">${p.precio ? dinero(p.precio) + ' · ' : ''}hay ${fCant(stockDe(p.id))}</span></span><span class="pill acc">＋</span></button>`).join('');
}
function pintarVenta(){
  const cu = $('#fCuerpo');
  cu.innerHTML = `${campo('Paciente', 'pac', {lista:'dlPac', ph:'Nombre de la paciente'})}${listaPacientes()}
    <div class="fila2">${campo('Fecha', 'fecha', {tipo:'date', max:hoyISO()})}${campo('WhatsApp (opcional)', 'tel', {tipo:'tel', ph:'09…'})}</div>
    <div class="sec-tit">Productos</div>
    ${F.items.map((it, i) => `<div class="item-venta"><span class="n">${esc(it.nombre)}</span><button type="button" class="x" data-act="vQuitar" data-i="${i}" aria-label="Quitar">✕</button>
      <div class="ctl"><div class="campo"><span class="lbl">Cantidad</span><input type="text" inputmode="decimal" data-item="${i}" data-c="cant" value="${esc(it.cant)}"></div>
      <div class="campo"><span class="lbl">Precio c/u ($)</span><input type="text" inputmode="decimal" data-item="${i}" data-c="precio" value="${esc(it.precio)}"></div></div>
      <span class="sub" data-sub="${i}">${dinero((num(it.cant) || 0) * (num(it.precio) || 0))}</span></div>`).join('')}
    <div class="card" style="gap:8px"><label class="buscar" style="border:none;padding:0">${IC.lupa}<input type="search" data-f="buscar" placeholder="${F.items.length ? 'Agregar otro producto' : 'Busca el producto que vendiste'}" value="${esc(F.buscar)}" autocomplete="off"></label>
      <div class="selector" id="selProd">${selectorHTML()}</div></div>
    <div class="total"><span>Total</span><span class="num" id="vTotal">${dinero(totalF())}</span></div>
    <div class="campo"><span class="lbl">Forma de pago</span>${chipsF('pago', PAGOS)}</div>
    ${campo('Nota (opcional)', 'nota')}`;
  cargarFotos(cu);
}
document.addEventListener('input', e => {
  const i = e.target.dataset && e.target.dataset.item;
  if(F && F.items && i !== undefined){ F.items[+i][e.target.dataset.c] = e.target.value; if(F.alItem) F.alItem(); }
});
async function guardarVenta(){
  if(!F.items.length){ toast('Agrega al menos un producto'); return; }
  if(!F.fecha || F.fecha > hoyISO()){ toast('Revisa la fecha'); return; }
  for(const it of F.items){ if(!(num(it.cant) > 0)){ toast('Revisa la cantidad de ' + it.nombre); return; } if(!(num(it.precio) >= 0)){ toast('Revisa el precio de ' + it.nombre); return; } }
  if(!F.pac.trim() && !(await confirmar('¿Guardar sin nombre?', 'No escribiste el nombre de la paciente. Así no sabrás después a quién se lo vendiste.', 'Guardar igual'))) return;
  // Avisar si se vende más de lo que hay
  const previo = F.id ? E.ventas.find(x => x.id === F.id) : null;
  const falta = F.items.filter(it => { const antes = previo ? (previo.items.find(x => x.prod === it.prod) || {cant:0}).cant : 0; return num(it.cant) > stockDe(it.prod) + antes; });
  if(falta.length && !(await confirmar('No alcanza el inventario', `Según la app no hay suficiente de: <b>${falta.map(i => esc(i.nombre)).join(', ')}</b>. Si sí lo tienes, guarda igual y luego corrige la cantidad con «Contar / corregir».`, 'Guardar igual'))) return;
  const items = F.items.map(it => ({prod:it.prod, nombre:it.nombre, cant:red(num(it.cant)), precio:red(num(it.precio)), costo:it.costo || 0}));
  const cobrado = F.pago !== 'Por cobrar';
  let v;
  if(previo){
    v = previo;
    Object.assign(v, {pac:F.pac.trim(), tel:F.tel.trim(), fecha:F.fecha, items, cobrado, pago:cobrado ? F.pago : (v.pago && v.pago !== 'Por cobrar' ? v.pago : 'Por cobrar'), nota:F.nota.trim()});
    marcar(v);
    for(const m of E.movs) if(m.venta === v.id && !m.borrado){ m.borrado = true; marcar(m); }
  } else {
    v = marcar({id:uid(), pac:F.pac.trim(), tel:F.tel.trim(), fecha:F.fecha, items, cobrado, pago:cobrado ? F.pago : 'Por cobrar', nota:F.nota.trim(), recordados:{}}, true);
    E.ventas.push(v);
  }
  if(!cobrado) v.pago = 'Por cobrar';
  for(const it of items) E.movs.push(marcar({id:uid(), prod:it.prod, tipo:'venta', cant:-it.cant, fecha:v.fecha, pac:v.pac, precio:it.precio, venta:v.id}, true));
  if(!guardar()) return;
  const nuevo = !F.id;
  cerrarCapa(); refrescar();
  toast(nuevo ? `Venta guardada · ${dinero(totalVenta(v))}` : 'Venta actualizada');
}
async function borrarVenta(){
  const v = E.ventas.find(x => x.id === F.id); if(!v) return;
  if(!(await confirmar('¿Eliminar esta venta?', 'Los productos vuelven al inventario.', 'Eliminar', true))) return;
  v.borrado = true; marcar(v);
  for(const m of E.movs) if(m.venta === v.id && !m.borrado){ m.borrado = true; marcar(m); }
  guardar(); cerrarCapa(); refrescar(); toast('Venta eliminada');
}

// ---------- Pacientes ----------
function abrirPacientes(){
  const d = abrirCapa('', {tipo:'pacientes'});
  const pintar = q => {
    const lista = pacientes().filter(p => !q || norm(p.nombre).includes(norm(q)));
    $('#pacLista', d).innerHTML = lista.length ? lista.map(p => {
      const vs = vivos(E.ventas).filter(v => norm(v.pac) === norm(p.nombre));
      return `<button class="alerta" data-act="verPaciente" data-n="${esc(p.nombre)}"><span class="av sm" style="background:var(--gold)">${esc(p.nombre[0].toUpperCase())}</span><div class="tx"><b>${esc(p.nombre)}</b><div class="d">${vs.length} ${vs.length===1?'compra':'compras'}${vs.length ? ' · última ' + esc(fCorta(vs.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].fecha)) : ''}</div></div><span class="num" style="font-weight:800">${dinero(vs.reduce((s, v) => s + totalVenta(v), 0))}</span></button>`;
    }).join('') : '<div class="vacio">Todavía no hay pacientes. Aparecen solas cuando registras ventas.</div>';
  };
  d.innerHTML = cabecera('Pacientes') + `<div class="hoja-cuerpo"><div class="hoja-in"><label class="buscar">${IC.lupa}<input type="search" id="qPac" placeholder="Buscar paciente" autocomplete="off"></label><section class="card" style="gap:0" id="pacLista"></section></div></div>`;
  pintar('');
  $('#qPac', d).addEventListener('input', e => pintar(e.target.value));
}
function verPaciente(nombre){
  const d = abrirCapa('', {tipo:'paciente'});
  d.dataset.n = nombre;
  pintarPaciente(d);
}
function pintarPaciente(d){
  const n = d.dataset.n, k = norm(n);
  const vs = vivos(E.ventas).filter(v => norm(v.pac) === k).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const usos = vivos(E.movs).filter(m => m.tipo === 'uso' && norm(m.pac) === k).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const tel = (vs.find(v => v.tel) || {}).tel || '';
  d.innerHTML = cabecera(esc(n)) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="cifras"><div class="cifra"><span class="v num">${dinero(vs.reduce((s, v) => s + totalVenta(v), 0))}</span><span class="l">${vs.length} ${vs.length===1?'compra':'compras'}</span></div>
      <div class="cifra"><span class="v num">${usos.length}</span><span class="l">Productos usados en tratamientos</span></div></div>
    ${tel ? `<a class="btn soft" href="${waLink(tel, 'Hola ' + n.split(' ')[0] + ', ')}" target="_blank" rel="noopener">💬 Escribirle por WhatsApp</a>` : ''}
    <section class="card" style="gap:0"><h3 style="margin-bottom:4px">Compras</h3>${vs.length ? vs.map(v => `<button class="alerta" data-act="editarVenta" data-id="${v.id}"><div class="tx"><b>${esc(v.items.map(i => fCant(i.cant) + ' × ' + i.nombre).join(', '))}</b><div class="d">${esc(fDia(v.fecha))} ${v.fecha.slice(0, 4)}</div></div><span class="pill ${v.cobrado ? 'acc' : 'warn'} num">${dinero(totalVenta(v))}</span></button>`).join('') : '<div class="muted peq">Sin compras.</div>'}</section>
    ${usos.length ? `<section class="card" style="gap:0"><h3 style="margin-bottom:4px">Usado en sus tratamientos</h3>${usos.map(m => { const p = prodPorId(m.prod); return `<div class="mov"><span>${esc(p ? p.nombre : 'Producto borrado')}</span><span class="q num">${fCant(-m.cant)} ${esc(p ? p.unidad : '')}</span><span class="s">${esc(fCorta(m.fecha))}${m.trat ? ' · ' + esc(m.trat) : ''}${m.nota ? ' · ' + esc(m.nota) : ''}</span></div>`; }).join('')}</section>` : ''}
  </div></div>`;
}

// ---------- Lista de compras ----------
function abrirCompras(){ const d = abrirCapa('', {tipo:'compras'}); pintarCompras(d); }
function pintarCompras(d){
  calcular();
  const lista = paraPedir(), grupos = new Map();
  for(const x of lista){ const k = x.p.prov || ''; if(!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); }
  let h = '';
  if(!lista.length) h = '<div class="estado-ok"><span>✓</span><div>No hay nada por pedir. Todo tiene suficiente cantidad.</div></div>';
  for(const [prov, xs] of grupos){
    const tel = (xs.find(x => x.p.telProv) || {p:{}}).p.telProv;
    h += `<section class="card" style="gap:0"><div class="card-cab" style="margin-bottom:6px"><h3>${esc(prov || 'Sin proveedor')}</h3>${tel ? `<a class="btn sm soft" href="${waLink(tel, textoPedido(xs))}" target="_blank" rel="noopener">💬 Pedir</a>` : ''}</div>
      ${xs.map(x => `<button class="alerta" data-act="verProd" data-id="${x.p.id}">${avatar(x.p, 'sm')}<div class="tx"><b>${esc(x.p.nombre)}</b><div class="d">${x.p.tipo === 'venta' ? 'Para vender' : 'Uso en spa'} · hay ${fCant(x.s)}</div></div><span class="pill gold">Pedir ${fCant(x.sug)}</span></button>`).join('')}</section>`;
  }
  d.innerHTML = cabecera('🛒 Lista de compras') + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="peq muted">Productos que se están terminando, con una cantidad sugerida para pedir (para unas semanas, según lo que usas o vendes).</div>${h}
    ${lista.length ? '<button class="btn full" data-act="compartirCompras">Compartir la lista completa</button>' : ''}</div></div>`;
  cargarFotos(d);
}
function textoPedido(xs){ return 'Hola, quisiera hacer un pedido:\n' + xs.map(x => `• ${fCant(x.sug)} ${x.p.unidad} de ${x.p.nombre}${x.p.marca ? ' (' + x.p.marca + ')' : ''}`).join('\n') + '\nGracias.'; }
async function compartirTexto(t){
  try{ if(navigator.share){ await navigator.share({text:t}); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(t); toast('Lista copiada. Pégala en WhatsApp.'); }catch(e){ toast('No se pudo compartir en este navegador'); }
}

// ---------- Compartir entre los dos celulares ----------
async function enviar(){
  if(!quien()){ elegirQuien(); return; }
  toast('Preparando el archivo…');
  const fotos = {};
  for(const p of vivos(E.productos)) if(p.foto){ const b = await FDB.get(p.foto).catch(() => null); if(b) fotos[p.foto] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
  const paquete = {app:'sparati-inventario', v:1, de:quien(), generado:new Date().toISOString(),
    datos:{productos:E.productos, movs:E.movs, ventas:E.ventas, cats:E.cats}, fotos};
  const texto = JSON.stringify(paquete);
  const nombre = `inventario-sparati-${quien().toLowerCase()}-${hoyISO()}.txt`;
  let hecho = false;
  try{
    const f = new File([texto], nombre, {type:'text/plain'});
    if(navigator.canShare && navigator.canShare({files:[f]})){ await navigator.share({files:[f], title:'Inventario SPARATI'}); hecho = true; }
  }catch(e){ if(e && e.name === 'AbortError'){ toast('Envío cancelado'); return; } }
  if(!hecho){
    const url = URL.createObjectURL(new Blob([texto], {type:'text/plain'}));
    const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Archivo guardado en Descargas: ' + nombre);
  } else toast(`Listo. Si lo mandaste por WhatsApp, ${otro()} lo abre con «Recibir».`);
  E.sync.envio = ahora(); guardar(); refrescar(); pintarAjustes();
}
function recibir(){ const i = $('#inArchivo'); i.value = ''; i.click(); }
function dataURLaBlob(u){
  const [cab, b64] = u.split(','); const tipo = (cab.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], {type:tipo});
}
// Junta lo recibido con lo de este celular: gana la versión más reciente de cada registro
function mezclar(datos){
  let nuevos = 0, cambiados = 0;
  for(const k of ['productos','movs','ventas']){
    const mapa = new Map(E[k].map(x => [x.id, x]));
    for(const x of datos[k] || []){
      if(!x || !x.id) continue;
      const y = mapa.get(x.id);
      if(!y){ E[k].push(x); mapa.set(x.id, x); nuevos++; }
      else if((x.mod || 0) > (y.mod || 0)){ for(const key of Object.keys(y)) if(!(key in x)) delete y[key]; Object.assign(y, x); cambiados++; }
    }
  }
  for(const t of ['venta','uso']) E.cats[t] = Array.from(new Set((E.cats[t] || []).concat((datos.cats && datos.cats[t]) || [])));
  return {nuevos, cambiados};
}
async function recibirArchivo(file){
  let p;
  try{ p = JSON.parse(await file.text()); }catch(e){ toast('Ese archivo no es del inventario de SPARATI'); return; }
  if(!p || p.app !== 'sparati-inventario' || !p.datos){ toast('Ese archivo no es del inventario de SPARATI'); return; }
  const r = mezclar(p.datos);
  for(const [id, u] of Object.entries(p.fotos || {})){
    const ya = await FDB.get(id).catch(() => null);
    if(!ya) try{ await FDB.put(id, dataURLaBlob(u)); }catch(e){}
  }
  E.sync.recibo = ahora(); if(p.de && p.de !== quien()) E.sync.de = p.de;
  guardar(); refrescar(); pintarAjustes();
  const de = p.de ? ' de ' + p.de : '';
  toast(r.nuevos || r.cambiados ? `Recibido${de}: ${r.nuevos} registros nuevos y ${r.cambiados} actualizados` : `Recibido${de}: ya tenías todo, no hubo cambios`);
}

// ---------- Ajustes ----------
function abrirAjustes(){ const d = abrirCapa('', {tipo:'ajustes'}); pintarAjustes(d); }
function pintarAjustes(d = capaArriba('ajustes')){
  if(!d) return;
  const cu = $('.hoja-cuerpo', d), sc = cu ? cu.scrollTop : 0;
  const badge = 'setAppBadge' in navigator;
  const permiso = window.Notification ? Notification.permission : 'no';
  d.innerHTML = cabecera('Ajustes') + `<div class="hoja-cuerpo"><div class="hoja-in">
    <section class="card"><h3>¿Quién usa este celular?</h3>
      <div class="seg"><button class="${quien()==='Elba'?'on':''}" data-act="ponQuien" data-v="Elba">Elba</button><button class="${quien()==='Jonathan'?'on':''}" data-act="ponQuien" data-v="Jonathan">Jonathan</button></div>
      <div class="peq muted">Cada venta y movimiento queda con el nombre de quien lo registró.</div></section>
    <section class="card"><h3>📲 Compartir entre los dos celulares</h3>
      <div class="peq">El inventario vive en cada celular. Para que el otro vea lo último, toca <b>Enviar</b> y mándale el archivo por WhatsApp. En el otro celular se abre con <b>Recibir</b>: la app junta todo sin borrar nada.</div>
      <div class="acc-grid"><button class="btn" data-act="enviar">📤 Enviar a ${esc(otro())}</button><button class="btn soft" data-act="recibir">📥 Recibir</button></div>
      <div class="peq muted">Último envío: ${haceTxt(E.sync.envio)} · Último recibido: ${haceTxt(E.sync.recibo)}</div>
      <div class="peq muted">Ese mismo archivo es tu copia de seguridad: si se borra la app o cambias de celular, con «Recibir» vuelve todo.</div></section>
    <section class="card"><h3>🔔 Avisos</h3>
      <div class="campo"><span class="lbl">Avisar del vencimiento con</span><div class="seg">${[30,60,90].map(n => `<button class="${E.ajustes.diasVence===n?'on':''}" data-act="diasVence" data-v="${n}">${n} días</button>`).join('')}</div></div>
      ${badge ? (permiso === 'granted' ? '<div class="peq">✓ El ícono de la app muestra cuántos productos tienen avisos.</div>'
        : `<button class="btn sm soft" data-act="permisoBadge">Mostrar el número de avisos en el ícono</button><div class="peq muted">El celular te pedirá permiso de notificaciones; solo se usa para el número del ícono.</div>`)
        : '<div class="peq muted">Los avisos aparecen al abrir la app, en Inicio y con un número rojo en las pestañas.</div>'}</section>
    <section class="card"><h3>🎨 Apariencia</h3><div class="seg">${[['auto','Automático'],['light','Claro'],['dark','Oscuro']].map(([v, n]) => `<button class="${E.ajustes.tema===v?'on':''}" data-act="aTema" data-v="${v}">${n}</button>`).join('')}</div></section>
    <details class="card"><summary style="font-weight:800;cursor:pointer">⚙️ Avanzado</summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
      <button class="btn ghost" data-act="actualizar">Actualizar la app ahora</button>
      <div class="peq muted">Úsalo si después de una mejora algo no responde. No borra tus datos.</div>
      <div class="campo"><label for="aBorrarTxt">Borrar todo el inventario de ESTE celular (productos, ventas y fotos). Escribe BORRAR para confirmar:</label><input type="text" id="aBorrarTxt" autocomplete="off" autocapitalize="characters"></div>
      <button class="btn danger" data-act="borrarTodo" id="aBorrar" disabled>Borrar todo</button>
      <div class="peq muted" style="text-align:center">SPARATI · Inventario · versión ${VERSION_APP}</div></div></details>
  </div></div>`;
  $('.hoja-cuerpo', d).scrollTop = sc;
  const bt = $('#aBorrarTxt', d);
  bt.addEventListener('input', () => { $('#aBorrar', d).disabled = bt.value.trim().toUpperCase() !== 'BORRAR'; });
}
function elegirQuien(){
  const d = abrirCapa(`<div class="hoja-cuerpo"><div class="hoja-in bienvenida">
    <div class="marca">SPARATI</div><div class="muted" style="letter-spacing:.2em;font-weight:700;font-size:.8rem;margin-top:-10px">INVENTARIO</div>
    <div style="font-weight:800;font-size:1.15rem;margin-top:20px">¿Quién usa este celular?</div>
    <div class="quien"><button data-act="ponQuien" data-v="Elba" data-cerrar="1"><span>🌸</span>Elba</button><button data-act="ponQuien" data-v="Jonathan" data-cerrar="1"><span>👤</span>Jonathan</button></div>
    <div class="peq muted">Sirve para saber quién registró cada cosa. Se puede cambiar en Ajustes.</div></div></div>`, {tipo:'quien', fija:true});
  return d;
}
function aplicarTema(){
  const v = E.ajustes.tema;
  if(v === 'light' || v === 'dark') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#FBF8F6';
}

// ---------- Acciones ----------
const ACT = {
  tab(b){ U.tab = b.dataset.tab; window.scrollTo(0, 0); render(); },
  cerrar(){ cerrarCapa(); },
  fab(){ if(U.tab === 'ventas' || U.tab === 'inicio') formVenta(); else formProd(null, U.tab); },
  ajustes(){ abrirAjustes(); },
  nuevoProd(b){ formProd(null, b.dataset.tipo); },
  verProd(b){ verProd(b.dataset.id); },
  editarProd(b){ formProd(b.dataset.id); },
  filtro(b){ U.filtro[U.tab] = b.dataset.f; render(); },
  vender(b){ formVenta(null, b.dataset.id); },
  usar(b){ formUso(b.dataset.id); },
  usarRapido(b){ usarRapido(b.dataset.id); },
  entrada(b){ formEntrada(b.dataset.id); },
  ajuste(b){ formAjuste(b.dataset.id); },
  abrirHoy(b){ const p = prodPorId(b.dataset.id); p.abierto = hoyISO(); marcar(p); guardar(); refrescar(); toast(`Anotado: ${p.nombre} se abrió hoy. Úsalo antes del ${fCorta(sumarMeses(p.abierto, p.pao))}`); },
  async borrarProd(b){
    const p = prodPorId(b.dataset.id);
    if(!(await confirmar('¿Eliminar producto?', `«${esc(p.nombre)}» se quita del inventario. Las ventas donde aparece se conservan.`, 'Eliminar', true))) return;
    p.borrado = true; marcar(p); guardar(); cerrarCapa(); refrescar(); toast('Producto eliminado');
  },
  compras(){ abrirCompras(); },
  compartirCompras(){ compartirTexto('🛒 Lista de compras SPARATI\n' + paraPedir().map(x => `• ${x.p.nombre}${x.p.marca ? ' (' + x.p.marca + ')' : ''}: pedir ${fCant(x.sug)} ${x.p.unidad} (hay ${fCant(x.s)})${x.p.prov ? ' — ' + x.p.prov : ''}`).join('\n')); },
  // Formularios
  guardarF(){ if(F && F.guardar) F.guardar(); },
  fChip(b){
    const f = b.dataset.f, v = b.dataset.v;
    F[f] = (f === 'cat' && F[f] === v) ? '' : v;
    if(f === 'tipo' && F.cat && !CATS[v].concat(E.cats[v] || []).includes(F.cat)) F.cat = '';
    repintar();
  },
  paso(b){
    const f = b.dataset.f, d = Number(b.dataset.d), v = num(F[f]);
    F[f] = fCant(Math.max(0, (isFinite(v) ? v : 0) + d));
    const inp = $(`input[data-f="${f}"]`); if(inp) inp.value = F[f];
    if(F.alCambiar) F.alCambiar(f, inp);
  },
  async nuevaCat(){
    const n = prompt('Nombre de la nueva categoría:');
    if(!n || !n.trim()) return;
    const c = cap(n.trim());
    E.cats[F.tipo] = Array.from(new Set((E.cats[F.tipo] || []).concat(c)));
    F.cat = c; guardar(); repintar();
  },
  fFoto(){ const i = $('#inFoto'); i.value = ''; i.click(); },
  fSinFoto(){ if(F.fotoNueva){ FDB.del(F.fotoNueva).catch(() => {}); F.fotoNueva = null; } F.foto = ''; repintar(); },
  vAgregar(b){ agregarItem(b.dataset.id); F.buscar = ''; repintar(); },
  vQuitar(b){ F.items.splice(+b.dataset.i, 1); repintar(); },
  editarVenta(b){ formVenta(b.dataset.id); },
  borrarVenta(){ borrarVenta(); },
  mes(b){
    const [y, m] = U.mes.split('-').map(Number), d = new Date(y, m - 1 + Number(b.dataset.d), 1);
    const nm = iso(d).slice(0, 7); if(nm > hoyISO().slice(0, 7)) return;
    U.mes = nm; render();
  },
  pacientes(){ abrirPacientes(); },
  verPaciente(b){ verPaciente(b.dataset.n); },
  recompra(b){
    const v = E.ventas.find(x => x.id === b.dataset.v), p = prodPorId(b.dataset.p);
    const tel = v.tel || ((pacientes().find(x => norm(x.nombre) === norm(v.pac)) || {}).tel);
    const msg = `Hola ${v.pac.split(' ')[0]}, ¿cómo te ha ido con ${p.nombre}? Ya debe estar por terminarse. Si quieres, te separo uno. 🌿 SPARATI`;
    if(tel) window.open(waLink(tel, msg), '_blank', 'noopener'); else compartirTexto(msg);
    v.recordados = v.recordados || {}; v.recordados[p.id] = true; marcar(v); guardar(); refrescar();
  },
  // Compartir y ajustes
  enviar(){ enviar(); },
  recibir(){ recibir(); },
  ponQuien(b){
    YO = {quien:b.dataset.v}; localStorage.setItem(CLAVE_YO, JSON.stringify(YO));
    if(b.dataset.cerrar){ pila[pila.length-1].fija = false; cerrarCapa(); }
    pintarAjustes(); render();
  },
  diasVence(b){ E.ajustes.diasVence = Number(b.dataset.v); guardar(); pintarAjustes(); },
  async permisoBadge(){ try{ await Notification.requestPermission(); }catch(e){} actualizarAvisos(); pintarAjustes(); },
  aTema(b){ E.ajustes.tema = b.dataset.v; guardar(); aplicarTema(); pintarAjustes(); },
  async actualizar(){
    try{
      const ks = await caches.keys();
      await Promise.all(ks.filter(k => k.startsWith('sp-')).map(k => caches.delete(k)));
      if(navigator.serviceWorker){ const r = await navigator.serviceWorker.getRegistration(); if(r) await r.update().catch(() => {}); }
    }catch(e){}
    location.reload();
  },
  async borrarTodo(){
    if((($('#aBorrarTxt') || {}).value || '').trim().toUpperCase() !== 'BORRAR') return;
    const aj = E.ajustes; E = estadoInicial(); E.ajustes = aj;
    guardar(); await FDB.vaciar().catch(() => {});
    pintarAjustes(); render(); toast('Se borró todo el inventario de este celular');
  },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if(!b || b.disabled) return;
  const f = ACT[b.dataset.act];
  if(f){ if(b.tagName === 'BUTTON') e.preventDefault(); f(b, e); }
});
$('#inFoto').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if(!f || !F) return;
  const b = await comprimir(f), id = 'f' + uid();
  try{ await FDB.put(id, b); }catch(err){ toast('No se pudo guardar la foto'); return; }
  if(!F){ FDB.del(id).catch(() => {}); return; }
  if(F.fotoNueva) FDB.del(F.fotoNueva).catch(() => {});
  F.fotoNueva = id; repintar();
});
$('#inArchivo').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if(f) recibirArchivo(f); });

// ---------- Arranque ----------
cargar();
aplicarTema();
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); }catch(e){}
if(window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);
render();
if(!quien()) elegirQuien();
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && !pila.length) render(); });
