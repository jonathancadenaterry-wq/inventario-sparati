'use strict';
/* SPARATI · Inventario
   Dos inventarios (para vender y de uso en el spa), avisos de lo que se termina o vence,
   ventas con paciente y fecha, y sincronización por archivo entre el celular de Elba y el de Jonathan.
   La cantidad de cada producto no se guarda: se calcula sumando sus movimientos. Así, al juntar
   lo que registró cada uno en su celular, nada se pisa. */
const VERSION_APP = 2;
const CLAVE = 'sparati_prueba_v2';
const CLAVE_YO = 'sparati_prueba_yo';
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DIAS_C = ['dom','lun','mar','mié','jue','vie','sáb'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const CATS = {
  venta:['Facial','Corporal','Protector solar','Capilar','Suplementos','Otros'],
  uso:['Activos e inyectables','Faciales','Corporales','Descartables','Aparatología','Limpieza','Otros'],
};
const UNIDADES = ['unidades','frascos','cajas','ampollas','jeringas','sobres','ml','g','pares','paquetes'];
const PAGOS = ['Efectivo','Transferencia','Tarjeta'];
const MOTIVOS = ['Conteo','Vencido','Dañado','Muestra o regalo','Otro'];

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
const SING = {unidades:'unidad', frascos:'frasco', cajas:'caja', ampollas:'ampolla', jeringas:'jeringa', sobres:'sobre', pares:'par', paquetes:'paquete'};
const singular = u => SING[u] || u || 'unidad';
const uTxt = (n, u) => Math.abs(n) === 1 ? singular(u) : (u || 'unidades');
const dinero = n => '$ ' + red(n || 0).toLocaleString('es-EC', {minimumFractionDigits:2, maximumFractionDigits:2});
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
  return {v:1, productos:[], movs:[], ventas:[], pacientes:[], cats:{venta:[], uso:[]},
    ajustes:{diasVence:60, tema:'auto'}, sync:{envio:0, recibo:0, de:''}, creado:ahora()};
}
let E, YO;
function cargar(){
  try{ E = JSON.parse(localStorage.getItem(CLAVE)); }catch(e){ E = null; }
  if(!E || !Array.isArray(E.productos)) E = estadoInicial();
  const b = estadoInicial();
  for(const k of ['movs','ventas','pacientes']) if(!Array.isArray(E[k])) E[k] = [];
  E.cats = Object.assign(b.cats, E.cats || {});
  E.ajustes = Object.assign(b.ajustes, E.ajustes || {});
  E.sync = Object.assign(b.sync, E.sync || {});
  try{ YO = JSON.parse(localStorage.getItem(CLAVE_YO)); }catch(e){ YO = null; }
  completarPacientes();
}
function guardar(estado = E){
  try{ localStorage.setItem(CLAVE, JSON.stringify(estado)); }
  catch(e){ toast('No se pudo guardar: la memoria del navegador está llena.'); return false; }
  E = estado;
  calcular(); actualizarAvisos();
  return true;
}
const quien = () => (YO && YO.quien) || '';
const otro = () => quien() === 'Elba' ? 'Jonathan' : 'Elba';
const marcar = (o, nuevo) => { o.mod = ahora(); o.por = quien(); if(nuevo) o.creado = o.mod; return o; };

function pacienteNuevo(nombre, tel = ''){
  return marcar({id:'paciente:' + norm(nombre), nombre, tel, notas:''}, true);
}
function completarPacientes(estado = E){
  const nombres = new Set(estado.pacientes.map(p => norm(p.nombre)));
  const fichas = new Map();
  const ventas = vivos(estado.ventas).sort((a, b) => b.fecha.localeCompare(a.fecha));
  for(const v of ventas){
    const nombre = v.pac?.trim(), k = norm(nombre);
    if(!k || nombres.has(k)) continue;
    const ficha = fichas.get(k);
    if(!ficha) fichas.set(k, pacienteNuevo(nombre, v.tel || ''));
    else if(!ficha.tel && v.tel) ficha.tel = v.tel;
  }
  estado.pacientes.push(...fichas.values());
  return fichas.size;
}

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
  else if(min > 0 && s <= min) out.push({clase:'stock', nivel:'bad', txt:`${s === 1 ? 'Queda' : 'Quedan'} ${fCant(s)} (avisar con ${fCant(min)})`, orden:1});
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
  const n = nV + nU, indicador = $('#avisosInventario');
  if(indicador){
    indicador.hidden = !n;
    indicador.textContent = n > 99 ? '99+' : n;
  }
  try{
    if(navigator.setAppBadge){ if(n) navigator.setAppBadge(n).catch(() => {}); else navigator.clearAppBadge().catch(() => {}); }
  }catch(e){}
}

// ---------- Fotos ----------
const FDB = {
  _db:null,
  abrir(){
    if(this._db) return Promise.resolve(this._db);
    return new Promise((ok, mal) => {
      const r = indexedDB.open('sparati_prueba_fotos', 1);
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
  $$('img[data-foto]', raiz).forEach(async img => {
    const u = await urlFoto(img.dataset.foto);
    if(!u){ img.remove(); return; }
    img.addEventListener('error', () => img.remove(), {once:true});
    img.src = u;
  });
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
  return `<span class="av ${cls}" aria-hidden="true"><span>${esc(ini)}</span>${p.foto ? `<img data-foto="${esc(p.foto)}" alt="">` : ''}</span>`;
}

// ---------- Capas, diálogos y mensajes ----------
const pila = [];
let idCapa = 0, resolverCierre, cierrePendiente;
function activarCapa(){
  const activa = pila.at(-1)?.el;
  $('#app').inert = $('.nav').inert = Boolean(activa);
  document.body.classList.toggle('bloqueo', Boolean(activa));
  for(const {el} of pila) el.inert = el !== activa;
}
function enfocarControl(anterior, raiz){
  if(!anterior || !raiz) return false;
  const control = anterior.isConnected ? anterior :
    anterior.dataset.act && $$('[data-act]', raiz).find(b =>
      Object.keys(anterior.dataset).every(k => b.dataset[k] === anterior.dataset[k]));
  if(!control) return false;
  control.focus({preventScroll:true});
  return document.activeElement === control;
}
function abrirCapa(html, op = {}){
  const d = document.createElement('div');
  d.className = op.cls || 'hoja';
  d.innerHTML = html;
  if(op.tipo) d.dataset.tipo = op.tipo;
  const dialogo = $('[role="dialog"]', d) || d;
  dialogo.setAttribute('role', 'dialog');
  dialogo.setAttribute('aria-modal', 'true');
  dialogo.tabIndex = -1;
  $('#capas').appendChild(d);
  const id = ++idCapa;
  pila.push({id, el:d, alCerrar:op.alCerrar, fija:op.fija, foco:document.activeElement});
  history.pushState({capa:id}, '');
  activarCapa();
  requestAnimationFrame(() => {
    if(d.inert || !d.isConnected) return;
    const titulo = $('h2, h3, h1', d);
    if(titulo) dialogo.setAttribute('aria-label', titulo.textContent);
    if(!dialogo.contains(document.activeElement)) dialogo.focus({preventScroll:true});
  });
  return d;
}
function cerrarCapa(){
  if(!pila.length || pila.at(-1).fija) return Promise.resolve();
  if(!cierrePendiente){
    cierrePendiente = new Promise(res => { resolverCierre = res; });
    history.back();
  }
  return cierrePendiente;
}
window.addEventListener('popstate', e => {
  let foco;
  const profundidad = pila.findIndex(c => c.id === e.state?.capa) + 1;
  while(pila.length > profundidad){
    if(pila.at(-1).fija){
      history.pushState({capa:pila.at(-1).id}, '', urlPantalla(U.tab));
      return;
    }
    const c = pila.pop();
    foco = c.foco;
    c.el.remove();
    c.alCerrar?.();
  }
  activarCapa();
  if(!pila.length) mostrarPantalla(pantallaDeURL());
  const activa = pila.at(-1)?.el;
  if(foco && !enfocarControl(foco, activa || $('#app'))){
    (activa?.querySelector('[data-act="cerrar"]') || $('.nav [aria-current]'))?.focus({preventScroll:true});
  }
  const resolver = resolverCierre;
  resolverCierre = cierrePendiente = null;
  resolver?.();
});
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape' || !pila.length || e.defaultPrevented) return;
  e.preventDefault();
  cerrarCapa();
});
const capaArriba = tipo => { const c = pila.slice().reverse().find(x => x.el.dataset.tipo === tipo); return c ? c.el : null; };
function cabecera(titulo, extra = '', volver = false){
  return `<header class="hoja-cab"><button class="icon-btn" data-act="cerrar" aria-label="${volver ? 'Volver' : 'Cerrar'}">${volver ? IC.volver : IC.x}</button><h2>${titulo}</h2>${extra}</header>`;
}
function confirmar(titulo, texto, ok = 'Sí', peligro = false){
  return new Promise(res => {
    let r = false;
    const d = abrirCapa(`<div class="dlg hoja-inferior" role="dialog"><span class="tirador" aria-hidden="true"></span><h3>${esc(titulo)}</h3><p>${texto}</p>
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
  if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.innerHTML = '<span></span>' + (accion ? '<button type="button">Deshacer</button>' : '');
  t.hidden = false;
  $('span', t).textContent = $('#anuncio').textContent = msg;
  if(accion) $('button', t).onclick = () => { t.hidden = true; accion(); };
  clearTimeout(tToast);
  tToast = setTimeout(() => { t.hidden = true; }, accion ? 5000 : 3400);
}
function guardarBorrado(registrosPorLista, borrado){
  const estado = {...E}, actualizados = {};
  for(const [lista, registros] of Object.entries(registrosPorLista)){
    const vigentes = new Set(E[lista]);
    if(registros.some(r => !vigentes.has(r))){
      toast('Ese registro cambió mientras tanto.');
      return null;
    }
    const porRegistro = new Map(registros.map(r => [r, marcar({...r, borrado})]));
    estado[lista] = E[lista].map(r => porRegistro.get(r) || r);
    actualizados[lista] = [...porRegistro.values()];
  }
  return guardar(estado) ? actualizados : null;
}
function avisarConDeshacer(mensaje, registrosPorLista, borrado){
  toast(mensaje, () => {
    if(!guardarBorrado(registrosPorLista, borrado)) return;
    refrescar();
    toast('Listo, se deshizo');
  });
}

// Trazos de las referencias del diseño, con el color del control que los contiene.
const trazosIconos = {
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  inicio:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  inventario:'<path d="M21 8 12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  bolsa:'<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  pacientes:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  reportes:'<path d="M5 20V11"/><path d="M11 20V5"/><path d="M17 20v-7"/><path d="M3 20h18"/>',
  escaneo:'<path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6"/>',
  lupa:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  campana:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  volver:'<path d="M15 5l-7 7 7 7"/>',
  siguiente:'<path d="m9 6 6 6-6 6"/>',
  mas:'<path d="M12 5v14M5 12h14"/>',
  menos:'<path d="M5 12h14"/>',
  entrada:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  gota:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  conteo:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/>',
  chat:'<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
  calendario:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  linterna:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  lapiz:'<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  pdf:'<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 21h14"/>',
  sync:'<path d="M20 11a8 8 0 0 0-14-5l-2 2"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14 5l2-2"/><path d="M20 21v-5h-5"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  etiqueta:'<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  ajustes:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
};
const IC = Object.fromEntries(Object.entries(trazosIconos).map(([nombre, dibujo]) =>
  [nombre, `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${dibujo}</svg>`]
));

// ---------- Vistas principales ----------
const RUTAS = {inicio:'', venta:'#inventario', uso:'#uso-en-spa', pacientes:'#pacientes', ventas:'#reportes'};
const U = {tab:'inicio', tipo:'venta', qInicio:'', qPac:'', q:{venta:'', uso:''}, filtro:{venta:'todos', uso:'todos'}, mes:hoyISO().slice(0, 7), qVentas:''};
const esInventario = tab => tab === 'venta' || tab === 'uso';
const urlPantalla = tab => location.pathname + location.search + RUTAS[tab];
const pantallaDeURL = () => Object.keys(RUTAS).find(tab => RUTAS[tab] === location.hash) || 'inicio';
const desplazamientos = new Map();

function mostrarPantalla(tab){
  if(tab === U.tab) return;
  desplazamientos.set(U.tab, window.scrollY);
  U.tab = tab;
  if(esInventario(tab)) U.tipo = tab;
  const app = $('#app');
  app.classList.remove('transicion');
  render();
  window.scrollTo(0, desplazamientos.get(tab) || 0);
  // La lectura de la caja reinicia la animación aunque se cambie dos veces de pantalla seguido.
  void app.offsetWidth;
  app.classList.add('transicion');
}
function irPantalla(tab){
  if(tab === 'inventario') tab = U.tipo;
  if(tab === U.tab || !Object.hasOwn(RUTAS, tab)) return;
  history.pushState(null, '', urlPantalla(tab));
  mostrarPantalla(tab);
}
function prepararNav(){
  const boton = (tab, ico, texto, indicador = '') => `<button data-act="tab" data-tab="${tab}">${IC[ico]}<span>${texto}</span>${indicador}</button>`;
  $('.nav').innerHTML = `<div class="nav-in">
    ${boton('inicio', 'inicio', 'Inicio')}
    ${boton('inventario', 'inventario', 'Inventario', '<span class="punto" id="avisosInventario" aria-hidden="true" hidden></span>')}
    <button class="nav-vender" data-act="vender"><span class="circulo">${IC.bolsa}</span><span>Vender</span></button>
    ${boton('pacientes', 'pacientes', 'Pacientes')}
    ${boton('ventas', 'reportes', 'Reportes')}
  </div>`;
}
function buscador(texto, {id = '', valor = '', campo = '', escaneo = ''} = {}){
  return `<div class="buscador"><label class="buscar">${IC.lupa}<input type="search" ${id ? `id="${id}"` : ''} ${campo ? `data-f="${campo}"` : ''} aria-label="${texto}" placeholder="${texto}" value="${esc(valor)}" autocomplete="off"></label>
    ${escaneo ? `<button class="btn boton-escanear" data-act="escanear" data-modo="${escaneo}" aria-label="Escanear">${IC.escaneo}</button>` : ''}</div>`;
}
function opcion(act, valor, texto, activa, clase = '', attrs = ''){
  return `<button type="button" class="${clase}${activa ? ' on' : ''}" aria-pressed="${activa}" data-act="${act}" data-v="${esc(valor)}" ${attrs}>${texto}</button>`;
}

function render(){
  calcular();
  const app = $('#app');
  app.innerHTML = U.tab === 'inicio' ? vInicio() : U.tab === 'ventas' ? vVentas() : U.tab === 'pacientes' ? vPacientes() : vLista(U.tab);
  const principal = esInventario(U.tab) ? 'inventario' : U.tab;
  for(const b of $$('.nav [data-tab]')){
    if(b.dataset.tab === principal) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  cargarFotos(app);
  actualizarAvisos();
  $('#qProd')?.addEventListener('input', e => {
    U.q[U.tab] = e.target.value;
    pintarListaProductos();
  });
  $('#qVentas')?.addEventListener('input', e => {
    U.qVentas = e.target.value;
    $('#listaVentas').innerHTML = listaVentasHTML();
  });
  $('#qPac')?.addEventListener('input', e => {
    U.qPac = e.target.value;
    $('#pacLista').innerHTML = filasPacientes(U.qPac);
  });
  $('#qInicio')?.addEventListener('input', e => {
    U.qInicio = e.target.value;
    pintarBusquedaInicio();
  });
  if(U.tab === 'inicio') pintarBusquedaInicio();
}
function pintarBusquedaInicio(){
  const q = norm(U.qInicio);
  const contenido = $('#contenidoInicio'), resultados = $('#resultadosInicio');
  contenido.hidden = Boolean(q);
  resultados.hidden = !q;
  if(!q) return;
  const ps = productos().filter(p => coincideProducto(p, q)).slice(0, 20);
  const pac = pacientes().filter(p => norm(p.nombre).includes(q)).slice(0, 10);
  resultados.innerHTML = (ps.length ? `<section class="grupo-productos"><h2>Productos</h2><div class="filas">${ps.map(p => filaProducto(p, 'verProd', true)).join('')}</div></section>` : '') +
    (pac.length ? `<section class="grupo-productos"><h2>Pacientes</h2><div class="filas">${pac.map(filaPaciente).join('')}</div></section>` : '') ||
    '<div class="vacio">No encontré productos ni pacientes con esa búsqueda.</div>';
  cargarFotos(resultados);
}

function vInicio(){
  const cab = `<h1 class="solo-lectura">Inicio</h1><div class="top"><div class="marca-inicio"><img src="emblema.png" class="emblema" alt="" width="128" height="115">
    <div><img src="logo-texto.png" class="logo-texto" alt="SPARATI" width="210" height="33"><div class="sub">${esc(fDia(hoyISO()))}</div></div></div>
    <button class="icon-btn" data-act="ajustes" aria-label="Ajustes">${IC.ajustes}</button></div>
    ${buscador('Buscar producto o paciente', {id:'qInicio', valor:U.qInicio, escaneo:'global'})}
    <div id="resultadosInicio" class="lista-productos" hidden></div>`;
  let h = '';
  const n = productos().length;
  // Compartir entre los dos celulares
  const envio = E.sync.envio, recibo = E.sync.recibo;
  if(quien()){
    const cambios = ultimoCambio() > envio;
    if(cambios && n && (!envio || ahora() - envio > 3 * 86400000))
      h += `<div class="aviso"><div>Hay cambios que ${esc(otro())} todavía no tiene${envio ? ' (último envío: ' + haceTxt(envio) + ')' : ''}.</div>
        <div class="fila"><button class="btn sm" data-act="enviar">Enviar a ${esc(otro())}</button></div></div>`;
    if(recibo) h += `<div class="peq muted" style="padding:0 4px">Último archivo recibido de ${esc(E.sync.de || otro())}: ${haceTxt(recibo)}. <button class="link" data-act="recibir">Recibir otro</button></div>`;
  }
  if(!n){
    h += `<section class="card"><h3>Bienvenida</h3>
      <div class="peq">Empieza agregando tus productos. Para cada uno pones cuántos hay y desde cuántos quieres que la app te avise.</div>
      <div class="acc-grid"><button class="btn" data-act="nuevoProd" data-tipo="venta">${IC.mas} Para vender</button><button class="btn gold" data-act="nuevoProd" data-tipo="uso">${IC.mas} Uso en spa</button></div>
      ${quien() === 'Jonathan' ? `<button class="btn ghost" data-act="recibir">Recibir el inventario de Elba</button>` : ''}</section>`;
    return cab + `<div class="contenido-inicio" id="contenidoInicio">${h}</div>`;
  }
  const av = todosLosAvisos(), rc = recompras(), pc = porCobrar();
  if(!av.stock.length && !av.fecha.length && !rc.length && !pc.length)
    h += `<div class="estado-ok">${IC.check}<div>Todo en orden. No hay productos por terminarse ni por vencer.</div></div>`;
  if(av.stock.length) h += `<section class="card"><div class="card-cab"><h3>Se están terminando (${av.stock.length})</h3><button class="btn sm gold" data-act="compras">Qué pedir</button></div>${av.stock.map(filaAviso).join('')}</section>`;
  if(av.fecha.length) h += `<section class="card"><h3>Fechas de vencimiento (${av.fecha.length})</h3>${av.fecha.map(filaAviso).join('')}</section>`;
  if(rc.length) h += `<section class="card"><h3>Volver a ofrecer (${rc.length})</h3><div class="peq muted">Pacientes que ya deberían estar terminando el producto que compraron.</div>${rc.map(r =>
    `<div class="alerta">${avatar({nombre:r.v.pac}, 'persona sm')}<div class="tx"><b>${esc(r.v.pac)}</b><div class="d">${esc(r.p.nombre)} · compró ${haceTxtDias(r.d)}</div></div>
      <button class="btn sm soft" data-act="recompra" data-v="${esc(r.v.id)}" data-p="${esc(r.p.id)}">Escribir</button></div>`).join('')}</section>`;
  if(pc.length) h += `<section class="card"><div class="card-cab"><h3>Por cobrar</h3><b class="num">${dinero(pc.reduce((s, v) => s + totalVenta(v), 0))}</b></div>${pc.slice(0, 6).map(v =>
    `<button class="alerta" data-act="editarVenta" data-id="${esc(v.id)}"><div class="tx"><b>${esc(v.pac || 'Sin nombre')}</b><div class="d">${esc(fCorta(v.fecha))} · ${esc(v.items.map(i => i.nombre).join(', '))}</div></div><span class="pill warn num">${dinero(totalVenta(v))}</span></button>`).join('')}</section>`;

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
  return cab + `<div class="contenido-inicio" id="contenidoInicio">${h}</div>`;
}
function haceTxtDias(d){ return d === 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días'; }
function filaAviso(a){
  return `<button class="alerta" data-act="verProd" data-id="${esc(a.p.id)}">${avatar(a.p, 'sm')}<div class="tx"><b>${esc(a.p.nombre)}</b><div class="d">${a.p.tipo === 'venta' ? 'Para vender' : 'Uso en spa'} · <span class="${a.nivel}">${esc(a.txt)}</span></div></div><span class="chev">${IC.siguiente}</span></button>`;
}
function ultimoCambio(){ let m = 0; for(const k of ['productos','movs','ventas']) for(const x of E[k]) if(x.por === quien() && x.mod > m) m = x.mod; return m; }

function vLista(tipo){
  const ps = productos(tipo);
  const cats = [...new Set(ps.map(p => p.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const filtros = [['todos', 'Todos'], ['stock', '<span class="indicador" aria-hidden="true"></span>Por terminarse'],
    ['fecha', '<span class="indicador vence" aria-hidden="true"></span>Vencen pronto'], ...cats.map(c => ['cat:' + c, esc(c)])];
  const costo = tipo === 'uso';
  const cantidad = costo ? ps.length : ps.reduce((s, p) => s + Math.max(0, stockDe(p.id)), 0);
  const valor = ps.reduce((s, p) => s + Math.max(0, stockDe(p.id)) * ((costo ? p.costo : p.precio) || 0), 0);
  return `<header class="top"><h1>Inventario</h1><div class="top-acciones">
      <button class="icon-btn" data-act="compras" aria-label="Lista de compras">${IC.bolsa}</button>
      <button class="btn sm" data-act="nuevoProd" data-tipo="${tipo}">${IC.mas} Producto</button></div></header>
    <div class="seg" role="group" aria-label="Tipo de inventario">
      ${[['venta','Para vender'], ['uso', 'Uso en spa']].map(([t, texto]) =>
        opcion('tab', t, texto + ' · ' + (tipo === t ? ps.length : productos(t).length), tipo === t, '', `data-tab="${t}"`)).join('')}
    </div>
    ${buscador('Buscar en el inventario', {id:'qProd', valor:U.q[tipo], escaneo:tipo})}
    <div class="chips scroll" role="group" aria-label="Filtrar productos">
      ${filtros.map(([f, texto]) => opcion('filtro', f, texto, U.filtro[tipo] === f, 'chip')).join('')}
    </div>
    <div class="cifras estadisticas-inventario">
      <div class="cifra"><span class="l">${costo ? 'Productos' : 'Unidades'}</span><span class="v num">${fCant(cantidad)}</span></div>
      <div class="cifra"><span class="l">${costo ? 'Valor a costo' : 'Valor a precio de venta'}</span><span class="v num">${dinero(valor)}</span></div>
    </div>
    <div id="listaProd" class="lista-productos">${listaHTML(tipo)}</div>`;
}
function coincideProducto(p, q){
  return norm([p.nombre, p.marca, p.cat, p.codigo].filter(Boolean).join(' ')).includes(q);
}
function pintarListaProductos(){
  const lista = $('#listaProd');
  lista.innerHTML = listaHTML(U.tab);
  cargarFotos(lista);
}
function listaHTML(tipo){
  const q = norm(U.q[tipo]), f = U.filtro[tipo], grupos = new Map();
  const todos = productos(tipo);
  for(const p of todos){
    if(!coincideProducto(p, q)) continue;
    if(f === 'stock' && !avisosDe(p).some(a => a.clase === 'stock')) continue;
    if(f === 'fecha' && !avisosDe(p).some(a => a.clase === 'fecha' && a.nivel === 'warn')) continue;
    if(f.startsWith('cat:') && p.cat !== f.slice(4)) continue;
    const marca = p.marca?.trim() || 'Sin marca';
    if(!grupos.has(marca)) grupos.set(marca, []);
    grupos.get(marca).push(p);
  }
  if(!todos.length) return '<div class="vacio">Todavía no hay productos aquí. Toca «Producto» para agregar el primero.</div>';
  if(!grupos.size) return '<div class="vacio">No hay productos con ese filtro.</div>';
  return [...grupos].sort(([a, ps], [b, otros]) => otros.length - ps.length || a.localeCompare(b, 'es')).map(([marca, ps]) =>
    `<section class="grupo-productos"><h2>${esc(marca)}</h2><div class="filas">${ps.map(p => filaProducto(p)).join('')}</div></section>`
  ).join('');
}
function pildoraStock(p, avs = avisosDe(p)){
  const s = stockDe(p.id), cantidad = fCant(s);
  const bajo = s <= (p.min || 0);
  const fechas = avs.filter(a => a.clase === 'fecha');
  const estado = bajo || fechas.some(a => a.nivel === 'bad') ? 'bad' : fechas.length ? 'warn' : 'ok';
  const texto = s <= 0 ? 'Agotado' : bajo ? `${s === 1 ? 'Queda' : 'Quedan'} ${cantidad}` : cantidad;
  return `<span class="pill stock ${estado}" title="${cantidad} ${esc(uTxt(s, p.unidad))}">${texto}</span>`;
}
function filaProducto(p, accion = 'verProd', mostrarMarca = false){
  const [nombre, ...presentacion] = p.nombre.split(' · ');
  const avs = avisosDe(p);
  const aviso = avs.find(a => a.clase === 'fecha') || avs.find(a => a.clase === 'stock' && a.nivel === 'warn');
  const precio = p.tipo === 'venta' && p.precio ? `<span class="sin-salto">${dinero(p.precio)}</span>` : '';
  const sub = [mostrarMarca ? esc(p.marca) : '', ...presentacion.map(esc), precio,
    esc(aviso?.txt || (!presentacion.length && p.tipo === 'uso' ? singular(p.unidad) : ''))].filter(Boolean).join(' · ');
  const cantidadEnVenta = accion === 'vAgregar' ? F.items.find(i => i.prod === p.id)?.cant : '';
  return `<button class="fila-lista" data-act="${accion}" data-id="${esc(p.id)}">${avatar(p)}
    <span class="tx"><b>${esc(nombre)}</b>${sub ? `<span class="m">${sub}</span>` : ''}${accion === 'vAgregar' ? `<span class="m en-venta"${cantidadEnVenta ? '' : ' hidden'}>${cantidadEnVenta ? esc(cantidadEnVenta) + ' en la venta' : ''}</span>` : ''}</span>
    ${pildoraStock(p, avs)}</button>`;
}

function vVentas(){
  const [y, m] = U.mes.split('-').map(Number);
  const vm = vivos(E.ventas).filter(v => v.fecha.startsWith(U.mes));
  const tot = vm.reduce((s, v) => s + totalVenta(v), 0), gan = tot - vm.reduce((s, v) => s + costoVenta(v), 0);
  const cobrar = vm.filter(v => !v.cobrado).reduce((s, v) => s + totalVenta(v), 0);
  const top = new Map();
  for(const v of vm) for(const it of v.items){ const x = top.get(it.prod) || {n:it.nombre, c:0, t:0}; x.c += it.cant; x.t += it.cant * it.precio; top.set(it.prod, x); }
  const tops = Array.from(top.values()).sort((a, b) => b.t - a.t).slice(0, 5), maxT = tops.length ? tops[0].t : 1;
  let h = `<header class="top"><h1>Reportes</h1></header>
    <div class="mes"><button data-act="mes" data-d="-1" aria-label="Mes anterior">${IC.volver}</button><b>${cap(MESES[m-1])} ${y}</b><button data-act="mes" data-d="1" aria-label="Mes siguiente" ${U.mes >= hoyISO().slice(0, 7) ? 'disabled' : ''}>${IC.siguiente}</button></div>
    <div class="cifras"><div class="cifra"><span class="v num">${dinero(tot)}</span><span class="l">${vm.length} ${vm.length===1?'venta':'ventas'}</span></div>
      <div class="cifra"><span class="v num">${dinero(gan)}</span><span class="l">Ganancia (venta − costo)</span></div>
      ${cobrar ? `<div class="cifra ancha"><span class="v num" style="color:var(--atencion)">${dinero(cobrar)}</span><span class="l">Por cobrar este mes</span></div>` : ''}</div>`;
  if(tops.length) h += `<section class="card"><h3>Lo más vendido</h3>${tops.map(t => `<div class="top-prod"><span class="n">${esc(t.n)} <span class="muted">· ${fCant(t.c)}</span></span><span class="b" style="width:${Math.max(8, Math.round(t.t / maxT * 70))}px"></span><b class="num">${dinero(t.t)}</b></div>`).join('')}</section>`;
  h += `<h2 class="titulo-seccion">Ventas</h2>${buscador('Buscar por paciente o producto', {id:'qVentas', valor:U.qVentas})}
    <div id="listaVentas" class="lista-productos">${listaVentasHTML()}</div>`;
  return h;
}
function listaVentasHTML(){
  const q = norm(U.qVentas);
  let vs = vivos(E.ventas);
  vs = q ? vs.filter(v => norm(v.pac + ' ' + v.items.map(i => i.nombre).join(' ')).includes(q)) : vs.filter(v => v.fecha.startsWith(U.mes));
  vs.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
  if(!vs.length) return `<div class="vacio">${q ? 'No hay ventas con esa búsqueda.' : 'No hay ventas en este mes.'}</div>`;
  let h = '', dia = '';
  for(const v of vs){
    if(v.fecha !== dia){ dia = v.fecha; h += `<div class="dia-tit">${esc(fDia(v.fecha))}${q && v.fecha.slice(0,4) !== String(new Date().getFullYear()) ? ' ' + v.fecha.slice(0,4) : ''}</div>`; }
    h += `<button class="venta" data-act="editarVenta" data-id="${esc(v.id)}"><div class="c"><span class="pac">${esc(v.pac || 'Sin nombre')}</span><span class="tot num">${dinero(totalVenta(v))}</span></div>
      <div class="it">${esc(v.items.map(i => fCant(i.cant) + ' × ' + i.nombre).join(' · '))}</div>
      <div class="c"><span class="pill ${v.cobrado ? 'acc' : 'warn'}">${esc(v.cobrado ? cap(v.pago) : 'Por cobrar')}</span>${v.por ? `<span class="peq muted">Registró ${esc(v.por)}</span>` : ''}</div></button>`;
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
  const scroll = $('.hoja-cuerpo', d)?.scrollTop || 0;
  const accion = d.contains(document.activeElement) ? document.activeElement.dataset.act : '';
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
  const etiqueta = {inicial:'Cantidad inicial', entrada:'Llegó', venta:'Venta', uso:'Uso en tratamiento', ajuste:'Ajuste', apertura:'Abrí uno nuevo'};
  const [nombre, ...presentacion] = p.nombre.split(' · ');
  const titulo = esc(nombre) + (presentacion.length ? `<span class="solo-lectura"> · ${esc(presentacion.join(' · '))}</span>` : '');
  d.innerHTML = cabecera(titulo, `<button class="icon-btn" data-act="editarProd" data-id="${esc(p.id)}" aria-label="Editar producto">${IC.lapiz}</button>`, true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="det-cab">${avatar(p, 'xl')}<div><div class="muted">${esc([p.marca, ...presentacion, p.cat].filter(Boolean).join(' · '))}</div>
      <div class="chips" style="margin-top:6px"><span class="pill ${p.tipo === 'venta' ? 'acc' : 'gold'}">${p.tipo === 'venta' ? 'Para vender' : 'Uso en spa'}</span></div></div></div>
    <section class="card"><div class="det-stock"><span class="q num" style="color:${avs.some(a => a.clase==='stock' && a.nivel==='bad') ? 'var(--mal)' : avs.some(a => a.clase==='stock') ? 'var(--atencion)' : 'inherit'}">${fCant(s)}</span><span class="u">${esc(uTxt(s, p.unidad))}</span></div>
      ${avs.length ? `<div class="chips" style="justify-content:center">${avs.map(a => `<span class="pill ${a.nivel}">${esc(a.txt)}</span>`).join('')}</div>` : `<div class="chips" style="justify-content:center"><span class="pill ok">${IC.check} Sin avisos</span></div>`}
      <div class="acc-grid">${p.tipo === 'venta' ? `<button class="btn" data-act="vender" data-id="${esc(p.id)}">${IC.bolsa} Vender</button>` : `<button class="btn" data-act="usarRapido" data-id="${esc(p.id)}">${IC.gota} Usar ${fCant(p.gasto > 0 ? p.gasto : 1)} ${esc(uTxt(p.gasto > 0 ? p.gasto : 1, p.unidad))}</button>`}
        <button class="btn gold" data-act="entrada" data-id="${esc(p.id)}">${IC.entrada} Llegó más</button>
        <button class="btn ghost" data-act="ajuste" data-id="${esc(p.id)}">Contar / corregir</button>
        ${p.tipo === 'uso' ? `<button class="btn ghost" data-act="usar" data-id="${esc(p.id)}">Otra cantidad</button>` : ''}
        ${p.pao ? `<button class="btn ghost" data-act="abrirHoy" data-id="${esc(p.id)}">Lo abrí hoy</button>` : ''}</div>
      ${p.telProv ? `<a class="btn soft" href="${waLink(p.telProv, `Hola, quisiera pedir ${p.nombre}${p.marca ? ' (' + p.marca + ')' : ''}. ¿Tienen disponible?`)}" target="_blank" rel="noopener">Pedir al proveedor por WhatsApp</a>` : ''}</section>
    <section class="card" style="gap:0"><h3 style="margin-bottom:4px">Datos</h3>${datos.map(x => `<div class="dato"><span>${esc(x[0])}</span><span>${esc(x[1])}</span></div>`).join('')}
      ${p.notas ? `<div class="dato"><span>Notas</span><span style="font-weight:500">${esc(p.notas)}</span></div>` : ''}</section>
    <section class="card" style="gap:0"><h3 style="margin-bottom:4px">Movimientos</h3>${movs.length ? movs.slice(0, 60).map(m => `<div class="mov"><span>${esc(etiqueta[m.tipo] || m.tipo)}${m.pac ? ' · ' + esc(m.pac) : ''}</span><span class="q num ${m.cant >= 0 ? 'mas' : 'menos'}">${m.cant >= 0 ? '+' : '−'}${fCant(Math.abs(m.cant))}</span>
      <span class="s">${esc(fCorta(m.fecha))}${m.trat ? ' · ' + esc(m.trat) : ''}${m.motivo ? ' · ' + esc(m.motivo) : ''}${m.nota ? ' · ' + esc(m.nota) : ''}${m.por ? ' · ' + esc(m.por) : ''}</span></div>`).join('') : '<div class="muted peq">Sin movimientos.</div>'}</section>
    <button class="btn danger full" data-act="borrarProd" data-id="${esc(p.id)}">Eliminar producto</button>
  </div></div>`;
  cargarFotos(d);
  $('.hoja-cuerpo', d).scrollTop = scroll;
  if(accion) $(`[data-act="${accion}"]`, d)?.focus({preventScroll:true});
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
  const activo = document.activeElement;
  F.pintar();
  cu.parentElement.scrollTop = sc;
  if(!activo.isConnected) enfocarControl(activo, cu);
}
function campo(label, f, op = {}){
  const v = F[f] ?? '';
  const tipo = op.tipo || 'text';
  const id = 'campo-' + f;
  const attrs = (op.modo ? ` inputmode="${op.modo}"` : '') + (op.ph ? ` placeholder="${esc(op.ph)}"` : '') + (op.lista ? ` list="${op.lista}"` : '') + (op.max ? ` max="${op.max}"` : '') + ' autocomplete="off"';
  const input = op.area ? `<textarea id="${id}" data-f="${f}"${attrs}>${esc(v)}</textarea>` : `<input id="${id}" type="${tipo}" data-f="${f}" value="${esc(v)}"${attrs}>`;
  return `<div class="campo"><label for="${id}">${label}</label>${input}${op.ayuda ? `<span class="ayuda">${op.ayuda}</span>` : ''}</div>`;
}
function pasos(label, f, unidad, item){
  const titulo = label + (unidad ? ' (' + unidad + ')' : '');
  const id = item === undefined ? 'paso-' + f : `paso-${f}-${item}`;
  const attrs = item === undefined ? `data-f="${f}"` : `data-item="${item}" data-c="${f}"`;
  const valor = item === undefined ? F[f] : F.items[item][f];
  return `<div class="campo"><label for="${id}">${esc(titulo)}</label><div class="paso">
    <button type="button" data-act="paso" data-d="-1" aria-label="Restar uno">${IC.menos}</button>
    <input id="${id}" type="text" inputmode="decimal" ${attrs} value="${esc(valor ?? '')}">
    <button type="button" data-act="paso" data-d="1" aria-label="Sumar uno">${IC.mas}</button></div></div>`;
}
function chipsF(f, opciones, op = {}){
  return `<div class="chips">${opciones.map(o => opcion('fChip', o, esc(o), F[f] === o, 'chip', `data-f="${f}"`)).join('')}${op.extra || ''}</div>`;
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
    <div class="seg" role="group" aria-label="Tipo de producto">${[['venta','Para vender'], ['uso','Uso en spa']].map(([v, n]) =>
      opcion('fChip', v, n, F.tipo === v, '', 'data-f="tipo"')).join('')}</div>
    <div class="foto-campo">${fotoId ? `<span class="av xl"><img data-foto="${esc(fotoId)}" alt=""></span>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px"><button type="button" class="btn sm soft" data-act="fFoto">${fotoId ? 'Cambiar foto' : 'Agregar foto'}</button>${fotoId ? '<button type="button" class="btn sm ghost" data-act="fSinFoto">Quitar foto</button>' : '<span class="peq muted">Opcional: ayuda a reconocerlo rápido.</span>'}</div></div>
    ${campo('Nombre del producto *', 'nombre', {ph: F.tipo === 'venta' ? 'Ej.: Protector solar FPS 50' : 'Ej.: Ácido hialurónico HydraFiller'})}
    ${campo('Marca (opcional)', 'marca', {ph:'Ej.: La Roche-Posay'})}
    <div class="campo"><span class="lbl">Categoría</span>${chipsF('cat', cats, {extra:`<button type="button" class="chip" data-act="nuevaCat">${IC.mas} Otra</button>`})}</div>
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
  await cerrarCapa();
  if(nuevo && esInventario(U.tab) && U.tab !== tipo) irPantalla(tipo);
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
  const m = marcar({id:uid(), prod:p.id, tipo:'uso', cant:-red(c), fecha:F.fecha, pac:F.pac.trim(), trat:F.trat.trim(), nota:p.lote ? 'Lote ' + p.lote : ''}, true);
  if(!guardar({...E, movs:[...E.movs, m]})) return;
  cerrarCapa(); refrescar();
  avisarConDeshacer(`−${fCant(c)} ${uTxt(c, p.unidad)} de ${p.nombre}`, {movs:[m]}, true);
}
function usarRapido(id){
  const p = prodPorId(id), c = p.gasto > 0 ? p.gasto : 1;
  const m = marcar({id:uid(), prod:id, tipo:'uso', cant:-c, fecha:hoyISO(), nota:p.lote ? 'Lote ' + p.lote : ''}, true);
  if(!guardar({...E, movs:[...E.movs, m]})) return;
  refrescar();
  avisarConDeshacer(`−${fCant(c)} ${uTxt(c, p.unidad)} de ${p.nombre}. Quedan ${fCant(stockDe(id))}`, {movs:[m]}, true);
}

// Contar / corregir
function formAjuste(id){
  const p = prodPorId(id);
  F = {prod:id, real:fCant(stockDe(id)), motivo:'Conteo', nota:'', guardar:guardarAjuste};
  hojaForm('Contar · ' + esc(p.nombre), 'form', () => {
    const dif = red(num(F.real) - stockDe(id));
    $('#fCuerpo').innerHTML = `<div class="peq muted">Según la app hay <b>${fCant(stockDe(id))} ${esc(p.unidad)}</b>. Escribe lo que realmente hay.</div>
      ${pasos('¿Cuántos hay de verdad?', 'real', p.unidad)}
      <div class="peq" id="aDif">${isFinite(dif) && dif ? `Diferencia: <b style="color:${dif < 0 ? 'var(--mal)' : 'var(--bien)'}">${dif > 0 ? '+' : '−'}${fCant(Math.abs(dif))}</b>` : 'Sin diferencia.'}</div>
      <div class="campo"><span class="lbl">Motivo</span>${chipsF('motivo', MOTIVOS)}</div>
      ${campo('Nota (opcional)', 'nota')}`;
  });
  F.alCambiar = f => { if(f === 'real'){ const dif = red(num(F.real) - stockDe(id)); const e = $('#aDif'); if(e) e.innerHTML = isFinite(dif) && dif ? `Diferencia: <b style="color:${dif < 0 ? 'var(--mal)' : 'var(--bien)'}">${dif > 0 ? '+' : '−'}${fCant(Math.abs(dif))}</b>` : 'Sin diferencia.'; } };
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
  F = v ? {id:v.id, pac:v.pac || '', tel:v.tel || '', fecha:v.fecha, pago:v.cobrado ? cap(v.pago) : 'Por cobrar', nota:v.nota || '',
        items:v.items.map(i => ({prod:i.prod, nombre:i.nombre, cant:fCant(i.cant), precio:dineroIn(i.precio), costo:i.costo || 0})), buscar:''}
    : {id:null, pac:'', tel:'', fecha:hoyISO(), pago:'Efectivo', nota:'', items:[], buscar:''};
  F.guardar = guardarVenta;
  F.pagoMarcado = F.pago === 'Por cobrar' ? PAGOS[0] : F.pago;
  if(prodId) agregarItem(prodId);
  const d = abrirCapa(cabecera(v ? 'Editar venta' : 'Nueva venta', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in" id="fCuerpo"></div></div>
    <div class="carrito hoja-inferior">
      <button class="resumen-venta" data-act="verCarrito" aria-controls="detalleVenta" aria-expanded="${Boolean(v)}">
        <span class="tirador" aria-hidden="true"></span><span><span id="resumenVenta"></span>${IC.volver}</span></button>
      <div class="carrito-detalle" id="detalleVenta"${v ? '' : ' hidden'}></div>
      <div class="total"><span>Total</span><span class="num" id="vTotal"></span></div>
      <footer class="hoja-pie"><div class="in">
        ${v ? '<button class="btn danger" data-act="borrarVenta">Eliminar</button>' : ''}
        <button class="btn ghost" data-act="cerrar">Cancelar</button><button class="btn" data-act="guardarF">Guardar</button>
      </div></footer>
    </div>`, {cls:'hoja venta-form', tipo:'form', alCerrar:() => { F = null; }});
  $('#fCuerpo', d).innerHTML = `<div class="card">
      ${campo('Paciente', 'pac', {lista:'dlPac', ph:'Nombre de la paciente'})}${listaPacientes()}
      <div class="fila2">${campo('Fecha', 'fecha', {tipo:'date', max:hoyISO()})}${campo('WhatsApp (opcional)', 'tel', {tipo:'tel', ph:'09…'})}</div></div>
    ${buscador('Buscar producto', {campo:'buscar', escaneo:'vender'})}
    <h3 class="titulo-seccion">Productos</h3><div class="filas" id="selProd"></div>`;
  pintarSelectorVenta();
  pintarCarrito();
  F.alCambiar = f => {
    if(f === 'pac' && !F.tel){
      const p = pacientes().find(p => norm(p.nombre) === norm(F.pac));
      if(p?.tel) F.tel = $('#campo-tel', d).value = p.tel;
    }
    if(f === 'buscar') pintarSelectorVenta();
  };
  F.alItem = actualizarTotalesVenta;
}
function agregarItem(pid){
  const p = prodPorId(pid);
  const ya = F.items.find(i => i.prod === pid);
  if(ya){ ya.cant = fCant((num(ya.cant) || 0) + 1); return; }
  F.items.push({prod:pid, nombre:p.nombre, cant:'1', precio:dineroIn(p.precio), costo:p.costo || 0});
}
const totalF = () => red(F.items.reduce((s, i) => s + (num(i.cant) || 0) * (num(i.precio) || 0), 0));
function pintarSelectorVenta(){
  const q = norm(F.buscar), selector = $('#selProd');
  const todos = productos('venta');
  const ps = todos.filter(p => coincideProducto(p, q)).slice(0, 30);
  selector.innerHTML = ps.length ? ps.map(p => filaProducto(p, 'vAgregar', true)).join('') :
    `<div class="vacio">${todos.length ? 'No encontré ese producto.' : 'Agrega productos en Inventario para empezar a vender.'}</div>`;
  cargarFotos(selector);
}
function pintarCarrito(){
  const detalle = $('#detalleVenta');
  const sc = detalle.scrollTop;
  detalle.innerHTML = `${F.items.map((it, i) => `<div class="item-venta">
      <span class="producto-carrito">${avatar(prodPorId(it.prod) || it, 'sm')}<span class="n">${esc(it.nombre)}</span></span><button type="button" class="x" data-act="vQuitar" data-i="${i}" aria-label="Quitar ${esc(it.nombre)}">${IC.x}</button>
      <div class="ctl">
        ${pasos('Cantidad', 'cant', '', i)}
        <div class="campo"><label for="venta-precio-${i}">Precio c/u ($)</label><input id="venta-precio-${i}" type="text" inputmode="decimal" data-item="${i}" data-c="precio" value="${esc(it.precio)}"></div>
      </div>
      <span class="sub num" data-sub="${i}"></span></div>`).join('')}
    <div class="campo"><span class="lbl">Forma de pago</span>
      <div class="seg" role="group" aria-label="Forma de pago">${PAGOS.map(p => opcion('pagoVenta', p, p, F.pagoMarcado === p)).join('')}</div>
      <label class="check"><input type="checkbox" id="pagoPendiente"${F.pago === 'Por cobrar' ? ' checked' : ''}> Queda pendiente</label>
    </div>
    ${campo('Nota (opcional)', 'nota', {area:true})}`;
  detalle.scrollTop = sc;
  $('#pagoPendiente').addEventListener('change', e => { F.pago = e.target.checked ? 'Por cobrar' : F.pagoMarcado; });
  cargarFotos(detalle);
  actualizarTotalesVenta();
}
function actualizarTotalesVenta(){
  const n = F.items.length;
  $('#resumenVenta').textContent = `Venta · ${n} ${n === 1 ? 'producto' : 'productos'}`;
  $('#vTotal').textContent = dinero(totalF());
  $$('[data-sub]', $('#detalleVenta')).forEach(e => {
    const it = F.items[+e.dataset.sub];
    e.textContent = dinero((num(it.cant) || 0) * (num(it.precio) || 0));
  });
  const cantidades = new Map(F.items.map(i => [i.prod, i.cant]));
  for(const b of $$('[data-act="vAgregar"]', $('#selProd'))){
    const cantidad = cantidades.get(b.dataset.id), etiqueta = $('.en-venta', b);
    etiqueta.hidden = !cantidad;
    etiqueta.textContent = cantidad ? cantidad + ' en la venta' : '';
  }
}
function agregarALaVenta(id){
  agregarItem(id);
  pintarCarrito();
}
document.addEventListener('input', e => {
  const i = e.target.dataset && e.target.dataset.item;
  if(F && F.items && i !== undefined){ F.items[+i][e.target.dataset.c] = e.target.value; if(F.alItem) F.alItem(); }
});
async function guardarVenta(){
  const formulario = F;
  if(!F.items.length){ toast('Agrega al menos un producto'); return; }
  if(!F.fecha || F.fecha > hoyISO()){ toast('Revisa la fecha'); return; }
  for(const it of F.items){ if(!(num(it.cant) > 0)){ toast('Revisa la cantidad de ' + it.nombre); return; } if(!(num(it.precio) >= 0)){ toast('Revisa el precio de ' + it.nombre); return; } }
  if(!F.pac.trim() && !(await confirmar('¿Guardar sin nombre?', 'No escribiste el nombre de la paciente. Así no sabrás después a quién se lo vendiste.', 'Guardar igual'))) return;
  if(F !== formulario) return;
  // Avisar si se vende más de lo que hay
  const previo = F.id ? E.ventas.find(x => x.id === F.id) : null;
  const falta = F.items.filter(it => { const antes = previo ? (previo.items.find(x => x.prod === it.prod) || {cant:0}).cant : 0; return num(it.cant) > stockDe(it.prod) + antes; });
  if(falta.length && !(await confirmar('No alcanza el inventario', `Según la app no hay suficiente de: <b>${falta.map(i => esc(i.nombre)).join(', ')}</b>. Si sí lo tienes, guarda igual y luego corrige la cantidad con «Contar / corregir».`, 'Guardar igual'))) return;
  if(F !== formulario) return;
  const items = F.items.map(it => ({prod:it.prod, nombre:it.nombre, cant:red(num(it.cant)), precio:red(num(it.precio)), costo:it.costo || 0}));
  const cobrado = F.pago !== 'Por cobrar';
  const pago = cobrado && previo && cap(previo.pago) === F.pago ? previo.pago : F.pago;
  const base = previo || {id:uid(), recordados:{}};
  const v = marcar({...base, pac:F.pac.trim(), tel:F.tel.trim(), fecha:F.fecha, items, cobrado, pago, nota:F.nota.trim()}, !previo);
  const ventas = previo ? E.ventas.map(x => x === previo ? v : x) : [...E.ventas, v];
  const movs = E.movs.map(m => m.venta === v.id && !m.borrado ? marcar({...m, borrado:true}) : m);
  for(const it of items) movs.push(marcar({id:uid(), prod:it.prod, tipo:'venta', cant:-it.cant, fecha:v.fecha, pac:v.pac, precio:it.precio, venta:v.id}, true));
  const estado = {...E, ventas, movs, pacientes:[...E.pacientes]};
  completarPacientes(estado);
  if(!guardar(estado)) return;
  await cerrarCapa();
  refrescar();
  toast(previo ? 'Venta actualizada' : `Venta guardada · ${dinero(totalVenta(v))}`);
}
async function borrarVenta(){
  const formulario = F;
  const v = E.ventas.find(x => x.id === F.id); if(!v) return;
  if(!(await confirmar('¿Eliminar esta venta?', 'Los productos vuelven al inventario.', 'Eliminar', true))) return;
  if(F !== formulario) return;
  const borrados = guardarBorrado({ventas:[v], movs:vivos(E.movs).filter(m => m.venta === v.id)}, true);
  if(!borrados) return;
  await cerrarCapa();
  refrescar();
  avisarConDeshacer('Venta eliminada', borrados, false);
}

// ---------- Pacientes ----------
function vPacientes(){
  return `<header class="top"><h1>Pacientes</h1></header>
    ${buscador('Buscar paciente', {id:'qPac', valor:U.qPac})}
    <div class="filas" id="pacLista">${filasPacientes(U.qPac)}</div>`;
}
function filasPacientes(q){
  const lista = pacientes().filter(p => norm(p.nombre).includes(norm(q)));
  if(!lista.length) return `<div class="vacio">${q ? 'No encontré pacientes con esa búsqueda.' : 'Todavía no hay pacientes. Aparecen solas cuando registras ventas.'}</div>`;
  return lista.map(filaPaciente).join('');
}
function filaPaciente(p){
  const vs = vivos(E.ventas).filter(v => norm(v.pac) === norm(p.nombre)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const detalle = vs.length ? `${vs.length} ${vs.length === 1 ? 'compra' : 'compras'} · última ${fCorta(vs[0].fecha)}` : 'Sin compras';
  return `<button class="fila-lista" data-act="verPaciente" data-n="${esc(p.nombre)}">${avatar(p, 'persona')}
    <span class="tx"><b>${esc(p.nombre)}</b><span class="m">${esc(detalle)}</span></span><span class="num">${dinero(vs.reduce((s, v) => s + totalVenta(v), 0))}</span></button>`;
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
  d.innerHTML = cabecera(esc(n), '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="cifras"><div class="cifra"><span class="v num">${dinero(vs.reduce((s, v) => s + totalVenta(v), 0))}</span><span class="l">${vs.length} ${vs.length===1?'compra':'compras'}</span></div>
      <div class="cifra"><span class="v num">${usos.length}</span><span class="l">Productos usados en tratamientos</span></div></div>
    ${tel ? `<a class="btn soft" href="${waLink(tel, 'Hola ' + n.split(' ')[0] + ', ')}" target="_blank" rel="noopener">Escribirle por WhatsApp</a>` : ''}
    <section class="card" style="gap:0"><h3 style="margin-bottom:4px">Compras</h3>${vs.length ? vs.map(v => `<button class="alerta" data-act="editarVenta" data-id="${esc(v.id)}"><div class="tx"><b>${esc(v.items.map(i => fCant(i.cant) + ' × ' + i.nombre).join(', '))}</b><div class="d">${esc(fDia(v.fecha))} ${v.fecha.slice(0, 4)}</div></div><span class="pill ${v.cobrado ? 'acc' : 'warn'} num">${dinero(totalVenta(v))}</span></button>`).join('') : '<div class="muted peq">Sin compras.</div>'}</section>
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
  if(!lista.length) h = `<div class="estado-ok">${IC.check}<div>No hay nada por pedir. Todo tiene suficiente cantidad.</div></div>`;
  for(const [prov, xs] of grupos){
    const tel = (xs.find(x => x.p.telProv) || {p:{}}).p.telProv;
    h += `<section class="card" style="gap:0"><div class="card-cab" style="margin-bottom:6px"><h3>${esc(prov || 'Sin proveedor')}</h3>${tel ? `<a class="btn sm soft" href="${waLink(tel, textoPedido(xs))}" target="_blank" rel="noopener">Pedir</a>` : ''}</div>
      ${xs.map(x => `<button class="alerta" data-act="verProd" data-id="${esc(x.p.id)}">${avatar(x.p, 'sm')}<div class="tx"><b>${esc(x.p.nombre)}</b><div class="d">${x.p.tipo === 'venta' ? 'Para vender' : 'Uso en spa'} · hay ${fCant(x.s)}</div></div><span class="pill gold">Pedir ${fCant(x.sug)}</span></button>`).join('')}</section>`;
  }
  d.innerHTML = cabecera('Lista de compras') + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="peq muted">Productos que se están terminando, con una cantidad sugerida para pedir (para unas semanas, según lo que usas o vendes).</div>${h}
    ${lista.length ? '<button class="btn full" data-act="compartirCompras">Compartir la lista completa</button>' : ''}</div></div>`;
  cargarFotos(d);
}
function textoPedido(xs){ return 'Hola, quisiera hacer un pedido:\n' + xs.map(x => `• ${fCant(x.sug)} ${x.p.unidad} de ${x.p.nombre}${x.p.marca ? ' (' + x.p.marca + ')' : ''}`).join('\n') + '\nGracias.'; }
async function compartirTexto(t){
  try{ if(navigator.share){ await navigator.share({text:t}); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(t); toast('Lista copiada. Pégala en WhatsApp.'); }catch(e){ toast('No se pudo compartir en este navegador'); }
}

// El buscador admite códigos guardados mientras se prepara la lectura con cámara.
function abrirCodigo(modo){
  const d = abrirCapa(`<form class="dlg hoja-inferior" role="dialog">
    <span class="tirador" aria-hidden="true"></span><h3>Escanear</h3>
    <div class="campo"><label for="codigoEscrito">Escribir el código a mano</label>
      <input type="text" id="codigoEscrito" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
      <span class="ayuda error-codigo" id="errorCodigo" role="status"></span>
    </div>
    <div class="fila"><button class="btn ghost" type="button" data-act="cerrar">Cancelar</button><button class="btn" type="submit">Buscar código</button></div>
  </form>`, {cls:'dlg-fondo', tipo:'codigo'});
  const form = $('form', d), campo = $('#codigoEscrito', d), error = $('#errorCodigo', d);
  campo.setAttribute('aria-describedby', error.id);
  campo.addEventListener('input', () => { error.textContent = ''; campo.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(cierrePendiente) return;
    const q = norm(campo.value);
    const tipo = modo === 'vender' ? 'venta' : esInventario(modo) ? modo : undefined;
    const p = q && productos(tipo).find(p => norm(p.codigo) === q);
    if(!p){
      campo.setAttribute('aria-invalid', 'true');
      error.textContent = 'No encontré un producto con ese código.';
      return;
    }
    await cerrarCapa();
    if(modo === 'vender') agregarALaVenta(p.id);
    else verProd(p.id);
  });
  d.addEventListener('click', e => { if(e.target === d) cerrarCapa(); });
}

// ---------- Compartir entre los dos celulares ----------
async function enviar(){
  if(!quien()){ elegirQuien(); return; }
  toast('Preparando el archivo…');
  const fotos = {};
  for(const p of vivos(E.productos)) if(p.foto){ const b = await FDB.get(p.foto).catch(() => null); if(b) fotos[p.foto] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
  const paquete = {app:'sparati-inventario', v:1, de:quien(), generado:new Date().toISOString(),
    datos:{productos:E.productos, movs:E.movs, ventas:E.ventas, cats:E.cats, pacientes:E.pacientes}, fotos};
  const texto = JSON.stringify(paquete);
  const nombre = `inventario-sparati-prueba-${quien().toLowerCase()}-${hoyISO()}.txt`;
  let hecho = false;
  try{
    const f = new File([texto], nombre, {type:'text/plain'});
    if(navigator.canShare && navigator.canShare({files:[f]})){ await navigator.share({files:[f], title:'SPARATI Prueba'}); hecho = true; }
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
  const estado = {...E, cats:{...E.cats}, sync:{...E.sync}};
  let nuevos = 0, cambiados = 0, categoriasNuevas = false;
  for(const k of ['productos','movs','ventas','pacientes']){
    const registros = E[k].slice();
    const mapa = new Map(registros.map((x, i) => [x.id, i]));
    for(const x of datos[k] || []){
      if(!x || !x.id) continue;
      const i = mapa.get(x.id);
      if(i === undefined){ mapa.set(x.id, registros.length); registros.push(x); nuevos++; }
      else if((x.mod || 0) > (registros[i].mod || 0)){ registros[i] = {...registros[i], ...x}; cambiados++; }
    }
    estado[k] = registros;
  }
  for(const t of ['venta','uso']){
    const anteriores = E.cats[t] || [];
    estado.cats[t] = [...new Set(anteriores.concat(datos.cats?.[t] || []))];
    categoriasNuevas = categoriasNuevas || estado.cats[t].length !== anteriores.length;
  }
  return {estado, nuevos, cambiados, categoriasNuevas};
}
async function recibirArchivo(file){
  let p;
  try{ p = JSON.parse(await file.text()); }catch(e){ toast('Ese archivo no es del inventario de SPARATI'); return; }
  if(!p || p.app !== 'sparati-inventario' || !p.datos){ toast('Ese archivo no es del inventario de SPARATI'); return; }
  let fotosNuevas = false;
  for(const [id, u] of Object.entries(p.fotos || {})){
    const ya = await FDB.get(id).catch(() => null);
    if(!ya) try{ await FDB.put(id, dataURLaBlob(u)); fotosNuevas = true; }catch(e){}
  }
  const r = mezclar(p.datos);
  r.nuevos += completarPacientes(r.estado);
  const huboCambios = r.nuevos || r.cambiados || r.categoriasNuevas || fotosNuevas;
  if(huboCambios || !E.sync.recibo){
    r.estado.sync.recibo = ahora();
    if(p.de && p.de !== quien()) r.estado.sync.de = p.de;
    if(!guardar(r.estado)) return;
    refrescar(); pintarAjustes();
  }
  const de = p.de ? ' de ' + p.de : '';
  toast(huboCambios ? `Recibido${de}: ${r.nuevos} registros nuevos y ${r.cambiados} actualizados` : `Recibido${de}: ya tenías todo, no hubo cambios`);
}

// ---------- Datos de ejemplo ----------
const PREFIJO_EJEMPLO = 'ejemplo-';
let cargandoEjemplo = false;
const hayEjemplo = () => E.productos.some(p => typeof p.id === 'string' && p.id.startsWith(PREFIJO_EJEMPLO));

function prepararEjemplo(catalogo){
  const hoy = aFecha(hoyISO());
  const fecha = diasAtras => iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasAtras));
  const salidas = new Map(), movs = [], ventas = [];
  const pacientes = ['Clara Niebla', 'Anaís Pinedal', 'Lucía Del Valle', 'Elena Peñaluz',
    'Diana Albor', 'Sofía Monteclaro', 'Micaela Almendral', 'Valeria Ríosol'].map(nombre => pacienteNuevo(nombre));
  const productos = catalogo.map(({tipo, nombre, marca, cat, unidad, precioEjemplo, foto}, i) => {
    const precio = precioEjemplo || 0;
    const costo = precio ? red(precio * .6) : unidad === 'frascos' ? 12 : 2;
    return marcar({id:PREFIJO_EJEMPLO + 'p' + (i + 1), tipo, nombre, marca, cat, unidad,
      precio, costo, min:i % 13 === 0 ? 1 : 0, gasto:1, duraPac:tipo === 'venta' ? 30 + i % 3 * 7 : 0,
      vence:i % 29 === 0 ? fecha(-21) : '', lote:'', abierto:'', pao:0, prov:'', telProv:'', notas:'',
      foto:foto ? PREFIJO_EJEMPLO + 'foto' + (i + 1) : ''}, true);
  });
  function movimiento(p, tipo, cant, diasAtras, detalle = {}){
    movs.push(marcar({id:PREFIJO_EJEMPLO + 'm' + (movs.length + 1), prod:p.id, tipo, cant,
      fecha:fecha(diasAtras), pac:'', trat:'', precio:0, costo:p.costo, venta:'', motivo:'', nota:'', ...detalle}, true));
    if(cant < 0) salidas.set(p.id, (salidas.get(p.id) || 0) - cant);
  }

  const destacados = productos.filter(p => p.tipo === 'venta' && p.foto).slice(0, 9);
  const pagos = ['efectivo', 'transferencia', 'tarjeta'];
  for(let i = 0; i < 25; i++){
    const diasAtras = 58 - Math.floor(i * 58 / 24);
    const elegidos = [destacados[i % destacados.length]];
    if(i % 3 === 0) elegidos.push(destacados[(i + 4) % destacados.length]);
    const items = elegidos.map(p => ({prod:p.id, nombre:p.nombre, cant:1, precio:p.precio, costo:p.costo}));
    const pac = pacientes[i % pacientes.length].nombre;
    const venta = marcar({id:PREFIJO_EJEMPLO + 'v' + (i + 1), pac, tel:'', fecha:fecha(diasAtras), items,
      cobrado:true, pago:pagos[i % pagos.length], nota:'', recordados:{}}, true);
    ventas.push(venta);
    elegidos.forEach(p => movimiento(p, 'venta', -1, diasAtras, {pac, precio:p.precio, venta:venta.id}));
  }
  const cabina = productos.filter(p => p.tipo === 'uso');
  const frasco = cabina.find(p => p.unidad === 'frascos');
  for(const [apertura, termino] of [[56, 42], [41, 25], [24, 7]]){
    movimiento(frasco, 'apertura', 0, apertura);
    movimiento(frasco, 'uso', -1, termino, {motivo:'terminado'});
  }
  movimiento(frasco, 'apertura', 0, 6);
  frasco.abierto = fecha(6);
  frasco.pao = 12;
  cabina.filter(p => p.unidad !== 'frascos').slice(0, 4).forEach((p, i) => {
    movimiento(p, 'uso', -p.gasto, 12 - i * 3, {pac:pacientes[i].nombre, trat:'Facial'});
  });

  // La cantidad del catálogo es la que queda hoy, después de las salidas ficticias.
  productos.forEach((p, i) => movimiento(p, 'inicial', catalogo[i].cantidad + (salidas.get(p.id) || 0), 59));
  const cats = {};
  for(const tipo of ['venta','uso']) cats[tipo] = [...new Set(productos.filter(p => p.tipo === tipo).map(p => p.cat).filter(Boolean))];
  return {productos, movs, ventas, pacientes, cats};
}
async function cargarEjemplo(boton){
  if(cargandoEjemplo || hayEjemplo()) return;
  cargandoEjemplo = true;
  boton.disabled = true;
  boton.textContent = 'Cargando los datos…';
  try{
    const respuesta = await fetch('../codex/catalogo.json');
    if(!respuesta.ok) throw new Error('No se encontró el catálogo');
    const {productos:catalogo} = await respuesta.json();
    const datos = prepararEjemplo(catalogo);
    const fotosConIndice = catalogo.map((p, i) => ({ruta:p.foto, id:datos.productos[i].foto})).filter(f => f.ruta);
    const fotos = await Promise.all(fotosConIndice.map(async ({ruta, id}) => {
      const respuestaFoto = await fetch('../' + ruta);
      if(!respuestaFoto.ok) throw new Error('No se encontró una foto');
      return {id, foto:await respuestaFoto.blob()};
    }));
    await FDB.tx('readwrite', s => { for(const {id, foto} of fotos) s.put(foto, id); });

    const nombres = new Set(E.pacientes.map(p => norm(p.nombre)));
    datos.pacientes = datos.pacientes.filter(p => !nombres.has(norm(p.nombre)));
    const {estado} = mezclar(datos);
    if(!guardar(estado)) return;
    refrescar();
    toast('Datos de ejemplo cargados');
  }catch(e){
    toast('No se pudieron cargar los datos de ejemplo. Vuelve a intentar.');
  }finally{
    cargandoEjemplo = false;
    pintarAjustes();
  }
}

// ---------- Ajustes ----------
function abrirAjustes(){ const d = abrirCapa('', {tipo:'ajustes'}); pintarAjustes(d); }
function pintarAjustes(d = capaArriba('ajustes')){
  if(!d) return;
  const cu = $('.hoja-cuerpo', d), sc = cu ? cu.scrollTop : 0;
  const activo = document.activeElement;
  const badge = 'setAppBadge' in navigator;
  const permiso = window.Notification ? Notification.permission : 'no';
  d.innerHTML = cabecera('Ajustes') + `<div class="hoja-cuerpo"><div class="hoja-in">
    <section class="card"><h3>¿Quién usa este celular?</h3>
      <div class="seg" role="group" aria-label="Quién usa el celular">${['Elba', 'Jonathan'].map(n => opcion('ponQuien', n, n, quien() === n)).join('')}</div>
      <div class="peq muted">Cada venta y movimiento queda con el nombre de quien lo registró.</div></section>
    <section class="card"><h3>Datos de ejemplo</h3>
      <div class="peq">Agrega 104 productos con sus cantidades y fotos disponibles, precios de ejemplo y ventas y usos ficticios.</div>
      <button class="btn full" data-act="cargarEjemplo" ${cargandoEjemplo || hayEjemplo() ? 'disabled' : ''}>${cargandoEjemplo ? 'Cargando los datos…' : 'Cargar datos de ejemplo'}</button>
      ${hayEjemplo() ? '<div class="peq muted">Ya están cargados en este inventario de prueba.</div>' : ''}</section>
    <section class="card"><h3>Compartir entre los dos celulares</h3>
      <div class="peq">El inventario vive en cada celular. Para que el otro vea lo último, toca <b>Enviar</b> y mándale el archivo por WhatsApp. En el otro celular se abre con <b>Recibir</b>: la app junta todo sin borrar nada.</div>
      <div class="acc-grid"><button class="btn" data-act="enviar">Enviar a ${esc(otro())}</button><button class="btn soft" data-act="recibir">Recibir</button></div>
      <div class="peq muted">Último envío: ${haceTxt(E.sync.envio)} · Último recibido: ${haceTxt(E.sync.recibo)}</div>
      <div class="peq muted">Ese mismo archivo es tu copia de seguridad: si se borra la app o cambias de celular, con «Recibir» vuelve todo.</div></section>
    <section class="card"><h3>Avisos</h3>
      <div class="campo"><span class="lbl">Avisar del vencimiento con</span><div class="seg" role="group" aria-label="Días de aviso">${[30,60,90].map(n => opcion('diasVence', n, n + ' días', E.ajustes.diasVence === n)).join('')}</div></div>
      ${badge ? (permiso === 'granted' ? '<div class="peq">✓ El ícono de la app muestra cuántos productos tienen avisos.</div>'
        : `<button class="btn sm soft" data-act="permisoBadge">Mostrar el número de avisos en el ícono</button><div class="peq muted">El celular te pedirá permiso de notificaciones; solo se usa para el número del ícono.</div>`)
        : '<div class="peq muted">Los avisos aparecen al abrir la app, en Inicio y con un número rojo junto a Inventario.</div>'}</section>
    <section class="card"><h3>Apariencia</h3><div class="seg" role="group" aria-label="Tema">${[['auto','Automático'],['light','Claro'],['dark','Oscuro']].map(([v, n]) => opcion('aTema', v, n, E.ajustes.tema === v)).join('')}</div></section>
    <details class="card"><summary style="font-weight:800;cursor:pointer">Avanzado</summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
      <button class="btn ghost" data-act="actualizar">Actualizar la app ahora</button>
      <div class="peq muted">Úsalo si después de una mejora algo no responde. No borra tus datos.</div>
      <div class="campo"><label for="aBorrarTxt">Borrar todo el inventario de ESTE celular (productos, ventas y fotos). Escribe BORRAR para confirmar:</label><input type="text" id="aBorrarTxt" autocomplete="off" autocapitalize="characters"></div>
      <button class="btn danger" data-act="borrarTodo" id="aBorrar" disabled>Borrar todo</button>
      <div class="peq muted" style="text-align:center">SPARATI · Inventario · versión ${VERSION_APP}</div></div></details>
  </div></div>`;
  $('.hoja-cuerpo', d).scrollTop = sc;
  if(!activo.isConnected) enfocarControl(activo, d);
  const bt = $('#aBorrarTxt', d);
  bt.addEventListener('input', () => { $('#aBorrar', d).disabled = bt.value.trim().toUpperCase() !== 'BORRAR'; });
}
function elegirQuien(){
  const d = abrirCapa(`<div class="hoja-cuerpo"><div class="hoja-in bienvenida">
    <img src="logo-completo.png" class="logo-completo" alt="SPARATI" width="480" height="520">
    <div class="rotulo">INVENTARIO</div>
    <h1>¿Quién usa este celular?</h1>
    <div class="quien"><button data-act="ponQuien" data-v="Elba" data-cerrar="1">Elba</button><button data-act="ponQuien" data-v="Jonathan" data-cerrar="1">Jonathan</button></div>
    <div class="peq muted">Sirve para saber quién registró cada cosa. Se puede cambiar en Ajustes.</div></div></div>`, {tipo:'quien', fija:true});
  return d;
}
function aplicarTema(){
  const v = E.ajustes.tema;
  const oscuro = v === 'dark' || (v !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = oscuro ? 'dark' : 'light';
}
function seleccionarOpcion(b){
  for(const opcion of $$('[aria-pressed]', b.parentElement)){
    opcion.classList.toggle('on', opcion === b);
    opcion.setAttribute('aria-pressed', String(opcion === b));
  }
}

// ---------- Acciones ----------
const ACT = {
  tab(b){ irPantalla(b.dataset.tab); },
  cerrar(){ cerrarCapa(); },
  ajustes(){ abrirAjustes(); },
  nuevoProd(b){ formProd(null, b.dataset.tipo); },
  verProd(b){ verProd(b.dataset.id); },
  editarProd(b){ formProd(b.dataset.id); },
  filtro(b){
    U.filtro[U.tab] = b.dataset.v;
    seleccionarOpcion(b);
    pintarListaProductos();
  },
  escanear(b){ abrirCodigo(b.dataset.modo); },
  vender(b){ formVenta(null, b.dataset.id); },
  usar(b){ formUso(b.dataset.id); },
  usarRapido(b){ usarRapido(b.dataset.id); },
  entrada(b){ formEntrada(b.dataset.id); },
  ajuste(b){ formAjuste(b.dataset.id); },
  abrirHoy(b){ const p = prodPorId(b.dataset.id); p.abierto = hoyISO(); marcar(p); guardar(); refrescar(); toast(`Anotado: ${p.nombre} se abrió hoy. Úsalo antes del ${fCorta(sumarMeses(p.abierto, p.pao))}`); },
  async borrarProd(b){
    const p = prodPorId(b.dataset.id);
    if(!(await confirmar('¿Eliminar producto?', `«${esc(p.nombre)}» se quita del inventario. Las ventas donde aparece se conservan.`, 'Eliminar', true))) return;
    const borrados = guardarBorrado({productos:[p]}, true);
    if(!borrados) return;
    await cerrarCapa();
    refrescar();
    avisarConDeshacer('Producto eliminado', borrados, false);
  },
  compras(){ abrirCompras(); },
  compartirCompras(){ compartirTexto('🛒 Lista de compras SPARATI\n' + paraPedir().map(x => `• ${x.p.nombre}${x.p.marca ? ' (' + x.p.marca + ')' : ''}: pedir ${fCant(x.sug)} ${x.p.unidad} (hay ${fCant(x.s)})${x.p.prov ? ' — ' + x.p.prov : ''}`).join('\n')); },
  // Formularios
  async guardarF(){
    const form = F;
    if(!form || form.guardando || cierrePendiente) return;
    form.guardando = true;
    try{ await form.guardar(); }
    finally{ form.guardando = false; }
  },
  fChip(b){
    const f = b.dataset.f, v = b.dataset.v;
    F[f] = (f === 'cat' && F[f] === v) ? '' : v;
    if(f === 'tipo' && F.cat && !CATS[v].concat(E.cats[v] || []).includes(F.cat)) F.cat = '';
    repintar();
  },
  paso(b){
    const inp = $('input', b.closest('.paso'));
    const v = num(inp.value), d = Number(b.dataset.d);
    inp.value = fCant(Math.max(0, (isFinite(v) ? v : 0) + d));
    inp.dispatchEvent(new Event('input', {bubbles:true}));
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
  vAgregar(b){ agregarALaVenta(b.dataset.id); },
  vQuitar(b){
    F.items.splice(+b.dataset.i, 1);
    pintarCarrito();
    $('.resumen-venta').focus({preventScroll:true});
  },
  verCarrito(b){
    const detalle = $('#detalleVenta');
    detalle.hidden = !detalle.hidden;
    b.setAttribute('aria-expanded', String(!detalle.hidden));
  },
  pagoVenta(b){
    F.pagoMarcado = b.dataset.v;
    if(!$('#pagoPendiente').checked) F.pago = F.pagoMarcado;
    seleccionarOpcion(b);
  },
  editarVenta(b){ formVenta(b.dataset.id); },
  borrarVenta(){ borrarVenta(); },
  mes(b){
    const [y, m] = U.mes.split('-').map(Number), d = new Date(y, m - 1 + Number(b.dataset.d), 1);
    const nm = iso(d).slice(0, 7); if(nm > hoyISO().slice(0, 7)) return;
    U.mes = nm; render();
  },
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
  cargarEjemplo,
  ponQuien(b){
    YO = {quien:b.dataset.v}; localStorage.setItem(CLAVE_YO, JSON.stringify(YO));
    if(b.dataset.cerrar){ pila[pila.length-1].fija = false; cerrarCapa(); }
    pintarAjustes(); render();
  },
  diasVence(b){ E.ajustes.diasVence = Number(b.dataset.v); guardar(); pintarAjustes(); },
  async permisoBadge(){ try{ await Notification.requestPermission(); }catch(e){} actualizarAvisos(); pintarAjustes(); },
  aTema(b){ E.ajustes.tema = b.dataset.v; guardar(); aplicarTema(); pintarAjustes(); },
  async actualizar(){
    if(navigator.serviceWorker){
      const r = await navigator.serviceWorker.getRegistration('./').catch(() => null);
      if(r && r.scope === new URL('./', document.baseURI).href) await r.update().catch(() => {});
    }
    location.reload();
  },
  async borrarTodo(){
    if(cargandoEjemplo) return;
    if((($('#aBorrarTxt') || {}).value || '').trim().toUpperCase() !== 'BORRAR') return;
    const aj = E.ajustes; E = estadoInicial(); E.ajustes = aj;
    guardar(); await FDB.vaciar().catch(() => {});
    pintarAjustes(); render(); toast('Se borró todo el inventario de este celular');
  },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if(!b || b.disabled || cierrePendiente) return;
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
history.scrollRestoration = 'manual';
U.tab = pantallaDeURL();
if(esInventario(U.tab)) U.tipo = U.tab;
history.replaceState(null, '', urlPantalla(U.tab));
prepararNav();
render();
if(!quien()) elegirQuien();
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && !pila.length) render(); });
