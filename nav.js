// Phone and tablet menu: one Menu button opens the page links as a list.
// Runs right after the header (not deferred). The collapsed menu CSS keys on html.js, which is added only after the
// handlers are bound, so if this file fails to load the plain link row stays visible.
(function () {
  var btn = document.querySelector('.menu-btn');
  var links = document.getElementById('nav-links');
  if (!btn || !links) return;
  function set(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    links.classList.toggle('open', open);
  }
  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') !== 'true';
    set(open);
    if (open) { var first = links.querySelector('a'); if (first) first.focus(); }
  });
  links.addEventListener('click', function (e) {
    if (e.target.closest('a')) set(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.site-nav')) set(false);
  });
  document.documentElement.classList.add('js');
})();
