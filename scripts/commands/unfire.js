import { selectPlayers } from "../lib/selectors.js";

export const unfireCommand = {
  name: "unfire",
  minRank: 3, 
  usage: ":unfire <selector>",
  description: "Extinguishes fire on selectors",
  examples: [
    ":unfire",
    ":unfire others",
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
        p.extinguishFire(false);
        count++;
      } catch {}
    }

    player.sendMessage(`extinguished fire on ${count} player(s).`);
  },
};
