#!/usr/bin/env node
/**
 * Upload mock_orders.json to RetailCRM via /api/v5/orders/upload (batches of 50).
 * Usage: node --env-file=.env.local scripts/upload-orders.mjs [path/to/mock_orders.json]
 */

import { readFileSync } from "fs";

const BASE = process.env.RETAILCRM_URL;
const KEY = process.env.RETAILCRM_API_KEY;
const SITE = process.env.RETAILCRM_SITE || "quaso";
const BATCH_SIZE = 50;

function mapOrder(mock, index) {
  return {
    externalId: `mock-order-${index + 1}`,
    site: SITE,
    orderType: "main",
    orderMethod: mock.orderMethod || "shopping-cart",
    status: mock.status || "new",
    customer: {
      firstName: mock.firstName,
      lastName: mock.lastName,
      phones: [{ number: mock.phone }],
      email: mock.email,
    },
    items: (mock.items || []).map((item, i) => ({
      productName: item.productName,
      quantity: item.quantity,
      initialPrice: item.initialPrice,
      offer: { externalId: `mock-${index + 1}-item-${i + 1}` },
    })),
    delivery: mock.delivery,
    customFields: mock.customFields,
  };
}

async function main() {
  const file = process.argv[2] || "mock_orders.json";
  const raw = JSON.parse(readFileSync(file, "utf-8"));
  console.log(`Loaded ${raw.length} orders from ${file}`);

  const orders = raw.map(mapOrder);

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    const body = new URLSearchParams();
    body.set("orders", JSON.stringify(batch));

    const res = await fetch(
      `${BASE}/api/v5/orders/upload?apiKey=${KEY}`,
      { method: "POST", body },
    );
    const json = await res.json();

    if (!json.success) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, JSON.stringify(json, null, 2));
      process.exit(1);
    }

    const ids = json.uploadedOrders?.map((o) => o.id) || [];
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: uploaded ${batch.length} orders (ids: ${ids.join(", ")})`);
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
