(function () {
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck', 'ttclid'];
  try {
    var q = new URLSearchParams(location.search);
    var saved = JSON.parse(sessionStorage.getItem('funnel_params') || '{}');
    var changed = false;
    KEYS.forEach(function (k) {
      if (q.get(k)) { saved[k] = q.get(k); }
      else if (saved[k]) { q.set(k, saved[k]); changed = true; }
    });
    sessionStorage.setItem('funnel_params', JSON.stringify(saved));
    if (changed && window.history && history.replaceState) {
      history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
    }
  } catch (e) {}
})();
