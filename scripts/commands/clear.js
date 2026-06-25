import { selectPlayers } from "../lib/selectors.js";

export const clearCommand = {
  name: "clear",
  minRank: 3, 
  usage: ":clear <selector>",
  description: "Clears inventory of selectors",
  examples: [
    ":clear",
    ":clear others",
    ":clear random",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        p.runCommand("clear @s");
        count++;
      } catch {}
    }

    player.sendMessage(`cleared ${count} player(s).`);
  },
};
