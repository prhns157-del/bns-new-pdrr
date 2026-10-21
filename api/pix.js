const flow = require('./_flow');

// POST /api/pix?f=<step>            -> cria a cobrança Pix
// GET  /api/pix?f=<step>&id=<tx_id> -> consulta o pagamento
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  const step = url.searchParams.get('f');
  if (!flow.STEPS[step]) return flow.send(res, 400, { error: 'step inválido' });

  try {
    if (req.method === 'GET') {
      return await flow.checkCharge(req, res, step, url.searchParams.get('id') || url.searchParams.get('txid'));
    }
    if (req.method === 'POST') return await flow.createCharge(req, res, step);
    return flow.send(res, 405, { error: 'método não permitido' });
  } catch (e) {
    console.error('[pix]', e.message);
    return flow.send(res, 502, { error: 'Não foi possível processar o pagamento agora' });
  }
};
