import {
  addChatFilterEntry,
  getChatFilterMode,
  getChatFilterList,
  removeChatFilterEntry,
  setChatFilterMode,
} from "../storage/db.js";

function showUsage(player) {
  player.sendMessage("Usage:");
  player.sendMessage(":filter add <word or phrase>");
  player.sendMessage(":filter remove <word or phrase>");
  player.sendMessage(":filter list");
  player.sendMessage(":filter type <block|scramble|redact>");
}

export const filterCommand = {
  name: "filter",
  minRank: 4,
  usage: ":filter <add|remove|list|type> [word or phrase|mode]",
  description: "Manages blocked chat words and phrases for normal chat only.",
  examples: [
    ":filter add badword",
    ":filter remove badword",
    ":filter list",
    ":filter type block",
    ":filter type scramble",
    ":filter type redact",
  ],

  execute({ player, args }) {
    const sub = String(args[0] ?? "").toLowerCase();
    const text = String(args.slice(1).join(" ") ?? "").trim();

    if (sub === "add") {
      if (!text) return showUsage(player);
      if (!addChatFilterEntry(text)) {
        player.sendMessage("Failed to add filter entry.");
        return;
      }
      player.sendMessage(`Added filter entry: ${text}`);
      return;
    }

    if (sub === "remove" || sub === "delete" || sub === "del") {
      if (!text) return showUsage(player);
      if (!removeChatFilterEntry(text)) {
        player.sendMessage(`Filter entry not found: ${text}`);
        return;
      }
      player.sendMessage(`Removed filter entry: ${text}`);
      return;
    }

    if (sub === "list") {
      const entries = getChatFilterList();
      player.sendMessage(`Filter mode: ${getChatFilterMode()}`);
      if (!entries.length) {
        player.sendMessage("No filter entries set.");
        return;
      }
      player.sendMessage("Blocked words/phrases:");
      for (const entry of entries) {
        player.sendMessage(`- ${entry}`);
      }
      return;
    }

    if (sub === "type" || sub === "mode") {
      if (!text) return showUsage(player);
      if (!setChatFilterMode(text)) {
        player.sendMessage("Filter type must be block, scramble, or redact.");
        return;
      }
      player.sendMessage(`Set filter type to ${text.toLowerCase()}.`);
      return;
    }

    showUsage(player);
  },
};
