import {
  addAutobroadcastMessage,
  createAutobroadcast,
  deleteAutobroadcastMessage,
  destroyAutobroadcast,
  getAutobroadcast,
  listAutobroadcasts,
  setAutobroadcastInterval,
} from "../storage/db.js";

function parseDurationMs(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  const match = text.match(/^(\d+)(s|m|h)?$/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2] ?? "s";
  if (!Number.isFinite(value) || value <= 0) return null;

  if (unit === "h") return value * 3600000;
  if (unit === "m") return value * 60000;
  return value * 1000;
}

function formatInterval(ms) {
  const totalSeconds = Math.max(1, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h${minutes}m${seconds}s`;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${seconds}s`;
}

function showUsage(player) {
  player.sendMessage("Usage:");
  player.sendMessage(":autobroadcast create <name>");
  player.sendMessage(":autobroadcast add <name> <message>");
  player.sendMessage(":autobroadcast interval <name> <delay>");
  player.sendMessage(":autobroadcast delete <name> <message>");
  player.sendMessage(":autobroadcast destroy <name>");
  player.sendMessage(":autobroadcast");
  player.sendMessage(":autobroadcast <name>");
}

export const autobroadcastCommand = {
  name: "autobroadcast",
  minRank: 4,
  usage: ":autobroadcast <create|add|interval|delete|destroy> ...",
  description: "Configures rotating world announcements stored in dynamic properties.",
  examples: [
    ":autobroadcast create discord",
    ":autobroadcast add discord Join our discord server!",
    ":autobroadcast add discord .gg/abcdef",
    ":autobroadcast interval discord 10m",
    ":autobroadcast delete discord Join our discord server!",
    ":autobroadcast destroy discord",
  ],

  execute({ player, args }) {
    const sub = String(args[0] ?? "").toLowerCase();
    const name = String(args[1] ?? "").trim();

    if (!sub) {
      const names = listAutobroadcasts();
      if (!names.length) {
        player.sendMessage("No autobroadcasts configured.");
        return;
      }
      player.sendMessage(`Autobroadcasts: ${names.join(", ")}`);
      return;
    }

    if (sub === "create") {
      if (!name) return showUsage(player);
      if (!createAutobroadcast(name)) {
        player.sendMessage("Failed to create autobroadcast.");
        return;
      }
      player.sendMessage(`Created autobroadcast ${name}.`);
      return;
    }

    if (sub === "add") {
      const message = String(args.slice(2).join(" ") ?? "").trim();
      if (!name || !message) return showUsage(player);
      if (!addAutobroadcastMessage(name, message)) {
        player.sendMessage(`Autobroadcast not found or invalid message: ${name}`);
        return;
      }
      player.sendMessage(`Added autobroadcast line to ${name}: ${message}`);
      return;
    }

    if (sub === "interval") {
      const rawDelay = args[2];
      const intervalMs = parseDurationMs(rawDelay);
      if (!name || intervalMs == null) return showUsage(player);
      if (!setAutobroadcastInterval(name, intervalMs)) {
        player.sendMessage(`Failed to set interval for ${name}.`);
        return;
      }
      player.sendMessage(`Set autobroadcast interval for ${name} to ${formatInterval(intervalMs)}.`);
      return;
    }

    if (sub === "delete" || sub === "remove" || sub === "del") {
      const message = String(args.slice(2).join(" ") ?? "").trim();
      if (!name || !message) return showUsage(player);
      if (!deleteAutobroadcastMessage(name, message)) {
        player.sendMessage(`Message not found in autobroadcast ${name}.`);
        return;
      }
      player.sendMessage(`Deleted autobroadcast line from ${name}: ${message}`);
      return;
    }

    if (sub === "destroy") {
      if (!name) return showUsage(player);
      if (!destroyAutobroadcast(name)) {
        player.sendMessage(`Autobroadcast not found: ${name}`);
        return;
      }
      player.sendMessage(`Destroyed autobroadcast ${name}.`);
      return;
    }

    const info = getAutobroadcast(sub);
    if (info) {
      const messages = Array.isArray(info.messages) ? info.messages : [];
      player.sendMessage(
        `Autobroadcast ${sub}: ${messages.length} line(s), interval ${formatInterval(Number(info.intervalMs) || 600000)}.`,
      );
      for (const [index, message] of messages.entries()) {
        player.sendMessage(`${index + 1}. ${message}`);
      }
      return;
    }

    showUsage(player);
  },
};
