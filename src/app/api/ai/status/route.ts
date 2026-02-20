import { successResponse } from "@/lib/api-response";
import { isAIEnabled } from "@/lib/ai/client";

export async function GET() {
  return successResponse({ enabled: isAIEnabled() });
}
