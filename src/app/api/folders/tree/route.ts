import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";

export async function GET() {
  try {
    const tree = await prisma.$queryRaw`
      WITH RECURSIVE folder_tree AS (
        SELECT id, name, parent_id, 0 as depth
        FROM folders
        WHERE user_id = ${DEFAULT_USER_ID}::uuid AND parent_id IS NULL
        UNION ALL
        SELECT f.id, f.name, f.parent_id, ft.depth + 1
        FROM folders f
        JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT id, name, parent_id as "parentId", depth
      FROM folder_tree
      ORDER BY depth, name
    `;

    return successResponse(tree);
  } catch (error) {
    console.error("GET /api/folders/tree error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch folder tree", 500);
  }
}
