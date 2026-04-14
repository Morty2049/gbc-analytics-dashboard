#!/usr/bin/env node
// Validate RetailCRM API credentials and print reference dictionaries
// needed to correctly map mock_orders.json → /api/v5/orders/upload.
//
// Usage:
//   node --env-file=.env.local scripts/check-retailcrm.mjs

const BASE = process.env.RETAILCRM_URL;
const KEY = process.env.RETAILCRM_API_KEY;
const SITE = process.env.RETAILCRM_SITE;

if (!BASE || !KEY) {
  console.error("Missing RETAILCRM_URL or RETAILCRM_API_KEY in env");
  process.exit(1);
}

async function get(path, { unversioned = false } = {}) {
  const prefix = unversioned ? "/api" : "/api/v5";
  const url = new URL(`${prefix}${path}`, BASE);
  url.searchParams.set("apiKey", KEY);
  const res = await fetch(url);
  const json = await res.json().catch(() => ({ raw: "<non-json>" }));
  return { status: res.status, json };
}

function codes(obj) {
  if (!obj || typeof obj !== "object") return [];
  // retailCRM reference endpoints return objects keyed by code
  return Object.values(obj).map((v) => ({
    code: v.code,
    name: v.name,
    active: v.active,
  }));
}

function bullet(arr) {
  return arr.map((x) => `    - ${x.code}  —  ${x.name}${x.active === false ? " (inactive)" : ""}`).join("\n");
}

console.log(`→ Base URL: ${BASE}`);
console.log(`→ Site code: ${SITE || "(not set)"}\n`);

console.log("[1] Credentials check (/api/credentials)");
const cred = await get("/credentials", { unversioned: true });
if (cred.status !== 200 || !cred.json.success) {
  console.error("  ❌ Credentials check failed:", cred.status, cred.json);
  process.exit(1);
}
console.log(`  ✅ Site access: ${(cred.json.siteAccess || "")}`);
console.log(`  ✅ Sites allowed: ${JSON.stringify(cred.json.sitesAvailable || [])}`);
console.log(`  ✅ Methods count: ${(cred.json.credentials || []).length}`);

const hasOrderWrite =
  (cred.json.credentials || []).some((c) => c.includes("/api/v5/orders/create") || c.includes("/api/v5/orders/upload"));
console.log(`  ${hasOrderWrite ? "✅" : "❌"} orders write permission: ${hasOrderWrite}`);

console.log("\n[2] Reference: order types (/reference/order-types)");
const ot = await get("/reference/order-types");
console.log(bullet(codes(ot.json.orderTypes)));

console.log("\n[3] Reference: order methods (/reference/order-methods)");
const om = await get("/reference/order-methods");
console.log(bullet(codes(om.json.orderMethods)));

console.log("\n[4] Reference: statuses (/reference/statuses)");
const st = await get("/reference/statuses");
console.log(bullet(codes(st.json.statuses)));

console.log("\n[5] Reference: sites (/reference/sites)");
const sites = await get("/reference/sites");
console.log(bullet(codes(sites.json.sites)));

console.log("\n[6] Existing orders count (/orders?limit=20)");
const orders = await get("/orders?limit=20");
console.log(`  totalCount: ${orders.json.pagination?.totalCount ?? "?"}`);

console.log("\n✅ Done. Use the codes above to validate mock_orders.json before /orders/upload.");
