import { NextResponse } from "next/server";

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
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
