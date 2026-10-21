const https = require('https');
const crypto = require('crypto');

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const digits = (v) => String(v || '').replace(/\D/g, '');

function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || '';
}

function normPhone(v) {
  let d = digits(v);
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return '+' + d;
}

// Monta o objeto user da Events API (email/telefone/external_id em SHA-256).
function buildUser({ email, phone, externalId, ip, ua, ttclid, ttp }) {
  const u = {};
  const e = String(email || '').trim().toLowerCase();
  const p = normPhone(phone);
  if (e) u.email = sha(e);
  if (p) u.phone = sha(p);
  if (externalId) u.external_id = sha(externalId);
  if (ip) u.ip = ip;
  if (ua) u.user_agent = ua;
  if (ttclid) u.ttclid = ttclid;
  if (ttp) u.ttp = ttp;
  return u;
}

// Contexto de navegador a partir da requisicao (IP, UA, cookies _ttp/ttclid).
function contextFromReq(req) {
  const c = cookies(req);
  return {
    ip: clientIp(req),
    ua: req.headers['user-agent'] || '',
    ttclid: c.ttclid || '',
    ttp: c._ttp || '',
    externalId: c.tt_sid || ''
  };
}

function post(body) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const r = https.request('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(raw),
        'Access-Token': process.env.TIKTOK_ACCESS_TOKEN
      }
    }, (resp) => {
      let s = '';
      resp.on('data', (d) => (s += d));
      resp.on('end', () => {
        let j = {};
        try { j = JSON.parse(s); } catch (e) {}
        resolve({ http: resp.statusCode, body: j });
      });
    });
    r.on('error', reject);
    r.setTimeout(5000, () => r.destroy(new Error('TikTok Events API timeout')));
    r.write(raw);
    r.end();
  });
}

// Nunca lanca: falha de rastreamento nao pode quebrar o pagamento.
async function sendEvent({ event, eventId, value, currency, url, referrer, user }) {
  const pixel = process.env.TIKTOK_PIXEL_ID;
  if (!process.env.TIKTOK_ACCESS_TOKEN || !pixel) return { skipped: true };

  const body = {
    event_source: 'web',
    event_source_id: pixel,
    data: [{
      event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user: user || {},
      properties: {
        currency: currency || 'BRL',
        content_type: 'product',
        ...(typeof value === 'number' ? { value } : {})
      },
      page: { url: url || '', referrer: referrer || '' }
    }]
  };
  if (process.env.TIKTOK_TEST_EVENT_CODE) body.test_event_code = process.env.TIKTOK_TEST_EVENT_CODE;

  try {
    const r = await post(body);
    if (r.http !== 200 || (r.body && r.body.code !== 0)) {
      console.error('[TikTok Events API]', r.http, JSON.stringify(r.body));
    }
    return r;
  } catch (e) {
    console.error('[TikTok Events API] erro:', e.message);
    return { error: e.message };
  }
}

module.exports = { sendEvent, buildUser, contextFromReq, clientIp };
