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
  btn.addEventListener('click', function (e) {
    var open = btn.getAttribute('aria-expanded') !== 'true';
    set(open);
    // Keyboard activation (detail 0) moves focus into the list; a tap leaves focus alone.
    if (open && e.detail === 0) { var first = links.querySelector('a'); if (first) first.focus({ preventScroll: true }); }
  });
  // Tabbing out of the open list closes it.
  function leave(e) {
    var to = e.relatedTarget;
    if (!to || links.contains(to) || to === btn) return; // no target = window blur or a tap; clicks handle those
    set(false);
  }
  links.addEventListener('focusout', leave);
  btn.addEventListener('focusout', leave);
  // Crossing to the desktop layout resets the menu.
  if (window.matchMedia) {
    var mq = window.matchMedia('(min-width: 1001px)');
    var reset = function () { if (mq.matches) set(false); };
    if (mq.addEventListener) mq.addEventListener('change', reset); else if (mq.addListener) mq.addListener(reset);
  }
  links.addEventListener('click', function (e) {
    if (e.target.closest('a')) set(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); if (btn.offsetParent) btn.focus({ preventScroll: true }); }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.site-nav')) set(false);
  });
  document.documentElement.classList.add('js');
})();
