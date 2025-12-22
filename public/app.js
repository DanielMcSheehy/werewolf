const rosterBody = document.querySelector("#roster-table tbody");
const logEl = document.querySelector("#log");
const startBtn = document.querySelector("#start-btn");
const stopBtn = document.querySelector("#stop-btn");
const humanForm = document.querySelector("#human-form");
const humanStatus = document.querySelector("#human-status");
const humanPlayerInput = document.querySelector("#human-player-id");
const humanPromptInput = document.querySelector("#human-prompt");
const humanSpeechInput = document.querySelector("#human-speech");
const humanTargetInput = document.querySelector("#human-target");
const humanSubmitBtn = humanForm.querySelector("button");

let latestState = null;

async function startGame() {
  startBtn.disabled = true;
  await fetch("/api/game/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
  setTimeout(() => (startBtn.disabled = false), 500);
}

async function stopGame() {
  await fetch("/api/game/stop", { method: "POST" });
}

function renderState(state) {
  latestState = state;
  rosterBody.innerHTML = "";
  (state?.players ?? []).forEach((player) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${player.name}</td>
      <td>${player.role}</td>
      <td>${player.provider}</td>
      <td>${player.alive ? "🟢 alive" : "⚫️ out"}</td>
      <td>${player.lastSpeech ?? ""}</td>
    `;
    rosterBody.appendChild(row);
  });

  const status = state
    ? `Day ${state.day} • Phase: ${state.phase.toUpperCase()}${state.winner ? ` • Winner: ${state.winner}` : ""}`
    : "Waiting for game...";
  document.title = `Werewolf • ${status}`;

  if (state?.awaitingHuman) {
    humanStatus.textContent = `Your turn! (${state.awaitingHuman.schema.toUpperCase()} phase)`;
    humanPlayerInput.value = state.awaitingHuman.playerId;
    humanPromptInput.value = state.awaitingHuman.prompt;
    humanSubmitBtn.disabled = false;
  } else {
    humanStatus.textContent = "Waiting for your cue...";
    humanPlayerInput.value = "";
    humanPromptInput.value = "";
    humanSubmitBtn.disabled = true;
  }
}

function appendLog(entry) {
  const row = document.createElement("div");
  row.className = "entry";
  const date = new Date(entry.timestamp).toLocaleTimeString();
  row.innerHTML = `<strong>${date}</strong> [${entry.phase}] ${entry.message}`;
  logEl.appendChild(row);
  logEl.scrollTop = logEl.scrollHeight;
}

function initEventStream() {
  const source = new EventSource("/api/game/events");
  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "state") {
        renderState(data.state);
      } else if (data.type === "log") {
        appendLog(data.entry);
      } else if (data.type === "human_wait") {
        renderState(data.state);
      }
    } catch (err) {
      console.error("Failed to parse event", err);
    }
  };
  source.onerror = () => {
    source.close();
    setTimeout(initEventStream, 2000);
  };
}

humanForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!humanPlayerInput.value) return;
  const payload = {
    speech: humanSpeechInput.value || "(silent)",
    target: humanTargetInput.value || "",
    rationale: "human player move",
  };
  const resp = await fetch("/api/game/human-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: humanPlayerInput.value, payload }),
  });
  if (resp.ok) {
    humanSpeechInput.value = "";
    humanTargetInput.value = "";
  } else {
    const error = await resp.json().catch(() => ({}));
    alert(`Failed to send action: ${error.error ?? "unknown error"}`);
  }
});

startBtn.addEventListener("click", startGame);
stopBtn.addEventListener("click", stopGame);

initEventStream();

fetch("/api/game/state")
  .then((res) => res.json())
  .then((data) => {
    data.log?.forEach((entry) => appendLog(entry));
    if (data.state) renderState(data.state);
  })
  .catch((err) => console.error("failed to load state", err));
