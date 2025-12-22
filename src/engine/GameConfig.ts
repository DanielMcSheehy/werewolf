import path from "node:path";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { GameConfig, PlayerConfig, Provider } from "./types";

const providerSchema = z.enum(["openai", "anthropic", "mock", "human"]);
const roleSchema = z.enum(["werewolf", "seer", "villager"]);
const controllerSchema = z.enum(["llm", "human"]);

const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: roleSchema,
  provider: providerSchema,
  model: z.string(),
  persona: z.string(),
  controller: controllerSchema,
});

const configSchema = z.object({
  players: z.array(playerSchema).min(4),
  discussionTurns: z.number().int().min(1).max(5),
  maxDays: z.number().int().min(1).max(10),
});

export const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "config", "defaultGame.json");

export function loadGameConfig(cfgPath: string = DEFAULT_CONFIG_PATH): GameConfig {
  const raw = readFileSync(cfgPath, "utf8");
  const parsed = configSchema.parse(JSON.parse(raw));
  return parsed;
}

export function serializePlayerSafe(player: PlayerConfig): Omit<PlayerConfig, "persona"> & { persona?: string } {
  const safe: PlayerConfig & { persona?: string } = { ...player };
  if (player.controller === "llm") {
    safe.persona = player.persona;
  }
  return safe;
}

export const SUPPORTED_PROVIDERS: Provider[] = ["openai", "anthropic", "mock", "human"];
