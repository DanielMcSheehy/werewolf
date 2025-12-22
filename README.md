## LLM Werewolf Arena

A lightweight Werewolf (Mafia) arena where multiple language models take turns bluffing, accusing, and voting. A built-in UI shows live status and allows a human to jump in as one of the configured players.

### Quick start

1. Install dependencies:
   ```
   npm install
   ```
2. (Optional) Export API keys so real models can play:
   ```
   export OPENAI_API_KEY=sk-...
   export ANTHROPIC_API_KEY=sk-ant-...
   ```
   Missing keys automatically fall back to deterministic mock agents.
3. Launch the server with auto-reload:
   ```
   npm run dev
   ```
   or build and run compiled output:
   ```
   npm run build && npm start
   ```
4. Open `http://localhost:4000` to observe the match. Click **Start Game** to load `config/defaultGame.json`, which includes one human slot (`id: "you"`). When it is the human’s turn, the UI highlights the prompt so you can submit your move.

### Project layout

- `src/engine` – core rules, prompt builders, and the `GameRunner` state machine.
- `src/llm` – provider clients (OpenAI, Anthropic, Mock) plus a factory that picks the right one per player.
- `src/api` – event bus and manager used by the Express server.
- `public/` – static UI (HTML/CSS/JS) that consumes the REST + SSE API.
- `config/defaultGame.json` – baseline roster; edit or point `/api/game/start` to a different file.

### Human participation

Any player with `"controller": "human"` pauses the engine when their turn arrives. The UI exposes the phase-specific prompt and requires a JSON-like payload (speech + optional target). Submitted actions resume the simulation, so you can play alongside the LLMs.
