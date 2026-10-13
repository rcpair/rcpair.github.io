// rcpair.si visit counter. No cookies and nothing stored on the device. Tells t.rcpair.si which page was opened, the
// ?r= tag on the link that brought the visitor, the site that sent them (name only), links tapped that leave the page,
// and on leaving how long they stayed and how far they scrolled. The server drops the end of the IP address before
// saving. Described on privacy.html#site.
(function () {
  var T = "https://t.rcpair.si/e.gif";
  var q = new URLSearchParams(location.search);
  var r = (q.get("r") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40).toLowerCase();
  var ref = "", from = "";
  try {
    if (document.referrer) {
      var u = new URL(document.referrer);
      if (u.hostname === location.hostname) from = u.pathname; else ref = u.hostname;
    }
  } catch (x) {}
  var t0 = Date.now(), deep = 0, left = false;
  function hit(e, extra) {
    var u = T + "?e=" + e + "&p=" + encodeURIComponent(location.pathname) + (r ? "&r=" + r : "") +
      (ref ? "&ref=" + encodeURIComponent(ref) : "") + (extra || "");
    try { fetch(u, { mode: "no-cors", keepalive: true, credentials: "omit", cache: "no-store" }); }
    catch (x) { new Image().src = u; }
  }
  hit("view", from ? "&from=" + encodeURIComponent(from) : "");
  addEventListener("scroll", function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) deep = Math.max(deep, Math.min(100, Math.round(100 * scrollY / h)));
  }, { passive: true });
  addEventListener("pagehide", function () {
    if (left) return; left = true;
    hit("leave", "&s=" + Math.round((Date.now() - t0) / 1000) + "&d=" + deep);
  });
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href"), to = "";
    if (href.charAt(0) === "#") return;
    if (/^mailto:/i.test(href)) to = "mail";
    else if (/^rcpair:/i.test(href)) to = "app-link";
    else {
      try {
        var u = new URL(a.href);
        if (u.hostname !== location.hostname) to = u.hostname;
        else if (!/(\.html?|\/)$/.test(u.pathname)) to = "file:" + u.pathname.split("/").pop();
      } catch (x) {}
    }
    if (to) hit("click", "&to=" + encodeURIComponent(to) + (a.dataset.t ? "&l=" + encodeURIComponent(a.dataset.t) : ""));
  }, true);
})();
