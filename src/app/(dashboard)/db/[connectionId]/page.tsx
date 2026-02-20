"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRefresh } from "@/components/layout/RefreshContext";
import TablesTab from "@/components/schema/TablesTab";
import RelationshipsTab from "@/components/schema/RelationshipsTab";
import EnumsTab from "@/components/schema/EnumsTab";
import IndexesTab from "@/components/schema/IndexesTab";
import InterfacesTab from "@/components/schema/InterfacesTab";

const SchemaDiagram = dynamic(() => import("@/components/schema/SchemaDiagram"), { ssr: false });

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
    interfaces: { name: string; tableName: string; associatedTables: string[]; properties: { name: string; type: string; isOptional: boolean }[] }[];
  } | null;
  lastExtractedAt: string | null;
}

type TabKey = "tables" | "relationships" | "enums" | "indexes" | "interfaces" | "diagram";

export default function ConnectionPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const router = useRouter();
  const { triggerRefresh } = useRefresh();
  const [conn, setConn] = useState<ConnectionDetail | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [tab, setTab] = useState<TabKey>("tables");

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

  async function handleDelete() {
    if (!confirm(`Delete connection "${conn?.name}"? This cannot be undone.`)) return;
    await fetch(`/api/db-connections/${connectionId}`, { method: "DELETE" });
    triggerRefresh();
    router.push("/files");
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

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "tables", label: "Tables", count: schema?.tables.length },
    { key: "relationships", label: "Relationships", count: schema?.relationships.length },
    { key: "enums", label: "Enums", count: schema?.enums.length },
    { key: "indexes", label: "Indexes", count: schema?.indexes.length },
    { key: "interfaces", label: "Interfaces", count: schema?.interfaces.length },
    { key: "diagram", label: "Diagram" },
  ];

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
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {!schema && (
        <p className="text-zinc-500">No schema extracted yet. Click &quot;Extract Schema&quot; to start.</p>
      )}

      {schema && (
        <>
          <div className="flex gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm whitespace-nowrap ${
                  tab === t.key
                    ? "border-b-2 border-blue-600 font-medium"
                    : "text-zinc-500 hover:text-foreground"
                }`}
              >
                {t.label}{t.count != null ? ` (${t.count})` : ""}
              </button>
            ))}
          </div>

          {tab === "tables" && <TablesTab tables={schema.tables} />}
          {tab === "relationships" && <RelationshipsTab relationships={schema.relationships} />}
          {tab === "enums" && <EnumsTab enums={schema.enums} />}
          {tab === "indexes" && <IndexesTab indexes={schema.indexes} />}
          {tab === "interfaces" && <InterfacesTab interfaces={schema.interfaces} />}
          {tab === "diagram" && <SchemaDiagram tables={schema.tables} relationships={schema.relationships} />}
        </>
      )}
    </div>
  );
}
