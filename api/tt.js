// Pixel do TikTok (navegador) + espelho server-side via /api/track. Servido como script.
function source(pixelId) {
  return `(function(w,d,t){
var PIXEL=${JSON.stringify(pixelId)};
if(!PIXEL)return;
function ck(n){var m=d.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):'';}
function setCk(n,v,days){d.cookie=n+'='+encodeURIComponent(v)+';max-age='+days*86400+';path=/;SameSite=Lax';}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k)||'';localStorage.setItem(k,v);}catch(e){return '';}}

var q=new URLSearchParams(location.search);
if(q.get('ttclid')){setCk('ttclid',q.get('ttclid'),30);}
var sid=ls('tt_sid');
if(!sid){sid=(w.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2);ls('tt_sid',sid);}
setCk('tt_sid',sid,365);

if(!w.ttq){
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
var s=d.createElement("script");s.type="text/javascript";s.async=!0;s.src=r+"?sdkid="+e+"&lib="+t;
var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(s,a)};
ttq.load(PIXEL);
}
var ttq=w.ttq;

function ident(){try{return JSON.parse(ls('tt_ident')||'{}');}catch(e){return {};}}
w.ttIdentify=function(email,phone){
  var o={};
  email=String(email||'').trim().toLowerCase();
  var p=String(phone||'').replace(/\\D/g,'');
  if(email)o.email=email;
  if(p){if(p.length<=11)p='55'+p;o.phone_number='+'+p;}
  if(!o.email&&!o.phone_number)return;
  ls('tt_ident',JSON.stringify({email:o.email||'',phone:p}));
  try{ttq.identify(o);}catch(e){}
};
var id0=ident();
if(id0.email||id0.phone){w.ttIdentify(id0.email,id0.phone);}

var sent={};
function mirror(ev){
  var idn=ident();
  var body=JSON.stringify({event:ev.event,event_id:ev.event_id,value:ev.value,url:location.href,referrer:d.referrer,
    email:idn.email||'',phone:idn.phone||'',ttclid:ck('ttclid'),ttp:ck('_ttp')});
  try{fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true}).catch(function(){});}catch(e){}
}
// ev: {event,value,currency,event_id,server_sent}. Mesmo event_id no pixel e na Events API.
w.ttEvento=function(ev){
  if(!ev||!ev.event||!ev.event_id||sent[ev.event_id])return;
  sent[ev.event_id]=1;
  try{ttq.track(ev.event,{value:ev.value,currency:ev.currency||'BRL',content_type:'product'},{event_id:ev.event_id});}catch(e){}
  if(!ev.server_sent&&ev.event!=='CompletePayment')mirror(ev);
};

ttq.page();

var path=location.pathname.toLowerCase().replace(/\\/index\\.html$/,'/').replace(/\\.html$/,'');
var m=path.match(/^\\/(up\\d+)(\\/checkout)?\\/?$/);
if(m){
  w.ttEvento({event:m[2]?'InitiateCheckout':'ViewContent',event_id:(m[2]?'ic_':'vc_')+m[1]+'_'+sid});
}else if(path==='/pix'||path==='/checkf'){
  w.ttEvento({event:'InitiateCheckout',value:22.87,event_id:'ic_entrada_'+sid});
}
})(window,document,"ttq");`;
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(source(process.env.TIKTOK_PIXEL_ID || ''));
};
