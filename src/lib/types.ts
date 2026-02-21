export interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId?: string | null;
  createdAt: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  _count: { children: number; files: number };
}

export interface ChildFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface FolderDetail {
  id: string;
  name: string;
  parentId: string | null;
  children: ChildFolder[];
  files: FileItem[];
  breadcrumbs: { id: string; name: string }[];
}

export type GridItem =
  | { kind: "folder"; data: FolderItem | ChildFolder }
  | { kind: "file"; data: FileItem };

export interface CtxMenu {
  x: number;
  y: number;
  type: "folder" | "file";
  id: string;
  name: string;
}
