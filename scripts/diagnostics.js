// Only fixed categories and the public build version leave the browser.
// No exception messages, URLs, stack traces, form values or persistent IDs.
const MODULES = new Set([
  "viewport",
  "interface",
  "preview",
  "media",
  "gallery",
  "downloads",
  "store",
  "story",
  "checkout",
  "micro-scenes",
  "analytics",
  "core",
]);

export function createDiagnostics({
  analyticsAllowed,
  version,
  host = window,
  fetcher = fetch,
}) {
  const reported = new Set();
  const build = /^\d{1,5}$/.test(version) ? version : null;
  const valid = (code) =>
    typeof code === "string" &&
    (code === "runtime:exception" ||
      code === "runtime:rejection" ||
      (code.startsWith("module:") && MODULES.has(code.slice(7))));
  const report = (code) => {
    try {
      if (
        !build ||
        !valid(code) ||
        !analyticsAllowed() ||
        reported.has(code) ||
        reported.size >= 5
      )
        return;
      reported.add(code);
      Promise.resolve(
        fetcher("https://zavod.metov.store/act", {
          method: "POST",
          mode: "no-cors",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          keepalive: true,
          body: JSON.stringify({
            site: "smart-store",
            name: "error",
            label: `v${build}:${code}`,
          }),
        }),
      ).catch(() => {});
    } catch {
      // Monitoring must not interrupt the customer journey or retry a failure.
    }
  };
  host.addEventListener("error", (event) => {
    if (event.target === host) report("runtime:exception");
  });
  host.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.name !== "AbortError") report("runtime:rejection");
  });
  return report;
}
