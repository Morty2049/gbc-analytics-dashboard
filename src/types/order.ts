export interface Order {
  id: number;
  external_id: string | null;
  number: string | null;
  status: string | null;
  total_summ: number;
  customer_name: string | null;
  customer_phone: string | null;
  city: string | null;
  utm_source: string | null;
  created_at: string;
  updated_at: string;
  raw: Record<string, unknown>;
}

export interface TelegramSubscriber {
  chat_id: number;
  username: string | null;
  subscribed_at: string;
}

export interface SyncState {
  key: string;
  value: string;
}
