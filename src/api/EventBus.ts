import { EventEmitter } from "node:events";
import { GameLogEntry, GameState } from "../engine/types";

export type GameEvent =
  | { type: "log"; entry: GameLogEntry }
  | { type: "state"; state: GameState }
  | { type: "human_wait"; state: GameState };

export class EventBus {
  private emitter = new EventEmitter();

  publish(event: GameEvent) {
    this.emitter.emit("event", event);
  }

  subscribe(handler: (event: GameEvent) => void): () => void {
    this.emitter.on("event", handler);
    return () => this.emitter.off("event", handler);
  }
}

export const eventBus = new EventBus();
