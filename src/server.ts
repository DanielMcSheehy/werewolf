import express from "express";
import path from "node:path";
import dotenv from "dotenv";
import { eventBus } from "./api/EventBus";
import { gameManager } from "./api/GameManager";
import { DEFAULT_CONFIG_PATH, loadGameConfig } from "./engine/GameConfig";

dotenv.config();

const app = express();
app.use(express.json());

const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

app.get("/api/game/config", (_req, res) => {
  try {
    const cfg = loadGameConfig();
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/game/state", (_req, res) => {
  res.json({
    state: gameManager.getState(),
    log: gameManager.getLog(),
  });
});

app.post("/api/game/start", (req, res) => {
  try {
    const cfgPath = req.body?.configPath ?? DEFAULT_CONFIG_PATH;
    const cfg = loadGameConfig(cfgPath);
    gameManager.start(cfg);
    res.json({ status: "started" });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/game/stop", (_req, res) => {
  gameManager.stop();
  res.json({ status: "stopped" });
});

app.post("/api/game/human-action", (req, res) => {
  const { playerId, payload } = req.body ?? {};
  if (!playerId || !payload) {
    res.status(400).json({ error: "playerId and payload required" });
    return;
  }
  try {
    gameManager.submitHumanAction(playerId, payload);
    res.json({ status: "received" });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/game/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });
  res.flushHeaders?.();
  res.write("retry: 3000\n\n");

  const send = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = eventBus.subscribe((event) => send(event));
  const snapshot = gameManager.getState();
  if (snapshot) {
    send({ type: "state", state: snapshot });
  }

  req.on("close", () => {
    unsubscribe();
    res.end();
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Werewolf LLM arena running on http://localhost:${PORT}`);
});
