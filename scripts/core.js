// Site configuration and domain rules shared by independent browser features.
export const config = Object.freeze({
  siteUrl: "https://metov.store/",
  storeDomain: "metov.store",
  connectionUrl: "https://connect.metov.store/lookup",
  releaseRepository: "Sardorbek505/smart-store-releases",
  releasesApi:
    "https://api.github.com/repos/Sardorbek505/smart-store-releases/releases/latest",
  releasesPage:
    "https://github.com/Sardorbek505/smart-store-releases/releases/latest",
});

export function storeCode(value) {
  if (typeof value !== "string") return null;
  let code = value.trim().toLowerCase();
  if (code.includes(".") || code.includes("/")) {
    let address;
    try {
      address = new URL(code.includes("://") ? code : `https://${code}`);
    } catch {
      return null;
    }
    if (
      address.protocol !== "https:" ||
      address.username ||
      address.password ||
      address.port
    )
      return null;
    const suffix = `.${config.storeDomain}`;
    if (!address.hostname.endsWith(suffix)) return null;
    code = address.hostname.slice(0, -suffix.length);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(code)) return null;
  if (["www", "connect", "api", "admin"].includes(code)) return null;
  return code;
}

export function storeUrl(code) {
  const normalized = storeCode(code);
  return normalized ? `https://${normalized}.${config.storeDomain}/` : null;
}

export function installerFromRelease(release) {
  if (
    !release ||
    release.draft ||
    release.prerelease ||
    !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)
  )
    return null;
  const version = release.tag_name.replace(/^v/, "");
  const name = `SmartStore-Setup-${version}-x64.exe`;
  const asset = Array.isArray(release.assets)
    ? release.assets.find((file) => file?.name === name)
    : null;
  if (!asset || !Number.isFinite(asset.size) || asset.size <= 0) return null;
  const url = `https://github.com/${config.releaseRepository}/releases/download/${release.tag_name}/${name}`;
  if (asset.browser_download_url !== url) return null;
  return { version, url, size: asset.size };
}

// A single deadline covers both headers and JSON. Caller cancellation is preserved.
export async function fetchJson(
  url,
  { timeout = 7000, signal, headers, fetcher = fetch } = {},
) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(url, { signal: controller.signal, headers });
    if (!response.ok) throw new Error("Service unavailable");
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
