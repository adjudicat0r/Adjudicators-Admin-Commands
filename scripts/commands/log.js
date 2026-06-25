import { getAdminLog, rankName } from "../storage/db.js";

export const logCommand = {
  name: "log",
  minRank: 4, 
  usage: ":log [count]",
  description: "Shows recent admin commands",
  examples: [
    ":log",
    ":log 5",
    ":log 50",
  ],

  execute({ player, args }) {
    const max = Math.max(1, Math.min(50, Number(args[0] ?? 10) || 10));

    const log = getAdminLog();
    if (!log.length) {
      player.sendMessage("Log is empty.");
      return;
    }

    const lines = log
      .slice()
      .reverse()
      .slice(0, max)
      .map((e) => {
        const d = new Date(e.t);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `[${hh}:${mm}] ${e.by} (${rankName(e.rank)}) -> ${e.cmd}`;
      });

    player.sendMessage(`Last ${lines.length} command(s):`);
    for (const line of lines) player.sendMessage(line);
  },
};
