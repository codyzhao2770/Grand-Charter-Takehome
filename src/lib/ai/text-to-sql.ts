import { getAIClient, getModel } from "./client";
import type { ExtractedSchema } from "../schema-extractor/types";

export function buildSchemaSummary(schema: ExtractedSchema): string {
  const lines: string[] = [];

  for (const table of schema.tables) {
    const cols = table.columns
      .map((c) => {
        const flags: string[] = [];
        if (c.isPrimaryKey) flags.push("PK");
        if (c.isForeignKey) flags.push("FK");
        if (!c.isNullable) flags.push("NOT NULL");
        const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
        return `  ${c.name} ${c.udtName}${flagStr}`;
      })
      .join("\n");
    lines.push(`TABLE ${table.name}:\n${cols}`);
  }

  if (schema.enums.length > 0) {
    lines.push("\nENUMS:");
    for (const e of schema.enums) {
      lines.push(`  ${e.name}: ${e.values.join(", ")}`);
    }
  }

  if (schema.relationships.length > 0) {
    lines.push("\nRELATIONSHIPS:");
    for (const r of schema.relationships) {
      lines.push(
        `  ${r.sourceTable}.${r.sourceColumn} -> ${r.targetTable}.${r.targetColumn}`
      );
    }
  }

  return lines.join("\n");
}

const UNSAFE_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|EXEC)\b/i;

export function validateSQLSafety(sql: string): { safe: boolean; reason?: string } {
  if (UNSAFE_PATTERN.test(sql)) {
    const match = sql.match(UNSAFE_PATTERN);
    return {
      safe: false,
      reason: `Query contains disallowed keyword: ${match?.[0]}`,
    };
  }
  return { safe: true };
}

export interface GenerateSQLResult {
  sql: string;
  explanation: string;
}

export async function generateSQL(
  schema: ExtractedSchema,
  question: string
): Promise<GenerateSQLResult> {
  const client = getAIClient();
  if (!client) {
    throw new Error("AI is not enabled. Set OPENAI_API_KEY to use text-to-SQL.");
  }

  const schemaSummary = buildSchemaSummary(schema);

  const response = await client.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content: `You are a PostgreSQL SQL query generator. Given a database schema and a natural language question, generate a SELECT query that answers the question.

Rules:
- ONLY generate SELECT queries. Never generate INSERT, UPDATE, DELETE, DROP, or any DDL.
- Use proper PostgreSQL syntax.
- Return ONLY valid SQL, no markdown or explanation in the SQL field.
- If you cannot answer the question with the given schema, explain why.

Respond in this exact JSON format:
{"sql": "SELECT ...", "explanation": "Brief explanation of what the query does"}`,
      },
      {
        role: "user",
        content: `Schema:\n${schemaSummary}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI model");
  }

  const parsed = JSON.parse(content) as GenerateSQLResult;
  return parsed;
}
