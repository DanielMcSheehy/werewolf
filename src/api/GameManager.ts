import { GameRunner } from "../engine/GameRunner";
import { GameConfig, GameState } from "../engine/types";

class GameManager {
  private runner: GameRunner | null = null;

  start(config: GameConfig) {
    if (this.runner) {
      this.runner.stop();
    }
    this.runner = new GameRunner(config);
    this.runner.start();
  }

  stop() {
    this.runner?.stop();
    this.runner = null;
  }

  submitHumanAction(playerId: string, payload: unknown) {
    if (!this.runner) {
      throw new Error("No game running.");
    }
    return this.runner.submitHumanAction(playerId, payload);
  }

  getState(): GameState | null {
    return this.runner?.getState() ?? null;
  }

  getLog() {
    return this.runner?.getLog() ?? [];
  }

  isRunning() {
    return Boolean(this.runner);
  }
}

export const gameManager = new GameManager();
