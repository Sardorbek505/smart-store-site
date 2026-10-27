// Visits, button labels and section reads for the developer's dashboard.
// No executable third-party SDK, query strings, form values or browser credentials.
// Labels come from the page itself (button text, section headings), so new buttons are
// counted without any markup. Downloads are labelled "Скачать — …" so the dashboard can put
// them into the landing → install funnel.

const ENDPOINT = "https://zavod.metov.store/act";
const SITE = "smart-store";
const MAX = 70;

/** One line, no repeated spaces, cut to the dashboard's limit. */
export function cleanLabel(text) {
  if (typeof text !== "string") return "";
  let line = text.replace(/\s+/g, " ").trim();
  // Animated buttons repeat their text in a second layer: "Открыть демо Открыть демо".
  const words = line.split(" ");
  const half = words.length / 2;
  if (
    Number.isInteger(half) &&
    words.slice(0, half).join(" ") === words.slice(half).join(" ")
  )
    line = words.slice(0, half).join(" ");
  return line.length > MAX ? `${line.slice(0, MAX - 1)}…` : line;
}

/** A download button: the main call to action, the installation links or a direct release link. */
export function isDownload(element) {
  if (element.matches?.("#download, [data-download], #start-download"))
    return true;
  const href = element.getAttribute?.("href") ?? "";
  return /smart-store-releases\/releases|\.exe($|\?)/.test(href);
}

function sectionName(element) {
  const section = element.closest?.("section[aria-labelledby]");
  const heading =
    section && document.getElementById(section.getAttribute("aria-labelledby"));
  // innerText keeps line breaks as spaces: "Весь магазин. В вашем фокусе."
  return heading ? cleanLabel(heading.innerText || heading.textContent) : "";
}

function labelFor(element) {
  const own = cleanLabel(
    element.getAttribute("data-act") ||
      element.getAttribute("aria-label") ||
      element.innerText ||
      element.textContent,
  );
  if (!own) return "";
  if (isDownload(element)) return cleanLabel(`Скачать — ${own}`);
  const where = sectionName(element);
  return cleanLabel(where && where !== own ? `${own} · ${where}` : own);
}

function transmit(endpoint, payload, json = false) {
  try {
    fetch(endpoint, {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      mode: json ? "cors" : "no-cors",
      referrerPolicy: "no-referrer",
      ...(json ? { headers: { "content-type": "application/json" } } : {}),
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // The counter must never get in the way of the site.
  }
}

export function init({ analyticsAllowed, referrerOrigin }) {
  if (!analyticsAllowed()) return;
  transmit(
    "https://zavod.metov.store/hit",
    {
      site: SITE,
      path: location.pathname,
      ref: referrerOrigin(document.referrer),
    },
    true,
  );
  const tell = (name, label) => {
    if (label && analyticsAllowed())
      transmit(ENDPOINT, { site: SITE, name, label });
  };
  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("a, button")
          : null;
      if (target) tell("click", labelFor(target));
    },
    { capture: true },
  );
  if (!("IntersectionObserver" in window)) return;
  // A section counts as read when a third of it has been on screen.
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seen.unobserve(entry.target);
        tell("seen", sectionName(entry.target));
      }
    },
    { threshold: 0.33 },
  );
  for (const section of document.querySelectorAll("section[aria-labelledby]"))
    seen.observe(section);
}
