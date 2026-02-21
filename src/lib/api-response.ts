import { NextResponse } from "next/server";

function serializeBigInt(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? Number(value) : value;
}

export function successResponse(data: unknown, status = 200) {
  const body = JSON.parse(JSON.stringify({ data }, serializeBigInt));
  return NextResponse.json(body, { status });
}

export function paginatedResponse(
  data: unknown,
  total: number,
  limit: number,
  offset: number,
  status = 200
) {
  const body = JSON.parse(
    JSON.stringify({ data, pagination: { total, limit, offset } }, serializeBigInt)
  );
  return NextResponse.json(body, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: { code, message, status } },
    { status }
  );
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults?: { sortBy?: string; maxLimit?: number }
) {
  const maxLimit = defaults?.maxLimit ?? 100;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
    maxLimit
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") || "0", 10) || 0,
    0
  );

  const sortBy = searchParams.get("sortBy") || defaults?.sortBy || "name";
  const sortOrderRaw = searchParams.get("sortOrder") || "asc";
  const sortOrder: "asc" | "desc" = sortOrderRaw === "desc" ? "desc" : "asc";

  return { limit, offset, sortBy, sortOrder };
}
