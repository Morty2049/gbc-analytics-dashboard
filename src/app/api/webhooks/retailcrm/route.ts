import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { broadcastMessage } from "@/lib/telegram";

const THRESHOLD = Number(process.env.ORDER_ALERT_THRESHOLD_KZT ?? 50_000);

// Receives webhook POST from RetailCRM on order create/update
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const order = body?.order;
    if (!order?.id) {
      return NextResponse.json({ error: "no order in payload" }, { status: 400 });
    }

    const sb = createServiceClient();
    const customer = (order.customer ?? {}) as Record<string, unknown>;

    const row = {
      id: order.id,
      external_id: order.externalId ?? null,
      number: order.number ?? null,
      status: order.status ?? null,
      total_summ: Number(order.totalSumm ?? 0),
      customer_name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
      customer_phone: (customer.phones as { number?: string }[])?.[0]?.number ?? null,
      city: order.delivery?.address?.city ?? order.delivery?.address?.text ?? null,
      utm_source: order.customFields?.utm_source ?? null,
      created_at: order.createdAt ?? null,
      updated_at: order.statusUpdatedAt ?? order.createdAt ?? null,
      raw: order,
    };

    const { error } = await sb.from("orders").upsert(row, { onConflict: "id" });
    if (error) throw error;

    // Check threshold and notify
    if (row.total_summ >= THRESHOLD) {
      const { data: subs } = await sb.from("telegram_subscribers").select("chat_id");
      if (subs?.length) {
        const text = `<b>New large order #${row.number ?? row.id}</b>\n${row.customer_name ?? "Unknown"}\n<b>${row.total_summ.toLocaleString()} KZT</b>`;
        await broadcastMessage(subs.map((s) => s.chat_id), text);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
