/**
 * Cloudflare Pages Function — the backend seam.
 *
 * The core product runs entirely in the browser (parsing, charting, theming,
 * PPTX export), so no server is needed for normal use and Cloudflare compute
 * cost stays at zero. This directory is where genuinely server-side features
 * would live later — e.g. shareable snapshot links (KV), or an LLM-backed
 * insight endpoint — without disturbing the client architecture.
 *
 * This handler just reports liveness so the deployment can be smoke-tested.
 */
export const onRequestGet: PagesFunction = async () =>
  new Response(
    JSON.stringify({ status: 'ok', service: 'chart-builder-pro', ts: Date.now() }),
    { headers: { 'content-type': 'application/json' } },
  );
