const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN!;

export async function sendMessage(chatId: number, text: string) {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    },
  );
  if (!res.ok) throw new Error(`Telegram sendMessage ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function broadcastMessage(chatIds: number[], text: string) {
  return Promise.allSettled(chatIds.map((id) => sendMessage(id, text)));
}
