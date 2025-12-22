import { PlayerConfig } from "../engine/types";
import { AnthropicClient } from "./AnthropicClient";
import { LLMClient } from "./LLMClient";
import { MockClient } from "./MockClient";
import { OpenAIClient } from "./OpenAIClient";

function normalizeAnthropicModel(model: string): string {
  // Keep common configs working even as Anthropic retires older aliases.
  if (model === "claude-3-5-sonnet-latest" || model === "claude-3-5-sonnet-20241022" || model === "claude-3-5-sonnet-20240620") {
    return "claude-sonnet-4-20250514";
  }
  return model;
}

export function buildClient(player: PlayerConfig): LLMClient | null {
  if (player.controller === "human" || player.provider === "human") {
    return null;
  }

  if (player.provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return new MockClient(`${player.id}-fallback`);
    }
    return new OpenAIClient(player.model, key);
  }

  if (player.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return new MockClient(`${player.id}-fallback`);
    }
    return new AnthropicClient(normalizeAnthropicModel(player.model), key);
  }

  return new MockClient(player.id);
}
