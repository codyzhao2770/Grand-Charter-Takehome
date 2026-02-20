import { NextResponse } from "next/server";

function serializeBigInt(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? Number(value) : value;
}

export function successResponse(data: unknown, status = 200) {
  const body = JSON.parse(JSON.stringify({ data }, serializeBigInt));
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
