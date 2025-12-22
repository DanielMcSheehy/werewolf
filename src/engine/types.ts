export type Role = "werewolf" | "seer" | "villager";

export type Phase = "idle" | "night" | "discussion" | "voting" | "ended";

export type Controller = "llm" | "human";

export type Provider = "openai" | "anthropic" | "mock" | "human";

export interface PlayerConfig {
  id: string;
  name: string;
  role: Role;
  provider: Provider;
  model: string;
  persona: string;
  controller: Controller;
}

export interface GameConfig {
  players: PlayerConfig[];
  discussionTurns: number;
  maxDays: number;
}

export interface PlayerState extends PlayerConfig {
  alive: boolean;
  lastSpeech?: string;
  lastReasoning?: string;
}

export interface HumanAwaiting {
  playerId: string;
  prompt: string;
  schema: "night" | "discussion" | "vote";
}

export interface GameState {
  day: number;
  phase: Phase;
  players: PlayerState[];
  lastVictim?: string | null;
  votes: Record<string, string>;
  winner?: "villagers" | "werewolves";
  awaitingHuman?: HumanAwaiting | null;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  phase: Phase;
  message: string;
  payload?: Record<string, unknown>;
}
