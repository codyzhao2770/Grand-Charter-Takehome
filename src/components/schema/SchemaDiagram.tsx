"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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

interface Relationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

interface SchemaDiagramProps {
  tables: SchemaTable[];
  relationships: Relationship[];
}

// Custom node component for tables
function TableNode({ data }: { data: { label: string; columns: SchemaTable["columns"]; rowCount: number } }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow-md min-w-[200px] text-xs">
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-2 !h-2" />
      <div className="bg-blue-600 text-white px-3 py-1.5 rounded-t font-bold text-sm flex justify-between items-center">
        <span>{data.label}</span>
        <span className="text-blue-200 font-normal text-[10px]">~{data.rowCount.toLocaleString()}</span>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {data.columns.map((col) => (
          <div key={col.name} className="px-3 py-1 flex items-center gap-2">
            <span className="shrink-0 w-6 text-[10px] text-right">
              {col.isPrimaryKey && <span className="text-amber-600 font-bold">PK</span>}
              {col.isForeignKey && <span className="text-blue-500 font-bold">FK</span>}
            </span>
            <span className="font-mono font-medium truncate">{col.name}</span>
            <span className="ml-auto text-zinc-400 shrink-0">{col.udtName}</span>
            {col.isNullable && <span className="text-zinc-300 shrink-0">?</span>}
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
};

// Simple layout: arrange tables in a grid, placing connected tables closer
function layoutNodes(tables: SchemaTable[], relationships: Relationship[]): Node[] {
  // Build adjacency for grouping
  const adjMap = new Map<string, Set<string>>();
  for (const t of tables) adjMap.set(t.name, new Set());
  for (const r of relationships) {
    adjMap.get(r.sourceTable)?.add(r.targetTable);
    adjMap.get(r.targetTable)?.add(r.sourceTable);
  }

  // BFS ordering so connected tables are near each other
  const ordered: string[] = [];
  const visited = new Set<string>();

  // Start from tables with most connections
  const sorted = [...tables].sort(
    (a, b) => (adjMap.get(b.name)?.size || 0) - (adjMap.get(a.name)?.size || 0)
  );

  for (const start of sorted) {
    if (visited.has(start.name)) continue;
    const queue = [start.name];
    visited.add(start.name);
    while (queue.length > 0) {
      const current = queue.shift()!;
      ordered.push(current);
      for (const neighbor of adjMap.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  const cols = Math.max(2, Math.ceil(Math.sqrt(ordered.length)));
  const colWidth = 320;
  const rowHeight = 280;

  return ordered.map((name, i) => {
    const table = tables.find((t) => t.name === name)!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Vary height by column count to avoid perfect grid overlap
    const extraHeight = table.columns.length * 4;

    return {
      id: name,
      type: "tableNode",
      position: { x: col * colWidth, y: row * rowHeight + extraHeight },
      data: {
        label: name,
        columns: table.columns,
        rowCount: table.estimatedRowCount,
      },
    };
  });
}

function buildEdges(relationships: Relationship[]): Edge[] {
  return relationships.map((r, i) => ({
    id: `edge-${i}`,
    source: r.sourceTable,
    target: r.targetTable,
    sourceHandle: null,
    targetHandle: null,
    label: `${r.sourceColumn} → ${r.targetColumn}`,
    labelStyle: { fontSize: 10, fill: "#888" },
    style: { stroke: "#6366f1", strokeWidth: 1.5 },
    animated: true,
    type: "smoothstep",
  }));
}

export default function SchemaDiagram({ tables, relationships }: SchemaDiagramProps) {
  const initialNodes = useMemo(() => layoutNodes(tables, relationships), [tables, relationships]);
  const initialEdges = useMemo(() => buildEdges(relationships), [relationships]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50);
  }, []);

  return (
    <div className="h-[600px] border border-zinc-200 dark:border-zinc-800 rounded">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-zinc-100 dark:!bg-zinc-900"
        />
      </ReactFlow>
    </div>
  );
}
