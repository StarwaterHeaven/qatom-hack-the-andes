// Synthetic trips on real Mexican freight corridors. DEMO DATA: no real carrier, driver or load.
// Positions move with the clock so every call during a live demo shows a truck that has moved.

const KM_PER_DEG = 111.2;

function distKm(a, b) {
  const dLat = (b[0] - a[0]) * KM_PER_DEG;
  const dLon = (b[1] - a[1]) * KM_PER_DEG * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLon) * 1.18; // roads are longer than straight lines
}

// Waypoints: [lat, lon, place]
const ROUTES = {
  'MTY-NLD': [[25.6866, -100.3161, 'Monterrey, NL'], [26.0, -100.27, 'Ciénega de Flores, NL'], [26.5017, -100.1772, 'Sabinas Hidalgo, NL'], [27.0, -99.95, 'Vallecillo, NL'], [27.4764, -99.5164, 'Nuevo Laredo, Tamps.']],
  'LEON-CDMX': [[21.125, -101.686, 'León, Gto.'], [20.6767, -101.3563, 'Irapuato, Gto.'], [20.5235, -100.8157, 'Celaya, Gto.'], [20.5888, -100.3899, 'Querétaro, Qro.'], [20.3886, -99.9962, 'San Juan del Río, Qro.'], [19.9, -99.45, 'Polotitlán–Jilotepec, Edomex'], [19.4326, -99.1332, 'Ciudad de México']],
  'QRO-GDL': [[20.5888, -100.3899, 'Querétaro, Qro.'], [20.6767, -101.3563, 'Irapuato, Gto.'], [20.3417, -102.03, 'La Piedad, Mich.'], [20.53, -102.78, 'Tototlán, Jal.'], [20.6597, -103.3496, 'Guadalajara, Jal.']],
  'SAL-SLP': [[25.4232, -100.9924, 'Saltillo, Coah.'], [24.85, -100.95, 'San Roberto, NL'], [23.6486, -100.6435, 'Matehuala, SLP'], [22.9, -100.85, 'Villa Hidalgo, SLP'], [22.1565, -100.9855, 'San Luis Potosí, SLP']],
  'ZLO-GDL': [[19.0522, -104.3158, 'Manzanillo, Col.'], [19.2433, -103.725, 'Colima, Col.'], [19.7047, -103.4617, 'Ciudad Guzmán, Jal.'], [20.6597, -103.3496, 'Guadalajara, Jal.']],
};

export const TRIPS = {
  'MXF-1001': { route: 'MTY-NLD', carrier: 'Transportes Demo Norte', unit: 'Tractocamión 27', cargo: 'Autopartes (exportación)', shipper: 'Demo Autopartes del Norte', mode: 'moving', loop_h: 5, speed_kmh: 72 },
  'MXF-1002': { route: 'LEON-CDMX', carrier: 'Fletes Demo del Bajío', unit: 'Tractocamión 14', cargo: 'Calzado terminado', shipper: 'Demo Calzado León', mode: 'delayed', loop_h: 7, speed_kmh: 68 },
  'MXF-1003': { route: 'QRO-GDL', carrier: 'Fletes Demo del Bajío', unit: 'Rabón 3', cargo: 'Electrodomésticos', shipper: 'Demo Hogar Querétaro', mode: 'moving', loop_h: 6, speed_kmh: 70 },
  'MXF-1004': { route: 'SAL-SLP', carrier: 'Transportes Demo Norte', unit: 'Tractocamión 31', cargo: 'Acero en rollo', shipper: 'Demo Aceros Coahuila', mode: 'stopped', loop_h: 8, speed_kmh: 65 },
  'MXF-1005': { route: 'ZLO-GDL', carrier: 'Logística Demo Pacífico', unit: 'Tractocamión 8', cargo: 'Contenedor 40 ft (importación)', shipper: 'Demo Importadora Jalisco', mode: 'delivered', loop_h: 6, speed_kmh: 60 },
};

export const REFS = Object.keys(TRIPS);

// Accepts MXF-1001, mxf1001, 1001, "mxf 1001".
export function resolveRef(input) {
  const s = String(input).toUpperCase().replace(/[\s_]/g, '');
  const digits = s.replace(/^MXF-?/, '');
  const ref = /^\d{4}$/.test(digits) ? `MXF-${digits}` : s;
  return TRIPS[ref] ? { ref, alias: ref !== input ? { requested: input, resolved: ref } : undefined } : null;
}

function routeGeometry(route) {
  const pts = ROUTES[route];
  const legs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = distKm(pts[i - 1], pts[i]); legs.push(d); total += d; }
  return { pts, legs, total };
}

function pointAt(geo, km) {
  let left = Math.max(0, Math.min(km, geo.total));
  for (let i = 0; i < geo.legs.length; i++) {
    if (left <= geo.legs[i]) {
      const f = geo.legs[i] ? left / geo.legs[i] : 0;
      const a = geo.pts[i], b = geo.pts[i + 1];
      const lat = a[0] + (b[0] - a[0]) * f, lon = a[1] + (b[1] - a[1]) * f;
      const near = f < 0.5 ? a[2] : b[2];
      return { lat: +lat.toFixed(4), lon: +lon.toFixed(4), near };
    }
    left -= geo.legs[i];
  }
  const z = geo.pts[geo.pts.length - 1];
  return { lat: z[0], lon: z[1], near: z[2] };
}

const iso = (ms) => new Date(Math.round(ms / 60000) * 60000).toISOString();

// The state of a trip at time `now` (ms). Deterministic, so two calls a minute apart agree.
export function tripState(ref, now = Date.now()) {
  const t = TRIPS[ref];
  const geo = routeGeometry(t.route);
  const origin = geo.pts[0][2];
  const destination = geo.pts[geo.pts.length - 1][2];
  const loopMs = t.loop_h * 3_600_000;
  const phase = (now % loopMs) / loopMs; // 0..1 through this trip's demo loop
  const base = { trip_ref: ref, carrier: t.carrier, unit: t.unit, cargo: t.cargo, shipper: t.shipper, origin, destination, route_km: Math.round(geo.total) };

  if (t.mode === 'delivered') {
    const deliveredAt = now - (40 + phase * 60) * 60000;
    const pos = pointAt(geo, geo.total);
    return {
      ...base, status: 'entregado', status_en: 'delivered', progress_pct: 100, distance_remaining_km: 0,
      position: { ...pos, updated_at: iso(deliveredAt), gps_age_min: Math.round((now - deliveredAt) / 60000), source: 'gps' },
      eta: null, delivered_at: iso(deliveredAt),
      proof_of_delivery: { signed_by: 'Recepción almacén (demo)', at: iso(deliveredAt + 6 * 60000) },
      last_driver_update: { at: iso(deliveredAt + 4 * 60000), channel: 'whatsapp', text_es: 'Ya descargamos, firmaron de recibido.', text_en: 'Unloaded, receipt signed.' },
      flags: [],
    };
  }

  // In-transit trips run between 8% and 92% of the route over the loop, so they are always on the road.
  const progress = t.mode === 'stopped' ? 0.47 : 0.08 + phase * 0.84;
  const km = geo.total * progress;
  const pos = pointAt(geo, km);
  const remaining = geo.total - km;
  const flags = [];
  let delayMin = 0;
  let gpsAge = 1 + Math.floor((now / 60000) % 3);
  let status = 'en_ruta', statusEn = 'in_transit';
  let driver = { at: iso(now - (12 + Math.floor(phase * 20)) * 60000), channel: 'whatsapp', text_es: 'Todo bien, vamos en tiempo.', text_en: 'All good, on schedule.' };

  if (t.mode === 'delayed') {
    // The "signal changes" case: the delay swings over the loop, so the ETA moves during a demo.
    // A 20-minute cycle, so asking again a few minutes later shows a different delay.
    delayMin = Math.round(25 + 20 * Math.sin((now / 60000) * 2 * Math.PI / 20));
    flags.push('eta_slipping');
    driver = { at: iso(now - 9 * 60000), channel: 'whatsapp', text_es: `Hay tráfico pesado por obras cerca de ${pos.near}, calculo unos ${delayMin} min de retraso.`, text_en: `Heavy roadworks traffic near ${pos.near}, about ${delayMin} min late.` };
  }
  if (t.mode === 'stopped') {
    status = 'detenido'; statusEn = 'stopped';
    gpsAge = 95 + Math.floor(phase * 30);
    flags.push('gps_stale', 'driver_unresponsive', 'stopped_unplanned');
    driver = { at: iso(now - (110 + Math.floor(phase * 30)) * 60000), channel: 'whatsapp', text_es: 'Paramos a revisar una llanta.', text_en: 'Stopped to check a tyre.' };
  }

  const driveMin = (remaining / t.speed_kmh) * 60;
  const etaMs = t.mode === 'stopped' ? null : now + (driveMin + delayMin) * 60000;
  const confidence = t.mode === 'stopped' ? 'low' : delayMin > 30 ? 'medium' : 'high';
  return {
    ...base, status, status_en: statusEn,
    progress_pct: Math.round(progress * 100), distance_remaining_km: Math.round(remaining),
    position: { ...pos, updated_at: iso(now - gpsAge * 60000), gps_age_min: gpsAge, source: 'gps' },
    eta: etaMs ? { at: iso(etaMs), window_min: t.mode === 'delayed' ? 30 : 15, confidence, delay_min: delayMin } : { at: null, confidence, note_es: 'Sin ETA hasta que el operador responda.', note_en: 'No ETA until the driver responds.' },
    last_driver_update: driver,
    flags,
  };
}

export function dataQuality(state) {
  let score = 100;
  if (state.flags.includes('gps_stale')) score -= 40;
  if (state.flags.includes('driver_unresponsive')) score -= 25;
  if (state.flags.includes('eta_slipping')) score -= 10;
  return { score, sources: ['gps', 'driver_whatsapp', 'carrier_erp'], flags: state.flags };
}
