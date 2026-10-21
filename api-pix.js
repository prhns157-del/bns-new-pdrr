(function () {
  var so = function (v) { return String(v || '').replace(/\D/g, ''); };

  function cpfValido(v) {
    var c = so(v);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
    }
    return true;
  }

  function telefoneValido(v) {
    var d = so(v);
    if (d.length !== 10 && d.length !== 11) return false;
    if (Number(d.slice(0, 2)) < 11) return false;
    return d.length === 10 || d.charAt(2) === '9';
  }

  function mascararCpf(v) {
    var d = so(v).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  function mascararTelefone(v) {
    var d = so(v).slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function ligarCampo(sel, mascara) {
    var el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('input', function () { el.value = mascara(el.value); });
  }

  function criar(api, dados) {
    if (window.ttIdentify) window.ttIdentify(dados.email, dados.telefone);
    return fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: dados.nome,
        email: dados.email,
        cpf: dados.cpf,
        telefone: dados.telefone,
        utm: location.search.replace(/^\?/, '')
      })
    });
  }

  function status(api, txId) {
    var url = api + (api.indexOf('?') >= 0 ? '&' : '?') + 'id=' + encodeURIComponent(txId);
    return fetch(url).then(function (r) {
      r.clone().json().then(function (d) {
        if (d && d.pago && window.ttEvento) window.ttEvento(d.tiktok);
      }).catch(function () {});
      return r;
    });
  }

  window.PIXBRIDGE = {
    soDigitos: so,
    cpfValido: cpfValido,
    telefoneValido: telefoneValido,
    mascararCpf: mascararCpf,
    mascararTelefone: mascararTelefone,
    ligarCampo: ligarCampo,
    criar: criar,
    status: status
  };
})();
