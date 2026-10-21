const { STEPS, send, checkCharge } = require('./_flow');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  const step = url.searchParams.get('f');
  const code = url.searchParams.get('code') || url.searchParams.get('id');
  if (!STEPS[step]) return send(res, 400, { error: 'step inválido' });

  try {
    return await checkCharge(req, res, step, code);
  } catch (e) {
    console.error('[status]', e.message);
    return send(res, 502, { error: 'consulta indisponível' });
  }
};
