import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

export function getAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export function isAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}
