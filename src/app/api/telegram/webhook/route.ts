import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { sendMessage } from "@/lib/telegram";

const NAMES = ["Айгуль Касымова", "Дана Серикова", "Марат Ибрагимов", "Жанна Кузнецова", "Ерлан Жумабаев", "Алия Нурпеисова"];
const CITIES = ["Алматы", "Астана", "Шымкент", "Актау", "Караганда"];
const PRODUCTS = ["Nova Classic", "Nova Slim", "Nova Lift", "Nova Fit", "Nova Shape"];
const UTM = ["instagram", "google", "tiktok", "direct", "referral"];

function randomOrder() {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const [firstName, lastName] = name.split(" ");
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const utm = UTM[Math.floor(Math.random() * UTM.length)];
  const qty = Math.floor(Math.random() * 3) + 1;
  const price = (Math.floor(Math.random() * 8) + 2) * 10000; // 20K-90K
  const total = price * qty;
  const phone = `+7700${Math.floor(1000000 + Math.random() * 9000000)}`;
  return { firstName, lastName, phone, city, product, qty, price, total, utm };
}

// Receives webhook POST from Telegram BotFather
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat?.id;
    const text = (message.text ?? "").trim();

    if (!chatId) return NextResponse.json({ ok: true });

    const sb = createServiceClient();

    if (text === "/start") {
      await sb.from("telegram_subscribers").upsert({
        chat_id: chatId,
        username: message.from?.username ?? null,
      });
      await sendMessage(
        chatId,
        "Subscribed to order alerts.\n\nCommands:\n/test_order — create a random test order in RetailCRM\n/stats — quick stats",
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/test_order") {
      const o = randomOrder();

      // Create order in RetailCRM
      const BASE = process.env.RETAILCRM_URL!;
      const KEY = process.env.RETAILCRM_API_KEY!;
      const orderPayload = {
        site: "quaso",
        orderType: "main",
        orderMethod: "shopping-cart",
        status: "new",
        customer: {
          firstName: o.firstName,
          lastName: o.lastName,
          phones: [{ number: o.phone }],
        },
        items: [{
          productName: o.product,
          quantity: o.qty,
          initialPrice: o.price,
        }],
        delivery: { address: { city: o.city, text: `ул. Тестовая ${Math.floor(Math.random() * 100) + 1}` } },
        customFields: { utm_source: o.utm },
      };

      const formBody = new URLSearchParams();
      formBody.set("order", JSON.stringify(orderPayload));
      const crmRes = await fetch(`${BASE}/api/v5/orders/create?apiKey=${KEY}`, { method: "POST", body: formBody });
      const crmJson = await crmRes.json();

      if (!crmJson.success) {
        await sendMessage(chatId, `Failed to create order in RetailCRM:\n${JSON.stringify(crmJson.errors ?? crmJson.errorMsg)}`);
        return NextResponse.json({ ok: true });
      }

      const crmOrder = crmJson.order;
      const orderId = crmOrder.id;
      const orderNumber = crmOrder.number;

      // Upsert into Supabase
      await sb.from("orders").upsert({
        id: orderId,
        number: orderNumber,
        status: "new",
        total_summ: o.total,
        customer_name: `${o.firstName} ${o.lastName}`,
        customer_phone: o.phone,
        city: o.city,
        utm_source: o.utm,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        raw: crmOrder,
      }, { onConflict: "id" });

      // Notify the creator
      const msg = [
        `<b>Test order created</b>`,
        `#${orderNumber} (CRM id: ${orderId})`,
        `${o.firstName} ${o.lastName} — ${o.city}`,
        `${o.product} x${o.qty} = <b>${o.total.toLocaleString()} KZT</b>`,
        `UTM: ${o.utm}`,
      ].join("\n");
      await sendMessage(chatId, msg);

      // If above threshold, also alert all subscribers
      const threshold = Number(process.env.ORDER_ALERT_THRESHOLD_KZT ?? 50000);
      if (o.total >= threshold) {
        const { data: subs } = await sb.from("telegram_subscribers").select("chat_id");
        const otherSubs = (subs ?? []).filter((s) => s.chat_id !== chatId);
        if (otherSubs.length > 0) {
          const alert = `<b>New large order #${orderNumber}</b>\n${o.firstName} ${o.lastName}\n<b>${o.total.toLocaleString()} KZT</b>`;
          await Promise.allSettled(otherSubs.map((s) => sendMessage(s.chat_id, alert)));
        }
        // Also alert the creator if it's above threshold
        await sendMessage(chatId, `⚠ Above ${threshold.toLocaleString()} KZT threshold — alert sent to all subscribers`);
      }

      return NextResponse.json({ ok: true });
    }

    if (text === "/stats") {
      const { count } = await sb.from("orders").select("*", { count: "exact", head: true });
      const { data: revenue } = await sb.from("orders").select("total_summ");
      const total = (revenue ?? []).reduce((s, r) => s + Number(r.total_summ), 0);
      await sendMessage(
        chatId,
        `<b>Dashboard stats</b>\nOrders: ${count}\nRevenue: ${total.toLocaleString()} KZT\n\nhttps://gbc-analytics-dashboard-ochre.vercel.app`,
      );
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    await sendMessage(chatId, "Commands:\n/start — subscribe\n/test_order — random test order\n/stats — quick stats");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Telegram webhook error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
