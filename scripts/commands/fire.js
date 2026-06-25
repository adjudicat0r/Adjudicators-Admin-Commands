import { selectPlayers } from "../lib/selectors.js";

export const fireCommand = {
  name: "fire",
  minRank: 3, 
  usage: ":fire <selector> <seconds>",
  description: "Sets selectors on fire",
  examples: [
    ":fire me 5",
    ":fire others 10",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const seconds = Number(args[1]);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        p.setOnFire(Math.floor(seconds));
        count++;
      } catch {}
    }

    player.sendMessage(`set ${count} player(s) on fire for ${Math.floor(seconds)}s.`);
  },
};
