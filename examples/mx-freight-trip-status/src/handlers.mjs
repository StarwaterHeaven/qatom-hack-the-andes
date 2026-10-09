import { ApiError, feedbackHandler } from '../../../lib/qatom-kit.mjs';
import { REFS, resolveRef, tripState, dataQuality } from './trips.mjs';

const hhmm = (isoString) => isoString
  ? new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(isoString))
  : null;

function lookup(input, base) {
  const hit = resolveRef(input);
  if (!hit) {
    throw new ApiError(404, 'item_not_found', `No trip with reference "${input}".`, { known_refs_for_demo: REFS, read_me: `${base}/llms.txt` });
  }
  return hit;
}

function summary(s, lang) {
  const eta = hhmm(s.eta?.at);
  if (lang === 'en') {
    if (s.status_en === 'delivered') return `${s.trip_ref} was delivered in ${s.destination} at ${hhmm(s.delivered_at)} (Mexico City time).`;
    if (s.status_en === 'stopped') return `${s.trip_ref} has been stopped near ${s.position.near} with no GPS update for ${s.position.gps_age_min} min; the driver has not answered. No reliable ETA.`;
    return `${s.trip_ref} is near ${s.position.near}, ${s.distance_remaining_km} km from ${s.destination}. ETA ${eta} Mexico City time${s.eta.delay_min ? `, about ${s.eta.delay_min} min late` : ', on time'}.`;
  }
  if (s.status_en === 'delivered') return `${s.trip_ref} se entregó en ${s.destination} a las ${hhmm(s.delivered_at)} (hora del centro).`;
  if (s.status_en === 'stopped') return `${s.trip_ref} está detenido cerca de ${s.position.near}, sin GPS desde hace ${s.position.gps_age_min} min y el operador no responde. Sin ETA confiable.`;
  return `${s.trip_ref} va cerca de ${s.position.near}, a ${s.distance_remaining_km} km de ${s.destination}. ETA ${eta} hora del centro${s.eta.delay_min ? `, con ${s.eta.delay_min} min de retraso` : ', a tiempo'}.`;
}

export const handlers = {
  // Paid: the full status of one trip.
  async trip_status({ trip_ref, lang }, { base }) {
    const { ref, alias } = lookup(trip_ref, base);
    const s = tripState(ref);
    const next = [];
    if (s.flags.includes('driver_unresponsive')) next.push({ action: 'Ask the carrier to call the driver; check again in 15 minutes.', item: 'trip_status' });
    if (s.flags.includes('eta_slipping')) next.push({ action: 'Tell the receiving warehouse the new window.', item: null });
    return {
      item: ref,
      alias,
      answer_type: 'current',
      result: {
        ...s,
        map_url: `https://www.google.com/maps?q=${s.position.lat},${s.position.lon}`,
        data_quality: dataQuality(s),
        times_note: 'All times are UTC (ISO 8601). Summary times are Mexico City time.',
      },
      summary: summary(s, lang),
      next_steps: next.length ? next : undefined,
    };
  },

  // Free: does this reference exist, and what does it cover? No position, no ETA.
  async trip_check({ trip_ref }, { base }) {
    const { ref, alias } = lookup(trip_ref, base);
    const s = tripState(ref);
    return {
      item: ref,
      alias,
      answer_type: 'published',
      result: { trip_ref: ref, exists: true, origin: s.origin, destination: s.destination, carrier: s.carrier, paid_item_has: ['position', 'status', 'eta', 'last_driver_update', 'data_quality'] },
      summary: `${ref}: ${s.origin} → ${s.destination}. Live position and ETA come from the paid trip status item.`,
      next_steps: [{ action: 'Buy the live status', item: 'trip_status' }],
    };
  },

  feedback: feedbackHandler,
};
