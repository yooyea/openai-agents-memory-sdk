declare module "cloudflare:workers" {
  /** Runtime bindings are injected by Cloudflare/Sites at deployment time. */
  export const env: any;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/** Cloudflare supplies the concrete D1 implementation at runtime. */
type D1Database = any;
