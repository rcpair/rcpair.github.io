// Public, read-only status. No cookies or account data are sent to the manifest host.
(async () => {
  const boxes = [...document.querySelectorAll("[data-release-product]")];
  const resources = [...document.querySelectorAll("[data-release-resource]")];
  if (!boxes.length && !resources.length) return;
  const allowed = [
    "testflight.apple.com",
    "github.com",
    "apps.apple.com",
    "play.google.com",
  ];
  try {
    const r = await fetch("/releases.json", {
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (!r.ok) throw Error("status unavailable");
    const m = await r.json();
    if (
      m.schemaVersion !== 1 ||
      m.maxAgeHours !== 24 ||
      !Array.isArray(m.records)
    )
      throw Error("invalid status");
    const safeUrl = (value, resource = false) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.hash &&
          allowed.includes(url.hostname) &&
          (!resource ||
            (url.hostname === "github.com" &&
              url.pathname.startsWith(
                "/rcpair/rcpair-releases/releases/download/",
              )))
        );
      } catch {
        return false;
      }
    };
    m.records = m.records.map((item) =>
      safeUrl(item.url) ? item : { ...item, state: "unverified", url: null },
    );
    m.resources = (m.resources || []).filter((item) => safeUrl(item.url, true));
    for (const box of boxes) {
      const rows = m.records.filter(
        (x) =>
          x.product === box.dataset.releaseProduct &&
          x.channel === box.dataset.releaseChannel &&
          (!box.dataset.releasePlatforms ||
            box.dataset.releasePlatforms.split("|").includes(x.platform)),
      );
      if (!rows.length) continue;
      const fragment = document.createDocumentFragment();
      for (const item of rows) {
        const article = document.createElement("article"),
          h = document.createElement("h3"),
          p = document.createElement("p"),
          date = document.createElement("p");
        article.className = "platform";
        h.textContent = item.platform;
        const age = Date.now() - Date.parse(item.verifiedAt),
          fresh = Number.isFinite(age) && age >= -300000 && age <= 86400000;
        p.textContent = !fresh
          ? "Availability needs rechecking. Last verified information is out of date."
          : item.state === "available"
            ? `Version ${item.version}${item.build ? ` (build ${item.build})` : ""}`
            : item.state === "not_released"
              ? "No release is available in this channel."
              : item.state === "pending"
                ? "Not available to this tester group yet."
                : "Current availability and version are not verified.";
        date.textContent =
          item.state === "unverified"
            ? "No verified release information."
            : `Last verified ${new Date(item.verifiedAt).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}.`;
        article.append(h, p, date);
        if (fresh && item.state === "available" && item.url) {
          const u = new URL(item.url);
          if (
            u.protocol !== "https:" ||
            u.username ||
            u.password ||
            u.hash ||
            !allowed.includes(u.hostname)
          )
            throw Error("invalid download");
          const a = document.createElement("a");
          a.href = u.href;
          a.textContent =
            item.channel === "external" ? "Open TestFlight" : "Download";
          a.rel = "noopener";
          article.append(a);
        }
        if (!fresh || item.state !== "available") {
          const a = document.createElement("a");
          a.href =
            item.product === "rcpair"
              ? item.platform.includes("iPhone")
                ? "https://rcpair.si/support/"
                : "https://github.com/rcpair/rcpair-releases/releases/latest"
              : item.platform === "Android"
                ? "https://play.google.com/store/apps/details?id=ai.risingcreek.pacenotes"
                : "/support";
          a.textContent = "Check current availability";
          a.rel = "noopener";
          article.append(a);
        }
        fragment.append(article);
      }
      box.replaceChildren(fragment);
    }
    for (const block of document.querySelectorAll(
      "[data-release-instructions]",
    )) {
      const version = block.dataset.releaseInstructions,
        ids = block.dataset.releaseInstructionRecords.split("|");
      const current = ids.map((id) => m.records.find((r) => r.id === id));
      const fresh = (r) =>
        r &&
        Number.isFinite(Date.parse(r.verifiedAt)) &&
        Date.now() - Date.parse(r.verifiedAt) >= -300000 &&
        Date.now() - Date.parse(r.verifiedAt) <= 86400000;
      const files = ["rc-checksums", "rc-signature"].map((id) =>
        (m.resources || []).find((r) => r.id === id),
      );
      const okay =
        current.every(
          (r) => fresh(r) && r.state === "available" && r.version === version,
        ) &&
        files.every(
          (r) => fresh(r) && r.url.includes("/rcpair-v" + version + "/"),
        );
      block.hidden = !okay;
      const note = block.previousElementSibling?.previousElementSibling;
      if (note?.hasAttribute("data-release-instruction-note"))
        note.hidden = okay;
    }
    for (const link of resources) {
      const item = [...m.records, ...(m.resources || [])].find(
        (x) => x.id === link.dataset.releaseResource,
      );
      if (!item || ("state" in item && item.state !== "available")) continue;
      const age = Date.now() - Date.parse(item.verifiedAt);
      if (!Number.isFinite(age) || age < -300000 || age > 86400000 || !item.url)
        continue;
      const u = new URL(item.url);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.hash ||
        !allowed.includes(u.hostname)
      )
        continue;
      link.href = u.href;
      link.removeAttribute("aria-disabled");
    }
  } catch {
    /* Keep the explicit unavailable fallback; never reuse cached version claims. */
  }
})();
