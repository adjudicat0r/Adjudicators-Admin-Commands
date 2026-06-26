import { system } from "@minecraft/server";

const queuedCommands = new Map();
let nextQueueId = 1;

function parseDurationToTicks(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text) return null;

  const match = text.match(/^(\d+)(s|m|h)?$/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2] ?? "s";
  if (!Number.isFinite(value) || value <= 0) return null;

  const seconds =
    unit === "h" ? value * 3600 :
    unit === "m" ? value * 60 :
    value;

  return seconds * 20;
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h${minutes}m${seconds}s`;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${seconds}s`;
}

function normalizeQueuedLine(manager, rawCommand) {
  const text = String(rawCommand ?? "").trim();
  if (!text) return null;
  if (text.startsWith(":") || text.startsWith(";")) return text;
  return `${manager.prefix}${text}`;
}

function queueCommand(player, manager, delayTicks, commandLine) {
  const id = nextQueueId++;
  const runAt = Date.now() + delayTicks * 50;

  const timeoutId = system.runTimeout(() => {
    const entry = queuedCommands.get(id);
    if (!entry) return;
    queuedCommands.delete(id);
    manager.runFromSystem(entry.player, entry.commandLine);
  }, delayTicks);

  queuedCommands.set(id, {
    id,
    player,
    by: player.name,
    commandLine,
    runAt,
    timeoutId,
  });

  return id;
}

function listQueue() {
  return Array.from(queuedCommands.values()).sort((a, b) => a.id - b.id);
}

function cancelQueue(id) {
  const entry = queuedCommands.get(id);
  if (!entry) return false;

  queuedCommands.delete(id);
  try {
    system.clearRun(entry.timeoutId);
  } catch {}
  return true;
}

export const cmdqueueCommand = {
  name: "cmdqueue",
  minRank: 5,
  usage: ":cmdqueue <delay> <command...> | :cmdqueue list | :cmdqueue cancel <id>",
  description: "Queues a command to run later, and lets you list or cancel pending jobs.",
  examples: [
    ":cmdqueue 45s smite all",
    ":cmdqueue 2m fling others 5",
    ":cmdqueue list",
    ":cmdqueue cancel 2",
    ";cmdqueue 45s smite all",
  ],

  execute({ player, args, manager }) {
    const sub = String(args[0] ?? "").toLowerCase();

    if (sub === "list") {
      const items = listQueue();
      if (!items.length) {
        player.sendMessage("No queued commands.");
        return;
      }

      player.sendMessage("Queued commands:");
      for (const entry of items) {
        const remaining = formatRemaining(entry.runAt - Date.now());
        player.sendMessage(`[${entry.id}] ${remaining} by ${entry.by}: ${entry.commandLine}`);
      }
      return;
    }

    if (sub === "cancel") {
      const id = Math.floor(Number(args[1]));
      if (!Number.isFinite(id) || id < 1) {
        player.sendMessage(`Usage: ${this.usage}`);
        return;
      }

      if (!cancelQueue(id)) {
        player.sendMessage(`No queued command with id ${id}.`);
        return;
      }

      player.sendMessage(`Canceled queued command ${id}.`);
      return;
    }

    const delayTicks = parseDurationToTicks(args[0]);
    const commandLine = normalizeQueuedLine(manager, args.slice(1).join(" "));

    if (delayTicks == null || !commandLine) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const id = queueCommand(player, manager, delayTicks, commandLine);
    player.sendMessage(`Queued command ${id} for ${args[0]}: ${commandLine}`);
  },
};
