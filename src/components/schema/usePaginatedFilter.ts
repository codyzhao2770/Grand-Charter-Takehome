import { useState, useMemo } from "react";

const PAGE_SIZE = 20;

export default function usePaginatedFilter<T>(
  items: T[],
  filterFn: (item: T, query: string) => boolean,
  pageSize = PAGE_SIZE
) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => (search ? items.filter((item) => filterFn(item, search.toLowerCase())) : items),
    [items, search, filterFn]
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  // Reset page if filter shrinks results
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return {
    search,
    setSearch,
    page: safePage,
    setPage,
    totalPages,
    filtered,
    paged,
    totalItems: filtered.length,
    pageSize,
  };
}
