import { selectPlayers } from "../lib/selectors.js";
import { addPlayerNote, deletePlayerNote, getPlayerNotes } from "../storage/db.js";

function formatNotes(playerName, notes) {
  if (!notes.length) return [`No notes for ${playerName}.`];
  const lines = [`Notes for ${playerName}:`];
  for (const [index, note] of notes.entries()) {
    const by = note.by ? ` by ${note.by}` : "";
    lines.push(`${index + 1}. ${note.text}${by}`);
  }
  return lines;
}

export const noteCommand = {
  name: "note",
  minRank: 4,
  usage: ":note <add|list|delete> <selector> [note text|index]",
  description: "Attach and manage admin notes on players.",
  examples: [
    ":note add steve suspected xray near spawn",
    ":note list Steve",
    ":note delete Steve 2",
  ],

  execute({ player, args }) {
    const sub = (args[0] ?? "").toLowerCase();

    if (sub === "add") {
      const selector = args[1] ?? "me";
      const text = String(args.slice(2).join(" ") ?? "").trim();
      if (!text) {
        player.sendMessage("Usage: :note add <selector> <text>");
        return;
      }

      const targets = selectPlayers(player, selector);
      if (!targets.length) {
        player.sendMessage(`No targets matched: ${selector}`);
        return;
      }

      let count = 0;
      for (const target of targets) {
        try {
          addPlayerNote(target.name, { text, by: player.name, t: Date.now() });
          count++;
        } catch {}
      }

      player.sendMessage(`Added note to ${count} player(s).`);
      return;
    }

    if (sub === "list") {
      const selector = args[1] ?? "me";
      const targets = selectPlayers(player, selector);
      if (!targets.length) {
        player.sendMessage(`No targets matched: ${selector}`);
        return;
      }

      for (const target of targets) {
        const notes = getPlayerNotes(target.name);
        for (const line of formatNotes(target.name, notes)) {
          player.sendMessage(line);
        }
      }
      return;
    }

    if (sub === "delete" || sub === "del" || sub === "remove") {
      const selector = args[1] ?? "me";
      const noteIndex = args[2];
      if (noteIndex == null) {
        player.sendMessage("Usage: :note delete <selector> <index>");
        return;
      }

      const targets = selectPlayers(player, selector);
      if (!targets.length) {
        player.sendMessage(`No targets matched: ${selector}`);
        return;
      }

      let removed = 0;
      for (const target of targets) {
        try {
          if (deletePlayerNote(target.name, noteIndex)) removed++;
        } catch {}
      }

      player.sendMessage(`Removed note ${noteIndex} for ${removed} player(s).`);
      return;
    }

    player.sendMessage("Usage:");
    player.sendMessage(":note add <selector> <text>");
    player.sendMessage(":note list <selector>");
    player.sendMessage(":note delete <selector> <index>");
  },
};
