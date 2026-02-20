"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewConnectionPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/db-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        port: parseInt(form.port, 10),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message || "Failed to create connection");
      return;
    }

    router.push(`/db/${data.data.id}`);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Add Database Connection</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Connection Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
            placeholder="My Database"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Host</label>
            <input
              type="text"
              required
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
              placeholder="localhost"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Port</label>
            <input
              type="number"
              required
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Database</label>
          <input
            type="text"
            required
            value={form.database}
            onChange={(e) => setForm({ ...form, database: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
            placeholder="my_database"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
            placeholder="postgres"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Testing & Saving..." : "Test & Save Connection"}
        </button>
      </form>
    </div>
  );
}
