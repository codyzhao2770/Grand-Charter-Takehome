"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface SchemaTable {
  name: string;
  columns: {
    name: string;
    dataType: string;
    udtName: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
  }[];
  estimatedRowCount: number;
}

interface ConnectionDetail {
  id: string;
  name: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  cachedSchema: {
    tables: SchemaTable[];
    relationships: { sourceTable: string; sourceColumn: string; targetTable: string; targetColumn: string }[];
    enums: { name: string; values: string[] }[];
    indexes: { name: string; tableName: string; columns: string[]; isUnique: boolean; isPrimary: boolean }[];
    interfaces: { name: string; properties: { name: string; type: string; isOptional: boolean }[] }[];
  } | null;
  lastExtractedAt: string | null;
}

export default function ConnectionPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const [conn, setConn] = useState<ConnectionDetail | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tab, setTab] = useState<"tables" | "relationships" | "enums" | "indexes" | "interfaces">("tables");

  const loadData = useCallback(() => {
    fetch(`/api/db-connections/${connectionId}`)
      .then((r) => r.json())
      .then((d) => setConn(d.data || null));
  }, [connectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleExtract() {
    setExtracting(true);
    await fetch(`/api/db-connections/${connectionId}/extract`, { method: "POST" });
    setExtracting(false);
    loadData();
  }

  function handleExportJSON() {
    if (!conn?.cachedSchema) return;
    const blob = new Blob([JSON.stringify(conn.cachedSchema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conn.name}-schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!conn) return <p className="text-zinc-500">Loading...</p>;

  const schema = conn.cachedSchema;
  const activeTable = schema?.tables.find((t) => t.name === selectedTable);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{conn.name}</h1>
          <p className="text-sm text-zinc-500">
            {conn.host}:{conn.port}/{conn.databaseName}
            {conn.lastExtractedAt && (
              <> &middot; Last extracted: {new Date(conn.lastExtractedAt).toLocaleString()}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? "Extracting..." : schema ? "Refresh Schema" : "Extract Schema"}
          </button>
          {schema && (
            <>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
              >
                Export JSON
              </button>
              <Link
                href={`/db/${connectionId}/query`}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Query
              </Link>
            </>
          )}
        </div>
      </div>

      {!schema && (
        <p className="text-zinc-500">No schema extracted yet. Click &quot;Extract Schema&quot; to start.</p>
      )}

      {schema && (
        <>
          <div className="flex gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800">
            {(["tables", "relationships", "enums", "indexes", "interfaces"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm capitalize ${
                  tab === t
                    ? "border-b-2 border-blue-600 font-medium"
                    : "text-zinc-500 hover:text-foreground"
                }`}
              >
                {t} ({schema[t]?.length || 0})
              </button>
            ))}
          </div>

          {tab === "tables" && (
            <div className="flex gap-6">
              <div className="w-48 space-y-1 shrink-0">
                {schema.tables.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedTable(t.name)}
                    className={`block w-full text-left px-3 py-1.5 rounded text-sm truncate ${
                      selectedTable === t.name ? "bg-zinc-200 dark:bg-zinc-800 font-medium" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="flex-1">
                {activeTable ? (
                  <div>
                    <h3 className="font-bold mb-1">{activeTable.name}</h3>
                    <p className="text-xs text-zinc-500 mb-3">~{activeTable.estimatedRowCount.toLocaleString()} rows</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-zinc-800">
                          <th className="text-left py-2 px-2">Column</th>
                          <th className="text-left py-2 px-2">Type</th>
                          <th className="text-left py-2 px-2">Nullable</th>
                          <th className="text-left py-2 px-2">Key</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTable.columns.map((c) => (
                          <tr key={c.name} className="border-b dark:border-zinc-800">
                            <td className="py-1.5 px-2 font-mono text-xs">{c.name}</td>
                            <td className="py-1.5 px-2 text-xs">{c.udtName}</td>
                            <td className="py-1.5 px-2 text-xs">{c.isNullable ? "yes" : "no"}</td>
                            <td className="py-1.5 px-2 text-xs">
                              {c.isPrimaryKey && <span className="text-amber-600">PK</span>}
                              {c.isForeignKey && <span className="text-blue-600 ml-1">FK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">Select a table to view its columns.</p>
                )}
              </div>
            </div>
          )}

          {tab === "relationships" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-zinc-800">
                  <th className="text-left py-2 px-2">From</th>
                  <th className="text-left py-2 px-2">To</th>
                </tr>
              </thead>
              <tbody>
                {schema.relationships.map((r, i) => (
                  <tr key={i} className="border-b dark:border-zinc-800">
                    <td className="py-1.5 px-2 font-mono text-xs">{r.sourceTable}.{r.sourceColumn}</td>
                    <td className="py-1.5 px-2 font-mono text-xs">{r.targetTable}.{r.targetColumn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "enums" && (
            <div className="space-y-3">
              {schema.enums.map((e) => (
                <div key={e.name}>
                  <h3 className="font-mono text-sm font-bold">{e.name}</h3>
                  <p className="text-xs text-zinc-500">{e.values.join(", ")}</p>
                </div>
              ))}
              {schema.enums.length === 0 && <p className="text-zinc-500 text-sm">No enums found.</p>}
            </div>
          )}

          {tab === "indexes" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-zinc-800">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Table</th>
                  <th className="text-left py-2 px-2">Columns</th>
                  <th className="text-left py-2 px-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {schema.indexes.map((idx) => (
                  <tr key={idx.name} className="border-b dark:border-zinc-800">
                    <td className="py-1.5 px-2 font-mono text-xs">{idx.name}</td>
                    <td className="py-1.5 px-2 text-xs">{idx.tableName}</td>
                    <td className="py-1.5 px-2 font-mono text-xs">{idx.columns.join(", ")}</td>
                    <td className="py-1.5 px-2 text-xs">
                      {idx.isPrimary ? "PK" : idx.isUnique ? "Unique" : "Index"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "interfaces" && (
            <div className="space-y-6">
              {schema.interfaces.map((iface) => (
                <div key={iface.name}>
                  <h3 className="font-mono text-sm font-bold mb-1">interface {iface.name}</h3>
                  <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded overflow-x-auto">
{`interface ${iface.name} {\n${iface.properties
  .map((p) => `  ${p.name}${p.isOptional ? "?" : ""}: ${p.type};`)
  .join("\n")}\n}`}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
