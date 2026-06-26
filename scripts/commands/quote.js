import { world } from "@minecraft/server";
import { addQuote, getQuotes, removeQuote } from "../storage/db.js";

function showUsage(player) {
  player.sendMessage("Usage:");
  player.sendMessage(":quote");
  player.sendMessage(":quote add <text>");
  player.sendMessage(":quote remove <index>");
  player.sendMessage(":quote list");
}

export const quoteCommand = {
  name: "quote",
  minRank: 0,
  usage: ":quote [add|remove|list] [text|index]",
  description: "Shows a random configured quote or manages the quote list.",
  examples: [
    ":quote",
    ":quote add never dig straight down",
    ":quote remove 4",
    ":quote list",
  ],

  execute({ player, args }) {
    const sub = String(args[0] ?? "").toLowerCase();

    if (!sub) {
      const quotes = getQuotes();
      if (!quotes.length) {
        player.sendMessage("No quotes configured.");
        return;
      }
      const pick = quotes[Math.floor(Math.random() * quotes.length)];
      world.sendMessage(`Quote: ${pick}`);
      return;
    }

    if (sub === "add") {
      const text = String(args.slice(1).join(" ") ?? "").trim();
      if (!text) return showUsage(player);
      if (!addQuote(text)) {
        player.sendMessage("Failed to add quote.");
        return;
      }
      player.sendMessage(`Added quote: ${text}`);
      return;
    }

    if (sub === "remove" || sub === "delete" || sub === "del") {
      const index = args[1];
      if (!removeQuote(index)) {
        player.sendMessage(`Quote not found: ${index}`);
        return;
      }
      player.sendMessage(`Removed quote ${index}.`);
      return;
    }

    if (sub === "list") {
      const quotes = getQuotes();
      if (!quotes.length) {
        player.sendMessage("No quotes configured.");
        return;
      }
      player.sendMessage("Quotes:");
      for (const [index, quote] of quotes.entries()) {
        player.sendMessage(`${index + 1}. ${quote}`);
      }
      return;
    }

    showUsage(player);
  },
};
