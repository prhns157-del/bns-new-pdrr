const flow = require('./_flow');
const { sendEvent, buildUser, contextFromReq } = require('./_tiktok');

// CompletePayment é enviado só pelo servidor (status/webhook), por isso não entra aqui.
const ALLOWED = ['ViewContent', 'InitiateCheckout', 'AddPaymentInfo'];

// Espelho server-side dos eventos do navegador (mesmo event_id => deduplicação no TikTok).
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return flow.send(res, 405, { error: 'método não permitido' });

  const b = await flow.readBody(req);
  if (!ALLOWED.includes(b.event) || !b.event_id) return flow.send(res, 400, { error: 'evento inválido' });

  const ctx = contextFromReq(req);
  await sendEvent({
    event: b.event,
    eventId: String(b.event_id).slice(0, 128),
    value: typeof b.value === 'number' ? b.value : undefined,
    url: String(b.url || req.headers.referer || '').slice(0, 2000),
    referrer: String(b.referrer || '').slice(0, 2000),
    user: buildUser({ ...ctx, email: b.email, phone: b.phone, ttclid: ctx.ttclid || b.ttclid, ttp: ctx.ttp || b.ttp })
  });
  return flow.send(res, 200, { ok: true });
};
