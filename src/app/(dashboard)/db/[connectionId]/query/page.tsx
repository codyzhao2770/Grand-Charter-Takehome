"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

interface QueryResult {
  sql: string;
  explanation: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export default function QueryPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setError("");
    setResult(null);
    setLoading(true);

    const res = await fetch(`/api/db-connections/${connectionId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: question }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message || "Query failed");
      return;
    }

    setResult(data.data);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Natural Language Query</h1>

      <form onSubmit={handleQuery} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the database... e.g. 'Show me the top 10 users by post count'"
            className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Running..." : "Run"}
          </button>
        </div>
      </form>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 mb-1">Generated SQL</h3>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded overflow-x-auto">
              {result.sql}
            </pre>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-500 mb-1">Explanation</h3>
            <p className="text-sm">{result.explanation}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-500 mb-1">
              Results ({result.rowCount} rows)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-900">
                    {result.columns.map((col) => (
                      <th key={col} className="text-left py-2 px-3 font-mono text-xs border-b dark:border-zinc-800">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b dark:border-zinc-800">
                      {result.columns.map((col) => (
                        <td key={col} className="py-1.5 px-3 text-xs font-mono">
                          {row[col] === null ? (
                            <span className="text-zinc-400">null</span>
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
