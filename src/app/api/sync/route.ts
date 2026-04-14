import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { fetchOrders } from "@/lib/retailcrm";

// Called by Vercel Cron daily (or manually via GET)
// Pulls orders updated since last sync from RetailCRM → upserts into Supabase
export async function GET() {
  try {
    const sb = createServiceClient();

    // Read last sync timestamp
    const { data: syncRow } = await sb
      .from("sync_state")
      .select("value")
      .eq("key", "last_sync")
      .single();

    const since = syncRow?.value
      ? new Date(syncRow.value).toISOString().replace("T", " ").slice(0, 19)
      : "2020-01-01 00:00:00";

    let page = 1;
    let totalUpserted = 0;

    // Paginate through updated orders
    while (true) {
      const { orders, pagination } = await fetchOrders(
        { createdAtFrom: since },
        page,
      );

      if (orders.length === 0) break;

      const rows = orders.map(mapOrder);
      const { error } = await sb.from("orders").upsert(rows, { onConflict: "id" });
      if (error) throw error;

      totalUpserted += rows.length;
      if (page >= pagination.totalPageCount) break;
      page++;
    }

    // Update sync timestamp
    await sb
      .from("sync_state")
      .upsert({ key: "last_sync", value: new Date().toISOString() });

    return NextResponse.json({ ok: true, upserted: totalUpserted });
  } catch (e) {
    console.error("Sync error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function mapOrder(o: Record<string, unknown>) {
  const customer = (o.customer ?? {}) as Record<string, unknown>;
  const delivery = (o.delivery ?? {}) as Record<string, unknown>;
  const address = (delivery.address ?? {}) as Record<string, unknown>;
  return {
    id: o.id,
    external_id: o.externalId ?? null,
    number: o.number ?? null,
    status: o.status ?? null,
    total_summ: Number(o.totalSumm ?? 0),
    customer_name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
    customer_phone: (customer.phones as { number?: string }[])?.[0]?.number ?? null,
    city: address.city?.toString() ?? null,
    utm_source: Array.isArray(o.customFields) ? null : (o.customFields as Record<string, unknown>)?.utm_source?.toString() ?? null,
    created_at: o.createdAt ?? null,
    updated_at: o.statusUpdatedAt ?? o.createdAt ?? null,
    raw: o,
  };
}
