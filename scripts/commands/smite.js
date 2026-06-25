import { selectPlayers } from "../lib/selectors.js";
import { Vector3 } from "@minecraft/server";
export const smiteCommand = {
  name: "smite",
  minRank: 3, 
  usage: ":smite <selector>",
  description: "Strikes selectors with lightning",
  examples: [
    ":smite",
    ":smite others",
    ":smite random",
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
        p.dimension.spawnEntity("minecraft:lightning_bolt", p.location);
        count++;
      } catch {}
    }

    player.sendMessage(`Smited ${count} player(s).`);
  },
};
