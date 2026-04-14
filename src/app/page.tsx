"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Order {
  id: number;
  number: string | null;
  status: string | null;
  total_summ: number;
  customer_name: string | null;
  customer_phone: string | null;
  city: string | null;
  utm_source: string | null;
  created_at: string;
}

const COLORS = ["#3b82f6", "#06b6d4", "#6366f1", "#8b5cf6", "#f59e0b", "#10b981"];

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const sb = createBrowserClient();
    sb.from("orders")
      .select("id, number, status, total_summ, customer_name, customer_phone, city, utm_source, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  // Aggregate: orders & revenue by day
  const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
  for (const o of orders) {
    const date = o.created_at?.slice(0, 10) ?? "unknown";
    const existing = byDay.get(date) ?? { date, orders: 0, revenue: 0 };
    existing.orders += 1;
    existing.revenue += o.total_summ;
    byDay.set(date, existing);
  }
  const dailyData = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Aggregate: top cities
  const cityMap = new Map<string, number>();
  for (const o of orders) {
    const city = o.city ?? "Unknown";
    cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
  }
  const cityData = [...cityMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Aggregate: utm sources
  const utmMap = new Map<string, number>();
  for (const o of orders) {
    const utm = o.utm_source ?? "direct";
    utmMap.set(utm, (utmMap.get(utm) ?? 0) + 1);
  }
  const utmData = [...utmMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Summary metrics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.total_summ, 0);
  const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const largeOrders = orders.filter((o) => o.total_summ >= 50000).length;

  // Filtered orders for table
  const statuses = [...new Set(orders.map((o) => o.status ?? "unknown"))];
  const filteredOrders =
    statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-1">GBC Retail CRM Dashboard</h1>
      <p className="text-sm text-zinc-500 mb-6">Order analytics from RetailCRM via Supabase</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Orders" value={String(totalOrders)} color="border-blue-500" />
        <SummaryCard label="Total Revenue" value={`${(totalRevenue / 1000).toFixed(0)}K KZT`} color="border-emerald-500" />
        <SummaryCard label="Avg Order" value={`${(avgOrder / 1000).toFixed(1)}K KZT`} color="border-amber-500" />
        <SummaryCard label="Large Orders (50K+)" value={String(largeOrders)} color="border-rose-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ChartCard title="Orders by Day">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" fontSize={11} tickFormatter={(v) => v.slice(5)} />
              <YAxis width={30} fontSize={11} />
              <Tooltip />
              <Bar dataKey="orders" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by Day (KZT)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" fontSize={11} tickFormatter={(v) => v.slice(5)} />
              <YAxis width={50} fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString()} KZT`} />
              <Bar dataKey="revenue" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ChartCard title="Orders by City">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={cityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {cityData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders by UTM Source">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={utmData} layout="vertical">
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey="name" type="category" width={70} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-zinc-300 rounded px-3 py-1.5 text-sm"
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="pb-2 pr-4">#</th>
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">City</th>
                <th className="pb-2 pr-4">UTM</th>
                <th className="pb-2 pr-4 text-right">Sum</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, 20).map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 pr-4 font-medium">{o.number ?? o.id}</td>
                  <td className="py-2 pr-4">{o.customer_name ?? "—"}</td>
                  <td className="py-2 pr-4">{o.city ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs">{o.utm_source ?? "—"}</span>
                  </td>
                  <td className="py-2 pr-4 text-right font-medium">{o.total_summ.toLocaleString()} KZT</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      o.status === "new" ? "bg-blue-100 text-blue-700" :
                      o.status === "complete" ? "bg-emerald-100 text-emerald-700" :
                      "bg-zinc-100 text-zinc-600"
                    }`}>
                      {o.status ?? "—"}
                    </span>
                  </td>
                  <td className="py-2 text-zinc-500">{o.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-lg border-t-4 ${color} border border-zinc-200 p-4`}>
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}
