import { clearMotd, getMotd, setMotd } from "../storage/db.js";

function showUsage(player) {
  player.sendMessage("Usage:");
  player.sendMessage(";motd set <message>");
  player.sendMessage(";motd clear");
}

export const motdCommand = {
  name: "motd",
  minRank: 4,
  usage: ":motd <set|clear>",
  description: "Sets or clears the message of the day shown on player spawn.",
  examples: [
    ";motd set Welcome to the server",
    ";motd clear",
  ],

  execute({ player, args }) {
    const sub = String(args[0] ?? "").toLowerCase();

    if (sub === "set") {
      const text = String(args.slice(1).join(" ") ?? "").trim();
      if (!text) return showUsage(player);
      if (!setMotd(text)) {
        player.sendMessage("Failed to set MOTD.");
        return;
      }
      player.sendMessage(`Set MOTD: ${text}`);
      return;
    }

    if (sub === "clear") {
      clearMotd();
      player.sendMessage("Cleared MOTD.");
      return;
    }

    const current = getMotd();
    if (current) {
      player.sendMessage(`Current MOTD: ${current}`);
      return;
    }

    showUsage(player);
  },
};
