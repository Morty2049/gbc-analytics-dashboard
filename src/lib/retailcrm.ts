const BASE_URL = process.env.RETAILCRM_URL!;
const API_KEY = process.env.RETAILCRM_API_KEY!;

function url(path: string, params?: Record<string, string>) {
  const u = new URL(`/api/v5${path}`, BASE_URL);
  u.searchParams.set("apiKey", API_KEY);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

export async function fetchOrders(filter: Record<string, string> = {}, page = 1, limit = 100) {
  const params: Record<string, string> = {
    limit: String(limit),
    page: String(page),
  };
  for (const [k, v] of Object.entries(filter)) {
    params[`filter[${k}]`] = v;
  }
  const res = await fetch(url("/orders", params));
  if (!res.ok) throw new Error(`RetailCRM /orders ${res.status}: ${await res.text()}`);
  return res.json() as Promise<{
    success: boolean;
    orders: Record<string, unknown>[];
    pagination: { totalPageCount: number; currentPage: number };
  }>;
}

export async function uploadOrders(orders: Record<string, unknown>[]) {
  const body = new URLSearchParams();
  body.set("orders", JSON.stringify(orders));
  const res = await fetch(url("/orders/upload"), { method: "POST", body });
  if (!res.ok) throw new Error(`RetailCRM /orders/upload ${res.status}: ${await res.text()}`);
  return res.json();
}
