import { randomUUID } from "node:crypto";
import { LLMClient, PromptContext } from "./LLMClient";

export class MockClient implements LLMClient {
  constructor(private readonly seedLabel: string) {}

  get id(): string {
    return `mock:${this.seedLabel}`;
  }

  async generate(context: PromptContext) {
    const phrases = [
      "I have a hunch about TARGET.",
      "My instincts point toward TARGET.",
      "TARGET looks suspicious tonight.",
      "Staying cautious, maybe TARGET?",
    ];

    const fallback = phrases[Math.floor(Math.random() * phrases.length)];

    // Extract ids from the brief: "Alive players: id:name (role), ..."
    const aliveMatch = context.userPrompt.match(/Alive players:\s*([^\n]+)\./i);
    const aliveList = aliveMatch?.[1] ?? "";
    const aliveIds = Array.from(aliveList.matchAll(/\b([a-z0-9_-]+):[^,]+\(/gi)).map((m) => m[1]);

    // Extract self id from "You are id:name."
    const selfMatch = context.userPrompt.match(/You are\s+([a-z0-9_-]+):/i);
    const selfId = selfMatch?.[1] ?? "";

    // Prefer to pick someone other than self when possible.
    const candidates = aliveIds.filter((id) => id && id !== selfId);
    const target = (candidates.length ? candidates : aliveIds)[Math.floor(Math.random() * Math.max(1, (candidates.length ? candidates : aliveIds).length))] ?? "";

    const speech = fallback.replaceAll("TARGET", target || "someone");
    const output = JSON.stringify({
      speech,
      target,
      rationale: `mock-${randomUUID().slice(0, 8)}`,
    });
    return { output };
  }
}
