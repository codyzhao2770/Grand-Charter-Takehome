"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface DragItem {
  type: "file" | "folder";
  id: string;
  name: string;
}

interface DragContextValue {
  dragging: DragItem | null;
  setDragging: (item: DragItem | null) => void;
}

const DragContext = createContext<DragContextValue | null>(null);

export function useDrag() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("useDrag must be used within DragProvider");
  return ctx;
}

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [dragging, setDraggingState] = useState<DragItem | null>(null);
  const setDragging = useCallback((item: DragItem | null) => setDraggingState(item), []);

  return (
    <DragContext.Provider value={{ dragging, setDragging }}>
      {children}
    </DragContext.Provider>
  );
}
