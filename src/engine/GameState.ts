import { GameConfig, GameState, PlayerState } from "./types";

export function createInitialState(config: GameConfig): GameState {
  const players: PlayerState[] = config.players.map((p) => ({
    ...p,
    alive: true,
  }));

  return {
    day: 1,
    phase: "idle",
    players,
    votes: {},
    lastVictim: null,
    awaitingHuman: null,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    votes: { ...state.votes },
    awaitingHuman: state.awaitingHuman ? { ...state.awaitingHuman } : null,
  };
}

export function livingPlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.alive);
}

export function areWolvesAlive(state: GameState): boolean {
  return state.players.some((p) => p.alive && p.role === "werewolf");
}

export function countLivingVillagers(state: GameState): number {
  return livingPlayers(state).filter((p) => p.role !== "werewolf").length;
}
