import { GameState, Phase, PlayerState } from "./types";

function baseBrief(state: GameState): string {
  // Include stable player IDs so both humans and bots can target correctly.
  const alive = state.players
    .filter((p) => p.alive)
    .map((p) => `${p.id}:${p.name} (${p.role})`)
    .join(", ");
  return `Day ${state.day}. Alive players: ${alive || "none"}. Last victim: ${state.lastVictim ?? "none yet"}.`;
}

export function buildSystemPrompt(player: PlayerState): string {
  return `You are ${player.name}, a ${player.role.toUpperCase()} in a simplified Werewolf game. ${player.persona}. Always roleplay your persona but obey the rules.`;
}

export function buildUserPrompt(player: PlayerState, state: GameState, phase: Phase): string {
  const brief = baseBrief(state);
  const self = `You are ${player.id}:${player.name}.`;
  switch (phase) {
    case "night":
      if (player.role === "werewolf") {
        return `${brief}\n${self}\nIt is the NIGHT phase. Coordinate silently with fellow werewolves to choose a single victim. Respond with JSON: {"speech": "<short in-character thought>", "target": "<playerId of victim>"} selecting a non-werewolf alive player.`;
      }
      if (player.role === "seer") {
        return `${brief}\n${self}\nIt is the NIGHT phase. Choose a player to inspect. Respond with JSON: {"speech": "<observation>", "target": "<playerId you peek>"}.\nPick any alive player except yourself.`;
      }
      return `${brief}\n${self}\nIt is the NIGHT phase. Villagers sleep. Respond with JSON: {"speech": "<dream or suspicion>", "target": ""}.`;
    case "discussion":
      return `${brief}\n${self}\nIt is the DISCUSSION phase. Defend yourself or accuse others. Respond JSON: {"speech":"<talk>", "target":"<playerId you accuse or empty>"}.\nStay under 3 sentences.`;
    case "voting":
      return `${brief}\n${self}\nIt is the VOTING phase. Pick ONE alive player (not yourself) to eliminate. Respond JSON: {"speech":"<brief justification>", "target":"<playerId>"}.\nIf unsure, pick whoever seems most suspicious.`;
    default:
      return `${brief}\n${self}\nProvide JSON {"speech":"...", "target":""}.`;
  }
}
