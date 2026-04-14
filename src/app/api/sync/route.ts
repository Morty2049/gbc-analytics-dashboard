import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { fetchOrders } from "@/lib/retailcrm";

// Full-refresh sync with diff-delete:
// 1. Pull ALL orders from RetailCRM (not just since last_sync — we need the
//    complete ID set to detect deletions).
// 2. Upsert each order into Supabase, preserving existing customer data when
//    RetailCRM returns null fields.
// 3. Delete orders from Supabase whose IDs are no longer present in RetailCRM.
// 4. Manually-inserted test rows (negative IDs, or id >= 1_000_000_000) are
//    preserved even if they never existed in CRM.
export async function GET() {
  try {
    const sb = createServiceClient();

    let page = 1;
    let totalUpserted = 0;
    const crmIds = new Set<number>();

    while (true) {
      const { orders, pagination } = await fetchOrders(
        { createdAtFrom: "2020-01-01 00:00:00" },
        page,
      );

      if (orders.length === 0) break;

      const rows = orders.map(mapOrder);
      rows.forEach((r) => crmIds.add(Number(r.id)));

      // Fetch existing rows to preserve non-null fields (names, utm, etc.)
      const ids = rows.map((r) => r.id);
      const { data: existing } = await sb
        .from("orders")
        .select("id, customer_name, customer_phone, city, utm_source, created_at")
        .in("id", ids);

      const existingById = new Map(
        (existing ?? []).map((e) => [Number(e.id), e]),
      );

      const merged = rows.map((r) => {
        const prev = existingById.get(Number(r.id));
        if (!prev) return r;
        return {
          ...r,
          customer_name: r.customer_name ?? prev.customer_name,
          customer_phone: r.customer_phone ?? prev.customer_phone,
          city: r.city ?? prev.city,
          utm_source: r.utm_source ?? prev.utm_source,
          created_at: prev.created_at ?? r.created_at,
        };
      });

      const { error: upsertErr } = await sb.from("orders").upsert(merged, { onConflict: "id" });
      if (upsertErr) throw upsertErr;

      totalUpserted += merged.length;
      if (page >= pagination.totalPageCount) break;
      page++;
    }

    // Diff-delete: fetch all Supabase IDs and delete ones no longer in CRM.
    // Keep synthetic rows (id < 0 or id >= 10^9) so they don't disappear.
    const { data: allInDb } = await sb.from("orders").select("id");
    const toDelete = (allInDb ?? [])
      .map((r) => Number(r.id))
      .filter((id) => !crmIds.has(id) && id >= 0 && id < 1_000_000_000);

    let deleted = 0;
    if (toDelete.length > 0) {
      const { error: delErr, count } = await sb
        .from("orders")
        .delete({ count: "exact" })
        .in("id", toDelete);
      if (delErr) throw delErr;
      deleted = count ?? toDelete.length;
    }

    await sb
      .from("sync_state")
      .upsert({ key: "last_sync", value: new Date().toISOString() });

    return NextResponse.json({
      ok: true,
      upserted: totalUpserted,
      deleted,
      crmTotal: crmIds.size,
    });
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
    utm_source: Array.isArray(o.customFields)
      ? null
      : (o.customFields as Record<string, unknown>)?.utm_source?.toString() ?? null,
    created_at: o.createdAt ?? null,
    updated_at: o.statusUpdatedAt ?? o.createdAt ?? null,
    raw: o,
  };
}
