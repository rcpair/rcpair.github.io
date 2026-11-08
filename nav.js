// Phone and tablet menu: one Menu button opens the page links as a list.
(function () {
  var btn = document.querySelector('.menu-btn');
  var links = document.getElementById('nav-links');
  if (!btn || !links) return;
  function set(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    links.classList.toggle('open', open);
  }
  btn.addEventListener('click', function () {
    set(btn.getAttribute('aria-expanded') !== 'true');
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
})();
