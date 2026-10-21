const flow = require('./_flow');
const { sendEvent, buildUser } = require('./_tiktok');

// Postback da FlevoPay. Não há assinatura, então o status é sempre reconfirmado na API deles.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return flow.send(res, 405, { error: 'método não permitido' });

  try {
    const p = await flow.readBody(req);
    const reference = p.external_id || p.store_reference;
    if (String(p.status).toLowerCase() === 'approved' && reference) {
      const ok = await flow.confirmByReference(reference);
      if (ok) {
        const c = p.customer || {};
        await sendEvent({
          event: 'CompletePayment',
          eventId: flow.payEventId(reference),
          value: ok.price,
          user: buildUser({ email: c.email, phone: c.phone })
        });
      }
    }
  } catch (e) {
    console.error('[webhook]', e.message);
  }
  return flow.send(res, 200, { ok: true });
};
