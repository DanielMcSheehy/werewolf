import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eventBus } from "../api/EventBus";
import { LLMClient } from "../llm/LLMClient";
import { buildClient } from "../llm/factory";
import { MockClient } from "../llm/MockClient";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { createInitialState, livingPlayers, areWolvesAlive, countLivingVillagers, cloneState } from "./GameState";
import { GameConfig, GameLogEntry, GameState, Phase, PlayerState } from "./types";

const decisionSchema = z.object({
  speech: z.string().min(1).max(600).catch("..."),
  target: z.string().optional().default(""),
  rationale: z.string().optional().default(""),
});

type Decision = z.infer<typeof decisionSchema>;

const schemaKinds = {
  night: decisionSchema,
  discussion: decisionSchema,
  vote: decisionSchema.extend({
    target: z.string().min(1, "target required for vote"),
  }),
};

export class GameRunner {
  private state: GameState;
  private log: GameLogEntry[] = [];
  private clients = new Map<string, LLMClient>();
  private running = false;
  private loopPromise?: Promise<void>;
  private humanResolvers = new Map<
    string,
    {
      resolve: (payload: Decision) => void;
      reject: (err: Error) => void;
    }
  >();

  constructor(private readonly config: GameConfig) {
    this.state = createInitialState(config);
    config.players.forEach((player) => {
      const client = buildClient(player);
      if (client) {
        this.clients.set(player.id, client);
      }
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.runLoop();
    this.broadcastState();
  }

  stop() {
    this.running = false;
    this.state.phase = "ended";
    this.broadcastState();
    this.flushHumanResolvers();
  }

  getState(): GameState {
    return cloneState(this.state);
  }

  getLog(): GameLogEntry[] {
    return [...this.log];
  }

  async submitHumanAction(playerId: string, payload: unknown) {
    const resolver = this.humanResolvers.get(playerId);
    if (!resolver) {
      throw new Error("No pending turn for that player.");
    }

    // Validate without consuming the pending turn so humans can correct and resubmit.
    const schema = this.state.awaitingHuman ? schemaKinds[this.state.awaitingHuman.schema] : decisionSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      throw new Error(msg || "Invalid payload");
    }

    resolver.resolve(parsed.data);
    this.humanResolvers.delete(playerId);
    this.state.awaitingHuman = null;
    this.broadcastState();
  }

  private async runLoop() {
    while (this.running && this.state.day <= this.config.maxDays) {
      await this.runNight();
      if (!this.running) break;

      await this.runDiscussion();
      if (!this.running) break;

      await this.runVoting();
      if (!this.running) break;

      this.state.day += 1;
    }
    if (this.state.phase !== "ended") {
      this.endGame("villagers", "Reached maximum day limit.");
    }
  }

  private async runNight() {
    if (!this.running) return;
    this.setPhase("night");
    this.pushLog("Night falls. Werewolves prowl.");

    const wolves = this.currentPlayers().filter((p) => p.role === "werewolf");
    const wolfVotes: Record<string, number> = {};
    for (const wolf of wolves) {
      const decision = await this.obtainDecision(wolf, "night", "night");
      this.recordSpeech(wolf, decision);
      if (decision.target) {
        wolfVotes[decision.target] = (wolfVotes[decision.target] || 0) + 1;
      }
    }

    const victimId = this.pickHighest(wolfVotes, (candidate) => {
      const target = this.state.players.find((p) => p.id === candidate);
      return Boolean(target && target.alive && target.role !== "werewolf");
    });

    if (victimId) {
      this.killPlayer(victimId, "werewolves");
    } else {
      this.pushLog("No victim selected tonight.");
    }

    const seers = this.currentPlayers().filter((p) => p.role === "seer");
    for (const seer of seers) {
      const decision = await this.obtainDecision(seer, "night", "night");
      this.recordSpeech(seer, decision);
      if (decision.target) {
        const target = this.state.players.find((p) => p.id === decision.target);
        if (target) {
          const info = target.role === "werewolf" ? "is a werewolf!" : "seems innocent.";
          this.pushLog(`${seer.name} peers into ${target.name}'s aura and learns they ${info}`);
        }
      }
    }

    this.checkWinState();
  }

  private async runDiscussion() {
    if (!this.running) return;
    this.setPhase("discussion");
    this.pushLog("Villagers gather to debate.");
    for (let round = 0; round < this.config.discussionTurns; round += 1) {
      for (const player of this.currentPlayers()) {
        const decision = await this.obtainDecision(player, "discussion", "discussion");
        this.recordSpeech(player, decision);
      }
      if (!this.running) return;
    }
  }

  private async runVoting() {
    if (!this.running) return;
    this.setPhase("voting");
    this.pushLog("Time to vote.");
    const voteTally: Record<string, number> = {};
    this.state.votes = {};
    for (const player of this.currentPlayers()) {
      const decision = await this.obtainDecision(player, "voting", "vote");
      this.recordSpeech(player, decision);
      if (decision.target && decision.target !== player.id) {
        voteTally[decision.target] = (voteTally[decision.target] || 0) + 1;
        this.state.votes[player.id] = decision.target;
      }
      this.broadcastState();
    }

    const eliminatedId = this.pickHighest(voteTally, (candidate) => {
      const target = this.state.players.find((p) => p.id === candidate);
      return Boolean(target && target.alive);
    });

    if (eliminatedId) {
      this.killPlayer(eliminatedId, "village vote");
    } else {
      this.pushLog("The village cannot agree on anyone.");
    }
    this.checkWinState();
  }

  private currentPlayers(): PlayerState[] {
    return livingPlayers(this.state);
  }

  private setPhase(phase: Phase) {
    this.state.phase = phase;
    this.broadcastState();
  }

  private recordSpeech(player: PlayerState, decision: Decision) {
    const entry = `${player.name}: ${decision.speech}`;
    player.lastSpeech = decision.speech;
    player.lastReasoning = decision.rationale;
    this.pushLog(entry, { playerId: player.id, target: decision.target });
    this.broadcastState();
  }

  private killPlayer(playerId: string, reason: string) {
    const target = this.state.players.find((p) => p.id === playerId);
    if (!target) return;
    target.alive = false;
    this.state.lastVictim = target.name;
    this.pushLog(`${target.name} was eliminated (${reason}). They were a ${target.role}.`);
    this.broadcastState();
  }

  private checkWinState() {
    if (!areWolvesAlive(this.state)) {
      this.endGame("villagers", "All werewolves defeated!");
      return;
    }
    if (this.currentPlayers().length === 0) {
      this.endGame("villagers", "No one remains alive?");
      return;
    }
    if (this.currentPlayers().filter((p) => p.role === "werewolf").length >= countLivingVillagers(this.state)) {
      this.endGame("werewolves", "Werewolves reached parity.");
    }
  }

  private endGame(winner: "villagers" | "werewolves", message: string) {
    this.state.winner = winner;
    this.state.phase = "ended";
    this.pushLog(`Game over: ${winner.toUpperCase()} win. ${message}`);
    this.broadcastState();
    this.running = false;
    this.flushHumanResolvers();
  }

  private async obtainDecision(player: PlayerState, phase: Phase, schema: keyof typeof schemaKinds): Promise<Decision> {
    if (!this.running) {
      return decisionSchema.parse({ speech: "Game stopped.", target: "" });
    }
    const userPrompt = buildUserPrompt(player, this.state, phase);
    if (player.controller === "human") {
      return this.waitForHuman(player, userPrompt, schema);
    }

    const systemPrompt = buildSystemPrompt(player);
    const client = this.clients.get(player.id) ?? new MockClient(`runtime-${player.id}`);

    try {
      const response = await client.generate({ systemPrompt, userPrompt });
      return this.safeParseDecision(response.output, schema);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      this.pushLog(`${player.name} failed to act (LLM error). Falling back to mock.`, { error: message, client: client.id });
      this.broadcastState();

      const fallback = new MockClient(`${player.id}-fallback-runtime`);
      // Remember the fallback so subsequent turns don't keep erroring.
      this.clients.set(player.id, fallback);

      const response = await fallback.generate({ systemPrompt, userPrompt });
      return this.safeParseDecision(response.output, schema);
    }
  }

  private waitForHuman(player: PlayerState, prompt: string, schema: keyof typeof schemaKinds): Promise<Decision> {
    return new Promise((resolve, reject) => {
      this.state.awaitingHuman = {
        playerId: player.id,
        prompt,
        schema,
      };
      this.broadcastState(true);
      this.humanResolvers.set(player.id, { resolve, reject });
    });
  }

  private safeParseDecision(text: string, schema: keyof typeof schemaKinds): Decision {
    const validator = schemaKinds[schema];
    try {
      return validator.parse(JSON.parse(text));
    } catch {
      const maybeJson = text.match(/\{[\s\S]*\}/);
      if (maybeJson) {
        try {
          return validator.parse(JSON.parse(maybeJson[0]));
        } catch {
          // fallthrough
        }
      }
      return validator.parse({ speech: text.slice(0, 200), target: "" });
    }
  }

  private pickHighest(votes: Record<string, number>, predicate: (candidate: string) => boolean): string | null {
    const entries = Object.entries(votes).filter(([candidate]) => predicate(candidate));
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  private pushLog(message: string, payload?: Record<string, unknown>) {
    const entry: GameLogEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      phase: this.state.phase,
      message,
      payload,
    };
    this.log.push(entry);
    eventBus.publish({ type: "log", entry });
  }

  private broadcastState(forceHuman = false) {
    const snapshot = this.getState();
    eventBus.publish({ type: "state", state: snapshot });
    if (forceHuman && snapshot.awaitingHuman) {
      eventBus.publish({ type: "human_wait", state: snapshot });
    }
  }

  private flushHumanResolvers() {
    for (const [playerId, resolver] of this.humanResolvers.entries()) {
      resolver.reject(new Error("Game ended"));
      this.humanResolvers.delete(playerId);
    }
    this.state.awaitingHuman = null;
  }
}
