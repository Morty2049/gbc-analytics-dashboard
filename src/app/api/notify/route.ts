import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { broadcastMessage } from "@/lib/telegram";

const THRESHOLD = Number(process.env.ORDER_ALERT_THRESHOLD_KZT ?? 50_000);

// Manual trigger: check recent orders above threshold and send alerts
export async function POST() {
  try {
    const sb = createServiceClient();

    const { data: orders } = await sb
      .from("orders")
      .select("id, number, customer_name, total_summ")
      .gte("total_summ", THRESHOLD)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!orders?.length) {
      return NextResponse.json({ ok: true, message: "No orders above threshold" });
    }

    const { data: subs } = await sb.from("telegram_subscribers").select("chat_id");
    if (!subs?.length) {
      return NextResponse.json({ ok: true, message: "No subscribers" });
    }

    const text = orders
      .map((o) => `#${o.number ?? o.id} — ${o.customer_name ?? "?"} — <b>${o.total_summ.toLocaleString()} KZT</b>`)
      .join("\n");

    await broadcastMessage(
      subs.map((s) => s.chat_id),
      `<b>Recent large orders:</b>\n${text}`,
    );

    return NextResponse.json({ ok: true, notified: subs.length });
  } catch (e) {
    console.error("Notify error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
