'use strict';
/* SPARATI · Inventario
   Dos inventarios (para vender y de uso en el spa), avisos de lo que se termina o vence,
   ventas con paciente y fecha, y sincronización por archivo entre el celular de Elba y el de Jonathan.
   La cantidad de cada producto no se guarda: se calcula sumando sus movimientos. Así, al juntar
   lo que registró cada uno en su celular, nada se pisa. */
const VERSION_APP = 2;
const CLAVE = 'sparati_prueba_v2';
const CLAVE_YO = 'sparati_prueba_yo';
const CLAVE_INSTALACION = 'sparati_prueba_instalacion';
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
const MOTIVOS = {conteo:'Conteo', dañado:'Se dañó', vencido:'Se venció', regalo:'Regalo', otro:'Otro'};
const PLANTILLA_RECORDATORIO = 'Hola, {nombre}. Te escribe Elba de SPARATI. Tu {producto} ya debe estar por terminarse. ¿Te separo uno?';
const PLANTILLA_COMPROBANTE = 'Gracias por tu compra.';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const barraPrincipal = $('.nav');
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
function cantidadEscrita(valor){
  const texto = String(valor ?? '').trim();
  if(!/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(texto)) return null;
  const cantidad = num(texto);
  return Number.isSafeInteger(Math.round(cantidad * 100)) ? red(cantidad) : null;
}
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
const diasEntre = (inicio, fin) => Math.round((aFecha(fin) - aFecha(inicio)) / 86400000);
const diasHasta = s => diasEntre(hoyISO(), s);
function diasDesde(s){ return -diasHasta(s); }
function sumarDias(s, n){
  const d = aFecha(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function sumarMeses(s, m){
  const d = aFecha(s), mes = d.getMonth() + Number(m);
  const ultimo = new Date(d.getFullYear(), mes + 1, 0).getDate();
  return iso(new Date(d.getFullYear(), mes, Math.min(d.getDate(), ultimo)));
}
function haceTxt(ms){
  if(!ms) return 'nunca';
  const d = Math.floor((ahora() - ms) / 86400000);
  if(d <= 0){ const h = Math.floor((ahora() - ms) / 3600000); return h <= 0 ? 'hace un momento' : 'hace ' + h + (h === 1 ? ' hora' : ' horas'); }
  return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}

// ---------- Estado ----------
function estadoInicial(){
  return {v:1, productos:[], movs:[], ventas:[], pacientes:[], pedidos:[], cats:{venta:[], uso:[]},
    ajustes:{diasVence:60, tema:'auto', letraGrande:false,
      plantillaRecordatorio:PLANTILLA_RECORDATORIO, plantillaComprobante:PLANTILLA_COMPROBANTE},
    sync:{envio:0, recibo:0, de:''}, creado:ahora()};
}
let E, YO, estadoGuardado;
function completarEstado(estado){
  const base = estadoInicial();
  for(const k of ['movs','ventas','pacientes','pedidos']) if(!Array.isArray(estado[k])) estado[k] = [];
  estado.cats = {...base.cats, ...estado.cats};
  estado.ajustes = {...base.ajustes, ...estado.ajustes};
  estado.sync = {...base.sync, ...estado.sync};
  return estado;
}
function cargar(){
  try{
    estadoGuardado = localStorage.getItem(CLAVE);
    E = JSON.parse(estadoGuardado);
  }catch(e){ E = null; }
  E = E && Array.isArray(E.productos) ? completarEstado(E) : estadoInicial();
  try{ YO = JSON.parse(localStorage.getItem(CLAVE_YO)); }catch(e){ YO = null; }
  completarPacientes();
}
function guardar(estado = E, soloBorrador = false, avisar = toast){
  try{
    const texto = JSON.stringify(estado);
    localStorage.setItem(CLAVE, texto);
    estadoGuardado = texto;
  }
  catch(e){ avisar('No se pudo guardar: la memoria del navegador está llena.'); return false; }
  E = estado;
  if(!soloBorrador){ calcular(); actualizarAvisos(); }
  return true;
}
const quien = () => (YO && YO.quien) || '';
const otro = () => quien() === 'Elba' ? 'Jonathan' : 'Elba';
const marcar = (o, nuevo) => { o.mod = ahora(); o.por = quien(); if(nuevo) o.creado = o.mod; return o; };

function pacienteNuevo(nombre, tel = '', autor = quien()){
  return {...marcar({id:'paciente:' + norm(nombre), nombre, tel, notas:''}, true), por:autor};
}
function completarPacientes(estado = E, autor = quien()){
  const nombres = new Set(estado.pacientes.map(p => norm(p.nombre)));
  const fichas = new Map();
  const ventas = vivos(estado.ventas).sort((a, b) => b.fecha.localeCompare(a.fecha));
  for(const v of ventas){
    const nombre = v.pac?.trim(), k = norm(nombre);
    if(!k || nombres.has(k)) continue;
    const ficha = fichas.get(k);
    if(!ficha) fichas.set(k, pacienteNuevo(nombre, v.tel || '', autor));
    else if(!ficha.tel && v.tel) ficha.tel = v.tel;
  }
  estado.pacientes.push(...fichas.values());
  return fichas.size;
}

// ---------- Cálculos ----------
let STOCK = new Map(), CONSUMO = new Map();
const vivos = l => l.filter(x => !x.borrado);
const productos = tipo => vivos(E.productos).filter(p => !tipo || p.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
const categoriasDe = tipo => [...new Set([...CATS[tipo], ...(E.cats[tipo] || []), ...productos(tipo).map(p => p.cat)].filter(Boolean))];
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
  else if(min > 0 && s <= min) out.push({clase:'stock', nivel:'bad', txt:`${s === 1 ? 'Queda' : 'Quedan'} ${fCant(s)}`, detalle:'avisas con ' + fCant(min), orden:1});
  else if(c && s / c <= 14) out.push({clase:'stock', nivel:'warn', txt:`Alcanza para unos ${Math.max(1, Math.round(s / c))} días`, orden:2});
  if(s > 0 && p.vence){
    const d = diasHasta(p.vence);
    if(d < 0) out.push({clase:'fecha', nivel:'bad', txt:'Venció el ' + fCorta(p.vence), orden:0});
    else if(d <= E.ajustes.diasVence) out.push({clase:'fecha', nivel:'warn', txt:d === 0 ? 'Vence hoy' : `Vence en ${d} ${d===1?'día':'días'}`, detalle:d > 0 ? fCorta(p.vence) : '', orden:1});
  }
  if(s > 0 && p.abierto && p.pao > 0){
    const lim = sumarMeses(p.abierto, p.pao), d = diasHasta(lim);
    if(d < 0) out.push({clase:'fecha', nivel:'bad', txt:'Ya pasó el tiempo de uso después de abierto', detalle:fCorta(lim), orden:0});
    else if(d === 0) out.push({clase:'fecha', nivel:'warn', txt:'Hoy se cumple el tiempo de uso después de abierto', orden:0});
    else if(d <= 30) out.push({clase:'fecha', nivel:'warn', txt:'Úsalo antes del ' + fCorta(lim), orden:1});
  }
  return out;
}
const textoAviso = a => a.txt + (a.detalle ? ' (' + a.detalle + ')' : '');
function todosLosAvisos(){
  const r = {stock:[], fecha:[]};
  for(const p of productos()) for(const a of avisosDe(p)) r[a.clase].push(Object.assign({p}, a));
  const ord = (a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'bad' ? -1 : 1) || a.orden - b.orden || a.p.nombre.localeCompare(b.p.nombre, 'es');
  r.stock.sort(ord); r.fecha.sort(ord);
  return r;
}
// Pacientes a quienes conviene volver a ofrecer un producto (según cuántos días le dura)
function recompras(lista = pacientes()){
  const porProducto = new Map(vivos(E.productos).filter(p => p.tipo === 'venta' && p.duraPac > 0).map(p => [p.id, p]));
  const hoy = hoyISO();
  const r = [];
  for(const paciente of lista){
    const vistos = new Set();
    for(const v of paciente.compras){
      if(v.fecha > hoy) continue;
      const d = diasEntre(v.fecha, hoy);
      for(const it of v.items){
        const p = porProducto.get(it.prod);
        if(!p || vistos.has(p.id)) continue;
        vistos.add(p.id);
        if(!v.recordados?.[p.id] && d >= p.duraPac - 5 && d <= p.duraPac + 60){
          r.push({paciente, v, p, d, fecha:sumarDias(v.fecha, p.duraPac)});
        }
      }
    }
  }
  return r.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
const porCobrar = () => vivos(E.ventas).filter(v => !v.cobrado).sort((a, b) => b.fecha.localeCompare(a.fecha));
const totalVenta = v => red(v.items.reduce((s, it) => s + it.cant * it.precio, 0) - (v.descuento || 0));
const costoVenta = v => red(v.items.reduce((s, it) => s + it.cant * (it.costo || 0), 0));
function cifrasVentas(ventas){
  const total = red(ventas.reduce((s, v) => s + totalVenta(v), 0));
  return {total, ganancia:red(total - ventas.reduce((s, v) => s + costoVenta(v), 0))};
}
function pacientes(){
  const lista = new Map(E.pacientes.map(p => [norm(p.nombre),
    {...p, compras:[], usos:[]}]));
  const persona = nombre => {
    const k = norm(nombre);
    if(!k) return null;
    if(!lista.has(k)) lista.set(k, {nombre:nombre.trim(), tel:'', compras:[], usos:[]});
    const p = lista.get(k);
    return p.borrado ? null : p;
  };
  const historial = (a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0);
  for(const v of vivos(E.ventas).reverse().sort(historial)){
    const p = persona(v.pac);
    if(!p) continue;
    p.compras.push(v);
    if(!p.id && !p.tel && v.tel) p.tel = v.tel;
  }
  for(const m of vivos(E.movs)){
    const p = persona(m.pac);
    if(p && m.tipo === 'uso') p.usos.push(m);
  }
  return vivos([...lista.values()]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
function coincidePaciente(p, texto){
  const q = norm(texto), digitos = q.replace(/\D/g, '');
  return norm(p.nombre).includes(q) ||
    (digitos && !/[a-z]/.test(q) && String(p.tel || '').replace(/\D/g, '').includes(digitos));
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
const URLS = Object.create(null);
async function urlFoto(id){
  if(URLS[id]) return URLS[id];
  const b = await FDB.get(id).catch(() => null);
  if(!b) return null;
  return (URLS[id] = URL.createObjectURL(b));
}
async function cargarFoto(img){
  const u = await urlFoto(img.dataset.foto);
  if(!img.isConnected) return;
  if(!u){ img.remove(); return; }
  img.addEventListener('error', () => img.remove(), {once:true});
  img.src = u;
}
function cargarFotos(raiz){
  $$('img[data-foto]', raiz).forEach(cargarFoto);
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
  const ficha = activa?.matches('.ficha-producto, .ficha-paciente');
  $('#app').inert = Boolean(activa);
  barraPrincipal.inert = Boolean(activa) && !ficha;
  if(ficha){
    if(barraPrincipal.parentElement !== activa) activa.append(barraPrincipal);
  }
  else if(barraPrincipal.parentElement !== document.body) $('#capas').before(barraPrincipal);
  document.body.classList.toggle('bloqueo', Boolean(activa));
  document.body.classList.toggle('ficha-abierta', Boolean(ficha));
  marcarPestanaPrincipal();
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
  pila.push({id, el:d, alCerrar:op.alCerrar, foco:document.activeElement});
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
function cerrarCapa(cantidad = 1){
  if(!pila.length) return Promise.resolve();
  if(!cierrePendiente){
    cierrePendiente = new Promise(res => { resolverCierre = res; });
    history.go(-cantidad);
  }
  return cierrePendiente;
}
window.addEventListener('popstate', e => {
  if(document.body.classList.contains('en-bienvenida')){
    if(quien()) iniciarPantallas();
    else pintarBienvenida(e.state?.bienvenida || {paso:1}, true);
    return;
  }
  let foco;
  const profundidad = pila.findIndex(c => c.id === e.state?.capa) + 1;
  while(pila.length > profundidad){
    const c = pila.pop();
    foco = c.foco;
    c.el.remove();
    c.alCerrar?.();
  }
  activarCapa();
  if(!pila.length) mostrarPantalla(pantallaDeURL());
  const activa = pila.at(-1)?.el;
  if(activa?.classList.contains('venta-form')) actualizarCatalogoVenta(activa);
  if(foco && !enfocarControl(foco, activa || $('#app'))){
    (activa?.querySelector('[data-act="cerrar"]') || $('.nav [aria-current]'))?.focus({preventScroll:true});
  }
  const resolver = resolverCierre;
  resolverCierre = cierrePendiente = null;
  resolver?.();
});
document.addEventListener('keydown', e => {
  const capa = pila.at(-1)?.el;
  if(!capa || e.defaultPrevented) return;
  if(e.key === 'Escape'){
    e.preventDefault();
    cerrarCapa();
  }else if(e.key === 'Tab'){
    const controles = 'a[href], button, input, select, textarea, summary, [tabindex]';
    const disponibles = $$(controles, capa).concat($$('#toast button, #toast a[href]')).filter(el => {
      if(el.matches(':disabled') || el.closest('[hidden], [inert]') || !el.getClientRects().length) return false;
      const cerrado = el.closest('details:not([open])');
      if(cerrado && !cerrado.querySelector(':scope > summary')?.contains(el)) return false;
      return el.tabIndex >= 0 || el.matches('summary:not([tabindex])');
    });
    const destino = e.shiftKey ? disponibles.at(-1) : disponibles[0];
    const borde = e.shiftKey ? disponibles[0] : disponibles.at(-1);
    const activo = document.activeElement;
    if(activo === borde || !disponibles.includes(activo)){
      e.preventDefault();
      (destino || $('[role="dialog"]', capa) || capa).focus();
    }
  }
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
function toast(msg, accion, {exito = false, enlace = ''} = {}){
  let t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.classList.toggle('toast-venta', exito);
  t.innerHTML = `${exito ? `<span class="check-venta" aria-hidden="true">${IC.check}</span>` : ''}<span class="texto-toast"></span>
    ${accion ? '<button type="button">Deshacer</button>' : ''}
    ${enlace ? `<a class="recibo-toast" href="${esc(enlace)}" target="_blank" rel="noopener">Abrir comprobante en WhatsApp</a>` : ''}`;
  t.hidden = false;
  $('.texto-toast', t).textContent = $('#anuncio').textContent = msg;
  if(accion) $('button', t).onclick = () => { t.hidden = true; accion(); };
  clearTimeout(tToast);
  tToast = setTimeout(() => { t.hidden = true; }, accion ? 5000 : 3400);
}
function guardarBorrado(registrosPorLista, borrado, productos = E.productos){
  const estado = {...E, productos}, actualizados = {};
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
function avisarConDeshacer(mensaje, registrosPorLista, borrado, restaurarProductos, opciones){
  toast(mensaje, () => {
    if(!guardarBorrado(registrosPorLista, borrado, restaurarProductos?.())) return;
    refrescar();
    toast('Listo, se deshizo');
  }, opciones);
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
const U = {tab:'inicio', tipo:'venta', qInicio:'', qPac:'', q:{venta:'', uso:''}, filtro:{venta:'todos', uso:'todos'},
  orden:{venta:'nombre', uso:'nombre'}, mes:hoyISO().slice(0, 7), reporte:'ventas', qVentas:''};
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
  barraPrincipal.innerHTML = `<div class="nav-in">
    ${boton('inicio', 'inicio', 'Inicio')}
    ${boton('inventario', 'inventario', 'Inventario', '<span class="punto" id="avisosInventario" aria-hidden="true" hidden></span>')}
    <button class="nav-vender" data-act="vender"><span class="circulo">${IC.bolsa}</span><span>Vender</span></button>
    ${boton('pacientes', 'pacientes', 'Pacientes')}
    ${boton('ventas', 'reportes', 'Reportes')}
  </div>`;
}
function marcarPestanaPrincipal(){
  const enFicha = barraPrincipal.closest('.ficha-producto');
  const principal = barraPrincipal.closest('.ficha-paciente') ? 'pacientes' :
    enFicha || esInventario(U.tab) ? 'inventario' : U.tab;
  const venta = $('.nav-vender', barraPrincipal);
  if(enFicha?.dataset.inventario === 'venta') venta?.setAttribute('aria-label', 'Vender otros productos');
  else venta?.removeAttribute('aria-label');
  for(const b of $$('[data-tab]', barraPrincipal)){
    if(b.dataset.tab === principal) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
}
function buscador(texto, {id = '', valor = '', campo = '', escaneo = ''} = {}){
  return `<div class="buscador"><label class="buscar">${IC.lupa}<input type="search" ${id ? `id="${id}"` : ''} ${campo ? `data-f="${campo}"` : ''} aria-label="${texto}" placeholder="${texto}" value="${esc(valor)}" autocomplete="off"></label>
    ${escaneo ? `<button class="btn boton-escanear" data-act="escanear" data-modo="${escaneo}" aria-label="Escanear">${IC.escaneo}</button>` : ''}</div>`;
}
function opcion(act, valor, texto, activa, clase = '', attrs = ''){
  return `<button type="button" class="${clase}${activa ? ' on' : ''}" aria-pressed="${activa}" data-act="${act}" data-v="${esc(valor)}" ${attrs}>${texto}</button>`;
}

function render(){
  if(document.body.classList.contains('en-bienvenida')) return;
  calcular();
  const app = $('#app');
  const activo = app.contains(document.activeElement) ? document.activeElement : null;
  const tira = $('.filtros-inventario', app);
  const posicionFiltros = tira?.scrollLeft;
  app.innerHTML = U.tab === 'inicio' ? vInicio() : U.tab === 'ventas' ? vReportes() : U.tab === 'pacientes' ? vPacientes() : vLista(U.tab);
  marcarPestanaPrincipal();
  const lista = $('#listaProd', app);
  prepararFotosInventario(lista);
  if(!lista) cargarFotos(app);
  const filtros = $('.filtros-inventario', app);
  if(filtros){
    if(tira?.dataset.tipo === U.tab) filtros.scrollLeft = posicionFiltros;
    else if(U.filtro[U.tab] !== 'todos'){
      const chip = $('.chip.on', filtros);
      if(chip) filtros.scrollLeft = chip.offsetLeft - parseFloat(getComputedStyle(filtros).paddingLeft);
    }
  }
  actualizarAvisos();
  $('#qProd')?.addEventListener('input', e => {
    U.q[U.tab] = e.target.value;
    pintarListaProductos();
  });
  $('#ordenProd')?.addEventListener('change', e => {
    U.orden[U.tab] = e.target.value;
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
  if(activo && !activo.isConnected){
    if(activo.id) document.getElementById(activo.id)?.focus({preventScroll:true});
    else enfocarControl(activo, app);
  }
}
function pintarBusquedaInicio(){
  const q = norm(U.qInicio);
  const contenido = $('#contenidoInicio'), resultados = $('#resultadosInicio');
  contenido.hidden = Boolean(q);
  resultados.hidden = !q;
  if(!q) return;
  const ps = productos().filter(p => coincideProducto(p, q)).slice(0, 20);
  const pac = pacientes().filter(p => coincidePaciente(p, q)).slice(0, 10);
  resultados.innerHTML = (ps.length ? `<section class="grupo-productos"><h2>Productos</h2><div class="filas">${ps.map(p => filaProducto(p, 'verProd', true)).join('')}</div></section>` : '') +
    (pac.length ? `<section class="grupo-productos"><h2>Pacientes</h2><div class="filas">${pac.map(filaPaciente).join('')}</div></section>` : '') ||
    '<div class="vacio card">No encontré productos ni pacientes con esa búsqueda. Prueba con otro nombre.</div>';
  cargarFotos(resultados);
}

const ACCIONES_INICIO = {
  vender:{titulo:'Vender', icono:'bolsa', accion:'vender'},
  usar:{titulo:'Usé en cabina', icono:'gota', tipo:'uso'},
  entrada:{titulo:'Llegó mercadería', icono:'entrada'},
  conteo:{titulo:'Contar inventario', icono:'conteo', accion:'conteo'},
};
const CONTADORES_INICIO = {stock:'Por terminarse', fecha:'Vencen pronto', paciente:'Pacientes por recordar'};

function saludoInicio(fecha){
  const h = fecha.getHours();
  return h < 5 || h >= 19 ? 'Buenas noches' : h < 12 ? 'Buenos días' : 'Buenas tardes';
}
function resumenInicio(fecha){
  const mes = fecha.getMonth(), anio = fecha.getFullYear();
  const anterior = new Date(anio, mes - 1, 1);
  const claveMes = iso(fecha).slice(0, 7), claveAnterior = iso(anterior).slice(0, 7);
  const ventas = vivos(E.ventas);
  const actuales = ventas.filter(v => v.fecha.startsWith(claveMes));
  const anteriores = ventas.filter(v => v.fecha.startsWith(claveAnterior));
  const previo = cifrasVentas(anteriores).total;
  const {total, ganancia} = cifrasVentas(actuales);
  const diarios = new Map();
  for(const v of ventas) diarios.set(v.fecha, (diarios.get(v.fecha) || 0) + totalVenta(v));
  const semana = Array.from({length:7}, (_, i) => {
    const dia = new Date(anio, mes, fecha.getDate() - 6 + i);
    return {dia:iso(dia), inicial:DIAS[dia.getDay()][0].toUpperCase(), total:red(diarios.get(iso(dia)) || 0)};
  });
  const variacion = previo > 0 ? Math.round((total - previo) / previo * 100) : null;
  return {mes:MESES[mes], anterior:MESES[anterior.getMonth()], total, ganancia, previo,
    ventas:actuales.length, ventasPrevias:anteriores.length, semana, variacion};
}
function tarjetaVentasInicio(fecha){
  const r = resumenInicio(fecha);
  const comparacion = r.variacion === null ? (r.ventasPrevias ? dinero(r.previo) : 'Sin ventas') + ' en ' + r.anterior :
    `${r.variacion > 0 ? '+' : ''}${r.variacion} % vs ${r.anterior}`;
  const mayor = Math.max(0, ...r.semana.map(d => d.total)) || 1;
  return `<section class="ventas-inicio" aria-labelledby="ventasInicio">
    <div class="ventas-inicio-cab"><h2 id="ventasInicio">Ventas de ${r.mes}</h2>
      <span class="comparacion${r.variacion < 0 ? ' baja' : ''}">${comparacion}</span></div>
    <button class="ventas-inicio-total num" data-act="ventasInicio" aria-label="Ver ventas de ${r.mes}, ${dinero(r.total)}">${dinero(r.total)}</button>
    <p>${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'} · <b>${dinero(r.ganancia)}</b> de ganancia</p>
    <ul class="ventas-inicio-grafico" role="list" aria-label="Ventas de los últimos 7 días">
      ${r.semana.map(d => `<li><span class="barra" style="--alto-barra:${Math.max(2, Math.round(d.total / mayor * 80))}px" aria-hidden="true"></span>
        <span aria-hidden="true">${d.inicial}</span><span class="solo-lectura">${cap(fDia(d.dia))} · ${dinero(d.total)}</span></li>`).join('')}
    </ul>
  </section>`;
}

function avisosInicio(){
  const {stock, fecha} = todosLosAvisos();
  const porProducto = new Map(), porPaciente = new Map();
  for(const a of fecha){
    if(!porProducto.has(a.p.id)) porProducto.set(a.p.id, []);
    porProducto.get(a.p.id).push(a);
  }
  for(const r of recompras()){
    const nombre = r.paciente.nombre;
    if(!porPaciente.has(nombre)) porPaciente.set(nombre, []);
    porPaciente.get(nombre).push(r);
  }
  const envio = E.sync.envio;
  const pendiente = quien() && ultimoCambio() > (E.sync.hastaEnvio ?? envio) && ahora() - (envio || E.creado) > 7 * 86400000;
  return {stock, fecha:[...porProducto.values()], paciente:[...porPaciente.values()], envio:pendiente ? [envio] : []};
}
function ultimoCambio(){
  let ultimo = E.sync.categoriasMod || 0;
  for(const k of ['productos','movs','ventas','pacientes'])
    for(const x of E[k]) if(x.por === quien() && x.mod > ultimo) ultimo = x.mod;
  return ultimo;
}
function filaAtencion({imagen, titulo, detalle, accion, atributos = '', etiqueta, icono = '', contexto = titulo}){
  return `<li class="alerta atencion-fila">
    ${imagen}<div class="tx"><b>${esc(titulo)}</b><div class="d">${detalle}</div></div>
    <button class="btn sm soft" data-act="${accion}" ${atributos} aria-label="${esc(etiqueta + ' · ' + contexto)}">${icono}${etiqueta}</button>
  </li>`;
}
function filasAtencion(avisos, filtro, muestra = false){
  let h = '';
  const deClase = clase => muestra ? avisos[clase].slice(0, 1) : avisos[clase];
  const estado = a => `<span class="${a.nivel}">${esc(a.txt)}</span>${a.detalle ? ' · ' + esc(a.detalle) : ''}`;
  if(!filtro || filtro === 'stock') h += deClase('stock').map(a =>
    filaAtencion({
      imagen:avatar(a.p), titulo:a.p.nombre, detalle:estado(a),
      accion:'compras', atributos:`data-id="${esc(a.p.id)}"`, etiqueta:'Pedir',
    })).join('');
  if(!filtro || filtro === 'fecha') h += deClase('fecha').map(avisosFecha =>
    filaAtencion({
      imagen:`<span class="atencion-icono fecha">${IC.calendario}</span>`,
      titulo:avisosFecha[0].p.nombre, detalle:avisosFecha.map(estado).join('<br>'),
      accion:'verProd', atributos:`data-id="${esc(avisosFecha[0].p.id)}"`, etiqueta:'Ver',
    })).join('');
  if(!filtro || filtro === 'paciente') h += deClase('paciente').flatMap(rs => muestra ? rs.slice(0, 1) : rs).map(({paciente, v, p, d}) => {
    const tiempo = p.duraPac - d;
    const detalle = tiempo > 0 ? 'Se acabaría esta semana' : tiempo === 0 ? 'Se acabaría hoy' : 'Ya se le habría terminado';
    return filaAtencion({
      imagen:avatar(paciente, 'persona'), titulo:paciente.nombre, detalle:`${esc(p.nombre)} · ${detalle}`,
      accion:'recompra', atributos:`data-v="${esc(v.id)}" data-p="${esc(p.id)}"`,
      etiqueta:'Escribir', icono:IC.chat, contexto:paciente.nombre + ' · ' + p.nombre,
    });
  }).join('');
  if(!filtro && avisos.envio.length){
    const [envio] = avisos.envio;
    const detalle = envio ? 'Último envío ' + haceTxt(envio) : 'Todavía no has enviado el inventario';
    h += filaAtencion({
      imagen:`<span class="atencion-icono">${IC.sync}</span>`, titulo:otro() + ' no tiene tus cambios', detalle,
      accion:'enviar', etiqueta:'Enviar',
    });
  }
  return h ? `<ul class="atencion-lista" role="list">${h}</ul>` :
    `<div class="estado-ok">${IC.check}<span>${filtro ? 'Todo en orden por aquí.' : 'Todo en orden. No hay avisos pendientes.'}</span></div>`;
}
function abrirAvisosInicio(filtro){
  const d = abrirCapa('', {tipo:'avisosInicio'});
  d.dataset.filtro = filtro || '';
  pintarAvisosInicio(d);
}
function pintarAvisosInicio(d){
  const titulo = CONTADORES_INICIO[d.dataset.filtro] || 'Necesita atención';
  const scroll = $('.hoja-cuerpo', d)?.scrollTop || 0;
  const activo = d.contains(document.activeElement) ? document.activeElement : null;
  d.innerHTML = cabecera(titulo, '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    ${filasAtencion(avisosInicio(), d.dataset.filtro)}</div></div>`;
  $('.hoja-cuerpo', d).scrollTop = scroll;
  cargarFotos(d);
  if(activo && !activo.isConnected && !enfocarControl(activo, d)) $('button[data-act="cerrar"]', d).focus({preventScroll:true});
}
function abrirSelectorInicio(accion){
  const {titulo} = ACCIONES_INICIO[accion];
  const d = abrirCapa(cabecera(titulo, '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    ${buscador('Buscar producto', {escaneo:accion})}<div class="filas selector-inicio-lista"></div></div></div>`, {tipo:'selectorInicio'});
  d.dataset.accion = accion;
  $('input', d).addEventListener('input', () => pintarSelectorInicio(d));
  pintarSelectorInicio(d);
}
function pintarSelectorInicio(d){
  const accion = d.dataset.accion, q = norm($('input', d).value);
  const ps = productos(ACCIONES_INICIO[accion].tipo).filter(p => coincideProducto(p, q));
  const lista = $('.selector-inicio-lista', d);
  const activo = document.activeElement;
  lista.innerHTML = ps.length ? ps.map(p => filaProducto(p, accion, true)).join('') :
    `<div class="vacio">${q ? 'No encontré productos con esa búsqueda.' : 'Todavía no hay productos para elegir.'}</div>`;
  cargarFotos(lista);
  if(!activo.isConnected) enfocarControl(activo, lista);
}

function vInicio(){
  const hoy = new Date(), nombre = quien();
  const avisos = avisosInicio(), pc = porCobrar();
  const cantidad = Object.values(avisos).reduce((n, lista) => n + lista.length, 0);
  const tieneAvisos = cantidad > 0;
  return `<header class="top cab-inicio">
    <div class="marca-inicio"><img src="emblema.png" class="emblema" alt="" width="128" height="115">
      <div><img src="logo-texto.png" class="logo-texto" alt="SPARATI" width="210" height="33">
        <h1>${saludoInicio(hoy)}${nombre ? ', ' + esc(nombre) : ''}</h1><div class="sub">${cap(fDia(iso(hoy)))}</div></div>
    </div>
    <button class="icon-btn avisos-inicio" data-act="avisosInicio" aria-label="Avisos${tieneAvisos ? ', ' + cantidad + ' pendientes' : ''}">${IC.campana}
      ${tieneAvisos ? `<span aria-hidden="true">${cantidad > 99 ? '99+' : cantidad}</span>` : ''}</button>
  </header>
  ${buscador('Buscar producto o paciente', {id:'qInicio', valor:U.qInicio, escaneo:'global'})}
  <div id="resultadosInicio" class="lista-productos" hidden></div>
  <div class="contenido-inicio" id="contenidoInicio">
    <div class="acciones-inicio" role="group" aria-label="Acciones rápidas">
      ${Object.entries(ACCIONES_INICIO).map(([clave, {titulo, icono, accion}]) => `<button data-act="${accion || 'selectorInicio'}" data-accion="${clave}">
        <span>${IC[icono]}</span>${clave === 'conteo' && E.conteo ? 'Retomar conteo' : titulo}</button>`).join('')}
    </div>
    ${tarjetaVentasInicio(hoy)}
    <div class="contadores-inicio" role="group" aria-label="Resumen de avisos">
      ${Object.entries(CONTADORES_INICIO).map(([clase, titulo]) => `<button class="contador-inicio ${clase}" data-act="avisosInicio" data-filtro="${clase}">
        <b>${avisos[clase].length}</b><span>${titulo}</span></button>`).join('')}
    </div>
    <section class="atencion-inicio" aria-labelledby="tituloAtencion">
      <div class="card-cab"><h2 class="titulo-seccion" id="tituloAtencion">Necesita atención</h2>
        ${tieneAvisos ? '<button class="link" data-act="avisosInicio">Ver todo</button>' : ''}</div>
      ${filasAtencion(avisos, '', true)}
    </section>
    ${pc.length ? `<section class="card pendiente-inicio"><div class="card-cab"><h2 class="titulo-seccion">Por cobrar</h2>
      <b class="num">${dinero(pc.reduce((s, v) => s + totalVenta(v), 0))}</b></div>
      ${pc.slice(0, 6).map(v => `<button class="alerta" data-act="editarVenta" data-id="${esc(v.id)}"><div class="tx"><b>${esc(v.pac || 'Sin nombre')}</b>
        <div class="d">${esc(fCorta(v.fecha))} · ${esc(v.items.map(i => i.nombre).join(', '))}</div></div>
        <span class="pill warn num">${dinero(totalVenta(v))}</span></button>`).join('')}
    </section>` : ''}
    ${!productos().length ? `<section class="card"><h2 class="titulo-seccion">Agrega tus primeros productos</h2>
      <div class="acc-grid"><button class="btn" data-act="nuevoProd" data-tipo="venta">${IC.mas} Para vender</button>
        <button class="btn gold" data-act="nuevoProd" data-tipo="uso">${IC.mas} Uso en spa</button></div>
      ${nombre === 'Jonathan' ? '<button class="btn ghost" data-act="recibir">Recibir el inventario de Elba</button>' : ''}</section>` : ''}
    ${invitacionInstalar()}
    <button class="link ajustes-inicio" data-act="ajustes">${IC.ajustes} Ajustes</button>
  </div>`;
}

const ORDEN_INVENTARIO = {nombre:'Por nombre', stock:'Menor stock', venta:'Última venta'};
const observadorFotosInventario = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entradas => {
    for(const {target, isIntersecting} of entradas){
      if(!isIntersecting) continue;
      observadorFotosInventario.unobserve(target);
      cargarFoto($('img[data-foto]', target));
    }
  }, {rootMargin:'240px 0px'})
  : null;

function prepararFotosInventario(lista){
  observadorFotosInventario?.disconnect();
  if(!lista) return;
  if(!observadorFotosInventario){ cargarFotos(lista); return; }
  for(const img of $$('img[data-foto]', lista)){
    // Observamos la fila aunque el navegador todavía omita pintar su contenido.
    const fila = img.closest('.fila-lista');
    observadorFotosInventario.observe(fila);
  }
}

function resumenInventario(ps, tipo){
  const porUnidad = new Map();
  let total = 0, valor = 0;
  for(const p of ps){
    const s = Math.max(0, stockDe(p.id));
    const unidad = p.unidad || 'unidades';
    if(s > 0) porUnidad.set(unidad, (porUnidad.get(unidad) || 0) + s);
    total += s;
    valor += s * ((tipo === 'venta' ? p.precio : p.costo) || 0);
  }
  const medidas = porUnidad.has('ml') || porUnidad.has('g');
  const porSeparado = porUnidad.size > 1 && (tipo === 'uso' || medidas);
  const unidad = porUnidad.size === 1 && (tipo === 'uso' || medidas) ? porUnidad.keys().next().value : 'unidades';
  const cantidades = porSeparado
    ? `<details class="cifra cantidades-inventario">
      <summary><span class="l">Cantidades</span><span class="ver-unidades">Ver por unidad ${IC.siguiente}</span></summary>
      <ul>${[...porUnidad].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([u, n]) =>
        `<li>${fCant(n)} ${esc(uTxt(n, u))}</li>`).join('')}</ul>
    </details>`
    : `<div class="cifra"><span class="l">${esc(unidad === 'ml' || unidad === 'g' ? unidad : cap(unidad))}</span><span class="v num">${fCant(total)}</span></div>`;
  return `<div class="cifras estadisticas-inventario">
    ${cantidades}
    <div class="cifra"><span class="l">${tipo === 'uso' ? 'Valor a costo' : 'Valor a precio de venta'}</span><span class="v num">${dinero(valor)}</span></div>
  </div>`;
}

function vLista(tipo){
  const ps = productos(tipo);
  const cats = [...new Set(ps.map(p => p.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const filtros = [['todos', 'Todos'], ['stock', '<span class="indicador" aria-hidden="true"></span>Por terminarse'],
    ['fecha', '<span class="indicador vence" aria-hidden="true"></span>Vencen pronto'], ...cats.map(c => ['cat:' + c, esc(c)])];
  return `<header class="top inventario-cab"><h1>Inventario</h1>
      <button class="btn sm" data-act="nuevoProd" data-tipo="${tipo}">${IC.mas} Producto</button></header>
    <div class="seg" role="group" aria-label="Tipo de inventario">
      ${[['venta','Para vender'], ['uso', 'Uso en spa']].map(([t, texto]) =>
        opcion('tab', t, texto + ' · ' + (tipo === t ? ps.length : productos(t).length), tipo === t, '', `data-tab="${t}"`)).join('')}
    </div>
    ${buscador('Buscar en el inventario', {id:'qProd', valor:U.q[tipo], escaneo:tipo})}
    <div class="chips scroll filtros-inventario" data-tipo="${tipo}" role="group" aria-label="Filtrar productos">
      ${filtros.map(([f, texto]) => opcion('filtro', f, texto, U.filtro[tipo] === f, 'chip')).join('')}
    </div>
    ${resumenInventario(ps, tipo)}
    <div class="controles-inventario">
      <button class="link" data-act="compras">${IC.bolsa} Lista de compras</button>
      <button class="link" data-act="conteo" ${E.conteo ? 'aria-label="Retomar conteo"' : ''}>${IC.conteo} ${E.conteo ? 'Retomar' : 'Contar'}</button>
      <button class="link" data-act="etiquetasQR">${IC.etiqueta} Etiquetas QR</button>
      <label class="orden-inventario"><span class="solo-lectura">Ordenar dentro de cada marca</span>
        <select id="ordenProd">
          ${Object.entries(ORDEN_INVENTARIO).map(([v, nombre]) =>
            `<option value="${v}"${U.orden[tipo] === v ? ' selected' : ''}>${nombre}</option>`).join('')}
        </select></label>
    </div>
    <div id="listaProd" class="lista-productos">${listaHTML(tipo, ps)}</div>`;
}
function coincideProducto(p, q){
  return norm([p.nombre, p.marca, p.cat, p.codigo].filter(Boolean).join(' ')).includes(q);
}
function pintarListaProductos(){
  const lista = $('#listaProd');
  lista.innerHTML = listaHTML(U.tab);
  prepararFotosInventario(lista);
}
function ultimasVentasPorProducto(){
  const fechas = new Map();
  for(const v of vivos(E.ventas)){
    for(const i of v.items){
      if(v.fecha > (fechas.get(i.prod) || '')) fechas.set(i.prod, v.fecha);
    }
  }
  return fechas;
}
function listaHTML(tipo, todos = productos(tipo)){
  const q = norm(U.q[tipo]), f = U.filtro[tipo], grupos = new Map();
  for(const p of todos){
    if(!coincideProducto(p, q)) continue;
    if(f === 'stock' && !avisosDe(p).some(a => a.clase === 'stock')) continue;
    if(f === 'fecha' && !avisosDe(p).some(a => a.clase === 'fecha' && a.nivel === 'warn')) continue;
    if(f.startsWith('cat:') && p.cat !== f.slice(4)) continue;
    const marca = p.marca?.trim() || 'Sin marca';
    if(!grupos.has(marca)) grupos.set(marca, []);
    grupos.get(marca).push(p);
  }
  if(!todos.length) return `<div class="vacio card">${tipo === 'venta' ? 'Aquí tendrás tus productos para vender.' : 'Aquí tendrás los insumos que usas en el spa.'} Toca «Producto» para agregar el primero.</div>`;
  if(!grupos.size) return '<div class="vacio">No hay productos con ese filtro.</div>';
  const orden = U.orden[tipo];
  const ultimasVentas = orden === 'venta' ? ultimasVentasPorProducto() : null;
  return [...grupos].sort(([a, ps], [b, otros]) => otros.length - ps.length || a.localeCompare(b, 'es')).map(([marca, ps]) => {
    // La lista de partida ya está ordenada por nombre. Ese orden resuelve los empates.
    if(orden === 'stock') ps.sort((a, b) => stockDe(a.id) - stockDe(b.id));
    if(ultimasVentas) ps.sort((a, b) => (ultimasVentas.get(b.id) || '').localeCompare(ultimasVentas.get(a.id) || ''));
    return `<section class="grupo-productos"><h2>${esc(marca)}</h2><div class="filas">${ps.map(p => filaProducto(p)).join('')}</div></section>`;
  }).join('');
}
function pildoraStock(p, avs = avisosDe(p)){
  const s = stockDe(p.id), cantidad = fCant(s);
  const bajo = s <= (p.min || 0);
  const fechas = avs.filter(a => a.clase === 'fecha');
  const estado = bajo || fechas.some(a => a.nivel === 'bad') ? 'bad' : fechas.length ? 'warn' : 'ok';
  const texto = s <= 0 ? 'Agotado' : bajo ? `${s === 1 ? 'Queda' : 'Quedan'} ${cantidad}` : cantidad;
  return `<span class="pill stock ${estado}" title="${cantidad} ${esc(uTxt(s, p.unidad))}">${texto}</span>`;
}
const textoStock = s => s <= 0 ? 'Agotado' : `${s === 1 ? 'Queda' : 'Quedan'} ${fCant(s)}`;
function filaProducto(p, accion = 'verProd', mostrarMarca = false){
  const [nombre, ...presentacion] = p.nombre.split(' · ');
  const avs = avisosDe(p);
  const aviso = avs.find(a => a.clase === 'fecha') || avs.find(a => a.clase === 'stock' && a.nivel === 'warn');
  const precio = p.tipo === 'venta' && p.precio ? `<span class="sin-salto">${dinero(p.precio)}</span>` : '';
  const sub = [mostrarMarca ? esc(p.marca) : '', ...presentacion.map(esc), precio,
    esc(aviso ? textoAviso(aviso) : !presentacion.length && p.tipo === 'uso' ? singular(p.unidad) : '')].filter(Boolean).join(' · ');
  return `<button class="fila-lista" data-act="${accion}" data-id="${esc(p.id)}">${avatar(p)}
    <span class="tx"><b>${esc(nombre)}</b>${sub ? `<span class="m">${sub}</span>` : ''}</span>
    ${pildoraStock(p, avs)}</button>`;
}

// ---------- Reportes ----------
const SECCIONES_REPORTE = {ventas:'Ventas', cabina:'Cabina', inventario:'Inventario'};
const nombreMes = mes => cap(MESES[Number(mes.slice(5)) - 1]) + ' ' + mes.slice(0, 4);
const finMes = mes => sumarDias(sumarMeses(mes + '-01', 1), -1);
const ventasDelMes = mes => vivos(E.ventas).filter(v => v.fecha.startsWith(mes));
const ORDEN_REPORTE = (a, b) => b.monto - a.monto || b.cant - a.cant || a.nombre.localeCompare(b.nombre, 'es');

function acumularReporte(grupo, id, nombre, unidad, cant, monto){
  if(!grupo.has(id)) grupo.set(id, {nombre, unidad, cant:0, monto:0});
  const fila = grupo.get(id);
  fila.cant = red(fila.cant + cant);
  fila.monto += monto;
}
function datosReporteVentas(mes){
  const ventas = ventasDelMes(mes);
  const {total, ganancia} = cifrasVentas(ventas);
  const ultimo = Number(finMes(mes).slice(-2));
  const semanas = Array.from({length:Math.ceil(ultimo / 7)}, (_, i) =>
    ({inicio:i * 7 + 1, fin:Math.min((i + 1) * 7, ultimo), monto:0}));
  const formas = new Map(PAGOS.map(p => [norm(p), {nombre:p, cant:0, monto:0}]));
  const sinForma = {nombre:'Sin forma de pago', cant:0, monto:0};
  const pendiente = {nombre:'Por cobrar', cant:0, monto:0};
  const pacientes = new Set(), masVendidos = new Map();
  for(const v of ventas){
    const importe = totalVenta(v);
    semanas[Math.floor((Number(v.fecha.slice(-2)) - 1) / 7)].monto += importe;
    const pago = v.cobrado ? formas.get(norm(v.pago)) || sinForma : pendiente;
    pago.cant++;
    pago.monto += importe;
    if(norm(v.pac)) pacientes.add(norm(v.pac));
    for(const it of v.items) acumularReporte(masVendidos, it.prod, it.nombre, 'u.', it.cant, it.cant * it.precio);
  }
  return {total, ganancia, cantidad:ventas.length, promedio:ventas.length ? red(total / ventas.length) : 0,
    semanas, pagos:[...formas.values(), sinForma, pendiente].filter(p => p.cant),
    productos:[...masVendidos.values()].sort(ORDEN_REPORTE), pacientes:pacientes.size,
    descuentos:ventas.some(v => v.descuento > 0)};
}
function datosReporteCabina(mes, catalogo){
  const usados = new Map();
  let gasto = 0, terminados = 0, sinCostoGuardado = false;
  for(const m of vivos(E.movs)){
    if(m.tipo !== 'uso' || m.cant >= 0 || !m.fecha.startsWith(mes)) continue;
    const p = catalogo.get(m.prod), cant = -m.cant;
    // Los usos antiguos podían guardar la cantidad sin guardar el costo.
    const monto = cant * (m.costo ?? p?.costo ?? 0);
    if(m.costo == null) sinCostoGuardado = true;
    gasto += monto;
    if(frascoTerminado(m)) terminados += cant;
    acumularReporte(usados, m.prod, p?.nombre || 'Producto sin ficha', p?.unidad || 'unidades', cant, monto);
  }
  return {gasto:red(gasto), terminados, sinCostoGuardado, productos:[...usados.values()].sort(ORDEN_REPORTE)};
}
function datosReporteInventario(mes, catalogo){
  const hoy = hoyISO();
  const corte = hoy.startsWith(mes) ? hoy : finMes(mes);
  const desde = sumarDias(corte, -59), hasta = sumarDias(corte, 90);
  const existencias = new Map(), recientes = new Set();
  for(const m of vivos(E.movs)){
    if(m.fecha > corte) continue;
    existencias.set(m.prod, (existencias.get(m.prod) || 0) + m.cant);
    if(m.cant !== 0 && m.fecha >= desde) recientes.add(m.prod);
  }
  let costo = 0, precio = 0;
  const quietos = [], vencen = [];
  for(const p of catalogo.values()){
    const cant = red(existencias.get(p.id) || 0);
    if(p.borrado || cant <= 0) continue;
    const monto = cant * (p.costo || 0);
    costo += monto;
    if(p.tipo === 'venta') precio += cant * (p.precio || 0);
    const fila = {id:p.id, nombre:p.nombre, cant, unidad:p.unidad || 'unidades', monto, fecha:p.vence};
    if(!recientes.has(p.id)) quietos.push(fila);
    if(p.vence >= corte && p.vence <= hasta) vencen.push(fila);
  }
  return {corte, costo:red(costo), precio:red(precio), quietos:quietos.sort(ORDEN_REPORTE),
    vencen:vencen.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, 'es'))};
}
function datosReporte(){
  const {mes, reporte} = U;
  const catalogo = new Map(E.productos.map(p => [p.id, p]));
  const cabina = reporte !== 'inventario' ? datosReporteCabina(mes, catalogo) : null;
  if(reporte === 'cabina') return cabina;
  if(reporte === 'inventario') return datosReporteInventario(mes, catalogo);
  return {...datosReporteVentas(mes), gastoCabina:cabina.gasto};
}
function cifraReporte(etiqueta, valor, detalle = '', clase = ''){
  return `<div class="cifra ${clase}"><span class="l">${etiqueta}</span><b class="v num">${valor}</b>
    ${detalle ? `<span class="nota-cifra">${detalle}</span>` : ''}</div>`;
}
function filaReporte(etiqueta, valor, icono){
  return `<li class="dato-ficha">${icono ? `<span class="dato-ico">${IC[icono]}</span>` : ''}
    <span>${esc(etiqueta)}</span><b class="num">${valor}</b></li>`;
}
function barrasReporte(titulo, filas, nota = ''){
  const maximo = filas[0]?.monto || 1;
  return `<section class="card tarjeta-reporte"><h2>${titulo}</h2>
    ${nota ? `<p class="nota-reporte">${nota}</p>` : ''}
    ${filas.length ? `<ul class="lista-reporte ranking-reporte">${filas.slice(0, 4).map(f => `<li>
      <div><strong>${esc(f.nombre)}</strong><span>${fCant(f.cant)} ${esc(uTxt(f.cant, f.unidad))} · <b class="num">${dinero(f.monto)}</b></span></div>
      <i style="--proporcion:${Math.max(0, f.monto / maximo * 100)}%" aria-hidden="true"></i></li>`).join('')}</ul>` :
      '<p class="nota-reporte">Todavía no hay registros en este mes.</p>'}</section>`;
}
function reporteVentasHTML(r){
  const maximo = Math.max(0, ...r.semanas.map(s => s.monto)) || 1;
  const actual = hoyISO().startsWith(U.mes) ? Math.floor((Number(hoyISO().slice(-2)) - 1) / 7) : -1;
  return `${r.cantidad ? '' : `<div class="card vacio no-imprimir-reporte"><p>Todavía no hay ventas este mes. Las ventas que registres se agrupan por su fecha.</p></div>`}
  <div class="cifras cifras-reporte">
    ${cifraReporte('Vendido', dinero(r.total))}
    ${cifraReporte('Ganancia', dinero(r.ganancia), r.total > 0 ? fCant(red(r.ganancia / r.total * 1000) / 10) + ' % del total' : '',
      r.ganancia < 0 ? 'perdida-reporte' : 'ganancia-reporte')}
    ${cifraReporte('Ventas', fCant(r.cantidad))}
    ${cifraReporte('Venta promedio', dinero(r.promedio))}
  </div>
  ${r.cantidad ? `<section class="card tarjeta-reporte">
    <h2 id="ventasPorSemana">Ventas por semana</h2>
    <ul class="lista-reporte semanas-reporte" aria-labelledby="ventasPorSemana">
      ${r.semanas.map((s, i) => `<li class="${i === actual ? 'semana-actual' : ''}" title="Del ${s.inicio} al ${s.fin}">
        <span class="solo-lectura">Días ${s.inicio} a ${s.fin} · ${dinero(s.monto)}</span>
        <strong class="num" aria-hidden="true">${dinero(s.monto)}</strong>
        <i aria-hidden="true" style="--alto-barra:${Math.max(2, Math.round(s.monto / maximo * 130))}px"></i>
        <span aria-hidden="true">S${i + 1}</span>
      </li>`).join('')}
    </ul>
  </section>
  ${barrasReporte('Lo más vendido', r.productos, r.descuentos ? 'Montos antes de los descuentos.' : '')}` : ''}
  <ul class="card lista-reporte totales-reporte" aria-label="Otros datos del mes">
    ${filaReporte('Gasto en cabina', dinero(r.gastoCabina), 'gota')}
    ${filaReporte('Pacientes que compraron', fCant(r.pacientes), 'pacientes')}
  </ul>
  ${r.pagos.length ? `<section class="card tarjeta-reporte">
    <h2>Formas de pago</h2>
    <ul class="lista-reporte totales-reporte">${r.pagos.map(p => filaReporte(p.nombre, dinero(p.monto))).join('')}</ul>
  </section>` : ''}`;
}
function reporteCabinaHTML(r){
  return `<div class="cifras cifras-reporte">
    ${cifraReporte('Gasto en cabina', dinero(r.gasto))}
    ${cifraReporte('Frascos terminados', fCant(r.terminados))}
  </div>
  ${barrasReporte('Lo que más se gastó', r.productos,
    r.sinCostoGuardado ? 'Para usos antiguos sin costo registrado se usa el costo actual.' : '')}`;
}
function listaReporteInventario(titulo, filas, vacio, porVencer = false){
  return `<section class="card tarjeta-reporte"><h2>${titulo}</h2>
    ${filas.length ? `<ul class="lista-reporte inventario-reporte-lista">${filas.map(f => `<li>
      <button data-act="verProd" data-id="${esc(f.id)}">
        <strong>${esc(f.nombre)}</strong>
        <span>${fCant(f.cant)} ${esc(uTxt(f.cant, f.unidad))}${porVencer ? ' · Vence el ' + fCorta(f.fecha) : ' · ' + dinero(f.monto)}</span>
        ${IC.siguiente}
      </button></li>`).join('')}</ul>` : `<p class="nota-reporte">${vacio}</p>`}</section>`;
}
function reporteInventarioHTML(r){
  return `<div class="cifras cifras-reporte">
    ${cifraReporte('Valor a costo', dinero(r.costo))}
    ${cifraReporte('Valor a precio de venta', dinero(r.precio))}
  </div>
  <p class="nota-reporte">Existencias al ${fCorta(r.corte)}. Los costos, precios y vencimientos vienen del catálogo actual.</p>
  ${listaReporteInventario('Sin movimiento en 60 días', r.quietos, 'No hay productos con existencias paradas.')}
  ${listaReporteInventario('Vencen en los próximos 90 días', r.vencen, 'No hay productos por vencer en ese plazo.', true)}`;
}
function vReportes(){
  const {mes, reporte} = U, r = datosReporte(), titulo = SECCIONES_REPORTE[reporte];
  const contenido = {ventas:reporteVentasHTML, cabina:reporteCabinaHTML, inventario:reporteInventarioHTML}[reporte](r);
  const enlace = waLink('', textoReporte(r));
  return `<section class="reporte" aria-label="Reportes">
    <header class="top no-imprimir-reporte"><h1>Reportes</h1></header>
    <div class="mes no-imprimir-reporte">
      <button data-act="mes" data-d="-1" aria-label="Mes anterior">${IC.volver}</button>
      <b>${nombreMes(mes)}</b>
      <button data-act="mes" data-d="1" aria-label="Mes siguiente" ${mes >= hoyISO().slice(0, 7) ? 'disabled' : ''}>${IC.siguiente}</button>
    </div>
    <div class="seg no-imprimir-reporte" role="group" aria-label="Tipo de reporte">
      ${Object.entries(SECCIONES_REPORTE).map(([v, n]) => opcion('tipoReporte', v, n, reporte === v)).join('')}
    </div>
    <header class="cab-impresion-reporte">
      <img src="logo-completo.png" alt="SPARATI" width="480" height="520">
      <div><h1>Reporte de ${titulo.toLowerCase()}</h1><p>${nombreMes(mes)}</p></div>
    </header>
    ${contenido}
    <div class="acciones-reporte no-imprimir-reporte" role="group" aria-label="Compartir reporte de ${titulo.toLowerCase()}">
      <button class="btn" data-act="imprimirReporte">${IC.pdf} Descargar PDF</button>
      <a class="btn soft" href="${esc(enlace)}" target="_blank" rel="noopener">${IC.chat} Enviar por WhatsApp</a>
      <button class="btn ghost" data-act="excelReporte">${IC.etiqueta} Excel</button>
    </div>
  </section>
  ${reporte === 'ventas' ? `<section class="historial-reporte no-imprimir-reporte" aria-labelledby="historialReporte">
    <h2 class="titulo-seccion" id="historialReporte">Historial de ventas</h2>
    ${buscador('Buscar por paciente o producto', {id:'qVentas', valor:U.qVentas})}
    <div id="listaVentas" class="lista-productos">${listaVentasHTML()}</div>
  </section>` : ''}`;
}
function textoReporte(r){
  const tipo = U.reporte;
  const lineas = [`SPARATI · ${SECCIONES_REPORTE[tipo]} · ${nombreMes(U.mes)}`];
  if(tipo === 'ventas'){
    lineas.push(`Vendido: ${dinero(r.total)}`, `Ganancia: ${dinero(r.ganancia)}`,
      `Ventas: ${r.cantidad} · Promedio: ${dinero(r.promedio)}`, `Pacientes que compraron: ${r.pacientes}`,
      `Gasto en cabina: ${dinero(r.gastoCabina)}`,
      ...r.pagos.map(p => `${p.nombre}: ${dinero(p.monto)}`));
  }else if(tipo === 'cabina'){
    lineas.push(`Gasto en cabina: ${dinero(r.gasto)}`, `Frascos terminados: ${r.terminados}`);
    if(r.sinCostoGuardado) lineas.push('Para usos antiguos sin costo registrado se usa el costo actual.');
  }else{
    lineas.push(`Existencias al ${fCorta(r.corte)}`, `Valor a costo: ${dinero(r.costo)}`,
      `Valor a precio de venta: ${dinero(r.precio)}`,
      `Productos sin movimiento en 60 días: ${r.quietos.length}`,
      `Productos que vencen en los próximos 90 días: ${r.vencen.length}`);
  }
  if(r.productos?.length){
    const titulo = tipo === 'cabina' ? 'Lo que más se gastó' : 'Lo más vendido';
    lineas.push('', titulo, ...r.productos.slice(0, 3).map(p => `• ${p.nombre}: ${fCant(p.cant)} ${uTxt(p.cant, p.unidad)}`));
  }
  return lineas.join('\n');
}
function filasCSVReporte(r){
  const mes = U.mes;
  const filas = [['Sección', 'Concepto', 'Fecha o período', 'Cantidad', 'Unidad', 'Monto (USD)']];
  const fila = (seccion, concepto, {fecha = mes, cant = '', unidad = '', monto = ''} = {}) => {
    filas.push([seccion, concepto, fecha, cant, unidad, typeof monto === 'number' ? red(monto).toFixed(2).replace('.', ',') : monto]);
  };
  const productos = (seccion, lista) => lista.forEach(p => fila(seccion, p.nombre, p));
  if(U.reporte === 'ventas'){
    fila('Ventas', 'Vendido', {monto:r.total});
    fila('Ventas', 'Ganancia', {monto:r.ganancia});
    fila('Ventas', 'Ventas', {cant:r.cantidad});
    fila('Ventas', 'Venta promedio', {monto:r.promedio});
    fila('Ventas', 'Pacientes que compraron', {cant:r.pacientes});
    fila('Ventas', 'Gasto en cabina', {monto:r.gastoCabina});
    r.semanas.forEach((s, i) => fila('Ventas por semana', `Semana ${i + 1} · días ${s.inicio} a ${s.fin}`, s));
    productos(r.descuentos ? 'Lo más vendido antes de descuentos' : 'Lo más vendido', r.productos);
    r.pagos.forEach(p => fila('Formas de pago', p.nombre, p));
  }else if(U.reporte === 'cabina'){
    fila('Cabina', 'Gasto en cabina', {monto:r.gasto});
    fila('Cabina', 'Frascos terminados', {cant:r.terminados});
    if(r.sinCostoGuardado) fila('Cabina', 'Para usos antiguos sin costo registrado se usa el costo actual.');
    productos('Lo que más se gastó', r.productos);
  }else{
    fila('Inventario', 'Valor a costo', {fecha:r.corte, monto:r.costo});
    fila('Inventario', 'Valor a precio de venta', {fecha:r.corte, monto:r.precio});
    fila('Inventario', 'Costos, precios y vencimientos del catálogo actual.', {fecha:r.corte});
    fila('Inventario', 'Productos sin movimiento en 60 días', {fecha:r.corte, cant:r.quietos.length});
    fila('Inventario', 'Productos que vencen en los próximos 90 días', {fecha:r.corte, cant:r.vencen.length});
    productos('Sin movimiento en 60 días', r.quietos.map(p => ({...p, fecha:r.corte})));
    productos('Vencen en los próximos 90 días', r.vencen);
  }
  return filas;
}
function celdaCSVReporte(valor, columna){
  if(typeof valor === 'number') return fCant(valor);
  // Excel interpreta ciertos textos como fórmulas. La columna de montos contiene números ya formateados.
  const texto = columna !== 5 && /^(?:[\t\r\n]|\s*[=+@-])/.test(valor) ? "'" + valor : valor;
  return /[;"\r\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
}
function descargarReporteCSV(){
  const filas = filasCSVReporte(datosReporte()).map(f => f.map(celdaCSVReporte).join(';'));
  const archivo = new Blob(['\uFEFF', filas.join('\r\n'), '\r\n'], {type:'text/csv;charset=utf-8'});
  descargarArchivo(archivo, `sparati-${U.reporte}-${U.mes}.csv`);
}
function listaVentasHTML(){
  const q = norm(U.qVentas);
  const vs = q ? vivos(E.ventas).filter(v => norm(v.pac + ' ' + v.items.map(i => i.nombre).join(' ')).includes(q)) : ventasDelMes(U.mes);
  vs.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
  if(!vs.length) return `<div class="vacio">${q ? 'No hay ventas con esa búsqueda. Prueba con otro nombre o producto.' : 'Las ventas que registres este mes aparecerán aquí.'}</div>`;
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
function movimientosDelProducto(id){
  return vivos(E.movs).filter(m => m.prod === id).reverse()
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0));
}
function verProd(id){
  const d = abrirCapa('', {tipo:'prod', cls:'hoja ficha-producto'});
  d.dataset.id = id;
  pintarProd(d);
}
function pintarProd(d){
  const p = prodPorId(d.dataset.id);
  if(!p || p.borrado){ cerrarCapa(); return; }
  const scroll = $('.hoja-cuerpo', d)?.scrollTop || 0;
  const foco = d.contains(document.activeElement) ? document.activeElement : null;
  const s = stockDe(p.id), avs = avisosDe(p), c = CONSUMO.get(p.id);
  const movs = movimientosDelProducto(p.id);
  d.dataset.inventario = p.tipo;
  d.innerHTML = p.tipo === 'venta' ? fichaVenta(p, s, avs, c, movs) : fichaCabina(p, s, avs, c, movs);
  d.setAttribute('aria-label', p.nombre);
  if(pila.at(-1)?.el === d) activarCapa();
  cargarFotos(d);
  $('.hoja-cuerpo', d).scrollTop = scroll;
  if(foco && !enfocarControl(foco, d)){
    ($('[data-act="abrirFrasco"]:not(:disabled)', d) || d).focus({preventScroll:true});
  }
}
function estructuraFicha(p, contenido){
  const id = esc(p.id), [nombre, ...presentacion] = p.nombre.split(' · ');
  const titulo = esc(nombre) + (presentacion.length ? `<span class="solo-lectura"> · ${esc(presentacion.join(' · '))}</span>` : '');
  const venta = p.tipo === 'venta';
  return `<div class="hoja-cuerpo"><div class="ficha-portada">
    ${avatar(p, `foto-ficha${p.foto ? ' con-foto' : ''}`)}
    <div class="ficha-controles"><button class="icon-btn" data-act="cerrar" aria-label="Volver">${IC.volver}</button>
      <button class="icon-btn" data-act="editarProd" data-id="${id}" aria-label="Editar producto">${IC.lapiz}</button></div>
    </div><div class="hoja-in ficha-contenido">
    <header class="ficha-cab"><div class="chips"><span class="pill ${venta ? 'acc' : 'ok'}">${venta ? 'Para vender' : 'Uso en spa'}</span>${p.cat ? `<span class="pill gold">${esc(p.cat)}</span>` : ''}</div>
      <h1>${titulo}</h1>${p.marca || presentacion.length ? `<p>${esc([p.marca, ...presentacion].filter(Boolean).join(' · '))}</p>` : ''}</header>
    ${contenido}</div></div>`;
}
function venceFicha(p){
  const fecha = p.vence ? aFecha(p.vence) : null;
  const vence = fecha ? `<time datetime="${esc(p.vence)}" title="${esc(fCorta(p.vence))}">${MESES_C[fecha.getMonth()]} ${fecha.getFullYear()}</time>` : 'Sin fecha';
  return p.lote ? `${vence} · lote ${esc(p.lote)}` : vence;
}
function avisosFechaFicha(avisos){
  const fechas = avisos.filter(a => a.clase === 'fecha');
  return fechas.length ? `<div class="chips avisos-fecha-ficha">${fechas.map(a => `<span class="pill ${a.nivel}">${esc(textoAviso(a))}</span>`).join('')}</div>` : '';
}
function historialFicha(movs, fila){
  return `<section class="historial-ficha" aria-label="Historial"><h2 class="titulo-seccion">Historial</h2>
    ${movs.length ? `<ol class="card linea-tiempo" role="list">${movs.map(fila).join('')}</ol>` : '<div class="card muted">Aún no hay movimientos.</div>'}</section>`;
}
function fichaVenta(p, s, avisos, consumo, movs){
  const id = esc(p.id);
  const stock = avisos.find(a => a.clase === 'stock');
  const nivel = stock?.nivel || 'ok';
  const estado = s <= 0 ? 'Agotado' : stock ? 'Por terminarse' : 'Disponible';
  const escala = p.max > 0 ? p.max : Math.max(5, 2 * (p.min || 0) + 1);
  const llenos = Math.max(0, Math.min(5, Math.ceil(5 * s / escala)));
  const dias = consumo && Math.max(1, Math.round(s / consumo));
  const prediccion = s > 0 && consumo ?
    `Vendes unos <b>${fCant(consumo * 30)} al mes</b> y se acabaría en <b>~${dias} ${dias === 1 ? 'día' : 'días'}</b>.` :
    s > 0 ? 'Con más ventas podremos estimar cuánto durará.' : '';
  const avisoMin = p.min > 0 ? `Te aviso cuando ${p.min === 1 ? 'quede' : 'queden'} ${fCant(p.min)}.` : '';
  const ventas = new Map(vivos(E.ventas).filter(v => v.items.some(i => i.prod === p.id)).map(v => [v.id, v]));
  const compradoras = new Set([...ventas.values()].map(v => norm(v.pac)).filter(Boolean));
  for(const m of movs) if(m.tipo === 'venta' && !m.venta && norm(m.pac)) compradoras.add(norm(m.pac));
  const costo = p.costo || 0, precio = p.precio || 0;
  const margen = precio > 0 && costo > 0 ? red(precio - costo) : null;
  const datos = [
    p.duraPac && ['A la paciente le dura', `Unos ${p.duraPac} días`],
    p.pao && ['Dura abierto', `${p.pao} ${p.pao === 1 ? 'mes' : 'meses'}`],
    p.abierto && ['Se abrió', fCorta(p.abierto)],
    p.prov && ['Proveedor', [p.prov, p.telProv].filter(Boolean).join(' · ')],
    p.notas && ['Notas', p.notas],
  ].filter(Boolean);
  return estructuraFicha(p, `
    <section class="card stock-ficha ${nivel}" aria-label="Existencias">
      <div class="det-stock"><span class="q num">${fCant(s)}</span><span class="u">${p.unidad && p.unidad !== 'unidades' ? esc(uTxt(s, p.unidad)) + ' ' : ''}en stock</span><span class="pill ${nivel}">${estado}</span></div>
      <div class="barra-stock" aria-hidden="true">${'<span class="lleno"></span>'.repeat(llenos)}${'<span></span>'.repeat(5 - llenos)}</div>
      ${prediccion || avisoMin ? `<p>${prediccion} ${avisoMin}</p>` : ''}
      ${avisosFechaFicha(avisos)}
    </section>
    <div class="acciones-ficha" role="group" aria-label="Acciones del producto">
      <button class="btn" data-act="vender" data-id="${id}">${IC.bolsa} Vender</button>
      <button class="btn soft" data-act="entrada" data-id="${id}">${IC.entrada} Llegó más</button>
      <button class="btn ghost" data-act="ajuste" data-id="${id}" aria-label="Ajustar cantidad">${IC.ajustes}</button>
    </div>
    <div class="precios-ficha" role="group" aria-label="Precios del producto">
      <div class="cifra"><span class="l">Precio</span><b class="v num">${precio ? dinero(precio) : '—'}</b></div>
      <div class="cifra"><span class="l">Costo</span><b class="v num">${costo ? dinero(costo) : '—'}</b></div>
      <div class="cifra ganancia${margen < 0 ? ' negativa' : ''}"><span class="l">Ganancia</span><b class="v num">${margen === null ? '—' : dinero(margen)}</b>
        ${margen === null ? '' : `<span class="porcentaje">${Math.round(margen / precio * 100)} %</span>`}</div>
    </div>
    <section class="card datos-ficha" aria-label="Datos del producto">
      <button class="dato-ficha" data-act="asignarCodigo" data-id="${id}"><span class="dato-ico">${IC.escaneo}</span><span>Código de barras</span>
        <b class="${p.codigo ? '' : 'por-asignar'}">${p.codigo ? 'Asignado' : 'Asignar con la cámara'}</b></button>
      <div class="dato-ficha"><span class="dato-ico">${IC.calendario}</span><span>Vence</span><b>${venceFicha(p)}</b></div>
      <div class="dato-ficha"><span class="dato-ico">${IC.pacientes}</span><span>Lo compran</span><b>${compradoras.size} ${compradoras.size === 1 ? 'paciente' : 'pacientes'}</b></div>
    </section>
    ${historialFicha(movs, m => filaHistorial(m, ventas.get(m.venta)))}
    ${datos.length || p.telProv ? `<section class="card otros-datos-ficha"><h3>Otros datos</h3>
      ${datos.map(([etiqueta, valor]) => `<div class="dato"><span>${esc(etiqueta)}</span><span>${esc(valor)}</span></div>`).join('')}
      ${p.telProv ? `<a class="btn soft" href="${waLink(p.telProv, `Hola, quisiera pedir ${p.nombre}${p.marca ? ' (' + p.marca + ')' : ''}. ¿Tienen disponible?`)}" target="_blank" rel="noopener">Pedir al proveedor por WhatsApp</a>` : ''}
    </section>` : ''}
    ${p.pao ? `<button class="btn ghost" data-act="abrirHoy" data-id="${id}">Lo abrí hoy</button>` : ''}
    <button class="btn danger full" data-act="borrarProd" data-id="${id}">Eliminar producto</button>`);
}
function filaHistorial(m, venta, frasco){
  const cant = fCant(Math.abs(m.cant));
  const cambio = m.cant > 0 ? '+' + cant : m.cant < 0 ? '− ' + cant : 'Sin diferencia';
  const motivo = norm(m.motivo);
  const nombre = m.pac || venta?.pac;
  let titulo, detalle;
  switch(m.tipo){
    case 'venta':
      titulo = nombre ? `Venta a ${nombre}` : 'Venta';
      detalle = [cambio, m.precio != null ? dinero(m.precio) + (m.cant < -1 ? ' c/u' : '') : '', venta?.pago ? cap(venta.pago) : ''];
      break;
    case 'entrada':
      titulo = `${m.cant === 1 ? 'Llegó' : 'Llegaron'} ${cant}`;
      detalle = [m.costo > 0 ? `Costo ${dinero(m.costo)} c/u` : ''];
      break;
    case 'ajuste':
      titulo = motivo === 'conteo' ? 'Conteo de inventario' : 'Ajuste de inventario';
      detalle = [cambio, motivo === 'conteo' ? '' : etiquetaMotivo(m.motivo)];
      break;
    case 'inicial': titulo = 'Cantidad inicial'; detalle = [cant]; break;
    case 'uso':
      titulo = frascoTerminado(m) ? 'Se terminó un frasco' : 'Uso en tratamiento';
      detalle = [frasco || cambio, m.trat, m.pac, frascoTerminado(m) ? '' : etiquetaMotivo(m.motivo)];
      break;
    case 'apertura': titulo = 'Abrí uno nuevo'; detalle = [frasco]; break;
    default: titulo = m.tipo; detalle = [cambio];
  }
  detalle.push(m.nota, m.por);
  return `<li class="paso-historial" data-mov="${frascoTerminado(m) ? 'terminado' : esc(m.tipo)}"><time datetime="${esc(m.fecha)}">${esc(fCorta(m.fecha))}</time>
    <b>${esc(titulo)}</b>${detalle.some(Boolean) ? `<p>${esc(detalle.filter(Boolean).join(' · '))}</p>` : ''}</li>`;
}
const etiquetaMotivo = motivo => Object.hasOwn(MOTIVOS, motivo) ? MOTIVOS[motivo] : motivo;
const esPorFrasco = p => p?.tipo === 'uso' && p.unidad === 'frascos';
const frascoTerminado = m => m.tipo === 'uso' && m.cant === -1 && m.motivo === 'terminado';
const duracionDias = dias => `${fCant(dias)} ${dias === 1 ? 'día' : 'días'}`;
const movimientoApertura = (prod, fecha) => marcar({id:uid(), prod, fecha, tipo:'apertura', cant:0}, true);

function aperturaVigente(movs){
  const ultimo = movs.find(m => m.tipo === 'apertura' || frascoTerminado(m));
  return ultimo?.tipo === 'apertura' ? ultimo : null;
}

// La ficha recibe solo los movimientos vigentes, de más reciente a más antiguo.
function rendimientoFrascos(movs){
  let apertura = '', saldo = 0;
  const duraciones = [], detalles = new Map();
  for(const m of movs.slice().reverse()){
    saldo = red(saldo + m.cant);
    if(m.tipo === 'apertura'){
      apertura = m.fecha;
      const cerrados = Math.max(0, saldo - 1);
      detalles.set(m.id, `${cerrados === 1 ? 'Quedó' : 'Quedaron'} ${fCant(cerrados)} sin abrir`);
    }else if(apertura && frascoTerminado(m)){
      // Un frasco abierto y terminado en la misma fecha cuenta como un día de uso.
      const dias = Math.max(1, diasEntre(apertura, m.fecha));
      duraciones.push(dias);
      detalles.set(m.id, `Duró ${duracionDias(dias)}`);
      apertura = '';
    }
  }
  const ultimas = duraciones.slice(-3);
  return {muestras:ultimas.length, promedio:ultimas.length ? ultimas.reduce((suma, dias) => suma + dias, 0) / ultimas.length : 0, detalles};
}

function tarjetaFrasco(p, s, avisos, rendimiento){
  const id = esc(p.id), {promedio, muestras} = rendimiento;
  const abierto = s > 0 ? p.abierto : '', dias = abierto ? Math.max(0, diasDesde(abierto)) : 0;
  const estimado = abierto && promedio ? sumarDias(abierto, Math.round(promedio)) : '';
  const avance = promedio ? Math.min(100, Math.round(dias / promedio * 100)) : 0;
  const fechaEstimada = estimado && new Intl.DateTimeFormat('es-EC', {
    day:'numeric', month:'long', ...(aFecha(estimado).getFullYear() === new Date().getFullYear() ? {} : {year:'numeric'}),
  }).format(aFecha(estimado));
  const estado = abierto ? dias ? `Abierto hace ${duracionDias(dias)}` : 'Abierto hoy' : s > 0 ? 'Sin abrir' : 'Agotado';
  const muestra = muestras === 1 ? 'tu último frasco' : `tus últimos ${muestras} frascos`;
  const diasPromedio = Math.round(promedio);
  const duracion = promedio ? `Un frasco te dura <b>${diasPromedio === 1 ? 'cerca de ' : 'unos '}${duracionDias(diasPromedio)}</b> (${muestras === 1 ? 'según' : 'promedio de'} ${muestra}).` : '';
  const fin = estimado ? `${diasHasta(estimado) < 0 ? 'La fecha estimada fue el' : 'Se acabaría alrededor del'} <b>${esc(fechaEstimada)}</b>.` : '';
  const detalle = abierto ? duracion || 'Cuando anotes que se terminó, podremos estimar cuánto te dura.' :
    s > 0 ? 'Anota cuándo abres un frasco nuevo.' : 'Registra una entrada cuando lleguen más frascos.';
  const sinAbrir = red(Math.max(0, s - (abierto ? 1 : 0)));
  return `<section class="card frasco-en-uso" aria-label="Frasco en uso">
      <div class="frasco-cab"><h2>Frasco en uso</h2><span class="pill ${s <= 0 ? 'bad' : abierto ? 'acc' : 'ok'}">${estado}</span></div>
      ${estimado ? `<div class="barra-frasco" role="progressbar" aria-label="Tiempo estimado transcurrido" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${avance}" style="--avance:${avance}%"><span></span></div>
        <div class="fechas-frasco"><time datetime="${esc(abierto)}">${esc(fCorta(abierto))}</time><time datetime="${estimado}">~${esc(fCorta(estimado))}</time></div>` :
        abierto ? `<div class="fechas-frasco"><time datetime="${esc(abierto)}">Abierto el ${esc(fCorta(abierto))}</time></div>` : ''}
      <p>${detalle}${fin ? ' ' + fin : ''}</p>
      ${avisosFechaFicha(avisos)}
      <div class="acciones-cabina"><button class="btn ghost" data-act="terminarFrasco" data-id="${id}" ${s < 1 || !abierto ? 'disabled' : ''}>Se terminó</button>
        <button class="btn" data-act="abrirFrasco" data-id="${id}" ${s < 1 ? 'disabled' : ''}>${IC.gota} Abrí uno nuevo</button></div>
    </section>
    <div class="cifras resumen-cabina" role="group" aria-label="Existencias y costo">
      <div class="cifra"><span class="l">Sin abrir</span><b class="v num">${fCant(sinAbrir)} ${uTxt(sinAbrir, 'frascos')}</b></div>
      <div class="cifra costo-dia"><span class="l">Costo por día</span><b class="v num">${promedio && p.costo > 0 ? dinero(p.costo / promedio) : '—'}</b>
        ${p.costo > 0 ? `<span>${dinero(p.costo)} el frasco</span>` : ''}</div>
    </div>`;
}

function tarjetaTratamiento(p, s, avisos, consumo){
  const id = esc(p.id), gasto = p.gasto > 0 ? p.gasto : 1;
  const stock = avisos.find(a => a.clase === 'stock');
  return `<section class="card stock-ficha ${stock?.nivel || 'ok'}" aria-label="Existencias">
    <div class="det-stock"><span class="q num">${fCant(s)}</span><span class="u">${esc(uTxt(s, p.unidad))} en stock</span>
      <span class="pill ${stock?.nivel || 'ok'}">${s <= 0 ? 'Agotado' : stock ? 'Por terminarse' : 'Disponible'}</span></div>
    ${consumo ? `<p>Usas unos <b>${fCant(consumo * 30)} ${esc(p.unidad || 'unidades')} al mes</b>.</p>` : ''}
    ${avisosFechaFicha(avisos)}
    <div class="acciones-cabina"><button class="btn" data-act="usarRapido" data-id="${id}">${IC.gota} Usar ${fCant(gasto)} ${esc(uTxt(gasto, p.unidad))}</button>
      <button class="btn ghost" data-act="usar" data-id="${id}">Otra cantidad</button></div>
  </section>`;
}

function fichaCabina(p, s, avisos, consumo, movs){
  const id = esc(p.id), frascos = esPorFrasco(p);
  const rendimiento = frascos ? rendimientoFrascos(movs) : null;
  const proveedor = esc(p.prov || 'Proveedor');
  const fichaProveedor = `<span class="dato-ico">${IC.chat}</span><span>Pedir a</span><b>${proveedor}</b>`;
  const datosExtra = [
    !frascos && p.costo > 0 && ['Costo', `${dinero(p.costo)} por ${singular(p.unidad)}`],
    !frascos && p.abierto && ['Se abrió', fCorta(p.abierto)],
    p.min > 0 && ['Avisar cuando queden', `${fCant(p.min)} ${uTxt(p.min, p.unidad)}`],
    p.notas && ['Notas', p.notas],
  ].filter(Boolean);
  return estructuraFicha(p, `
    ${frascos ? tarjetaFrasco(p, s, avisos, rendimiento) : tarjetaTratamiento(p, s, avisos, consumo)}
    <section class="card datos-ficha" aria-label="Datos del producto">
      ${p.pao > 0 ? `<div class="dato-ficha"><span class="dato-ico">${IC.calendario}</span><span>Abierto dura</span><b>${fCant(p.pao)} ${p.pao === 1 ? 'mes' : 'meses'}</b></div>` : ''}
      <div class="dato-ficha"><span class="dato-ico">${IC.calendario}</span><span>Vence</span><b>${venceFicha(p)}</b></div>
      ${p.telProv ? `<a class="dato-ficha" href="${waLink(p.telProv, `Hola, quisiera pedir ${p.nombre}${p.marca ? ' (' + p.marca + ')' : ''}. ¿Tienen disponible?`)}" target="_blank" rel="noopener">${fichaProveedor}</a>` :
        p.prov ? `<div class="dato-ficha">${fichaProveedor}</div>` : ''}
    </section>
    <div class="acciones-cabina" role="group" aria-label="Acciones de existencias">
      <button class="btn soft" data-act="entrada" data-id="${id}">${IC.entrada} Llegó más</button>
      <button class="btn ghost" data-act="ajuste" data-id="${id}">Ajustar cantidad</button>
      ${!frascos && p.pao > 0 ? `<button class="btn ghost" data-act="abrirHoy" data-id="${id}">Lo abrí hoy</button>` : ''}
    </div>
    ${historialFicha(movs, m => filaHistorial(m, null, rendimiento?.detalles.get(m.id)))}
    ${datosExtra.length ? `<section class="card otros-datos-ficha" aria-label="Otros datos">${datosExtra.map(([etiqueta, valor]) => `<div class="dato"><span>${esc(etiqueta)}</span><span>${esc(valor)}</span></div>`).join('')}</section>` : ''}
    <button class="btn danger full" data-act="borrarProd" data-id="${id}">Eliminar producto</button>`);
}
function telefonoWhatsApp(tel){
  const t = String(tel || '').replace(/\D/g, '');
  if(t.startsWith('00')) return t.slice(2);
  return t.startsWith('0') ? '593' + t.slice(1) : t;
}
function waLink(tel, texto){
  return 'https://wa.me/' + telefonoWhatsApp(tel) + '?text=' + encodeURIComponent(texto);
}
function refrescar(){
  render();
  for(const {el} of pila){
    if(el.dataset.tipo === 'prod') pintarProd(el);
    if(el.dataset.tipo === 'paciente') pintarPaciente(el);
    if(el.dataset.tipo === 'compras') pintarCompras(el);
    if(el.dataset.tipo === 'avisosInicio') pintarAvisosInicio(el);
    if(el.dataset.tipo === 'selectorInicio') pintarSelectorInicio(el);
  }
}
function recargarEstadoSiCambio(){
  try{ if(localStorage.getItem(CLAVE) === estadoGuardado) return false; }
  catch(e){ return false; }
  cargar();
  refrescar();
  return true;
}

// ---------- Formularios (estado F + campos data-f) ----------
let F = null;
function hojaForm(titulo, tipo, pintar, alCerrar){
  const anterior = capaArriba('form')?.formulario || null;
  const formulario = F;
  const d = abrirCapa(cabecera(titulo) + `<div class="hoja-cuerpo"><div class="hoja-in" id="fCuerpo"></div></div>
    <footer class="hoja-pie"><div class="in"><button class="btn ghost" data-act="cerrar">Cancelar</button><button class="btn" data-act="guardarF">Guardar</button></div></footer>`,
    {tipo, alCerrar:() => { alCerrar?.(formulario); F = anterior; }});
  d.formulario = formulario;
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
  const id = op.id || 'campo-' + f;
  const attrs = (op.modo ? ` inputmode="${op.modo}"` : '') + (op.ph ? ` placeholder="${esc(op.ph)}"` : '') + (op.lista ? ` list="${op.lista}"` : '') + (op.max ? ` max="${op.max}"` : '') + (op.codigo ? ' autocapitalize="off" spellcheck="false"' : '') + ' autocomplete="off"';
  const input = op.area ? `<textarea id="${id}" data-f="${f}"${attrs}>${esc(v)}</textarea>` : `<input id="${id}" type="${tipo}" data-f="${f}" value="${esc(v)}"${attrs}>`;
  return `<div class="campo"><label for="${id}">${label}</label>${input}${op.ayuda ? `<span class="ayuda">${op.ayuda}</span>` : ''}</div>`;
}
function pasos(label, f, unidad, item){
  const titulo = label + (unidad ? ' (' + unidad + ')' : '');
  const id = item === undefined ? 'paso-' + f : `paso-${f}-${item}`;
  const attrs = item === undefined ? `data-f="${f}"` : `data-item="${item}" data-c="${f}"`;
  const valor = item === undefined ? F[f] : F.items[item][f];
  return campoCantidad(titulo, id, valor, attrs);
}
function campoCantidad(titulo, id, valor, attrs){
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
function formProd(id, tipo, codigo = ''){
  const p = id ? prodPorId(id) : null;
  F = p ? {id:p.id, tipo:p.tipo, nombre:p.nombre, marca:p.marca || '', cat:p.cat || '', unidad:p.unidad || 'unidades', inicial:'',
      codigo:String(p.codigo ?? ''), min:p.min ? fCant(p.min) : '', max:p.max > 0 ? fCant(p.max) : '',
      costo:dineroIn(p.costo), precio:dineroIn(p.precio), gasto:p.gasto ? fCant(p.gasto) : '', duraPac:p.duraPac || '',
      vence:p.vence || '', lote:p.lote || '', abierto:p.abierto || '', pao:p.pao || '', prov:p.prov || '', telProv:p.telProv || '', notas:p.notas || '', foto:p.foto || '', fotoNueva:null}
    : {id:null, tipo:tipo || 'venta', nombre:'', marca:'', cat:'', unidad:'unidades', inicial:'', codigo, min:'', max:'', costo:'', precio:'', gasto:'1', duraPac:'',
      vence:'', lote:'', abierto:'', pao:'', prov:'', telProv:'', notas:'', foto:'', fotoNueva:null};
  F.guardar = guardarProd;
  hojaForm(p ? 'Editar producto' : 'Nuevo producto', 'form', pintarFormProd, f => { if(f.fotoNueva && !f.guardado) FDB.del(f.fotoNueva).catch(() => {}); });
}
function pintarFormProd(){
  const cu = $('#fCuerpo');
  const cats = [...new Set([...categoriasDe(F.tipo), F.cat].filter(Boolean))];
  const provs = Array.from(new Set(vivos(E.productos).map(p => p.prov).filter(Boolean)));
  const fotoId = F.fotoNueva || F.foto;
  cu.classList.add('form-producto');
  cu.innerHTML = `
    <div class="seg" role="group" aria-label="Tipo de producto">${[['venta','Para vender'], ['uso','Uso en spa']].map(([v, n]) =>
      opcion('fChip', v, n, F.tipo === v, '', 'data-f="tipo"')).join('')}</div>
    <section class="card">
      <div class="foto-campo">${fotoId ? `<span class="av xl"><img data-foto="${esc(fotoId)}" alt=""></span>` : ''}
        <div class="acciones-foto"><button type="button" class="btn sm soft" data-act="fFoto">${fotoId ? 'Cambiar foto' : 'Agregar foto'}</button>${fotoId ? '<button type="button" class="btn sm ghost" data-act="fSinFoto">Quitar foto</button>' : ''}</div></div>
      ${campo('Nombre del producto *', 'nombre', {ph: F.tipo === 'venta' ? 'Ej.: Protector solar FPS 50' : 'Ej.: Mascarilla hidratante'})}
      ${campo('Marca', 'marca', {ph:'Ej.: La Roche-Posay'})}
      ${campo('Código de barras', 'codigo', {codigo:true})}
      <div class="campo"><span class="lbl">Categoría</span>${chipsF('cat', cats, {extra:`<button type="button" class="chip" data-act="nuevaCat">${IC.mas} Otra</button>`})}</div>
      ${F.id ? '' : '<div class="peq muted">Solo el nombre es obligatorio.</div>'}
    </section>
    <section class="card">
      <h3>Existencias</h3>
      <div class="campo"><span class="lbl">Se cuenta en</span>${chipsF('unidad', UNIDADES)}</div>
      ${!F.id ? pasos('¿Cuántos tienes ahora?', 'inicial', F.unidad) : ''}
      ${pasos('Avisarme cuando queden', 'min', F.unidad)}
      ${pasos('Cantidad ideal para pedir', 'max', F.unidad)}
      <span class="peq muted">Lo que quieres tener después de recibir un pedido.</span>
      ${F.tipo === 'uso' ? pasos('Gasto por tratamiento', 'gasto', F.unidad) + '<span class="peq muted">Es lo que descuenta el botón «Usar» con un solo toque.</span>' : ''}
    </section>
    <section class="card">
      <h3>${F.tipo === 'venta' ? 'Precios' : 'Costo'}</h3>
      <div class="${F.tipo === 'venta' ? 'fila2' : ''}">${campo('Costo de compra ($)', 'costo', {modo:'decimal', ph:'0,00', ayuda:'Por ' + singular(F.unidad)})}
        ${F.tipo === 'venta' ? campo('Precio de venta ($)', 'precio', {modo:'decimal', ph:'0,00'}) : ''}</div>
      ${F.tipo === 'venta' ? `<div class="peq" id="margen">${textoMargen()}</div>` : ''}
    </section>
    <section class="card">
      <h3>Vencimiento</h3>
      <div class="fila2">${campo('Fecha de vencimiento', 'vence', {tipo:'date'})}${campo('Lote', 'lote')}</div>
      <div class="fila2">${campo('Dura abierto (meses)', 'pao', {modo:'numeric', ph:'Ej.: 12', ayuda:'El número del frasquito abierto: 6M, 12M…'})}${campo('Fecha en que se abrió', 'abierto', {tipo:'date', max:hoyISO()})}</div>
    </section>
    ${F.tipo === 'venta' ? `<section class="card"><h3>Para volver a ofrecer</h3>${campo('A la paciente le dura (días)', 'duraPac', {modo:'numeric', ph:'Ej.: 60', ayuda:'La app te recordará ofrecérselo de nuevo cuando ya se le esté terminando.'})}</section>` : ''}
    <section class="card">
      <h3>Proveedor</h3>
      <div class="fila2">${campo('Nombre del proveedor', 'prov', {lista:'dlProv'})}${campo('WhatsApp del proveedor', 'telProv', {tipo:'tel', ph:'09…'})}</div>
      <datalist id="dlProv">${provs.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    </section>
    <section class="card">${campo('Notas', 'notas', {area:true, ph:'Ej.: guardar en refrigeración'})}</section>`;
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
  const cantidadIdeal = F.max.trim(), max = num(cantidadIdeal);
  if(cantidadIdeal && (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(cantidadIdeal) || !Number.isFinite(max))){
    $('#paso-max').focus();
    toast('Escribe una cantidad ideal para pedir de cero o más');
    return;
  }
  if(F.abierto && F.abierto > hoyISO()){ toast('La fecha de apertura no puede ser futura'); return; }
  const codigo = F.codigo.trim(), previo = F.id ? prodPorId(F.id) : null;
  const duplicado = codigo !== String(previo?.codigo ?? '').trim() && productoPorCodigo(codigo, F.id);
  if(duplicado){
    $('#campo-codigo').focus();
    toast(`Ese código ya está asignado a ${duplicado.nombre}.`);
    return;
  }
  const datos = {tipo:F.tipo, nombre, marca:F.marca.trim(), cat:F.cat, unidad:F.unidad || 'unidades', codigo, max:max > 0 ? red(max) : 0,
    min:min > 0 ? red(min) : 0, costo:costo > 0 ? red(costo) : 0, precio:F.tipo === 'venta' && precio > 0 ? red(precio) : 0,
    gasto:F.tipo === 'uso' && gasto > 0 ? red(gasto) : 0, duraPac:F.tipo === 'venta' && dura > 0 ? dura : 0,
    vence:F.vence || '', lote:F.lote.trim(), abierto:F.abierto || '', pao:pao > 0 ? pao : 0,
    prov:F.prov.trim(), telProv:F.telProv.trim(), notas:F.notas.trim(), foto:F.fotoNueva || F.foto || ''};
  const id = F.id || uid(), nuevo = !F.id;
  const p = marcar({...previo, id, ...datos}, nuevo);
  const productos = nuevo ? [...E.productos, p] : E.productos.map(x => x.id === id ? p : x);
  const estado = {...E, productos};
  if(nuevo && ini > 0) estado.movs = [...E.movs, marcar({id:uid(), prod:id, tipo:'inicial', cant:red(ini), fecha:hoyISO(), costo:datos.costo}, true)];
  if(esPorFrasco(p) && p.abierto !== (previo?.abierto || '')){
    const historico = previo ? movimientosDelProducto(id) : [];
    const cierre = historico.find(frascoTerminado);
    if(p.abierto && cierre && p.abierto < cierre.fecha){
      $('#campo-abierto').focus();
      toast(`El frasco anterior se terminó el ${fCorta(cierre.fecha)}. Usa esa fecha o una posterior.`);
      return;
    }
    const apertura = aperturaVigente(historico);
    if(apertura){
      const cambio = p.abierto ? {fecha:p.abierto} : {borrado:true};
      estado.movs = estado.movs.map(m => m === apertura ? marcar({...m, ...cambio}) : m);
    }else if(p.abierto){
      estado.movs = [...estado.movs, movimientoApertura(id, p.abierto)];
    }
  }
  if(!guardar(estado)) return;
  F.guardado = true;
  const fotoVieja = previo?.foto;
  if(fotoVieja && fotoVieja !== p.foto && !productos.some(x => x.foto === fotoVieja)) FDB.del(fotoVieja).catch(() => {});
  await cerrarCapa();
  if(nuevo && !pila.length && esInventario(U.tab) && U.tab !== p.tipo) irPantalla(p.tipo);
  refrescar();
  toast(nuevo ? 'Producto agregado' : 'Cambios guardados');
}

// Llegó mercadería
function formEntrada(id){
  const p = prodPorId(id);
  F = {prod:id, cant:'1', costo:dineroIn(p.costo), fecha:hoyISO(), vence:'', lote:'', nota:'', guardar:guardarEntrada};
  hojaForm('Llegó más · ' + esc(p.nombre), 'form', () => {
    const stock = stockDe(id);
    $('#fCuerpo').innerHTML = `<div class="peq muted">Ahora hay <b>${fCant(stock)} ${esc(uTxt(stock, p.unidad))}</b>.</div>
      ${pasos('¿Cuántos llegaron?', 'cant', p.unidad)}
      <div class="fila2">${campo('Costo de cada uno ($)', 'costo', {modo:'decimal', ph:'0,00'})}${campo('Fecha', 'fecha', {tipo:'date', max:hoyISO()})}</div>
      <div class="fila2">${campo('Vence (opcional)', 'vence', {tipo:'date'})}${campo('Lote (opcional)', 'lote')}</div>
      ${campo('Nota (opcional)', 'nota', {ph:'Ej.: factura 123, pedido a…'})}`;
  });
}
async function guardarEntrada(){
  const p = prodPorId(F.prod), c = red(num(F.cant)), costo = red(num(F.costo));
  if(!(c > 0)){ toast('Escribe cuántos llegaron'); return; }
  if(!F.fecha || F.fecha > hoyISO()){ toast('Revisa la fecha'); return; }
  const entrada = marcar({id:uid(), prod:p.id, tipo:'entrada', cant:c, fecha:F.fecha, costo:costo > 0 ? costo : 0, nota:F.nota.trim()}, true);
  const cambios = {};
  if(costo > 0 && costo !== p.costo) cambios.costo = costo;
  // Se guarda la fecha de vencimiento más próxima de lo que hay
  if(F.vence && F.vence !== p.vence && (!p.vence || stockDe(p.id) <= 0 || F.vence < p.vence)) cambios.vence = F.vence;
  const lote = F.lote.trim();
  if(lote && lote !== p.lote) cambios.lote = lote;
  const campos = Object.keys(cambios);
  const nuevosProductos = campos.length ? E.productos.map(x => x === p ? marcar({...p, ...cambios}) : x) : E.productos;
  if(!guardar({...E, productos:nuevosProductos, movs:[...E.movs, entrada]})) return;
  await cerrarCapa();
  refrescar();
  avisarConDeshacer(`Llegó mercadería · +${fCant(c)} ${uTxt(c, p.unidad)}`, {movs:[entrada]}, true, () =>
    E.productos.map(actual => {
      if(actual.id !== p.id || actual.borrado) return actual;
      const restaurados = campos.filter(campo => actual[campo] === cambios[campo]);
      if(!restaurados.length) return actual;
      return marcar({...actual, ...Object.fromEntries(restaurados.map(campo => [campo, p[campo] ?? (campo === 'costo' ? 0 : '')]))});
    }));
}

// Abrir deja el frasco dentro del stock. Solo se descuenta cuando se termina.
function registrarFrasco(id, terminado){
  const p = prodPorId(id), fecha = hoyISO();
  if(!esPorFrasco(p) || p.borrado || stockDe(id) < 1) return;
  if(terminado && !p.abierto) return;
  if(!terminado && p.abierto){
    toast('Primero anota que se terminó el frasco en uso.');
    return;
  }
  const registros = [];
  if(terminado){
    // La versión 1 guardaba la fecha en el producto. Consérvala en el historial al cerrar ese frasco.
    if(!aperturaVigente(movimientosDelProducto(id))) registros.push(movimientoApertura(id, p.abierto));
    registros.push(marcar({id:uid(), prod:id, fecha, tipo:'uso', cant:-1, motivo:'terminado', costo:p.costo || 0}, true));
  }else{
    registros.push(movimientoApertura(id, fecha));
  }
  const actualizado = marcar({...p, abierto:terminado ? '' : fecha});
  const productos = E.productos.map(x => x === p ? actualizado : x);
  if(!guardar({...E, productos, movs:[...E.movs, ...registros]})) return;
  refrescar();
  const mensaje = terminado ? 'Se terminó un frasco' : 'Abrí uno nuevo';
  avisarConDeshacer(mensaje, {movs:registros}, true, () => E.productos.map(actual =>
    actual.id === id && !actual.borrado && actual.abierto === actualizado.abierto ? marcar({...actual, abierto:p.abierto || ''}) : actual));
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
function usarProducto(id){
  if(esPorFrasco(prodPorId(id))) verProd(id);
  else formUso(id);
}
function guardarUso(){
  const p = prodPorId(F.prod), c = num(F.cant);
  if(!(c > 0)){ toast('Escribe cuánto usaste'); return; }
  if(!F.fecha || F.fecha > hoyISO()){ toast('Revisa la fecha'); return; }
  const m = marcar({id:uid(), prod:p.id, tipo:'uso', cant:-red(c), fecha:F.fecha, costo:p.costo || 0,
    pac:F.pac.trim(), trat:F.trat.trim(), nota:p.lote ? 'Lote ' + p.lote : ''}, true);
  if(!guardar({...E, movs:[...E.movs, m]})) return;
  cerrarCapa(); refrescar();
  avisarConDeshacer(`−${fCant(c)} ${uTxt(c, p.unidad)} de ${p.nombre}`, {movs:[m]}, true);
}
function usarRapido(id){
  const p = prodPorId(id), c = p.gasto > 0 ? p.gasto : 1;
  const m = marcar({id:uid(), prod:id, tipo:'uso', cant:-c, fecha:hoyISO(), costo:p.costo || 0, nota:p.lote ? 'Lote ' + p.lote : ''}, true);
  if(!guardar({...E, movs:[...E.movs, m]})) return;
  refrescar();
  avisarConDeshacer(`−${fCant(c)} ${uTxt(c, p.unidad)} de ${p.nombre}. Quedan ${fCant(stockDe(id))}`, {movs:[m]}, true);
}

// Contar / corregir
function formAjuste(id, desdeFicha = false){
  const p = prodPorId(id);
  F = {prod:id, real:fCant(Math.max(0, stockDe(id))), motivo:'conteo', nota:'', guardar:guardarAjuste, desdeFicha};
  hojaForm(`${desdeFicha ? 'Ajustar' : 'Contar'} · ${esc(p.nombre)}`, 'form', () => {
    const stock = stockDe(id);
    $('#fCuerpo').innerHTML = `<div class="peq muted">Según la app hay <b>${fCant(stock)} ${esc(uTxt(stock, p.unidad))}</b>. Escribe lo que realmente hay.</div>
      ${pasos('¿Cuántos hay de verdad?', 'real', p.unidad)}
      <div class="peq" id="aDif" role="status">${diferenciaAjuste(id)}</div>
      <div class="campo"><span class="lbl">Motivo</span><div class="chips" role="group" aria-label="Motivo">
        ${Object.entries(MOTIVOS).map(([v, texto]) => opcion('fChip', v, texto, F.motivo === v, 'chip', 'data-f="motivo"')).join('')}</div></div>
      ${campo('Nota (opcional)', 'nota')}`;
  });
  F.alCambiar = f => { if(f === 'real') $('#aDif').innerHTML = diferenciaAjuste(id); };
}
function diferenciaAjuste(id){
  const real = num(F.real);
  const dif = red(real - stockDe(id));
  if(!(real >= 0)) return 'Escribe la cantidad que hay.';
  if(!dif) return 'Sin diferencia.';
  return `Diferencia: <b style="color:${dif < 0 ? 'var(--mal)' : 'var(--bien)'}">${dif > 0 ? '+' : '−'}${fCant(Math.abs(dif))}</b>`;
}
async function guardarAjuste(){
  const p = prodPorId(F.prod), real = num(F.real);
  if(!(real >= 0)){ toast('Escribe la cantidad que hay'); return; }
  const dif = red(real - stockDe(p.id));
  if(!dif && !(F.desdeFicha && F.motivo === 'conteo')){ cerrarCapa(); toast('La cantidad ya estaba bien'); return; }
  const ajuste = marcar({id:uid(), prod:p.id, tipo:'ajuste', cant:dif, fecha:hoyISO(), motivo:F.motivo, nota:F.nota.trim()}, true);
  if(!guardar({...E, movs:[...E.movs, ajuste]})) return;
  await cerrarCapa();
  refrescar();
  const quedan = stockDe(p.id);
  const cantidad = quedan > 0 ? `${quedan === 1 ? 'Queda' : 'Quedan'} ${fCant(quedan)}` : 'Agotado';
  avisarConDeshacer(dif ? `Cantidad ajustada · ${cantidad}` : 'Conteo guardado · Sin diferencia', {movs:[ajuste]}, true);
}

// ---------- Conteo guiado ----------
const GRUPOS_CONTEO = {todos:'Todo el inventario', venta:'Para vender', uso:'Uso en spa'};
function filasConteo(conteo){
  const porId = new Map(vivos(E.productos).map(p => [p.id, p]));
  return conteo.ids.filter(id => porId.has(id)).map(id => {
    const p = porId.get(id), esperado = stockDe(id);
    const contado = cantidadEscrita(conteo.cantidades[id]);
    return {p, esperado, contado, diferencia:contado === null ? null : red(contado - esperado)};
  });
}
function revisarEstadoConteo(d){
  if(!recargarEstadoSiCambio()) return true;
  pintarConteo(d, true);
  toast('El inventario cambió. Revisa el conteo y vuelve a intentar.');
  return false;
}
function guardarBorradorConteo(conteo){ return guardar({...E, conteo}, true); }
function nuevoConteo(d, grupo, valor, p = null){
  const porMarca = grupo === 'marca';
  const ps = porMarca ? productos().filter(x => norm(x.marca) === valor) : productos(grupo === 'todos' ? null : grupo);
  if(!ps.length){ toast('Todavía no hay productos en este grupo.'); return; }
  const nombre = porMarca ? (ps[0].marca?.trim() || 'Sin marca') : GRUPOS_CONTEO[grupo];
  const conteo = {nombre, ids:ps.map(x => x.id), cantidades:p ? {[p.id]:'1'} : {}, paso:p?.id || ps[0].id};
  if(!guardarBorradorConteo(conteo)) return;
  render();
  pintarConteo(d, true);
}
function textoCantidadConteo(cant, p){ return `${fCant(cant)} ${esc(uTxt(cant, p.unidad))}`; }
function inicioConteoHTML(){
  const ps = productos();
  if(!ps.length) return '<div class="vacio">Agrega un producto en Inventario para empezar a contar.</div>';
  const grupos = {todos:ps.length, venta:0, uso:0};
  const marcas = new Map();
  for(const p of ps){
    grupos[p.tipo]++;
    const clave = norm(p.marca);
    if(!marcas.has(clave)) marcas.set(clave, {nombre:p.marca?.trim() || 'Sin marca', cantidad:0});
    marcas.get(clave).cantidad++;
  }
  const cantidad = n => `${n} ${n === 1 ? 'producto' : 'productos'}`;
  return `<p class="muted">Elige qué quieres contar.</p>
    <div class="filas alcance-conteo">${Object.entries(GRUPOS_CONTEO).map(([grupo, nombre]) => `<button type="button" class="fila-lista"
      data-act="iniciarConteo" data-grupo="${grupo}" ${grupos[grupo] ? '' : 'disabled'}>
      <span class="av" aria-hidden="true">${grupo === 'venta' ? IC.bolsa : grupo === 'uso' ? IC.gota : IC.inventario}</span>
      <span class="tx"><b>${nombre}</b><span class="m">${cantidad(grupos[grupo])}</span></span>${IC.siguiente}</button>`).join('')}
    </div>
    <section class="card"><h3>Por marca</h3>
      <div class="campo"><label for="marcaConteo">Marca</label><select id="marcaConteo">
        ${[...marcas].sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre, 'es')).map(([clave, marca]) =>
          `<option value="${esc(clave)}">${esc(marca.nombre)} · ${cantidad(marca.cantidad)}</option>`).join('')}
      </select></div><button type="button" class="btn ghost" data-act="iniciarConteo" data-grupo="marca">Contar esta marca</button>
    </section>`;
}
function pasoConteoHTML(conteo, filas, i){
  const {p, esperado} = filas[i], unidad = p.unidad || 'unidades';
  const botonEscanear = `<button type="button" class="btn soft" data-act="escanearConteo">${IC.escaneo} Escanear</button>`;
  return `<div class="conteo-avance"><span class="muted">${esc(conteo.nombre)}</span>
      <b>Producto ${i + 1} de ${filas.length}</b><progress max="${filas.length}" aria-label="Productos contados"></progress>
      <span class="muted conteo-cuantos" role="status"></span></div>
    <section class="card conteo-producto" aria-labelledby="productoConteo">
      ${avatar(p, 'conteo-foto')}<h3 id="productoConteo" tabindex="-1">${esc(p.nombre)}</h3>
      ${p.marca && norm(p.marca) !== norm(conteo.nombre) ? `<p class="muted">${esc(p.marca)}</p>` : ''}
      <div class="conteo-esperado"><span>Stock esperado</span><b class="num">${textoCantidadConteo(esperado, p)}</b></div>
      ${campoCantidad(`Cantidad contada (${unidad})`, 'cantidadConteo', conteo.cantidades[p.id], 'aria-describedby="estadoCantidadConteo"')}
      <p id="estadoCantidadConteo" class="conteo-diferencia" role="status"></p>
      <div class="conteo-metodos"><button type="button" class="btn ghost" data-act="ceroConteo">No hay</button>${botonEscanear}</div>
    </section>
    <div class="conteo-enlaces"><button type="button" class="link" data-act="descartarConteo">Descartar conteo</button></div>`;
}
function resumenConteoHTML(conteo, filas){
  const diferencias = filas.filter(f => f.diferencia);
  const n = diferencias.length;
  return `<div class="conteo-avance"><span class="muted">${esc(conteo.nombre)}</span>
      <b>${filas.length} ${filas.length === 1 ? 'producto contado' : 'productos contados'}</b></div>
    <section class="card conteo-resumen" aria-labelledby="diferenciasConteo"><h3 id="diferenciasConteo" tabindex="-1">Diferencias</h3>
      ${n ? `<p class="muted">${n} ${n === 1 ? 'producto tiene' : 'productos tienen'} una diferencia. Toca un producto si quieres corregir la cantidad.</p>
        <div class="conteo-filas">${diferencias.map(({p, esperado, contado, diferencia}) => `<button type="button" class="fila-lista"
          data-act="irConteo" data-id="${esc(p.id)}">${avatar(p)}<span class="tx"><b>${esc(p.nombre)}</b>
          <span class="m">Esperado ${fCant(esperado)} · Contado ${textoCantidadConteo(contado, p)}</span></span>
          <span class="solo-lectura">Ajuste de ${diferencia > 0 ? 'más' : 'menos'} ${textoCantidadConteo(Math.abs(diferencia), p)}</span>
          <span class="pill ${diferencia > 0 ? 'ok' : 'bad'}" aria-hidden="true">${diferencia > 0 ? '+' : '−'}${fCant(Math.abs(diferencia))}</span>
        </button>`).join('')}</div>` : '<p class="conteo-correcto">' + IC.check + ' Las cantidades coinciden con el inventario.</p>'}
    </section>
    <div class="conteo-enlaces"><button type="button" class="link" data-act="irConteo" data-id="${esc(conteo.paso)}">Volver al conteo</button>
      <button type="button" class="link" data-act="descartarConteo">Descartar conteo</button></div>`;
}
function pintarConteo(d, enfocar = false){
  const conteo = E.conteo, filas = conteo ? filasConteo(conteo) : [];
  const i = Math.max(0, filas.findIndex(f => f.p.id === conteo?.paso));
  const resumen = conteo?.resumen && filas.length && filas.every(f => f.contado !== null);
  const titulo = resumen ? 'Resumen del conteo' : 'Contar inventario';
  let cuerpo, pie = '';
  if(!conteo){
    cuerpo = inicioConteoHTML();
  }else if(!filas.length){
    cuerpo = '<div class="vacio">Los productos de este conteo ya no están en el inventario.</div>' +
      '<button type="button" class="btn ghost" data-act="descartarConteo">Descartar conteo</button>';
  }else if(resumen){
    cuerpo = resumenConteoHTML(conteo, filas);
    pie = '<button type="button" class="btn" data-act="confirmarConteo">Confirmar conteo</button>';
  }else{
    cuerpo = pasoConteoHTML(conteo, filas, i);
    pie = `<button type="button" class="btn ghost" data-act="irConteo" data-id="${esc(filas[i - 1]?.p.id)}" ${i ? '' : 'disabled'}>${IC.volver} Anterior</button>
      <button type="button" class="btn" data-act="siguienteConteo"></button>`;
  }
  d.setAttribute('aria-label', titulo);
  d.innerHTML = cabecera(titulo, conteo ? '<button type="button" class="link" data-act="cerrar">Pausar</button>' : '', true) +
    `<div class="hoja-cuerpo"><div class="hoja-in">${cuerpo}</div></div>` +
    (pie ? `<footer class="hoja-pie"><div class="in">${pie}</div></footer>` : '');
  if(conteo && filas.length && !resumen){
    const input = $('#cantidadConteo', d), p = filas[i].p;
    input.addEventListener('input', () => {
      if(!revisarEstadoConteo(d)) return;
      const actual = E.conteo;
      const guardado = (actual.cantidades[p.id] ?? '') === input.value ||
        guardarBorradorConteo({...actual, paso:p.id, resumen:false, cantidades:{...actual.cantidades, [p.id]:input.value}});
      pintarCantidadConteo(d, filasConteo(E.conteo), i, guardado);
    });
    pintarCantidadConteo(d, filas, i);
  }
  cargarFotos(d);
  if(enfocar) ($('[tabindex="-1"]', d) || d).focus({preventScroll:true});
}
function pintarCantidadConteo(d, filas, i, guardado = true){
  const registrados = filas.filter(f => f.contado !== null).length;
  const {contado, diferencia, p} = filas[i];
  const input = $('#cantidadConteo', d), mensaje = $('#estadoCantidadConteo', d);
  const invalido = Boolean(input.value.trim()) && cantidadEscrita(input.value) === null;
  $('progress', d).value = registrados;
  const avance = $('.conteo-cuantos', d), textoAvance = `${registrados} de ${filas.length} contados`;
  if(avance.textContent !== textoAvance) avance.textContent = textoAvance;
  mensaje.classList.toggle('bad', invalido || !guardado || diferencia < 0);
  mensaje.classList.toggle('ok', diferencia > 0 && !invalido && guardado);
  input.setAttribute('aria-invalid', String(invalido));
  if(invalido) mensaje.textContent = 'Escribe una cantidad válida con hasta dos decimales.';
  else if(!guardado) mensaje.textContent = 'La cantidad no se guardó. Vuelve a escribirla para reintentar.';
  else if(contado === null) mensaje.textContent = 'Escribe la cantidad que encuentres.';
  else if(!diferencia) mensaje.textContent = 'Sin diferencia';
  else mensaje.innerHTML = `Diferencia <b>${diferencia > 0 ? '+' : '−'}${textoCantidadConteo(Math.abs(diferencia), p)}</b>`;
  const siguiente = $('[data-act="siguienteConteo"]', d);
  siguiente.disabled = !guardado || contado === null;
  siguiente.textContent = registrados === filas.length ? 'Ver resumen' : i + 1 === filas.length ? 'Ir al pendiente' : 'Siguiente';
}
function abrirConteo(p = null){
  recargarEstadoSiCambio();
  const d = abrirCapa('', {cls:'hoja hoja-conteo', tipo:'conteo'});
  if(p){
    p = prodPorId(p.id);
    if(!p || p.borrado){ toast('Ese producto ya no está en el inventario.'); p = null; }
  }
  if(p && !E.conteo){ nuevoConteo(d, p.tipo, '', p); }
  else if(p){
    const lectura = sumarLecturaConteo(p, true);
    if(!lectura.ok) toast(lectura.texto);
  }
  if(!d.hasChildNodes()) pintarConteo(d);
}
function irConteo(d, id, resumen = false){
  const conteo = E.conteo;
  if(guardarBorradorConteo({...conteo, paso:id, resumen})) pintarConteo(d, true);
}
function siguienteConteo(d){
  if(!revisarEstadoConteo(d)) return;
  const conteo = E.conteo, filas = filasConteo(conteo);
  const i = Math.max(0, filas.findIndex(f => f.p.id === conteo.paso));
  if(filas[i].contado === null) return;
  const pendiente = filas.find(f => f.contado === null);
  irConteo(d, pendiente ? (filas[i + 1] || pendiente).p.id : filas[i].p.id, !pendiente);
}
async function descartarConteo(d){
  if(!(await confirmar('¿Descartar el conteo?', 'Se perderán las cantidades que anotaste en este conteo.', 'Descartar', true))) return;
  if(!revisarEstadoConteo(d)) return;
  const {conteo, ...estado} = E;
  if(!guardar(estado, true)) return;
  render();
  pintarConteo(d, true);
}
async function confirmarConteo(d){
  if(!revisarEstadoConteo(d)) return;
  const {conteo, ...estado} = E;
  const filas = filasConteo(conteo);
  if(!filas.length || filas.some(f => f.contado === null)){ pintarConteo(d, true); return; }
  const movs = filas.filter(f => f.diferencia).map(({p, diferencia}) =>
    marcar({id:uid(), prod:p.id, tipo:'ajuste', cant:diferencia, fecha:hoyISO(), motivo:'conteo'}, true));
  if(!guardar({...estado, movs:[...estado.movs, ...movs]})) return;
  await cerrarCapa();
  refrescar();
  if(movs.length){
    avisarConDeshacer(`Conteo guardado · ${movs.length} ${movs.length === 1 ? 'ajuste' : 'ajustes'}`, {movs}, true);
  }else toast('Conteo guardado · Sin diferencias');
}
function sumarLecturaConteo(p, enfocar = false){
  if(!p) return {texto:'No encontré un producto con ese código.'};
  const conteo = E.conteo;
  if(!conteo?.ids.includes(p.id)) return {texto:`${p.nombre} no pertenece a este conteo.`};
  const cantidad = red((cantidadEscrita(conteo.cantidades[p.id]) ?? 0) + 1);
  const valor = fCant(cantidad);
  if(cantidadEscrita(valor) === null) return {texto:'La cantidad es demasiado grande.'};
  const avance = {...conteo, cantidades:{...conteo.cantidades, [p.id]:valor}};
  if(enfocar) Object.assign(avance, {paso:p.id, resumen:false});
  if(!guardarBorradorConteo(avance)) return {texto:'La lectura no se guardó. Intenta de nuevo.'};
  return {ok:true, cantidad};
}

// ---------- Ventas ----------
function masVendidosVenta(todos){
  const hoy = hoyISO(), desde = sumarDias(hoy, -59), cantidades = new Map();
  for(const v of E.ventas){
    if(v.borrado || v.fecha < desde || v.fecha > hoy) continue;
    for(const it of v.items) cantidades.set(it.prod, (cantidades.get(it.prod) || 0) + it.cant);
  }
  return [...todos].sort((a, b) =>
    (cantidades.get(b.id) || 0) - (cantidades.get(a.id) || 0) ||
    Number(stockDe(b.id) > 0) - Number(stockDe(a.id) > 0)).slice(0, 9);
}
function recientesVenta(lista){
  const hoy = hoyISO();
  const nombres = new Set(vivos(E.ventas).filter(v => v.pac?.trim() && v.fecha <= hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado)
    .map(v => norm(v.pac)));
  const porNombre = new Map(lista.map(p => [norm(p.nombre), p]));
  return [...nombres].map(n => porNombre.get(n)).filter(Boolean);
}
function formVenta(id, prodId, paciente){
  const v = id ? vivos(E.ventas).find(x => x.id === id) : null;
  if(id && !v) return;
  const anterior = F, lista = pacientes();
  F = {id:v?.id, pac:v?.pac || paciente?.nombre || '', tel:v?.tel || paciente?.tel || '', fecha:v?.fecha || hoyISO(), nota:v?.nota || '',
    pago:PAGOS.find(p => norm(p) === norm(v?.pago)) || PAGOS[0], cobrado:v ? Boolean(v.cobrado) : true,
    descuento:dineroIn(v?.descuento), comprobante:false, buscar:'', categoria:'populares',
    items:v ? v.items.map(i => ({...i, cant:fCant(i.cant), precio:dineroIn(i.precio)})) : [],
    lista, recientes:recientesVenta(lista), guardar:guardarVenta};
  if(prodId) agregarItem(prodId);
  const escanear = `<button class="btn sm soft escaner-venta" data-act="escanear" data-modo="vender" aria-label="Escanear código de barras">${IC.escaneo} Escanear</button>`;
  const d = abrirCapa(cabecera(v ? 'Editar venta' : 'Nueva venta', escanear, true) + `
    <div class="hoja-cuerpo"><div class="hoja-in">
      <section class="card paciente-venta" aria-label="Paciente"></section>
      ${buscador('Buscar producto', {campo:'buscar', escaneo:'vender'})}
      <div class="chips scroll filtros-venta" role="group" aria-label="Filtrar productos"></div>
      <div class="cuadricula-venta" id="selProd"></div>
    </div></div>
    <section class="carrito hoja-inferior" aria-label="Carrito">
      <button class="resumen-venta" data-act="verCarrito" aria-controls="detalleVenta" aria-expanded="${Boolean(v || prodId)}">
        <span class="tirador" aria-hidden="true"></span>
        <span class="resumen-venta-linea"><span id="resumenVenta"></span><span class="fecha-carrito" id="fechaResumen"></span>${IC.volver}</span>
      </button>
      <div class="vista-carrito" id="vistaCarrito" hidden></div>
      <div class="carrito-detalle" id="detalleVenta"${v || prodId ? '' : ' hidden'}>
        <div class="items-venta" id="itemsVenta"></div>
        <div class="total" id="totalDetalle"><span>Total</span><span class="num"></span></div>
        <div class="opciones-venta">
          <div class="seg pago-venta" role="group" aria-label="Forma de pago">${PAGOS.map(p => opcion('pagoVenta', p, p, F.pago === p)).join('')}</div>
          <div class="seg" role="group" aria-label="Estado del pago">
            ${opcion('estadoPagoVenta', 'cobrado', 'Cobrado', F.cobrado)}
            ${opcion('estadoPagoVenta', 'pendiente', 'Queda pendiente', !F.cobrado)}
          </div>
          ${v ? `<a class="btn soft" href="${esc(enlaceComprobante(v))}" target="_blank" rel="noopener">${IC.chat} Abrir comprobante en WhatsApp</a>` :
            `<label class="check comprobante-venta"><input type="checkbox" id="enviarComprobante"> Enviar comprobante por WhatsApp</label>
            <p class="peq muted ayuda-comprobante" id="ayudaComprobante" hidden></p>`}
          <div class="fila2">
            ${campo('Descuento ($)', 'descuento', {modo:'decimal', ph:'0,00'})}
            <div class="campo"><label for="fechaVenta">Fecha</label><div class="fecha-venta">
              <span id="fechaVisible" aria-hidden="true"></span>${IC.calendario}
              <input type="date" id="fechaVenta" data-f="fecha" value="${esc(F.fecha)}" max="${hoyISO()}">
            </div></div>
          </div>
          ${campo('Nota (opcional)', 'nota', {area:true, id:'notaVenta'})}
        </div>
      </div>
      <div class="total" id="totalPlegado"><span>Total</span><span class="num" id="vTotal"></span></div>
      <footer class="hoja-pie"><div class="in">
        ${v ? '<button class="btn danger" data-act="borrarVenta">Eliminar</button>' : ''}
        <button class="btn" data-act="guardarF">${IC.check}<span id="accionVenta"></span></button>
      </div></footer>
    </section>`, {cls:'hoja venta-form', tipo:'form', alCerrar:() => { F = anterior; }});
  d.formulario = F;
  $('#enviarComprobante', d)?.addEventListener('change', e => {
    F.comprobante = e.target.checked;
    pintarAyudaComprobante();
  });
  F.alCambiar = f => {
    if(f === 'buscar') pintarSelectorVenta();
    if(f === 'descuento') actualizarTotalesVenta();
    if(f === 'fecha') pintarFechaVenta();
  };
  pintarPacienteVenta();
  actualizarCatalogoVenta(d);
  pintarCarrito();
  pintarFechaVenta();
}
function actualizarCatalogoVenta(d){
  const todos = productos('venta');
  const categorias = [...new Set(todos.map(p => p.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const filtros = $('.filtros-venta', d), scroll = filtros.scrollLeft;
  F.todos = todos;
  F.populares = masVendidosVenta(todos);
  filtros.innerHTML = [['populares', 'Más vendidos'], ['todos', 'Todos'], ...categorias.map(cat => ['cat:' + cat, cat])]
    .map(([v, texto]) => opcion('vCategoria', v, esc(texto), F.categoria === v, 'chip')).join('');
  filtros.scrollLeft = scroll;
  pintarSelectorVenta();
}
function pintarPacienteVenta(){
  const abreviar = nombre => {
    const [primero, segundo] = nombre.trim().split(/\s+/);
    return segundo ? primero + ' ' + segundo[0] + '.' : primero;
  };
  const recientes = F.recientes.filter(p => norm(p.nombre) !== norm(F.pac)).slice(0, 2);
  $('.paciente-venta').innerHTML = `
    <div class="paciente-venta-cab">
      ${F.pac ? avatar({nombre:F.pac}, 'persona') : `<span class="av persona" aria-hidden="true">${IC.pacientes}</span>`}
      <div class="paciente-venta-nombre"><span>Paciente</span><b>${esc(F.pac || 'Sin nombre')}</b></div>
      <button class="btn sm sin-fondo" data-act="vBuscaPaciente">${F.pac ? 'Cambiar' : 'Buscar'}</button>
    </div>
    <div class="paciente-venta-recientes">
      ${recientes.length ? `<span>Recientes</span>${recientes.map(p =>
        `<button class="chip" data-act="vEligePaciente" data-n="${esc(p.nombre)}" aria-label="${esc(p.nombre)}">${esc(abreviar(p.nombre))}</button>`).join('')}` : ''}
      <button class="chip pac-nueva" data-act="vNuevaPaciente">${IC.mas} Nueva</button>
    </div>`;
  pintarAyudaComprobante();
}
function buscarPacienteVenta(){
  const d = abrirCapa(cabecera('Elegir paciente', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    ${buscador('Buscar paciente por nombre o teléfono')}
    <div class="opciones-paciente-venta">
      <button class="btn soft sm" data-act="vNuevaPaciente">${IC.mas} Nueva</button>
      ${F.pac ? '<button class="btn ghost sm" data-act="vNuevaPaciente" data-editar="1">Editar datos</button>' : ''}
      <button class="btn ghost sm" data-act="vEligePaciente" data-n="">Sin nombre</button>
    </div>
    <div class="filas"></div>
  </div></div>`, {tipo:'seleccionPacienteVenta'});
  const campo = $('input', d);
  const pintar = () => {
    const lista = F.lista.filter(p => coincidePaciente(p, campo.value));
    $('.filas', d).innerHTML = lista.length ? lista.map(p =>
      `<button class="fila-lista" data-act="vEligePaciente" data-n="${esc(p.nombre)}">${avatar(p, 'persona')}
        <span class="tx"><b>${esc(p.nombre)}</b>${p.tel ? `<span class="m">${esc(p.tel)}</span>` : ''}</span></button>`).join('') :
      '<p class="vacio">No encontré pacientes. Puedes agregar una nueva.</p>';
  };
  campo.addEventListener('input', pintar);
  pintar();
}
function seleccionarPacienteVenta(nombre, tel, telEditado = false){
  F.pac = nombre;
  F.tel = tel || '';
  F.telEditado = telEditado;
  const desdeSelector = pila.at(-1)?.el.dataset.tipo === 'seleccionPacienteVenta';
  pintarPacienteVenta();
  if(desdeSelector) cerrarCapa();
  else $('.paciente-venta [data-act="vBuscaPaciente"]').focus({preventScroll:true});
}
function editarPacienteVenta(editar){
  const desdeSelector = pila.at(-1)?.el.dataset.tipo === 'seleccionPacienteVenta';
  const d = abrirCapa(`<form class="dlg hoja-inferior" role="dialog">
    <span class="tirador" aria-hidden="true"></span><h3>${editar ? 'Datos de la paciente' : 'Nueva paciente'}</h3>
    <div class="campo"><label for="nombrePacienteVenta">Nombre</label>
      <input id="nombrePacienteVenta" type="text" autocomplete="off" required value="${editar ? esc(F.pac) : ''}">
    </div>
    <div class="campo"><label for="telefonoPacienteVenta">Teléfono (opcional)</label>
      <input id="telefonoPacienteVenta" type="tel" autocomplete="off" value="${editar ? esc(F.tel) : ''}">
    </div>
    <div class="fila"><button class="btn ghost" type="button" data-act="cerrar">Cancelar</button>
      <button class="btn" type="submit">Elegir paciente</button></div>
  </form>`, {cls:'dlg-fondo', tipo:'nuevaPacienteVenta'});
  const nombre = $('#nombrePacienteVenta', d);
  nombre.addEventListener('input', () => nombre.setCustomValidity(''));
  $('form', d).addEventListener('submit', async e => {
    e.preventDefault();
    if(cierrePendiente) return;
    const escrito = nombre.value.trim().replace(/\s+/g, ' ');
    if(!escrito){
      nombre.setCustomValidity('Escribe el nombre de la paciente.');
      nombre.reportValidity();
      return;
    }
    const ficha = F.lista.find(p => norm(p.nombre) === norm(escrito));
    const tel = $('#telefonoPacienteVenta', d).value.trim();
    await cerrarCapa(desdeSelector ? 2 : 1);
    seleccionarPacienteVenta(ficha?.nombre || escrito, tel || (editar ? '' : ficha?.tel), editar || Boolean(tel));
  });
}
function pintarAyudaComprobante(){
  const ayuda = $('#ayudaComprobante');
  if(!ayuda) return;
  ayuda.hidden = !F.comprobante;
  ayuda.textContent = F.tel.replace(/\D/g, '') ? `Para ${F.tel}` : 'Podrás elegir el contacto en WhatsApp.';
}
function pintarFechaVenta(){
  const texto = F.fecha ? fCorta(F.fecha) : 'Elige la fecha';
  $('#fechaVisible').textContent = texto;
  $('#fechaResumen').textContent = F.fecha === hoyISO() ? 'Hoy' : texto;
}
function agregarItem(pid){
  const p = prodPorId(pid);
  if(!p || p.borrado || p.tipo !== 'venta') return;
  const ya = F.items.find(i => i.prod === pid);
  if(ya) ya.cant = fCant((num(ya.cant) || 0) + 1);
  else F.items.push({prod:pid, nombre:p.nombre, cant:'1', precio:dineroIn(p.precio ?? 0), costo:p.costo || 0});
  F.ultimoAgregado = pid;
  return p;
}
function numeroVenta(valor){
  if(typeof valor === 'number') return num(valor);
  const limpio = valor.trim().replace(/^\$\s*/, '');
  return /^(?:\d+(?:[.,]\d+)?|[.,]\d+|\d{1,3}(?:\.\d{3})+,\d+)$/.test(limpio) ? num(limpio) : NaN;
}
const importeItemVenta = it => red(numeroVenta(it.cant) || 0) * red(numeroVenta(it.precio) || 0);
const subtotalVenta = items => red(items.reduce((suma, it) => suma + importeItemVenta(it), 0));
const descuentoVenta = valor => valor.trim() ? red(numeroVenta(valor)) : 0;
function pintarSelectorVenta(){
  const q = norm(F.buscar), selector = $('#selProd'), categoria = F.categoria;
  const lista = !q && categoria === 'populares' ? F.populares : F.todos;
  const ps = lista.filter(p => coincideProducto(p, q) && (!categoria.startsWith('cat:') || p.cat === categoria.slice(4)));
  selector.innerHTML = ps.length ? ps.map(p => {
    const stock = stockDe(p.id);
    const aviso = avisosDe(p).find(a => a.clase === 'fecha');
    const nivel = stock <= (p.min || 0) || stock === 1 || aviso?.nivel === 'bad' ? 'bad' : aviso ? 'warn' : '';
    const restante = textoStock(stock);
    return `<button class="tarjeta-venta" data-act="vAgregar" data-id="${esc(p.id)}">
      ${avatar(p)}<span class="nombre-tarjeta-venta">${esc(p.nombre)}</span>
      <strong class="num">${dinero(p.precio)}</strong><span class="stock-tarjeta-venta ${nivel}">${restante}</span>
      <span class="cantidad-tarjeta-venta" hidden></span>
    </button>`;
  }).join('') : `<div class="vacio">${F.todos.length ? 'No encontré productos con ese filtro.' : 'Agrega productos en Inventario para empezar a vender.'}</div>`;
  cargarFotos(selector);
  pintarCantidadesVenta();
}
function pintarCantidadesVenta(animar){
  const cantidades = new Map(F.items.map(i => [i.prod, i.cant]));
  for(const boton of $$('.tarjeta-venta', $('#selProd'))){
    const cantidad = cantidades.get(boton.dataset.id), insignia = $('.cantidad-tarjeta-venta', boton);
    boton.classList.toggle('en-carrito', Boolean(cantidad));
    insignia.hidden = !cantidad;
    insignia.textContent = cantidad ? cantidad : '';
    insignia.setAttribute('aria-label', cantidad ? cantidad + ' en el carrito' : '');
    if(cantidad && boton.dataset.id === animar && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      insignia.animate([{transform:'scale(.8)'}, {transform:'scale(1.18)'}, {transform:'scale(1)'}], {duration:180});
  }
}
function pintarCarrito(animar){
  const items = $('#itemsVenta'), activo = document.activeElement;
  items.innerHTML = F.items.length ? F.items.map((it, i) => `<div class="item-venta" role="group" aria-label="${esc(it.nombre)}">
    <button class="producto-carrito" data-act="vPrecio" data-i="${i}" aria-label="Editar precio de ${esc(it.nombre)}">
      ${avatar(prodPorId(it.prod) || it, 'sm')}<span class="producto-carrito-texto">
        <span class="n">${esc(it.nombre)}</span><span class="precio-carrito num">${dinero(num(it.precio))} c/u</span>
      </span>
    </button>
    ${pasos('Cantidad', 'cant', '', i)}
  </div>`).join('') : '<p class="peq muted sin-items">Toca un producto para agregarlo a la venta.</p>';
  cargarFotos(items);
  if(!activo.isConnected) enfocarControl(activo, items);
  actualizarTotalesVenta(animar);
}
function actualizarTotalesVenta(animar){
  const n = F.items.length, ultima = F.items.find(it => it.prod === F.ultimoAgregado) || F.items.at(-1);
  const subtotal = subtotalVenta(F.items), descuento = descuentoVenta(F.descuento);
  const total = dinero(Math.max(0, subtotal - (descuento >= 0 ? descuento : 0)));
  const detalle = $('#detalleVenta'), vista = $('#vistaCarrito');
  $('#resumenVenta').textContent = `Venta · ${n} ${n === 1 ? 'producto' : 'productos'}`;
  vista.textContent = ultima ? ultima.nombre : '';
  vista.hidden = !ultima || !detalle.hidden;
  $('#vTotal').textContent = total;
  $('.num', $('#totalDetalle')).textContent = total;
  $('#totalPlegado').hidden = !detalle.hidden;
  $('#totalDetalle').hidden = !n;
  const accion = F.cobrado ? 'Cobrar' : 'Registrar pendiente';
  const importe = n ? (F.cobrado ? ' ' : ' · ') + total : '';
  $('#accionVenta').textContent = F.id ? 'Guardar cambios' : accion + importe;
  $('#accionVenta').parentElement.disabled = !n;
  pintarCantidadesVenta(animar);
}
function agregarALaVenta(id){
  const p = agregarItem(id);
  if(!p) return;
  pintarCarrito(id);
  $('#anuncio').textContent = p.nombre + ' en el carrito. ' + $('#resumenVenta').textContent;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(10);
}
async function venderProducto(id){
  const venta = capaArriba('form');
  if(!id || !venta?.classList.contains('venta-form')){ formVenta(null, id); return; }
  const encima = pila.length - 1 - pila.findIndex(c => c.el === venta);
  if(encima) await cerrarCapa(encima);
  if(pila.at(-1)?.el === venta) agregarALaVenta(id);
}
function editarPrecioVenta(indice){
  const it = F.items[indice];
  const d = abrirCapa(`<form class="dlg hoja-inferior" role="dialog">
    <span class="tirador" aria-hidden="true"></span><h3>Editar precio</h3><p>${esc(it.nombre)}</p>
    <div class="campo"><label for="precioVenta">Precio c/u ($)</label>
      <input id="precioVenta" type="text" inputmode="decimal" value="${esc(it.precio)}" required></div>
    <div class="fila"><button class="btn ghost" type="button" data-act="cerrar">Cancelar</button>
      <button class="btn" type="submit">Aplicar</button></div>
  </form>`, {cls:'dlg-fondo'});
  const precio = $('#precioVenta', d);
  precio.addEventListener('input', () => precio.setCustomValidity(''));
  $('form', d).addEventListener('submit', async e => {
    e.preventDefault();
    if(cierrePendiente) return;
    const valor = numeroVenta(precio.value);
    if(!(valor >= 0)){
      precio.setCustomValidity('Escribe un precio válido.');
      precio.reportValidity();
      return;
    }
    it.precio = dineroIn(valor);
    await cerrarCapa();
    pintarCarrito();
  });
}
document.addEventListener('input', e => {
  const i = e.target.dataset && e.target.dataset.item;
  if(F?.items && i !== undefined){
    F.items[+i][e.target.dataset.c] = e.target.value;
    actualizarTotalesVenta();
  }
});
function enlaceComprobante(v){
  const lineas = v.items.map(it => `${fCant(it.cant)} × ${it.nombre} · ${dinero(importeItemVenta(it))}`);
  const despedida = E.ajustes.plantillaComprobante || PLANTILLA_COMPROBANTE;
  return waLink(v.tel, ['Comprobante SPARATI', fDia(v.fecha) + ' de ' + v.fecha.slice(0, 4),
    ...(v.pac ? [v.pac] : []), '', ...lineas,
    ...(v.descuento ? ['Descuento: ' + dinero(v.descuento)] : []),
    'Total: ' + dinero(totalVenta(v)), v.cobrado ? 'Cobrado · ' + cap(v.pago) : 'Queda pendiente', '', despedida].join('\n'));
}
function cantidadesPorProducto(items){
  const cantidades = new Map();
  for(const it of items) cantidades.set(it.prod, red((cantidades.get(it.prod) || 0) + it.cant));
  return cantidades;
}
async function guardarVenta(){
  const formulario = F;
  if(!F.items.length){ toast('Agrega al menos un producto'); return; }
  if(!F.fecha || F.fecha > hoyISO()){ toast('Revisa la fecha'); return; }
  for(const it of F.items){
    if(!(red(numeroVenta(it.cant)) > 0)){ toast('Revisa la cantidad de ' + it.nombre); return; }
    if(!(numeroVenta(it.precio) >= 0)){ toast('Revisa el precio de ' + it.nombre); return; }
  }
  const descuento = descuentoVenta(F.descuento);
  if(!(descuento >= 0 && descuento <= subtotalVenta(F.items))){
    toast('El descuento tiene que estar entre cero y el subtotal de la venta.');
    if($('#detalleVenta').hidden) ACT.verCarrito($('.resumen-venta'));
    $('#campo-descuento').focus();
    return;
  }
  const previo = F.id ? E.ventas.find(x => x.id === F.id) : null;
  const items = F.items.map(it => ({...it, cant:red(numeroVenta(it.cant)), precio:red(numeroVenta(it.precio)), costo:it.costo || 0}));
  const anteriores = cantidadesPorProducto(previo?.items || []), cantidades = cantidadesPorProducto(items);
  const falta = [...new Set(items.filter(it =>
    cantidades.get(it.prod) > red(stockDe(it.prod) + (anteriores.get(it.prod) || 0))).map(it => esc(it.nombre)))];
  if(falta.length && !(await confirmar('No alcanza el inventario', `Revisa la cantidad disponible de <b>${falta.join(', ')}</b>. Si tienes lo necesario, registra la venta y luego ajusta las existencias en Inventario.`, 'Registrar igual'))) return;
  if(F !== formulario) return;
  const base = previo || {id:uid(), recordados:{}};
  const recordados = norm(base.pac) === norm(F.pac) ? base.recordados : {};
  const v = marcar({...base, pac:F.pac, tel:F.tel, fecha:F.fecha, items, cobrado:F.cobrado, recordados,
    pago:norm(F.pago), nota:F.nota.trim(), descuento}, !previo);
  const ventas = previo ? E.ventas.map(x => x === previo ? v : x) : [...E.ventas, v];
  const movs = E.movs.map(m => m.venta === v.id && !m.borrado ? marcar({...m, borrado:true}) : m);
  const registrados = items.map(it => marcar({id:uid(), prod:it.prod, tipo:'venta', cant:-it.cant,
    fecha:v.fecha, pac:v.pac, precio:it.precio, costo:it.costo || 0, venta:v.id}, true));
  movs.push(...registrados);
  const estado = {...E, ventas, movs, pacientes:[...E.pacientes]};
  if(F.telEditado) estado.pacientes = estado.pacientes.map(p =>
    !p.borrado && norm(p.nombre) === norm(v.pac) && p.tel !== v.tel ? marcar({...p, tel:v.tel}) : p);
  completarPacientes(estado);
  if(!guardar(estado)) return;
  const enlace = !previo && F.comprobante ? enlaceComprobante(v) : '';
  // La venta ya está guardada. Si se bloquea la pestaña, el aviso ofrece el enlace.
  if(enlace){
    try{ window.open(enlace, '_blank', 'noopener'); }
    catch(e){}
  }
  await cerrarCapa(previo ? 1 : pila.length);
  if(!previo){
    irPantalla('inicio');
    window.scrollTo(0, 0);
  }
  refrescar();
  if(previo) toast('Venta actualizada');
  else avisarConDeshacer(`${v.cobrado ? 'Venta cobrada' : 'Venta pendiente'} · ${dinero(totalVenta(v))}`,
    {ventas:[v], movs:registrados}, true, undefined, {exito:true, enlace});
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
  const lista = pacientes().filter(p => coincidePaciente(p, q));
  if(q && !lista.length) return '<div class="vacio">No encontré pacientes con esa búsqueda. Prueba con otro nombre.</div>';
  if(!lista.length){
    const vender = E.productos.some(p => !p.borrado && p.tipo === 'venta' && stockDe(p.id) > 0);
    return `<div class="vacio"><p>Cuando registres una venta a nombre de una paciente, su ficha aparecerá aquí.</p>
      ${vender ? `<button class="btn soft" data-act="vender">${IC.bolsa} Registrar una venta</button>` :
        `<button class="btn soft" data-act="tab" data-tab="venta">${IC.inventario} Ir al inventario</button>`}</div>`;
  }
  return lista.map(filaPaciente).join('');
}
function filaPaciente(p){
  const detalle = p.compras.length ? 'Última compra · ' + fCorta(p.compras[0].fecha) : 'Sin compras';
  return `<button class="fila-lista fila-paciente" data-act="verPaciente" data-n="${esc(p.nombre)}">${avatar(p, 'persona')}
    <span class="tx"><b>${esc(p.nombre)}</b><span class="m">${esc(detalle)}</span></span>
    <span class="num total-paciente"><span class="solo-lectura">Total de compras </span>${dinero(cifrasVentas(p.compras).total)}</span></button>`;
}
const pacientePorNombre = nombre => pacientes().find(p => norm(p.nombre) === norm(nombre));
function verPaciente(nombre){
  const p = pacientePorNombre(nombre);
  if(!p) return;
  const d = abrirCapa('', {tipo:'paciente', cls:'hoja ficha-paciente'});
  d.dataset.n = nombre;
  pintarPaciente(d, p);
}
function pintarPaciente(d, p = pacientePorNombre(d.dataset.n)){
  if(!p) return;
  const cuerpo = $('.hoja-cuerpo', d), scroll = cuerpo?.scrollTop || 0;
  const foco = cuerpo?.contains(document.activeElement) && document.activeElement;
  const compras = p.compras, usos = p.usos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const fechas = [...new Set(compras.map(v => v.fecha))];
  const frecuencia = fechas.length > 1 ? Math.round(diasEntre(fechas.at(-1), fechas[0]) / (fechas.length - 1)) : 0;
  const antigua = [fechas.at(-1), p.creado ? iso(new Date(p.creado)) : '', usos.at(-1)?.fecha].filter(Boolean).sort()[0];
  const desde = antigua ? aFecha(antigua) : null;
  const subtitulo = [desde && `Paciente desde ${MESES[desde.getMonth()]} ${desde.getFullYear()}`, p.tel || 'Sin teléfono'].filter(Boolean).join(' · ');
  const pendientes = recompras([p]), nombre = esc(p.nombre);
  // La barra se mueve a la ficha activa. El repintado reemplaza su contenido.
  d.innerHTML = `<div class="hoja-cuerpo"><div class="hoja-in contenido-paciente">
    <div class="controles-paciente"><button class="icon-btn" data-act="cerrar" aria-label="Volver">${IC.volver}</button>
      <button class="icon-btn" data-act="editarPaciente" data-n="${nombre}" aria-label="Editar paciente">${IC.lapiz}</button></div>
    <header class="cab-paciente">${avatar(p, 'persona')}
      <h1>${nombre}</h1><p>${esc(subtitulo)}</p></header>
    <div class="acc-grid acciones-paciente" role="group" aria-label="Acciones de la paciente">
      <a class="btn" href="${esc(waLink(p.tel, `Hola, ${p.nombre}.`))}" target="_blank" rel="noopener">${IC.chat} WhatsApp</a>
      <button class="btn soft" data-act="ventaPaciente" data-n="${nombre}">${IC.bolsa} Nueva venta</button></div>
    <div class="cifras cifras-paciente" role="group" aria-label="Resumen de compras">
      <div class="cifra"><span class="l">Compró</span><b class="v num">${dinero(cifrasVentas(compras).total)}</b></div>
      <div class="cifra"><span class="l">Compras</span><b class="v num">${compras.length}</b></div>
      <div class="cifra"><span class="l">Vuelve cada</span><b class="v num">${frecuencia ? '~' + duracionDias(frecuencia) : '<span aria-label="Aún sin datos">—</span>'}</b></div>
    </div>
    ${pendientes.length ? `<section class="recompra-paciente" aria-label="Le toca volver a comprar">
      <h2 class="titulo-seccion">Le toca volver a comprar</h2>
      <div class="productos-recompra" role="group" aria-label="Producto para recordar">${pendientes.map((r, i) => `
        <button class="producto-recompra" type="button" data-recompra="${i}" aria-pressed="${i === 0}">${avatar(r.p)}
          <span><b>${esc(r.p.nombre)}</b><small>${diasHasta(r.fecha) < 0 ? 'Se le habría acabado el ' : 'Se le acaba ~'}${esc(fCorta(r.fecha))}</small></span>
          ${pendientes.length > 1 ? IC.check : ''}</button>`).join('')}</div>
      ${editorRecordatorio()}</section>` : ''}
    <section class="card notas-paciente" aria-label="Notas"><h2>Notas</h2>
      <p>${p.notas ? esc(p.notas) : '<span class="muted">Todavía no hay notas.</span>'}</p></section>
    <section class="historial-paciente" aria-label="Compras"><h2 class="titulo-seccion">Compras</h2>
      <div class="filas">${compras.length ? compras.map(filaCompraPaciente).join('') : '<p class="vacio">Todavía no hay compras.</p>'}</div></section>
    ${usos.length ? `<section class="card"><h3>Usado en sus tratamientos</h3>${usos.map(m => {
      const prod = prodPorId(m.prod);
      return `<div class="mov"><span>${esc(prod ? prod.nombre : 'Producto borrado')}</span><span class="q num">${fCant(-m.cant)} ${esc(prod?.unidad)}</span>
        <span class="s">${esc([fCorta(m.fecha), m.trat, m.nota].filter(Boolean).join(' · '))}</span></div>`;
    }).join('')}</section>` : ''}
  </div></div>`;
  d.setAttribute('aria-label', p.nombre);
  if(pila.at(-1)?.el === d) activarCapa();
  if(pendientes.length) prepararRecordatorio(d, pendientes);
  cargarFotos(d);
  $('.hoja-cuerpo', d).scrollTop = scroll;
  if(foco && !enfocarControl(foco, d) && !d.inert) $('[data-act="cerrar"]', d).focus({preventScroll:true});
}
function filaCompraPaciente(v){
  const fecha = aFecha(v.fecha);
  const pago = [v.pago && cap(v.pago), !v.cobrado && 'Por cobrar'].filter(Boolean).join(' · ');
  const items = v.items.map(i => (i.cant === 1 ? '' : fCant(i.cant) + ' × ') + i.nombre).join(' · ');
  return `<button class="fila-lista compra-paciente" data-act="editarVenta" data-id="${esc(v.id)}">
    <time datetime="${esc(v.fecha)}" aria-label="${esc(fCorta(v.fecha))}"><b>${fecha.getDate()}</b><span>${MESES_C[fecha.getMonth()]}${fecha.getFullYear() !== new Date().getFullYear() ? ' ' + fecha.getFullYear() : ''}</span></time>
    <span class="tx"><b>${esc(items)}</b>${pago ? `<span class="m">${esc(pago)}</span>` : ''}</span>
    <strong class="num">${dinero(totalVenta(v))}</strong></button>`;
}
function editarPaciente(nombre){
  const p = pacientePorNombre(nombre);
  if(!p) return;
  const d = abrirCapa(cabecera('Editar paciente', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <form id="datosPaciente" class="card"><h3>${esc(p.nombre)}</h3>
      <div class="campo"><label for="telefonoPaciente">Teléfono (opcional)</label>
        <input id="telefonoPaciente" type="tel" autocomplete="off" value="${esc(p.tel)}"></div>
      <div class="campo"><label for="notasPaciente">Notas</label>
        <textarea id="notasPaciente" rows="4" placeholder="Ej.: Prefiere protector sin color">${esc(p.notas)}</textarea></div>
    </form></div></div>
    <footer class="hoja-pie"><div class="in"><button class="btn ghost" data-act="cerrar">Cancelar</button>
      <button class="btn" type="submit" form="datosPaciente">Guardar</button></div></footer>`, {tipo:'edicionPaciente'});
  $('form', d).addEventListener('submit', async e => {
    e.preventDefault();
    if(cierrePendiente) return;
    const tel = $('#telefonoPaciente', d).value.trim(), notas = $('#notasPaciente', d).value.trim();
    const actual = vivos(E.pacientes).find(f => norm(f.nombre) === norm(p.nombre));
    if(!actual || tel !== actual.tel || notas !== (actual.notas || '')){
      const ficha = actual ? marcar({...actual, tel, notas}) : {...pacienteNuevo(p.nombre, tel), notas};
      const pacientes = actual ? E.pacientes.map(f => f === actual ? ficha : f) : [...E.pacientes, ficha];
      if(!guardar({...E, pacientes})) return;
    }
    await cerrarCapa();
    refrescar();
    toast('Datos de la paciente guardados');
  });
}

// El mensaje se prepara en la app y WhatsApp abre el contacto con el texto listo.
function editorRecordatorio(){
  return `<div class="editor-recordatorio">
    <label class="mensaje-recordatorio"><span class="solo-lectura">Mensaje de recordatorio</span>${IC.lapiz}
      <textarea rows="5" required></textarea></label>
    <a class="btn full" data-enviar-recordatorio target="_blank" rel="noopener">${IC.chat} Enviar recordatorio</a>
  </div>`;
}
function prepararRecordatorio(d, pendientes, cerrarAlEnviar = false){
  const campo = $('.mensaje-recordatorio textarea', d), enlace = $('[data-enviar-recordatorio]', d);
  const opciones = $$('[data-recompra]', d);
  const borradores = d.borradoresRecordatorio ||= new Map();
  const claves = pendientes.map(({v, p}) => JSON.stringify([v.id, p.id]));
  let elegido = 0;
  const actualizar = () => {
    const {paciente} = pendientes[elegido];
    campo.setCustomValidity('');
    enlace.href = waLink(paciente.tel, campo.value.trim());
  };
  const elegir = indice => {
    elegido = indice;
    const {paciente, p} = pendientes[indice];
    campo.value = borradores.get(claves[indice]) ?? mensajeRecordatorio(paciente, p);
    opciones.forEach((b, i) => b.setAttribute('aria-pressed', String(i === indice)));
    actualizar();
  };
  campo.addEventListener('input', () => {
    borradores.set(claves[elegido], campo.value);
    actualizar();
  });
  opciones.forEach((b, i) => b.addEventListener('click', () => elegir(i)));
  elegir(0);
  enlace.addEventListener('click', e => {
    if(!campo.value.trim()){
      e.preventDefault();
      campo.setCustomValidity('Escribe el recordatorio que quieres enviar.');
      campo.reportValidity();
      return;
    }
    const {v, p} = pendientes[elegido];
    const paciente = pacientePorNombre(v.pac);
    const pendiente = paciente && recompras([paciente]).find(r => r.v.id === v.id && r.p.id === p.id);
    if(!pendiente){
      e.preventDefault();
      toast('Este recordatorio ya no está pendiente.');
      return;
    }
    const venta = marcar({...pendiente.v, recordados:{...pendiente.v.recordados, [p.id]:true}});
    if(!guardar({...E, ventas:E.ventas.map(x => x === pendiente.v ? venta : x)})){
      e.preventDefault();
      return;
    }
    borradores.delete(claves[elegido]);
    enlace.href = waLink(paciente.tel, campo.value.trim());
    // Dejar que Safari abra el enlace del toque antes de retirar el control.
    setTimeout(async () => {
      if(cerrarAlEnviar && pila.at(-1)?.el === d) await cerrarCapa();
      refrescar();
      toast('Recordatorio anotado', () => {
        const actual = E.ventas.find(x => x.id === venta.id && !x.borrado);
        if(actual !== venta){ toast('Ese registro cambió mientras tanto.'); return; }
        const recordados = {...actual.recordados};
        delete recordados[p.id];
        if(!guardar({...E, ventas:E.ventas.map(x => x === actual ? marcar({...x, recordados}) : x)})) return;
        refrescar();
        toast('Recordatorio pendiente otra vez');
      });
    }, 0);
  });
}
function mensajeRecordatorio(paciente, producto){
  const plantilla = E.ajustes.plantillaRecordatorio || PLANTILLA_RECORDATORIO;
  return plantilla.replace(/\{(nombre|producto)\}/g, (_, campo) => campo === 'nombre' ? paciente.nombre : producto.nombre);
}
function abrirRecordatorio(venta, producto){
  const pendiente = recompras().find(r => r.v.id === venta && r.p.id === producto);
  if(!pendiente) return;
  const {paciente, p} = pendiente;
  const d = abrirCapa(cabecera('Recordatorio', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <section class="card recompra-paciente"><header><h3>${esc(paciente.nombre)}</h3><p>${esc(p.nombre)}</p></header>
      ${editorRecordatorio()}</section></div></div>`, {tipo:'recordatorio'});
  prepararRecordatorio(d, [pendiente], true);
}

// ---------- Lista de compras ----------
function pedidosPendientes(){
  const recibidos = new Map(), catalogo = new Map(vivos(E.productos).map(p => [p.id, p]));
  for(const m of E.movs){
    if(m.borrado || m.tipo !== 'entrada' || !m.pedido) continue;
    if(!recibidos.has(m.pedido)) recibidos.set(m.pedido, new Map());
    const porProducto = recibidos.get(m.pedido);
    porProducto.set(m.prod, (porProducto.get(m.prod) || 0) + m.cant);
  }
  const pendientes = [];
  for(const pedido of vivos(E.pedidos)){
    const items = pedido.items.map(it => {
      const falta = red(it.cant - (recibidos.get(pedido.id)?.get(it.prod) || 0));
      const p = catalogo.get(it.prod);
      const vigente = p && (p.unidad || 'unidades') === it.unidad;
      return {...it, falta, p:vigente ? p : null};
    }).filter(it => it.falta > 0);
    if(items.length) pendientes.push({pedido, items});
  }
  return pendientes;
}
function gruposParaPedir(id, pedidos){
  const catalogo = productos(), telefonos = new Map(), enCamino = new Map(), grupos = new Map();
  for(const p of catalogo){
    const nombre = norm(p.prov), tel = telefonoWhatsApp(p.telProv);
    if(!nombre || !tel) continue;
    if(!telefonos.has(nombre)) telefonos.set(nombre, new Map());
    telefonos.get(nombre).set(tel, p.prov.trim());
  }
  for(const {items} of pedidos){
    for(const it of items){
      if(it.p) enCamino.set(it.prod, (enCamino.get(it.prod) || 0) + it.falta);
    }
  }
  for(const p of catalogo){
    if((id && p.id !== id) || !avisosDe(p).some(a => a.clase === 'stock')) continue;
    const stock = stockDe(p.id), consumo = CONSUMO.get(p.id) || 0;
    const objetivo = p.max > 0 ? p.max : Math.max((Number(p.min) || 0) + 1, Math.ceil(consumo * 30));
    const cant = red(objetivo - stock - (enCamino.get(p.id) || 0));
    if(!(cant > 0)) continue;
    const nombre = norm(p.prov), contactos = telefonos.get(nombre);
    const tel = telefonoWhatsApp(p.telProv) || (contactos?.size === 1 ? contactos.keys().next().value : '');
    const clave = JSON.stringify([nombre, tel]);
    if(!grupos.has(clave)) grupos.set(clave, {proveedor:contactos?.get(tel) || p.prov?.trim() || 'Sin proveedor', tel, items:[]});
    grupos.get(clave).items.push({p, stock, prod:p.id, nombre:p.nombre, marca:p.marca, unidad:p.unidad || 'unidades', cant});
  }
  return [...grupos.values()].sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es'));
}
const cantidadPedido = (cant, unidad) => `${fCant(cant)} ${uTxt(cant, unidad)}`;
const nombrePedido = it => it.nombre + (it.marca ? ' (' + it.marca + ')' : '');
function textoPedido(items){
  return 'Hola, te escribe SPARATI. Quisiera hacer este pedido:\n' +
    items.map(it => `• ${cantidadPedido(it.cant, it.unidad)} de ${nombrePedido(it)}`).join('\n') + '\nGracias.';
}
function abrirCompras(id){
  recargarEstadoSiCambio();
  const d = abrirCapa('', {cls:'hoja hoja-compras', tipo:'compras'});
  d.dataset.id = id || '';
  pintarCompras(d);
}
function filaPedido(it, pendiente){
  const {p, unidad} = it, nombre = esc(p?.nombre || it.nombre);
  const detalle = pendiente ? 'Por recibir ' + cantidadPedido(it.falta, unidad) : 'Hay ' + cantidadPedido(it.stock, unidad);
  const contenido = `${p ? avatar(p) : `<span class="pedido-icono">${IC.inventario}</span>`}
    <span class="tx"><b>${nombre}</b><span class="m">${esc(detalle)}</span></span>
    ${!pendiente ? `<span class="pill gold">Pedir ${esc(cantidadPedido(it.cant, unidad))}</span>` : ''}`;
  return p ? `<button class="fila-lista" data-act="verProd" data-id="${esc(p.id)}">${contenido}</button>` :
    `<div class="fila-lista">${contenido}</div>`;
}
function grupoParaPedir(grupo, i){
  const {proveedor, tel, items} = grupo;
  return `<section class="card pedido-card" aria-label="${esc(proveedor)}">
    <header class="pedido-cabecera"><h3>${esc(proveedor)}</h3><span class="muted">${tel ? '+' + tel : 'Sin WhatsApp registrado'}</span></header>
    <div class="pedido-filas">${items.map(it => filaPedido(it, false)).join('')}</div>
    <div class="pedido-acciones">
      ${tel ? `<a class="btn soft" href="${esc(waLink(tel, textoPedido(items)))}" target="_blank" rel="noopener">${IC.chat} WhatsApp</a>` : ''}
      <button class="btn ghost" data-act="marcarPedido" data-grupo="${i}">Marcar como pedido</button>
    </div>
  </section>`;
}
function tarjetaPedidoPendiente({pedido, items}){
  const id = esc(pedido.id);
  return `<section class="card pedido-card" aria-label="${esc(pedido.proveedor)}">
    <header class="pedido-cabecera"><h3>${esc(pedido.proveedor)}</h3>
      <span class="muted">Pedido el ${fCorta(pedido.fecha)}</span></header>
    <div class="pedido-filas">${items.map(it => filaPedido(it, true)).join('')}</div>
    <div class="pedido-acciones">
      <button class="btn" data-act="abrirLlegadaPedido" data-id="${id}">${IC.entrada} Llegó</button>
      <button class="btn ghost" data-act="cerrarPedido" data-id="${id}">Cerrar pedido</button>
    </div>
  </section>`;
}
function pintarCompras(d){
  const id = d.dataset.id, pedidos = pedidosPendientes();
  const grupos = gruposParaPedir(id, pedidos);
  const visibles = pedidos.filter(({items}) => !id || items.some(it => it.prod === id));
  d.dataset.vista ||= grupos.length || !visibles.length ? 'sugeridos' : 'pedidos';
  const mostrandoPedidos = d.dataset.vista === 'pedidos';
  const activo = d.contains(document.activeElement) ? document.activeElement : null;
  const desplazamiento = $('.hoja-cuerpo', d)?.scrollTop || 0;
  const contenido = mostrandoPedidos ?
    (visibles.map(tarjetaPedidoPendiente).join('') || '<p class="vacio">Todavía no hay pedidos por recibir.</p>') :
    (grupos.map(grupoParaPedir).join('') || `<div class="estado-ok">${IC.check}<span>No hay nada más por pedir.</span></div>`);
  d.innerHTML = cabecera('Lista de compras', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="seg" role="group" aria-label="Lista de compras">
      ${opcion('vistaCompras', 'sugeridos', 'Por pedir', !mostrandoPedidos)}
      ${opcion('vistaCompras', 'pedidos', 'Pedidos' + (visibles.length ? ' · ' + visibles.length : ''), mostrandoPedidos)}
    </div>${contenido}
    ${!mostrandoPedidos && grupos.length ? `<button class="btn ghost full" data-act="compartirCompras" data-id="${esc(id)}">${id ? 'Compartir pedido' : 'Compartir la lista completa'}</button>` : ''}</div></div>`;
  cargarFotos(d);
  $('.hoja-cuerpo', d).scrollTop = desplazamiento;
  if(activo && !enfocarControl(activo, d)) $('.seg .on', d).focus({preventScroll:true});
}
function mostrarVistaCompras(d, vista){
  d.dataset.vista = vista;
  $('.hoja-cuerpo', d).scrollTop = 0;
  pintarCompras(d);
  $('.seg .on', d).focus({preventScroll:true});
}
function marcarPedido(b){
  if(recargarEstadoSiCambio()){ toast('La lista cambió. Revisa las cantidades y vuelve a intentar.'); return; }
  const d = b.closest('.hoja-compras'), grupo = gruposParaPedir(d.dataset.id, pedidosPendientes())[Number(b.dataset.grupo)];
  if(!grupo) return;
  const items = grupo.items.map(({prod, nombre, unidad, cant}) => ({prod, nombre, unidad, cant}));
  const pedido = marcar({id:uid(), proveedor:grupo.proveedor, fecha:hoyISO(), items}, true);
  if(!guardar({...E, pedidos:[pedido, ...E.pedidos]})) return;
  mostrarVistaCompras(d, 'pedidos');
  toast('Pedido anotado');
}
async function cerrarPedido(id){
  if(!(await confirmar('¿Cerrar este pedido?', 'Las cantidades que faltan quedarán disponibles para volver a pedir. Las entradas que ya registraste se conservan.', 'Cerrar pedido'))) return;
  recargarEstadoSiCambio();
  const pendiente = pedidosPendientes().find(x => x.pedido.id === id);
  if(!pendiente) return;
  const pedidos = E.pedidos.map(p => p === pendiente.pedido ? marcar({...p, borrado:true}) : p);
  if(!guardar({...E, pedidos})) return;
  refrescar();
  toast('Pedido cerrado');
}
function abrirLlegadaPedido(id){
  recargarEstadoSiCambio();
  const pendiente = pedidosPendientes().find(x => x.pedido.id === id);
  if(!pendiente) return;
  const {pedido, items} = pendiente, vigentes = items.filter(it => it.p);
  const d = abrirCapa(cabecera('Llegó el pedido', '', true) +
    `<form class="pedido-llegada" novalidate>
      <div class="hoja-cuerpo"><div class="hoja-in">
        <div class="pedido-cabecera"><strong>${esc(pedido.proveedor)}</strong>
          <p class="muted">Anota cuánto llegó y cuánto costó cada uno. Si algo no llegó, escribe 0.</p></div>
        ${vigentes.map((it, i) => `<section class="card pedido-recibir" aria-label="${esc(it.p.nombre)}" data-prod="${esc(it.prod)}">
          <header>${avatar(it.p)}<div><h3>${esc(it.p.nombre)}</h3><span class="muted">Por recibir ${esc(cantidadPedido(it.falta, it.unidad))}</span></div></header>
          <div class="fila2">
            <div class="campo"><label for="llegada-cant-${i}">Cantidad recibida</label>
              <input id="llegada-cant-${i}" data-cant inputmode="decimal" value="${fCant(it.falta)}"></div>
            <div class="campo"><label for="llegada-costo-${i}">Costo por ${esc(singular(it.unidad))} ($)</label>
              <input id="llegada-costo-${i}" data-costo inputmode="decimal" value="${esc(dineroIn(it.p.costo ?? 0))}"></div>
          </div>
        </section>`).join('')}
        ${items.filter(it => !it.p).map(it => `<p class="vacio">${esc(it.nombre)} ya no está disponible con la unidad del pedido.</p>`).join('')}
      </div></div>
      ${vigentes.length ? '<footer class="hoja-pie"><div class="in"><button class="btn" type="submit">Registrar llegada</button></div></footer>' : ''}
    </form>`, {cls:'hoja hoja-compras', tipo:'llegadaPedido'});
  cargarFotos(d);
  $('form', d).addEventListener('input', e => e.target.removeAttribute('aria-invalid'));
  $('form', d).addEventListener('submit', e => {
    e.preventDefault();
    if(!cierrePendiente) registrarLlegadaPedido(d, id);
  });
}
async function registrarLlegadaPedido(d, id){
  if(recargarEstadoSiCambio()){
    await cerrarCapa();
    toast('El inventario cambió. Abre el pedido para revisar lo que falta.');
    return;
  }
  const pendiente = pedidosPendientes().find(x => x.pedido.id === id);
  if(!pendiente) return;
  const entradas = [], costos = new Map(), anteriores = new Map();
  const porId = new Map(pendiente.items.filter(it => it.p).map(it => [it.prod, it.p]));
  for(const fila of $$('[data-prod]', d)){
    const p = porId.get(fila.dataset.prod);
    const campoCant = $('[data-cant]', fila), campoCosto = $('[data-costo]', fila);
    const cant = cantidadEscrita(campoCant.value), costo = cantidadEscrita(campoCosto.value);
    const error = cant === null ? campoCant : cant > 0 && costo === null ? campoCosto : null;
    if(error){
      error.setAttribute('aria-invalid', 'true');
      error.focus();
      toast(error === campoCant ? 'Escribe una cantidad válida con hasta dos decimales.' : 'Escribe el costo de compra con hasta dos decimales.');
      return;
    }
    if(!p || cant === 0) continue;
    entradas.push(marcar({id:uid(), prod:p.id, tipo:'entrada', cant, costo, fecha:hoyISO(), pedido:id,
      nota:'Pedido · ' + pendiente.pedido.proveedor}, true));
    if(costo !== p.costo){
      anteriores.set(p.id, p.costo ?? 0);
      costos.set(p.id, marcar({...p, costo}));
    }
  }
  if(!entradas.length){ toast('Anota cuánto llegó de al menos un producto.'); return; }
  const productos = E.productos.map(p => costos.get(p.id) || p);
  if(!guardar({...E, productos, movs:[...E.movs, ...entradas]})) return;
  await cerrarCapa();
  refrescar();
  const falta = pedidosPendientes().some(x => x.pedido.id === id);
  toast(falta ? 'Llegada guardada · Aún faltan productos' : 'Llegada guardada · Pedido completo', () => {
    recargarEstadoSiCambio();
    const ids = new Set(entradas.map(m => m.id));
    const vigentes = vivos(E.movs), movs = vigentes.filter(m => ids.has(m.id));
    if(!movs.length) return;
    const ultimas = new Map(vigentes.filter(m => m.tipo === 'entrada').map(m => [m.prod, m.id]));
    const restaurados = E.productos.map(p => {
      const cambio = costos.get(p.id);
      return !p.borrado && cambio && p.costo === cambio.costo && p.mod === cambio.mod && ids.has(ultimas.get(p.id)) ?
        marcar({...p, costo:anteriores.get(p.id)}) : p;
    });
    if(!guardarBorrado({movs}, true, restaurados)) return;
    refrescar();
    toast('Listo, se deshizo');
  });
}
async function compartirTexto(t){
  try{ if(navigator.share){ await navigator.share({text:t}); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(t); toast('Lista copiada. Pégala en WhatsApp.'); }catch(e){ toast('No se pudo compartir en este navegador'); }
}

// ---------- Códigos de barras ----------
const FORMATOS_CODIGO = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];
function claveCodigo(codigo){
  const valor = String(codigo ?? '').trim();
  return /^SP-/i.test(valor) ? valor.toUpperCase() : valor;
}
function varianteUPC(clave){
  // Algunos lectores devuelven UPC-A como EAN-13, con un cero delante.
  const ean = /^0\d{12}$/.test(clave), upc = ean ? clave.slice(1) : clave;
  if(!/^\d{12}$/.test(upc)) return '';
  const suma = [...upc].reduce((s, cifra, i) => s + Number(cifra) * (i % 2 ? 1 : 3), 0);
  return suma % 10 === 0 ? (ean ? upc : '0' + upc) : '';
}
function productoPorCodigo(codigo, excepto){
  const clave = claveCodigo(codigo);
  if(!clave) return;
  const buscar = valor => E.productos.find(p => !p.borrado && p.id !== excepto && claveCodigo(p.codigo) === valor);
  const variante = varianteUPC(clave);
  return buscar(clave) || (variante ? buscar(variante) : undefined);
}
function guardarCodigoProducto(id, codigo){
  const actual = prodPorId(id);
  if(!actual || actual.borrado) return false;
  if(actual.codigo === codigo) return true;
  const actualizado = marcar({...actual, codigo});
  return guardar({...E, productos:E.productos.map(p => p === actual ? actualizado : p)});
}

// ---------- Etiquetas QR ----------
const ETIQUETAS_POR_HOJA = 24;
const ALFABETO_ETIQUETAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codigoDeEtiqueta = p => /^SP-[A-Z0-9]{5}$/.test(claveCodigo(p.codigo));

function generarCodigoEtiqueta(ocupados){
  let codigo;
  do{
    const valores = crypto.getRandomValues(new Uint8Array(5));
    codigo = 'SP-' + Array.from(valores, n => ALFABETO_ETIQUETAS[n % ALFABETO_ETIQUETAS.length]).join('');
  }while(ocupados.has(codigo));
  ocupados.add(codigo);
  return codigo;
}

function productosEtiquetables(){
  const ocupados = new Set(), repetidos = new Set();
  for(const p of vivos(E.productos)){
    const codigo = claveCodigo(p.codigo);
    if(ocupados.has(codigo)) repetidos.add(codigo);
    ocupados.add(codigo);
  }
  return productos().filter(p => {
    const codigo = claveCodigo(p.codigo);
    return !codigo || (codigoDeEtiqueta(p) && !repetidos.has(codigo));
  });
}

function abrirEtiquetasQR(){
  recargarEstadoSiCambio();
  const d = abrirCapa(cabecera('Etiquetas QR', '', true) + `<form class="form-etiquetas">
    <div class="hoja-cuerpo"><div class="hoja-in">
      <p class="ayuda">Elige los productos que vas a etiquetar. Puedes reimprimir los QR que ya tienen.</p>
      ${buscador('Buscar productos para etiquetar', {id:'buscarEtiquetas'})}
      <div class="cab-lista-etiquetas">
        <p class="ayuda" data-total-etiquetas role="status"></p>
        <button class="link" type="button" data-seleccionar-etiquetas></button>
      </div>
      <div data-lista-etiquetas></div>
    </div></div>
    <footer class="hoja-pie"><div class="in"><button class="btn" type="submit" disabled>Preparar etiquetas</button></div></footer>
  </form>`, {cls:'hoja hoja-etiquetas'});
  const seleccion = new Set();
  const buscar = $('#buscarEtiquetas', d), lista = $('[data-lista-etiquetas]', d);
  const seleccionar = $('[data-seleccionar-etiquetas]', d), preparar = $('button[type="submit"]', d);
  let disponibles = productosEtiquetables(), visibles = [], preparando = false;

  function actualizarControles(){
    const todos = visibles.every(p => seleccion.has(p.id));
    const grupo = norm(buscar.value) ? ' los resultados' : ' todos';
    seleccionar.textContent = (todos ? 'Quitar' : 'Elegir') + grupo;
    seleccionar.hidden = visibles.length === 0;
    $('[data-total-etiquetas]', d).textContent = seleccion.size === 1 ? '1 producto elegido' : `${seleccion.size} productos elegidos`;
    preparar.disabled = preparando || !seleccion.size;
  }
  function pintarLista(){
    const consulta = norm(buscar.value);
    visibles = disponibles.filter(p => coincideProducto(p, consulta));
    lista.classList.toggle('card', Boolean(visibles.length));
    lista.innerHTML = visibles.length ? visibles.map(p => `<label class="fila-etiqueta">
      <input type="checkbox" value="${esc(p.id)}"${seleccion.has(p.id) ? ' checked' : ''}>
      <span><strong>${esc(p.nombre)}</strong>
        <small>${esc([p.marca, p.tipo === 'uso' ? 'Uso en spa' : 'Para vender'].filter(Boolean).join(' · '))}</small></span>
      <span class="estado-etiqueta">${codigoDeEtiqueta(p) ? 'Con QR' : 'Sin código'}</span>
    </label>`).join('') : `<p class="vacio">${disponibles.length ? 'No encontramos productos con esa búsqueda.' : 'No hay productos disponibles para etiquetar.'}</p>`;
    actualizarControles();
  }
  buscar.addEventListener('input', pintarLista);
  buscar.addEventListener('keydown', e => { if(e.key === 'Enter') e.preventDefault(); });
  lista.addEventListener('change', e => {
    if(e.target.checked) seleccion.add(e.target.value);
    else seleccion.delete(e.target.value);
    actualizarControles();
  });
  seleccionar.addEventListener('click', () => {
    const quitar = visibles.every(p => seleccion.has(p.id));
    for(const p of visibles){
      if(quitar) seleccion.delete(p.id);
      else seleccion.add(p.id);
    }
    $$('.fila-etiqueta input', lista).forEach(campo => { campo.checked = seleccion.has(campo.value); });
    actualizarControles();
  });
  $('form', d).addEventListener('submit', async e => {
    e.preventDefault();
    if(preparando || !seleccion.size) return;
    preparando = true;
    actualizarControles();
    try{
      const {qrcode} = await import('./vendor/qrcode.esm.js');
      const prepararVista = () => {
        if(!d.isConnected || d.inert || cierrePendiente) return;
        recargarEstadoSiCambio();
        disponibles = productosEtiquetables();
        const elegidos = disponibles.filter(p => seleccion.has(p.id));
        if(elegidos.length !== seleccion.size){
          const ids = new Set(elegidos.map(p => p.id));
          for(const id of seleccion) if(!ids.has(id)) seleccion.delete(id);
          pintarLista();
          toast('El inventario cambió. Revisa los productos elegidos.');
          return;
        }
        const ocupados = new Set(E.productos.map(p => claveCodigo(p.codigo)));
        const nuevos = new Map();
        const etiquetas = elegidos.map(p => {
          if(claveCodigo(p.codigo)) return p;
          const nuevo = marcar({...p, codigo:generarCodigoEtiqueta(ocupados)});
          nuevos.set(p.id, nuevo);
          return nuevo;
        });
        if(nuevos.size){
          const productos = E.productos.map(p => nuevos.get(p.id) || p);
          if(!guardar({...E, productos})) return;
          refrescar();
          disponibles = disponibles.map(p => nuevos.get(p.id) || p);
        }
        preparando = false;
        pintarLista();
        preparar.focus({preventScroll:true});
        abrirVistaEtiquetas(etiquetas, qrcode);
      };
      if(navigator.locks) await navigator.locks.request(CLAVE + '_etiquetas', prepararVista);
      else prepararVista();
    }catch(e){
      toast('No se pudieron preparar las etiquetas. Inténtalo otra vez.');
    }finally{
      preparando = false;
      actualizarControles();
    }
  });
  pintarLista();
}

function abrirVistaEtiquetas(etiquetas, crearQR){
  const hojas = [];
  for(let i = 0; i < etiquetas.length; i += ETIQUETAS_POR_HOJA){
    const celdas = etiquetas.slice(i, i + ETIQUETAS_POR_HOJA).map(p => {
      const codigo = claveCodigo(p.codigo), qr = crearQR(1, 'M');
      qr.addData(codigo, 'Alphanumeric');
      qr.make();
      return `<li class="etiqueta-qr">
        <span class="dibujo-etiqueta" aria-hidden="true">${qr.createSvgTag({cellSize:1, margin:4, scalable:true})}</span>
        <div class="texto-etiqueta">
          <img src="emblema.png" alt="" width="28" height="28">
          <strong title="${esc(p.nombre)}">${esc(p.nombre)}</strong>
          <small>${esc(codigo)}</small>
        </div>
      </li>`;
    }).join('');
    hojas.push(`<div class="pagina-etiquetas"><ol aria-label="Hoja ${hojas.length + 1}">${celdas}</ol></div>`);
  }
  const resumen = `${etiquetas.length === 1 ? '1 etiqueta' : etiquetas.length + ' etiquetas'} · ${hojas.length === 1 ? '1 hoja A4' : hojas.length + ' hojas A4'}`;
  const d = abrirCapa(cabecera('Vista previa', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <div class="resumen-etiquetas"><strong>${resumen}</strong><p class="ayuda">24 etiquetas por hoja, en 3 columnas y 8 filas.</p></div>
    ${hojas.join('')}
  </div></div>
  <footer class="hoja-pie"><div class="in"><button type="button" class="btn">Imprimir etiquetas</button></div></footer>`,
  {cls:'hoja hoja-vista-etiquetas'});
  $('.hoja-pie button', d).addEventListener('click', () => {
    recargarEstadoSiCambio();
    const cambio = etiquetas.some(p => {
      const actual = productoPorCodigo(p.codigo);
      return actual?.id !== p.id || actual.nombre !== p.nombre || productoPorCodigo(p.codigo, p.id);
    });
    if(cambio){
      toast('El inventario cambió. Vuelve a preparar las etiquetas.');
      return;
    }
    window.print();
  });
}

let lectorLocal;
async function detectorDeCodigos(){
  try{
    const formatos = await window.BarcodeDetector?.getSupportedFormats?.();
    if(formatos && FORMATOS_CODIGO.every(f => formatos.includes(f))) return new window.BarcodeDetector({formats:FORMATOS_CODIGO});
  }catch(e){}
  if(!lectorLocal){
    lectorLocal = new Promise((resolver, rechazar) => {
      const script = document.createElement('script');
      script.src = new URL('vendor/barcode-detector.js', document.baseURI);
      script.onload = () => {
        try{
          const api = window.BarcodeDetectionAPI;
          api.prepareZXingModule({overrides:{locateFile: () => new URL('vendor/zxing_reader.wasm', document.baseURI).href}});
          resolver(api.BarcodeDetector);
        }catch(e){ script.remove(); rechazar(e); }
      };
      script.onerror = () => { script.remove(); rechazar(new Error('No se pudo cargar el lector')); };
      document.head.append(script);
    }).catch(error => { lectorLocal = null; throw error; });
  }
  const Detector = await lectorLocal;
  return new Detector({formats:FORMATOS_CODIGO});
}
function visorCamara(){
  return `
    <div class="visor-codigo" data-visor-camara hidden>${videoCamara()}</div>
    <button class="btn soft" type="button" data-camara>${IC.escaneo} Abrir cámara</button>
    <p class="ayuda" role="status" data-estado-camara></p>`;
}
function videoCamara(){
  return '<video playsinline muted autoplay aria-label="Vista de la cámara"></video>';
}
function avisarLectura(sonido){
  navigator.vibrate?.(35);
  if(sonido?.state !== 'running') return;
  try{
    const inicio = sonido.currentTime, tono = sonido.createOscillator(), volumen = sonido.createGain();
    tono.frequency.value = 880;
    volumen.gain.setValueAtTime(.14, inicio);
    volumen.gain.exponentialRampToValueAtTime(.001, inicio + .12);
    tono.connect(volumen).connect(sonido.destination);
    tono.start(inicio);
    tono.stop(inicio + .12);
  }catch(e){}
}
function prepararCamara(d, alLeer, {alAbrir, alFallar, conservarVista = false, lecturaContinua = false} = {}){
  const video = $('video', d), visor = $('[data-visor-camara]', d), boton = $('[data-camara]', d);
  const estado = $('[data-estado-camara]', d), linterna = $('[data-linterna]', d);
  let intento, flujo, espera, sonido;
  function detenerCamara(){
    intento = null;
    clearTimeout(espera);
    flujo?.getTracks().forEach(pista => pista.stop());
    flujo = video.srcObject = null;
    visor.hidden = true;
    d.classList.remove('camara-activa', 'abriendo-camara');
    boton.disabled = false;
    if(linterna){
      linterna.hidden = true;
      linterna.disabled = false;
      linterna.setAttribute('aria-pressed', 'false');
    }
  }
  function pausarCamara(){
    if(intento){
      detenerCamara();
      estado.textContent = 'La cámara se pausó. Puedes abrirla de nuevo.';
    }
  }
  function alCambiarVisibilidad(){ if(document.hidden) pausarCamara(); }
  function mostrarFallo(mensaje){
    detenerCamara();
    estado.textContent = mensaje + ' Puedes escribir el código a mano.';
    alFallar?.();
  }
  linterna?.addEventListener('click', async () => {
    const pista = flujo?.getVideoTracks()[0];
    if(!pista) return;
    const encender = linterna.getAttribute('aria-pressed') !== 'true';
    linterna.disabled = true;
    try{
      await pista.applyConstraints({advanced:[{torch:encender}]});
      if(flujo?.getVideoTracks()[0] === pista) linterna.setAttribute('aria-pressed', String(encender));
    }catch(e){
      if(flujo?.getVideoTracks()[0] === pista) estado.textContent = 'No pude cambiar la linterna.';
    }finally{
      if(flujo?.getVideoTracks()[0] === pista) linterna.disabled = false;
    }
  });
  async function leer(actual){
    if(intento !== actual) return;
    try{
      const codigos = video.readyState >= 2 ? await actual.detector.detect(video) : [];
      if(intento !== actual) return;
      const valores = codigos.map(c => c.rawValue?.trim()).filter(Boolean);
      if(lecturaContinua){
        const visibles = new Set(valores), tiempo = ahora();
        // Un código necesita salir del encuadre antes de volver a contar otra unidad.
        for(const [codigo, visto] of actual.vistos){
          if(visibles.has(codigo)) actual.vistos.set(codigo, tiempo);
          else if(tiempo - visto >= 420) actual.vistos.delete(codigo);
        }
        if(visibles.size === 1){
          const [codigo] = visibles;
          if(!actual.vistos.has(codigo)){
            actual.vistos.set(codigo, tiempo);
            if(alLeer(codigo, estado)) avisarLectura(sonido);
          }
        }
        if(intento === actual) espera = setTimeout(() => leer(actual), 120);
        return;
      }
      const codigo = valores.find(valor => valor !== actual.ultimoCodigo);
      if(!valores.length) actual.ultimoCodigo = '';
      if(!codigo){ espera = setTimeout(() => leer(actual), 120); return; }
      actual.ultimoCodigo = codigo;
      if(!conservarVista) detenerCamara();
      avisarLectura(sonido);
      estado.textContent = '';
      alLeer(codigo, estado);
    }catch(e){
      if(intento === actual) mostrarFallo('No pude leer el código.');
    }
  }
  async function abrirCamara(){
    if(boton.disabled) return;
    alAbrir?.();
    if(conservarVista && flujo && intento?.detector){
      estado.textContent = '';
      leer(intento);
      return;
    }
    detenerCamara();
    const actual = intento = {vistos:new Map()};
    d.classList.add('abriendo-camara');
    boton.disabled = true;
    estado.textContent = 'Abriendo la cámara…';
    try{
      const Audio = window.AudioContext || window.webkitAudioContext;
      if(Audio){
        sonido ||= new Audio();
        sonido.resume().catch(() => {});
      }
    }catch(e){}
    try{
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible');
      const nueva = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}, audio:false});
      if(intento !== actual){ nueva.getTracks().forEach(pista => pista.stop()); return; }
      flujo = video.srcObject = nueva;
      const pista = flujo.getVideoTracks()[0];
      pista?.addEventListener('ended', () => {
        if(intento === actual) mostrarFallo('Se cerró la cámara.');
      }, {once:true});
      video.muted = true;
      visor.hidden = false;
      d.classList.add('camara-activa');
      if(linterna){
        try{ linterna.hidden = !pista?.getCapabilities?.()?.torch; }
        catch(e){}
      }
      await video.play();
      if(intento !== actual) return;
      actual.detector = await detectorDeCodigos();
      if(intento !== actual) return;
      d.classList.remove('abriendo-camara');
      boton.disabled = !conservarVista;
      estado.textContent = conservarVista ? '' : 'Pon el código dentro del recuadro.';
      leer(actual);
    }catch(e){
      if(intento !== actual) return;
      mostrarFallo(e.name === 'NotAllowedError' ? 'No se dio permiso para la cámara.' : 'No pude abrir la cámara.');
    }
  }
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  window.addEventListener('pagehide', pausarCamara);
  boton.addEventListener('click', abrirCamara);
  return {abrir:abrirCamara, detener:detenerCamara, cerrar(){
    detenerCamara();
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    window.removeEventListener('pagehide', pausarCamara);
    sonido?.close().catch(() => {});
  }};
}
function asignarCodigo(id){
  const p = prodPorId(id);
  const d = abrirCapa(cabecera('Asignar código de barras', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in asignar-codigo">
    <p class="muted">${esc(p.nombre)}</p>
    ${visorCamara()}
    <form class="card">
      <div class="campo"><label for="codigoAsignar">Escribir el código a mano</label>
        <input type="text" id="codigoAsignar" value="${esc(p.codigo ?? '')}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="errorAsignar" required>
        <p class="ayuda error-codigo" id="errorAsignar" role="status"></p></div>
      <button class="btn" type="submit">Guardar código</button>
    </form></div></div>`, {tipo:'asignarCodigo', alCerrar:() => camara.cerrar()});
  const campo = $('#codigoAsignar', d), error = $('#errorAsignar', d), form = $('form', d);
  function limpiarError(){
    error.textContent = '';
    campo.removeAttribute('aria-invalid');
  }
  const camara = prepararCamara(d, (codigo, estado) => {
    campo.value = codigo;
    limpiarError();
    estado.textContent = 'Código leído. Revisa que esté bien y guárdalo.';
    $('[type="submit"]', form).focus();
  });
  campo.addEventListener('input', () => {
    camara.detener();
    $('[data-estado-camara]', d).textContent = '';
    limpiarError();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(cierrePendiente) return;
    const codigo = campo.value.trim(), duplicado = productoPorCodigo(codigo, id);
    if(!codigo || duplicado){
      campo.setAttribute('aria-invalid', 'true');
      error.textContent = duplicado ? `Ese código ya está asignado a ${duplicado.nombre}.` : 'Escribe el código del producto.';
      campo.focus();
      return;
    }
    if(!guardarCodigoProducto(id, codigo)) return;
    await cerrarCapa();
    refrescar();
    toast('Código asignado');
  });
  if(!p.codigo) camara.abrir();
}

const MODOS_ESCANER = {
  vender:{nombre:'Vender', tipo:'venta', accion:'Agregar a la venta', icono:'mas', abrir:venderProducto},
  usar:{nombre:'Usé', tipo:'uso', accion:'Registrar uso', icono:'gota', abrir:usarProducto},
  entrada:{nombre:'Llegó', accion:'Registrar entrada', icono:'entrada', abrir:formEntrada},
  ajuste:{nombre:'Contar', accion:'Contar producto', icono:'conteo', abrir:id => abrirConteo(prodPorId(id))},
};
function tarjetaEscaner(p, codigo, modo){
  if(!p) return `<h3 class="resultado-escaner-titulo">No encontré un producto con ese código</h3>
    <p class="codigo-leido" dir="auto">${esc(codigo)}</p>
    <div class="acciones-escaner">
      <button class="btn ghost" type="button" data-escaner="asignar">Asignar a un producto</button>
      <button class="btn" type="button" data-escaner="crear">Crear producto con este código</button>
    </div>`;
  const [nombre, ...presentacion] = p.nombre.split(' · ');
  const detalle = [p.marca, ...presentacion].filter(Boolean).join(' · ');
  const stock = stockDe(p.id), bajo = stock <= (p.min || 0);
  const permitido = !modo.tipo || p.tipo === modo.tipo;
  return `<h3 class="resultado-escaner-titulo encontrado">${IC.check} Producto encontrado<span class="solo-lectura">: ${esc(p.nombre)}</span></h3>
    <div class="producto-escaner">${avatar(p)}<div>
      <strong>${esc(nombre)}</strong>${detalle ? `<p>${esc(detalle)}</p>` : ''}
      <p>${p.tipo === 'venta' ? `<b class="num">${dinero(p.precio)}</b> · ` : ''}<span class="${bajo ? 'stock-bajo' : 'stock-disponible'}">${textoStock(stock)}</span></p>
    </div></div>
    ${permitido ? '' : `<p class="ayuda">${p.tipo === 'uso' ? 'Este producto es de uso en spa. Puedes elegir «Usé».' : 'Este producto es para vender. Puedes elegir «Vender».'}</p>`}
    <div class="acciones-escaner">
      <button class="btn ghost" type="button" data-escaner="ver">Ver producto</button>
      <button class="btn" type="button" data-escaner="accion" ${permitido ? '' : 'disabled'}>${IC[modo.icono]} ${modo.accion}</button>
    </div>`;
}
function elegirProductoParaCodigo(codigo, alAsignar){
  const d = abrirCapa(cabecera('Asignar a un producto', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in">
    <p class="codigo-leido" dir="auto">${esc(codigo)}</p>
    ${buscador('Buscar producto')}<div class="filas selector-inicio-lista"></div></div></div>`, {tipo:'buscarCodigo'});
  const campo = $('input', d), lista = $('.filas', d);
  function pintar(){
    const q = norm(campo.value);
    const disponibles = productos().filter(p => !claveCodigo(p.codigo) && coincideProducto(p, q));
    lista.innerHTML = disponibles.length ? disponibles.map(p => filaProducto(p, 'elegirParaCodigo', true)).join('') :
      '<p class="vacio">No encontré productos sin código para asignar.</p>';
    cargarFotos(lista);
  }
  campo.addEventListener('input', pintar);
  lista.addEventListener('click', async e => {
    const boton = e.target.closest('[data-act="elegirParaCodigo"]');
    if(!boton || cierrePendiente) return;
    const p = prodPorId(boton.dataset.id);
    if(!p || p.borrado || claveCodigo(p.codigo) || productoPorCodigo(codigo)){
      toast('Los códigos cambiaron. Revisa los productos.');
      pintar();
      return;
    }
    if(!guardarCodigoProducto(p.id, codigo)) return;
    await cerrarCapa();
    refrescar();
    alAsignar();
  });
  pintar();
}
function estructuraEscaner(titulo, indicacion, modos, textoBoton){
  return `<div class="vista-escaner" data-visor-camara hidden>${videoCamara()}</div>
    <div class="escaner-contenido">
      <header class="escaner-cab">
        <button class="icon-btn" type="button" data-act="cerrar" aria-label="Cerrar">${IC.x}</button><h2>${titulo}</h2>
        <button class="icon-btn" type="button" data-linterna aria-label="Linterna" aria-pressed="false" hidden>${IC.linterna}</button>
      </header>
      ${modos}
      <div class="guia-escaner">
        <div class="marco-escaner" aria-hidden="true"><span></span><span></span><span></span><span></span><i></i></div>
        <p>${indicacion}</p>
      </div>
      <section class="escaner-panel" aria-label="Código del producto">
        <p id="estadoEscaner" role="status" data-estado-camara></p>
        <div class="resultado-escaner" aria-live="polite" hidden></div>
        <form class="escaner-manual" hidden>
          <div class="campo"><label for="codigoEscrito">Escribir el código a mano</label>
            <input type="text" id="codigoEscrito" aria-describedby="estadoEscaner" autocomplete="off" autocapitalize="off" spellcheck="false" required></div>
          <button class="btn" type="submit">${textoBoton}</button>
        </form>
        <div class="escaner-controles">
          <button class="link" type="button" data-escaner="manual">Escribir el código a mano</button>
          <button class="link" type="button" data-camara>Abrir cámara</button>
        </div>
      </section>
    </div>`;
}
function abrirCodigo(origen){
  let modo = Object.hasOwn(MODOS_ESCANER, origen) ? origen : origen === 'uso' ? 'usar' : 'vender';
  let codigo = '';
  const modos = `<div class="escaner-modos" role="group" aria-label="Modo de escaneo">${Object.entries(MODOS_ESCANER).map(([v, m]) =>
    `<button type="button" data-modo-escaner="${v}" aria-pressed="${modo === v}">${m.nombre}</button>`).join('')}</div>`;
  const d = abrirCapa(estructuraEscaner('Escanear', 'Apunta al código de barras o QR del producto', modos, 'Buscar código'),
    {cls:'hoja escaner', tipo:'codigo', alCerrar:() => camara.cerrar()});
  const form = $('form', d), campo = $('input', form), resultado = $('.resultado-escaner', d);
  const estado = $('[data-estado-camara]', d), botonCamara = $('[data-camara]', d);
  const botonManual = $('[data-escaner="manual"]', d);
  function mostrarResultado(valor, enfocar = false){
    codigo = valor.trim();
    resultado.hidden = !codigo;
    resultado.innerHTML = codigo ? tarjetaEscaner(productoPorCodigo(codigo), codigo, MODOS_ESCANER[modo]) : '';
    d.classList.toggle('con-resultado', Boolean(codigo));
    botonCamara.textContent = codigo ? 'Escanear otro' : 'Abrir cámara';
    if(codigo){
      cargarFotos(resultado);
      if(enfocar){
        const titulo = $('h3', resultado);
        titulo.tabIndex = -1;
        titulo.focus({preventScroll:true});
      }
    }
  }
  function mostrarManual(visible){
    form.hidden = !visible;
    botonManual.hidden = visible;
    campo.removeAttribute('aria-invalid');
  }
  const camara = prepararCamara(d, valor => mostrarResultado(valor), {
    conservarVista:true,
    alAbrir(){ mostrarResultado(''); mostrarManual(false); },
    alFallar(){ mostrarManual(!codigo); },
  });
  campo.addEventListener('input', () => {
    if(campo.hasAttribute('aria-invalid')) estado.textContent = '';
    campo.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const valor = campo.value.trim();
    if(!valor){
      estado.textContent = 'Escribe el código del producto.';
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
      return;
    }
    estado.textContent = '';
    mostrarManual(false);
    mostrarResultado(valor, true);
  });
  d.addEventListener('click', async e => {
    const boton = e.target.closest('button');
    if(!boton || boton.disabled || cierrePendiente) return;
    if(boton.dataset.modoEscaner){
      modo = boton.dataset.modoEscaner;
      seleccionarOpcion(boton);
      if(codigo) mostrarResultado(codigo);
      return;
    }
    const accion = boton.dataset.escaner;
    if(accion === 'manual'){
      camara.detener();
      estado.textContent = '';
      campo.value = codigo;
      mostrarResultado('');
      mostrarManual(true);
      campo.focus();
      return;
    }
    if(!accion || !codigo) return;
    const p = productoPorCodigo(codigo), m = MODOS_ESCANER[modo];
    if(accion === 'asignar' && !p){
      camara.detener();
      elegirProductoParaCodigo(codigo, () => mostrarResultado(codigo, true));
    }else if(accion === 'crear' && !p){
      const valor = codigo;
      await cerrarCapa();
      formProd(null, m.tipo || (esInventario(origen) ? origen : 'venta'), valor);
    }else if(p && (accion === 'ver' || accion === 'accion' && (!m.tipo || m.tipo === p.tipo))){
      await cerrarCapa();
      if(accion === 'ver') verProd(p.id);
      else m.abrir(p.id);
    }
  });
  camara.abrir();
}

function escanearConteo(hoja){
  if(!revisarEstadoConteo(hoja)) return;
  const indicacion = 'Apunta a un código a la vez. Retíralo antes de contar otra unidad.';
  const d = abrirCapa(estructuraEscaner('Escanear para contar', indicacion, '', 'Sumar uno'),
    {cls:'hoja escaner escaner-conteo', tipo:'escanerConteo', alCerrar:() => {
      camara.cerrar();
      if(hoja.isConnected) pintarConteo(hoja);
    }});
  const form = $('form', d), campo = $('input', form), estado = $('[data-estado-camara]', d);
  const resultado = $('.resultado-escaner', d), botonManual = $('[data-escaner="manual"]', d);
  function mostrarManual(visible){
    form.hidden = !visible;
    botonManual.hidden = visible;
  }
  function leer(codigo){
    if(d.inert || cierrePendiente) return false;
    const cambio = recargarEstadoSiCambio();
    const p = productoPorCodigo(codigo);
    const lectura = cambio ? {texto:'El inventario cambió. Revisa el conteo antes de seguir.'} : sumarLecturaConteo(p);
    if(cambio) camara.detener();
    estado.textContent = '';
    resultado.hidden = false;
    resultado.innerHTML = lectura.ok ? `<h3 class="resultado-escaner-titulo encontrado">${IC.check} Unidad sumada</h3>
      <div class="producto-escaner">${avatar(p)}<div><strong>${esc(p.nombre)}</strong>
        <p>${textoCantidadConteo(lectura.cantidad, p)} en el conteo.</p></div></div>` : `<p>${esc(lectura.texto)}</p>`;
    if(lectura.ok) cargarFotos(resultado);
    return lectura.ok;
  }
  const camara = prepararCamara(d, leer, {
    conservarVista:true, lecturaContinua:true,
    alAbrir(){ mostrarManual(false); },
    alFallar(){ mostrarManual(true); },
  });
  botonManual.addEventListener('click', () => {
    camara.detener();
    estado.textContent = '';
    mostrarManual(true);
    campo.focus();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const codigo = campo.value.trim();
    if(!codigo){ estado.textContent = 'Escribe el código del producto.'; campo.focus(); return; }
    if(leer(codigo)) campo.value = '';
    campo.focus();
  });
  camara.abrir();
}

// ---------- Compartir entre los dos celulares ----------
function descargarArchivo(archivo, nombre){
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(archivo);
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function fotoADataURL(blob){
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(lector.result);
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(blob);
  });
}
async function adjuntarFotos(productos, incluirBorrados){
  const ids = new Set(productos.filter(p => p.foto && (incluirBorrados || !p.borrado)).map(p => p.foto));
  const fotos = Object.create(null);
  await Promise.all([...ids].map(async id => {
    const blob = await FDB.get(id);
    if(blob) fotos[id] = await fotoADataURL(blob);
  }));
  const faltan = new Set(productos.filter(p => !p.borrado && p.foto && !fotos[p.foto]).map(p => p.foto));
  return {fotos, faltan:faltan.size};
}
function puedeCompartirArchivo(archivo){
  try{ return Boolean(navigator.share && navigator.canShare?.({files:[archivo]})); }
  catch(e){ return false; }
}
function abrirArchivoParaGuardar(respaldo = false){
  if(!quien()) return;
  const titulo = respaldo ? 'Respaldo completo' : 'Enviar a ' + otro();
  const d = abrirCapa(`<section class="dlg hoja-inferior archivo-ajustes" role="dialog">
    <span class="tirador" aria-hidden="true"></span>
    <header class="archivo-ajustes-cab"><span class="archivo-ajustes-icono">${respaldo ? IC.pdf : IC.sync}</span>
      <h3>${esc(titulo)}</h3><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${IC.x}</button></header>
    <p class="muted" data-instruccion-archivo>${respaldo
      ? 'Incluye el inventario, las fotos guardadas y los ajustes de este celular.'
      : `Mándaselo a ${esc(otro())} por WhatsApp. En su celular lo abre con «Recibir».`}</p>
    <p role="status" data-estado-archivo></p>
    <button class="btn" data-guardar-archivo disabled>Preparando archivo…</button>
  </section>`, {tipo:respaldo ? 'respaldo' : 'envio', cls:'dlg-fondo'});
  const boton = $('[data-guardar-archivo]', d), estado = $('[data-estado-archivo]', d);
  const tipoArchivo = respaldo ? 'respaldo' : 'envío';
  let archivo, autor, corte, compartir;
  function explicarComoGuardar(){
    $('[data-instruccion-archivo]', d).textContent = respaldo
      ? `${compartir ? 'Desde el menú Compartir, guarda el respaldo en Archivos o Drive.' : 'Descarga el respaldo y guárdalo en Archivos o Drive.'} Podrás abrirlo con «Restaurar respaldo».`
      : `${compartir ? 'En Compartir, elige WhatsApp.' : 'Manda el envío por WhatsApp.'} ${otro()} lo abre con «Recibir».`;
    boton.textContent = compartir ? `Compartir ${tipoArchivo}` : `Descargar ${tipoArchivo}`;
  }
  async function preparar(){
    boton.disabled = true;
    boton.textContent = 'Preparando archivo…';
    estado.textContent = '';
    delete estado.dataset.nivel;
    try{
      recargarEstadoSiCambio();
      autor = quien();
      corte = ahora();
      const {productos, movs, ventas, cats, pacientes} = E;
      const comun = {v:1, de:autor, generado:new Date(corte).toISOString()};
      // Congela los datos antes de leer las fotos, mientras se puede seguir usando otra pestaña.
      const paquete = JSON.parse(JSON.stringify(respaldo
        ? {app:'sparati-respaldo', ...comun, estado:E}
        : {app:'sparati-inventario', ...comun, datos:{productos, movs, ventas, cats, pacientes}}));
      const {fotos, faltan} = await adjuntarFotos((respaldo ? paquete.estado : paquete.datos).productos, respaldo);
      if(!d.isConnected) return;
      paquete.fotos = fotos;
      const nombre = respaldo ? `respaldo-sparati-prueba-${hoyISO()}.json`
        : `inventario-sparati-prueba-${autor.toLowerCase()}-${hoyISO()}.txt`;
      archivo = new File([JSON.stringify(paquete)], nombre, {type:respaldo ? 'application/json' : 'text/plain'});
      compartir = puedeCompartirArchivo(archivo);
      explicarComoGuardar();
      const cantidad = Object.keys(fotos).length;
      estado.textContent = `Archivo listo · ${cantidad} ${cantidad === 1 ? 'foto' : 'fotos'}`;
      if(faltan) estado.textContent += `. ${faltan === 1 ? 'Una foto ya no está en este celular.' : faltan + ' fotos ya no están en este celular.'}`;
    }catch(e){
      estado.dataset.nivel = 'error';
      estado.textContent = 'No se pudo preparar el archivo. Vuelve a intentar.';
      boton.textContent = 'Volver a preparar';
    }finally{ boton.disabled = false; }
  }
  boton.addEventListener('click', async () => {
    if(!archivo){ preparar(); return; }
    boton.disabled = true;
    try{
      // El menú nativo necesita el toque directo, con el archivo ya preparado.
      if(compartir) await navigator.share({files:[archivo], title:respaldo ? 'Respaldo SPARATI Prueba' : 'Inventario SPARATI Prueba'});
      else descargarArchivo(archivo, archivo.name);
    }catch(e){
      if(e?.name !== 'AbortError'){
        estado.dataset.nivel = 'error';
        estado.textContent = compartir ? 'No se pudo abrir el menú Compartir. Puedes descargar el archivo.'
          : 'No se pudo descargar el archivo. Vuelve a intentar.';
        compartir = false;
        explicarComoGuardar();
      }
      boton.disabled = false;
      if(d === pila.at(-1)?.el) boton.focus({preventScroll:true});
      return;
    }
    recargarEstadoSiCambio();
    if(!respaldo && quien() === autor){
      const sync = {...E.sync, envio:ahora(), hastaEnvio:Math.max(E.sync.hastaEnvio ?? E.sync.envio, corte)};
      if(!guardar({...E, sync})){ boton.disabled = false; return; }
      refrescar();
      pintarAjustes();
    }
    if(d === pila.at(-1)?.el) await cerrarCapa();
    toast(respaldo ? (compartir ? 'Respaldo listo para guardar' : 'Respaldo guardado en Descargas')
      : (compartir ? `${otro()} puede abrir el archivo con «Recibir».` : 'Archivo guardado en Descargas'));
  });
  preparar();
}
function elegirArchivo(id){ const i = $(id); i.value = ''; i.click(); }

function dataURLaBlob(u){
  const partes = /^data:([^;,]*);base64,(.*)$/.exec(u);
  if(!partes) throw new Error('Foto inválida');
  const bin = atob(partes[2]);
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], {type:partes[1] || 'image/jpeg'});
}
const esObjeto = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
function inventarioDeArchivo(datos){
  const listaConId = (lista, valida) => Array.isArray(lista) && lista.every(x =>
    esObjeto(x) && typeof x.id === 'string' && x.id && valida(x));
  const fecha = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return esObjeto(datos) &&
    listaConId(datos.productos, p => typeof p.nombre === 'string' && Object.hasOwn(CATS, p.tipo)) &&
    listaConId(datos.movs, m => typeof m.prod === 'string' && Number.isFinite(m.cant) && fecha(m.fecha)) &&
    listaConId(datos.ventas, v => fecha(v.fecha) && (v.pac == null || typeof v.pac === 'string') &&
      Array.isArray(v.items) && v.items.every(it => esObjeto(it) && typeof it.nombre === 'string')) &&
    (datos.pacientes == null || listaConId(datos.pacientes, p => typeof p.nombre === 'string')) &&
    (datos.cats == null || (esObjeto(datos.cats) && ['venta','uso'].every(tipo =>
      datos.cats[tipo] == null || (Array.isArray(datos.cats[tipo]) && datos.cats[tipo].every(c => typeof c === 'string')))));
}
async function leerArchivoInventario(file, respaldo){
  const paquete = JSON.parse(await file.text());
  if(!paquete || paquete.v !== 1 || paquete.app !== (respaldo ? 'sparati-respaldo' : 'sparati-inventario') ||
    !inventarioDeArchivo(respaldo ? paquete.estado : paquete.datos) ||
    (paquete.fotos != null && !esObjeto(paquete.fotos))) return null;
  const fotos = Object.entries(paquete.fotos || {}).map(([id, url]) => [id, dataURLaBlob(url)]);
  return {paquete, fotos};
}
async function guardarFotosDeArchivo(fotos){
  if(!fotos.length) return 0;
  let nuevas = 0;
  await FDB.tx('readwrite', almacen => {
    for(const [id, foto] of fotos){
      const consulta = almacen.getKey(id);
      consulta.onsuccess = () => {
        if(consulta.result !== undefined) return;
        almacen.add(foto, id);
        nuevas++;
      };
    }
  });
  return nuevas;
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
async function recibirArchivo(file, destinatario = quien(), avisar = toast){
  let leido;
  try{ leido = await leerArchivoInventario(file, false); }catch(e){}
  if(!leido){ avisar('Ese archivo no es un envío de inventario de SPARATI.'); return false; }
  const {paquete, fotos} = leido;
  let fotosNuevas;
  try{ fotosNuevas = await guardarFotosDeArchivo(fotos); }
  catch(e){ avisar('No se pudieron guardar las fotos del envío. Vuelve a intentar.'); return false; }
  recargarEstadoSiCambio();
  const r = mezclar(paquete.datos);
  r.nuevos += completarPacientes(r.estado, destinatario);
  const huboCambios = r.nuevos || r.cambiados || r.categoriasNuevas || fotosNuevas;
  const de = typeof paquete.de === 'string' ? paquete.de : '';
  if(huboCambios || !E.sync.recibo){
    r.estado.sync.recibo = ahora();
    if(de && de !== destinatario) r.estado.sync.de = de;
    if(!guardar(r.estado, false, avisar)) return false;
    refrescar(); pintarAjustes();
  }
  const origen = de ? ' de ' + de : '';
  avisar(huboCambios ? `Recibido${origen}: ${r.nuevos} registros nuevos y ${r.cambiados} actualizados`
    : `Recibido${origen}: ya tenías todo, no hubo cambios`);
  return true;
}
async function restaurarArchivo(file){
  const ajustes = capaArriba('ajustes');
  let leido;
  try{ leido = await leerArchivoInventario(file, true); }catch(e){}
  if(!leido){ toast('Ese archivo no es un respaldo completo de SPARATI.'); return; }
  if(!ajustes?.isConnected || ajustes !== pila.at(-1)?.el) return;
  recargarEstadoSiCambio();
  const {paquete, fotos} = leido;
  const anterior = estadoGuardado;
  const cantidad = vivos(paquete.estado.productos).length;
  const fecha = new Date(paquete.generado);
  const detalle = `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}${Number.isFinite(+fecha) ? ' · ' + fCorta(iso(fecha)) : ''}`;
  if(!await confirmar('¿Restaurar este respaldo?',
    `${detalle}. El respaldo reemplazará el inventario y los ajustes actuales de este celular.`, 'Restaurar respaldo', true)) return;
  try{
    const estado = completarEstado(paquete.estado);
    completarPacientes(estado);
    // Los identificadores de las fotos se conservan al restaurar la misma copia.
    await guardarFotosDeArchivo(fotos);
    if(recargarEstadoSiCambio() || estadoGuardado !== anterior){
      toast('El inventario cambió. Vuelve a elegir el respaldo.');
      return;
    }
    if(!guardar(estado)) return;
  }catch(e){
    toast('No se pudo restaurar el respaldo. Vuelve a intentar.');
    return;
  }
  aplicarApariencia();
  refrescar(); pintarAjustes();
  toast('Respaldo restaurado');
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
  const diasVentas = Array.from({length:18}, (_, i) => 58 - Math.floor(i * 50 / 17))
    .concat([6, 5, 4, 3, 2, 1, 0]);
  for(const [i, diasAtras] of diasVentas.entries()){
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
function abrirAjustes(){ const d = abrirCapa('', {tipo:'ajustes', cls:'hoja hoja-ajustes'}); pintarAjustes(d); }
function pintarAjustes(d = capaArriba('ajustes')){
  if(!d) return;
  const desplazamiento = $('.hoja-cuerpo', d)?.scrollTop || 0;
  const avanzadoAbierto = $('details', d)?.open;
  const activo = d.contains(document.activeElement) ? document.activeElement : null;
  const badge = 'setAppBadge' in navigator && window.Notification;
  const permiso = badge ? Notification.permission : '';
  const {envio, recibo, de} = E.sync;
  d.innerHTML = cabecera('Ajustes', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in ajustes-in">
    <section class="card" aria-labelledby="ajustesCelulares">
      <h3 id="ajustesCelulares">Entre celulares</h3>
      <dl class="fechas-envio">
        <div><dt>Último envío</dt><dd>${cap(haceTxt(envio))}</dd></div>
        <div><dt>Último recibido</dt><dd>${cap(haceTxt(recibo))}${de ? ' · ' + esc(de) : ''}</dd></div>
      </dl>
      <div class="acc-grid">
        <button class="btn" data-act="enviar">${IC.sync} Enviar a ${esc(otro())}</button>
        <button class="btn ghost" data-act="recibir">${IC.entrada} Recibir</button>
      </div>
    </section>
    <section class="card" aria-labelledby="ajustesRespaldo">
      <h3 id="ajustesRespaldo">Copia de seguridad</h3>
      <p class="muted">Guarda una copia con fotos en Archivos o Drive, por si cambias de celular.</p>
      <button class="btn gold" data-act="respaldo">${IC.pdf} Respaldo completo</button>
      <button class="link" data-act="restaurar">Restaurar respaldo</button>
    </section>
    <section class="card" aria-labelledby="ajustesCelular">
      <h3 id="ajustesCelular">Este celular</h3>
      <div class="campo">
        <span class="lbl" id="ajustesQuien">¿Quién usa este celular?</span>
        <div class="seg" role="group" aria-labelledby="ajustesQuien">${['Elba', 'Jonathan'].map(n => opcion('ponQuien', n, n, quien() === n)).join('')}</div>
      </div>
      <div class="campo"><span class="lbl" id="ajustesTema">Tema</span>
        <div class="seg" role="group" aria-labelledby="ajustesTema">${[['auto','Automático'],['light','Claro'],['dark','Oscuro']].map(([v, n]) => opcion('aTema', v, n, E.ajustes.tema === v)).join('')}</div></div>
      <div class="campo"><span class="lbl" id="ajustesLetra">Tamaño de letra</span>
        <div class="seg" role="group" aria-labelledby="ajustesLetra">${opcion('aLetra', 'normal', 'Normal', !E.ajustes.letraGrande)}${opcion('aLetra', 'grande', 'Grande', E.ajustes.letraGrande)}</div></div>
    </section>
    <section class="card" aria-labelledby="ajustesInventario">
      <h3 id="ajustesInventario">Inventario</h3>
      <div class="campo"><span class="lbl">Avisar del vencimiento con</span>
        <div class="seg" role="group" aria-label="Días de aviso">${[30,60,90].map(n => opcion('diasVence', n, n + ' días', E.ajustes.diasVence === n)).join('')}</div></div>
      ${badge && permiso === 'default' ? '<button class="btn sm soft" data-act="permisoBadge">Mostrar el número de avisos en el ícono</button>' : ''}
      ${permiso === 'granted' ? '<p class="muted">El ícono de la app muestra cuántos productos tienen avisos.</p>' : ''}
      <button class="fila-ajustes" data-act="categoriasAjustes"><span>${IC.etiqueta} Categorías</span>${IC.siguiente}</button>
      <button class="fila-ajustes" data-act="plantillasAjustes"><span>${IC.chat} Plantillas de WhatsApp</span>${IC.siguiente}</button>
    </section>
    <section class="card" aria-labelledby="ajustesEjemplo">
      <h3 id="ajustesEjemplo">Datos de ejemplo</h3>
      <p class="muted">${hayEjemplo() ? 'Ya están cargados en este inventario de prueba.'
        : 'Agrega 104 productos con las fotos disponibles, más ventas y usos de ejemplo.'}</p>
      <button class="btn soft" data-act="cargarEjemplo" ${cargandoEjemplo || hayEjemplo() ? 'disabled' : ''}>${cargandoEjemplo ? 'Cargando los datos…' : 'Cargar datos de ejemplo'}</button>
    </section>
    <details class="card ajustes-avanzado"${avanzadoAbierto ? ' open' : ''}><summary>Avanzado</summary>
      <div>
        <button class="btn ghost" data-act="actualizar">Actualizar la app ahora</button>
        <div class="campo"><label for="aBorrarTxt">Para borrar el inventario y las fotos de este celular, escribe BORRAR.</label>
          <input type="text" id="aBorrarTxt" autocomplete="off" autocapitalize="characters"></div>
        <button class="btn danger" data-act="borrarTodo" id="aBorrar" disabled>Borrar todo</button>
        <p class="muted">SPARATI Prueba · Versión ${VERSION_APP}</p>
      </div>
    </details>
  </div></div>`;
  $('.hoja-cuerpo', d).scrollTop = desplazamiento;
  if(activo) enfocarControl(activo, d);
  const texto = $('#aBorrarTxt', d);
  texto.addEventListener('input', () => { $('#aBorrar', d).disabled = texto.value.trim().toUpperCase() !== 'BORRAR'; });
}
function agregarCategoria(tipo, nombre){
  const existente = categoriasDe(tipo).find(c => norm(c) === norm(nombre));
  if(existente) return existente;
  const cats = {...E.cats, [tipo]:[...(E.cats[tipo] || []), nombre]};
  return guardar({...E, cats, sync:{...E.sync, categoriasMod:ahora()}}) ? nombre : null;
}
function abrirCategorias(){
  const d = abrirCapa(cabecera('Categorías', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in ajustes-in">
    <div class="seg" role="group" aria-label="Tipo de inventario">
      ${opcion('tipoCategoria', 'venta', 'Para vender', true)}
      ${opcion('tipoCategoria', 'uso', 'Uso en spa', false)}
    </div>
    <form class="card ajustes-nueva-categoria">
      <div class="campo"><label for="nuevaCategoriaAjustes">Nueva categoría</label>
        <input type="text" id="nuevaCategoriaAjustes" required></div>
      <button class="btn" type="submit">${IC.mas} Agregar categoría</button>
    </form>
    <section class="card" aria-labelledby="tituloCategorias"><h3 id="tituloCategorias"></h3>
      <ul class="lista-categorias-ajustes" role="list"></ul>
    </section>
  </div></div>`, {tipo:'categorias'});
  const campo = $('#nuevaCategoriaAjustes', d);
  campo.addEventListener('input', () => campo.setCustomValidity(''));
  $('form', d).addEventListener('submit', e => {
    e.preventDefault();
    const tipo = d.dataset.inventario, nombre = cap(campo.value.trim().replace(/\s+/g, ' '));
    recargarEstadoSiCambio();
    const equivalente = categoriasDe(tipo).some(c => norm(c) === norm(nombre));
    if(!nombre || equivalente){
      campo.setCustomValidity(equivalente ? 'Esa categoría ya existe.' : 'Escribe el nombre de la categoría.');
      campo.reportValidity();
      return;
    }
    if(!agregarCategoria(tipo, nombre)) return;
    campo.value = '';
    pintarCategorias(d, tipo);
    refrescar();
    toast('Categoría agregada');
  });
  pintarCategorias(d, 'venta');
}
function pintarCategorias(d, tipo){
  d.dataset.inventario = tipo;
  $('#tituloCategorias', d).textContent = tipo === 'venta' ? 'Para vender' : 'Uso en spa';
  const nombres = categoriasDe(tipo).sort((a, b) => a.localeCompare(b, 'es'));
  $('.lista-categorias-ajustes', d).innerHTML = nombres.map(c => `<li>${esc(c)}</li>`).join('');
}
const PLANTILLAS_AJUSTES = {
  plantillaRecordatorio:{titulo:'Recordatorio de compra', etiqueta:'Mensaje base para WhatsApp',
    ayuda:'Usa {nombre} y {producto} para poner esos datos en cada mensaje.', defecto:PLANTILLA_RECORDATORIO,
    boton:'Guardar mensaje base', guardado:'Mensaje base guardado'},
  plantillaComprobante:{titulo:'Comprobante de venta', etiqueta:'Despedida del comprobante',
    ayuda:'Este texto va después de los productos, el total y la forma de pago.', defecto:PLANTILLA_COMPROBANTE,
    boton:'Guardar despedida', guardado:'Despedida guardada'},
};
function abrirPlantillas(){
  const d = abrirCapa(cabecera('Plantillas de WhatsApp', '', true) + `<div class="hoja-cuerpo"><div class="hoja-in ajustes-in">
    ${Object.entries(PLANTILLAS_AJUSTES).map(([id, p]) => `<form class="card" data-plantilla="${id}" aria-labelledby="titulo-${id}">
      <h3 id="titulo-${id}">${p.titulo}</h3>
      <div class="campo"><label for="${id}">${p.etiqueta}</label>
        <textarea id="${id}" rows="3" required aria-describedby="ayuda-${id}">${esc(E.ajustes[id] || p.defecto)}</textarea>
        <span class="ayuda" id="ayuda-${id}">${p.ayuda}</span></div>
      <button type="submit" class="btn soft">${p.boton}</button></form>`).join('')}
  </div></div>`, {tipo:'plantillas'});
  for(const form of $$('form', d)){
    const id = form.dataset.plantilla, campo = $('textarea', form);
    campo.addEventListener('input', () => campo.setCustomValidity(''));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const mensaje = campo.value.trim();
      if(!mensaje){ campo.setCustomValidity('Escribe un mensaje.'); campo.reportValidity(); return; }
      if(!guardarPreferencias({[id]:mensaje})) return;
      campo.value = mensaje;
      toast(PLANTILLAS_AJUSTES[id].guardado);
    });
  }
}
function guardarPreferencias(cambios){
  recargarEstadoSiCambio();
  return guardar({...E, ajustes:{...E.ajustes, ...cambios}});
}

let instalacionVista = false;
function plataformaParaInstalar(){
  const agente = navigator.userAgent;
  if(/iPhone|iPad|iPod/i.test(agente) || (/Macintosh/i.test(agente) && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/i.test(agente) ? 'android' : '';
}
function invitacionInstalar(){
  if(!quien() || !plataformaParaInstalar() || instalacionVista || navigator.standalone ||
    window.matchMedia?.('(display-mode: standalone)').matches) return '';
  try{ if(localStorage.getItem(CLAVE_INSTALACION)) return ''; }catch(e){}
  return `<section class="card invitacion-instalar" aria-labelledby="invitacionInstalar">
    <header class="card-cab"><h3 id="invitacionInstalar">SPARATI en tu pantalla de inicio</h3>
      <button class="icon-btn" data-act="cerrarInstalacion" aria-label="Cerrar invitación">${IC.x}</button></header>
    <p class="muted">Ten el inventario a mano y guarda una copia con fotos desde Ajustes.</p>
    <button class="btn soft" data-act="verInstalacion">Ver los pasos</button>
  </section>`;
}
function cerrarInvitacion(){
  instalacionVista = true;
  try{ localStorage.setItem(CLAVE_INSTALACION, '1'); }catch(e){}
  $('.invitacion-instalar')?.remove();
  $('.ajustes-inicio')?.focus({preventScroll:true});
}
function verInstalacion(){
  const ayuda = plataformaParaInstalar() === 'ios'
    ? 'En Safari, toca Compartir y elige «Agregar a pantalla de inicio». Luego toca «Agregar».'
    : 'En Chrome, abre el menú de tres puntos y elige «Agregar a pantalla de inicio». Sigue los pasos que te muestra el celular.';
  const d = abrirCapa(`<section class="dlg hoja-inferior" role="dialog">
    <span class="tirador" aria-hidden="true"></span><h3>Agregar a pantalla de inicio</h3>
    <p>${ayuda}</p><button class="btn">Entendido</button>
  </section>`, {cls:'dlg-fondo guia-instalacion'});
  $('button', d).addEventListener('click', async () => { await cerrarCapa(); cerrarInvitacion(); });
}
// ---------- Primera vez ----------
let bienvenida, recibiendoBienvenida = false;
function pintarBienvenida(estado, enfocar = false){
  bienvenida = estado;
  const {paso, recibir, nombre, recibido} = estado;
  const remitente = nombre === 'Jonathan' ? 'Elba' : 'Jonathan';
  const volver = paso > 1 ? `<button class="icon-btn bienvenida-volver" data-act="volverBienvenida" aria-label="Volver">${IC.volver}</button>` : '';
  let contenido, acciones;
  if(paso === 1){
    contenido = `<img src="logo-completo.png" class="logo-completo" alt="SPARATI" width="480" height="520" fetchpriority="high">
      <div><p class="rotulo">Inventario</p><h1 tabindex="-1" aria-describedby="pasoBienvenida">Tus productos, ventas y pacientes en un solo lugar</h1></div>`;
    acciones = `<button class="btn" data-act="empezarBienvenida">Empezar</button>
      <button class="btn ghost" data-act="empezarBienvenida" data-recibir>${IC.sync} Recibir datos de Jonathan</button>`;
  }else if(paso === 2){
    contenido = `<span class="icono-bienvenida">${IC.pacientes}</span><div>
      <h1 tabindex="-1" aria-describedby="pasoBienvenida">¿Quién usa este celular?</h1><p class="muted">Así sabrás quién registró cada cosa. Puedes cambiarlo en Ajustes.</p></div>`;
    acciones = `<div class="quien">${['Elba', 'Jonathan'].map(n => `<button class="btn ghost" data-act="quienBienvenida" data-v="${n}">${n}</button>`).join('')}</div>`;
  }else{
    contenido = `<span class="icono-bienvenida">${IC[recibido ? 'check' : 'inventario']}</span><div>
      <h1 tabindex="-1" aria-describedby="pasoBienvenida">${recibido ? 'Tu inventario está listo' : `Prepara tu inventario, ${esc(nombre)}`}</h1>
      <p class="muted">${recibido ? 'Ya puedes consultar los productos y las ventas que recibiste.' :
        `Puedes agregar tus productos o abrir el archivo de inventario que te envió ${remitente}.`}</p></div>`;
    const importar = `<button class="btn ${recibir ? '' : 'ghost'}" data-act="archivoBienvenida"${recibiendoBienvenida ? ' disabled' : ''}>${IC.sync} Recibir datos de ${remitente}</button>`;
    const entrar = `<button class="btn ${recibir && !recibido ? 'ghost' : ''}" data-act="terminarBienvenida"${recibiendoBienvenida ? ' disabled' : ''}>${recibir && !recibido ? 'Entrar sin recibir datos' : 'Ir a Inicio'}</button>`;
    acciones = recibido ? entrar : (recibir ? importar + entrar : entrar + importar);
  }
  const app = $('#app');
  app.innerHTML = `<section class="bienvenida" data-paso="${paso}">${volver}
    <div class="bienvenida-contenido">${contenido}</div>
    <div class="bienvenida-pie">
      <p class="estado-bienvenida" role="status"></p>
      <div class="pasos-bienvenida"><span class="solo-lectura" id="pasoBienvenida">Paso ${paso} de 3</span>
        ${[1, 2, 3].map(n => `<span aria-hidden="true"${n === paso ? ' class="actual"' : ''}></span>`).join('')}</div>
      ${acciones}
    </div></section>`;
  window.scrollTo(0, 0);
  if(enfocar) $('h1', app).focus({preventScroll:true});
}
function avanzarBienvenida(estado){
  history.pushState({bienvenida:estado}, '', urlPantalla(U.tab));
  pintarBienvenida(estado, true);
}
async function recibirEnBienvenida(archivo){
  if(recibiendoBienvenida) return;
  const estado = bienvenida, vista = $('.bienvenida');
  const mensaje = $('[role="status"]', vista), abrir = $('[data-act="archivoBienvenida"]', vista);
  recibiendoBienvenida = abrir.disabled = $('[data-act="terminarBienvenida"]', vista).disabled = true;
  mensaje.textContent = 'Abriendo el archivo…';
  let recibido = false;
  try{ recibido = await recibirArchivo(archivo, estado.nombre, texto => { mensaje.textContent = texto; }); }
  finally{
    recibiendoBienvenida = false;
    if(vista.isConnected && recibido){
      const siguiente = {...estado, recibido:true};
      history.replaceState({bienvenida:siguiente}, '', urlPantalla(U.tab));
      pintarBienvenida(siguiente, true);
    }else if(vista.isConnected){
      abrir.disabled = $('[data-act="terminarBienvenida"]', vista).disabled = false;
      abrir.focus({preventScroll:true});
    }else if(!quien() && bienvenida.paso === 3) pintarBienvenida(bienvenida, true);
  }
}
function guardarQuien(nombre){
  const identidad = {quien:nombre};
  try{ localStorage.setItem(CLAVE_YO, JSON.stringify(identidad)); }
  catch(e){ toast('No se pudo guardar quién usa el celular.'); return false; }
  YO = identidad;
  return true;
}
function iniciarPantallas(){
  const primeraVez = document.body.classList.contains('en-bienvenida');
  document.body.classList.remove('en-bienvenida');
  barraPrincipal.hidden = false;
  history.replaceState(null, '', urlPantalla(U.tab));
  prepararNav();
  render();
  if(primeraVez){
    const titulo = $('#app h1');
    titulo.tabIndex = -1;
    titulo.focus({preventScroll:true});
  }
}
function aplicarTema(){
  const v = E.ajustes.tema;
  const oscuro = v === 'dark' || (v !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = oscuro ? 'dark' : 'light';
}
function aplicarApariencia(){
  aplicarTema();
  document.documentElement.dataset.letra = E.ajustes.letraGrande ? 'grande' : 'normal';
}
function seleccionarOpcion(b){
  for(const opcion of $$('[aria-pressed]', b.parentElement)){
    opcion.classList.toggle('on', opcion === b);
    opcion.setAttribute('aria-pressed', String(opcion === b));
  }
}

// ---------- Acciones ----------
const ACT = {
  async tab(b){
    const tab = b.dataset.tab;
    const desdeFicha = b.closest('.ficha-producto, .ficha-paciente');
    if(desdeFicha) await cerrarCapa(pila.length);
    irPantalla(tab === 'inventario' && desdeFicha?.dataset.inventario ? desdeFicha.dataset.inventario : tab);
  },
  cerrar(){ cerrarCapa(); },
  ajustes(){ abrirAjustes(); },
  avisosInicio(b){ abrirAvisosInicio(b.dataset.filtro); },
  selectorInicio(b){ abrirSelectorInicio(b.dataset.accion); },
  ventasInicio(){
    U.mes = hoyISO().slice(0, 7);
    U.reporte = 'ventas';
    U.qVentas = '';
    desplazamientos.delete('ventas');
    irPantalla('ventas');
  },
  nuevoProd(b){ formProd(null, b.dataset.tipo); },
  verProd(b){ verProd(b.dataset.id); },
  editarProd(b){ formProd(b.dataset.id); },
  filtro(b){
    U.filtro[U.tab] = b.dataset.v;
    seleccionarOpcion(b);
    pintarListaProductos();
  },
  escanear(b){ abrirCodigo(b.dataset.modo); },
  asignarCodigo(b){ asignarCodigo(b.dataset.id); },
  vender(b){ venderProducto(b.dataset.id); },
  usar(b){ usarProducto(b.dataset.id); },
  usarRapido(b){ usarRapido(b.dataset.id); },
  abrirFrasco(b){ registrarFrasco(b.dataset.id, false); },
  terminarFrasco(b){ registrarFrasco(b.dataset.id, true); },
  entrada(b){ formEntrada(b.dataset.id); },
  ajuste(b){ formAjuste(b.dataset.id, Boolean(b.closest('.ficha-producto'))); },
  conteo(){ abrirConteo(); },
  iniciarConteo(b){
    const d = b.closest('.hoja-conteo');
    if(revisarEstadoConteo(d)) nuevoConteo(d, b.dataset.grupo, $('#marcaConteo', d)?.value);
  },
  irConteo(b){
    const d = b.closest('.hoja-conteo');
    if(revisarEstadoConteo(d)) irConteo(d, b.dataset.id);
  },
  siguienteConteo(b){ siguienteConteo(b.closest('.hoja-conteo')); },
  ceroConteo(b){
    const input = $('#cantidadConteo', b.closest('.hoja-conteo'));
    input.value = '0';
    input.dispatchEvent(new Event('input'));
  },
  escanearConteo(b){ escanearConteo(b.closest('.hoja-conteo')); },
  descartarConteo(b){ descartarConteo(b.closest('.hoja-conteo')); },
  confirmarConteo(b){ confirmarConteo(b.closest('.hoja-conteo')); },
  abrirHoy(b){
    const p = prodPorId(b.dataset.id), abierto = hoyISO();
    const productos = E.productos.map(x => x === p ? marcar({...p, abierto}) : x);
    if(!guardar({...E, productos})) return;
    refrescar();
    toast(`Anotado: ${p.nombre} se abrió hoy. Úsalo antes del ${fCorta(sumarMeses(abierto, p.pao))}`);
  },
  async borrarProd(b){
    const p = prodPorId(b.dataset.id);
    if(!(await confirmar('¿Eliminar producto?', `«${esc(p.nombre)}» se quita del inventario. Las ventas donde aparece se conservan.`, 'Eliminar', true))) return;
    const borrados = guardarBorrado({productos:[p]}, true);
    if(!borrados) return;
    await cerrarCapa();
    refrescar();
    avisarConDeshacer('Producto eliminado', borrados, false);
  },
  compras(b){ abrirCompras(b.dataset.id); },
  etiquetasQR(){ abrirEtiquetasQR(); },
  vistaCompras(b){ mostrarVistaCompras(b.closest('.hoja-compras'), b.dataset.v); },
  marcarPedido,
  abrirLlegadaPedido(b){ abrirLlegadaPedido(b.dataset.id); },
  cerrarPedido(b){ cerrarPedido(b.dataset.id); },
  compartirCompras(b){
    if(recargarEstadoSiCambio()){ toast('La lista cambió. Revísala antes de compartir.'); return; }
    const grupos = gruposParaPedir(b.dataset.id, pedidosPendientes());
    compartirTexto('Lista de compras SPARATI\n' + grupos.map(({proveedor, items}) =>
      proveedor + '\n' + items.map(it => `• ${nombrePedido(it)}: pedir ${cantidadPedido(it.cant, it.unidad)} (hay ${fCant(it.stock)})`).join('\n')
    ).join('\n\n'));
  },
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
    if(f === 'tipo' && v === F.tipo) return;
    F[f] = (f === 'cat' && F[f] === v) ? '' : v;
    if(f === 'tipo' && F.cat && !categoriasDe(v).includes(F.cat)) F.cat = '';
    repintar();
  },
  paso(b){
    const inp = $('input', b.closest('.paso'));
    const v = inp.id === 'cantidadConteo' ? cantidadEscrita(inp.value) ?? 0 : num(inp.value);
    const d = Number(b.dataset.d);
    const siguiente = Math.max(0, (isFinite(v) ? v : 0) + d);
    if(inp.dataset.item !== undefined && d < 0 && siguiente === 0){
      F.items.splice(+inp.dataset.item, 1);
      pintarCarrito();
      $('.resumen-venta').focus({preventScroll:true});
      return;
    }
    inp.value = fCant(siguiente);
    inp.dispatchEvent(new Event('input', {bubbles:true}));
  },
  nuevaCat(){
    const n = prompt('Nombre de la nueva categoría:');
    if(!n || !n.trim()) return;
    recargarEstadoSiCambio();
    const categoria = agregarCategoria(F.tipo, cap(n.trim().replace(/\s+/g, ' ')));
    if(categoria){ F.cat = categoria; repintar(); }
  },
  fFoto(){ if(!F.cargandoFoto){ const i = $('#inFoto'); i.value = ''; i.click(); } },
  fSinFoto(){ if(F.fotoNueva){ FDB.del(F.fotoNueva).catch(() => {}); F.fotoNueva = null; } F.foto = ''; repintar(); },
  vAgregar(b){ agregarALaVenta(b.dataset.id); },
  vCategoria(b){
    F.categoria = b.dataset.v;
    seleccionarOpcion(b);
    pintarSelectorVenta();
  },
  vBuscaPaciente(){ buscarPacienteVenta(); },
  vNuevaPaciente(b){ editarPacienteVenta(Boolean(b.dataset.editar)); },
  vEligePaciente(b){
    const p = F.lista.find(p => p.nombre === b.dataset.n);
    seleccionarPacienteVenta(p?.nombre || '', p?.tel);
  },
  vPrecio(b){ editarPrecioVenta(+b.dataset.i); },
  verCarrito(b){
    const detalle = $('#detalleVenta');
    detalle.hidden = !detalle.hidden;
    b.setAttribute('aria-expanded', String(!detalle.hidden));
    actualizarTotalesVenta();
  },
  pagoVenta(b){
    F.pago = b.dataset.v;
    seleccionarOpcion(b);
  },
  estadoPagoVenta(b){
    F.cobrado = b.dataset.v === 'cobrado';
    seleccionarOpcion(b);
    actualizarTotalesVenta();
  },
  editarVenta(b){ formVenta(b.dataset.id); },
  borrarVenta(){ borrarVenta(); },
  mes(b){
    const [y, m] = U.mes.split('-').map(Number), d = new Date(y, m - 1 + Number(b.dataset.d), 1);
    const nm = iso(d).slice(0, 7); if(nm > hoyISO().slice(0, 7)) return;
    U.mes = nm;
    render();
    if(!enfocarControl(b, $('#app'))) $('.mes button:not(:disabled)')?.focus({preventScroll:true});
    $('#anuncio').textContent = nombreMes(nm);
  },
  tipoReporte(b){
    if(U.reporte === b.dataset.v) return;
    U.reporte = b.dataset.v;
    render();
    enfocarControl(b, $('#app'));
  },
  imprimirReporte(){ window.print(); },
  excelReporte(){ descargarReporteCSV(); },
  verPaciente(b){ verPaciente(b.dataset.n); },
  editarPaciente(b){ editarPaciente(b.dataset.n); },
  ventaPaciente(b){
    const p = pacientePorNombre(b.dataset.n);
    if(p) formVenta(null, null, p);
  },
  recompra(b){ abrirRecordatorio(b.dataset.v, b.dataset.p); },
  // Compartir y ajustes
  enviar(){ abrirArchivoParaGuardar(); },
  recibir(){ elegirArchivo('#inArchivo'); },
  respaldo(){ abrirArchivoParaGuardar(true); },
  restaurar(){ elegirArchivo('#inRespaldo'); },
  categoriasAjustes(){ abrirCategorias(); },
  plantillasAjustes(){ abrirPlantillas(); },
  tipoCategoria(b){
    seleccionarOpcion(b);
    $('#nuevaCategoriaAjustes', b.closest('.hoja')).setCustomValidity('');
    pintarCategorias(b.closest('.hoja'), b.dataset.v);
  },
  verInstalacion,
  cerrarInstalacion(){ cerrarInvitacion(); },
  empezarBienvenida(b){ avanzarBienvenida({paso:2, recibir:b.hasAttribute('data-recibir')}); },
  quienBienvenida(b){ avanzarBienvenida({...bienvenida, paso:3, nombre:b.dataset.v}); },
  volverBienvenida(){ history.back(); },
  archivoBienvenida(){ elegirArchivo('#inArchivo'); },
  terminarBienvenida(){
    if(!guardarQuien(bienvenida.nombre)) return;
    U.tab = 'inicio';
    history.go(1 - bienvenida.paso);
  },
  cargarEjemplo,
  ponQuien(b){
    if(!guardarQuien(b.dataset.v)) return;
    pintarAjustes(); render();
  },
  diasVence(b){
    if(guardarPreferencias({diasVence:Number(b.dataset.v)})){
      seleccionarOpcion(b);
      refrescar();
    }
  },
  async permisoBadge(){ try{ await Notification.requestPermission(); }catch(e){} actualizarAvisos(); pintarAjustes(); },
  aTema(b){
    if(guardarPreferencias({tema:b.dataset.v})){ aplicarApariencia(); seleccionarOpcion(b); }
  },
  aLetra(b){
    if(guardarPreferencias({letraGrande:b.dataset.v === 'grande'})){ aplicarApariencia(); seleccionarOpcion(b); }
  },
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
    recargarEstadoSiCambio();
    if(!guardar({...estadoInicial(), ajustes:E.ajustes})) return;
    await FDB.vaciar().catch(() => {});
    for(const [id, url] of Object.entries(URLS)){ URL.revokeObjectURL(url); delete URLS[id]; }
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
  const archivo = e.target.files?.[0], formulario = F;
  if(!archivo || !formulario || formulario.cargandoFoto) return;
  const botonGuardar = $('[data-act="guardarF"]', capaArriba('form'));
  formulario.cargandoFoto = botonGuardar.disabled = true;
  const id = 'f' + uid();
  try{
    await FDB.put(id, await comprimir(archivo));
    if(F !== formulario){
      FDB.del(id).catch(() => {});
      return;
    }
    if(F.fotoNueva) FDB.del(F.fotoNueva).catch(() => {});
    F.fotoNueva = id;
    repintar();
  }catch(e){
    if(F === formulario) toast('No se pudo guardar la foto');
  }finally{
    formulario.cargandoFoto = botonGuardar.disabled = false;
  }
});
$('#inArchivo').addEventListener('change', e => {
  const archivo = e.target.files?.[0];
  if(!archivo) return;
  if(quien()) recibirArchivo(archivo);
  else if(bienvenida.paso === 3) recibirEnBienvenida(archivo);
});
$('#inRespaldo').addEventListener('change', e => { const f = e.target.files?.[0]; if(f) restaurarArchivo(f); });

// ---------- Arranque ----------
cargar();
aplicarApariencia();
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); }catch(e){}
if(window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);
history.scrollRestoration = 'manual';
U.tab = pantallaDeURL();
if(esInventario(U.tab)) U.tipo = U.tab;
if(quien()) iniciarPantallas();
else{
  document.body.classList.add('en-bienvenida');
  pintarBienvenida(history.state?.bienvenida || {paso:1});
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && !pila.length) render(); });
