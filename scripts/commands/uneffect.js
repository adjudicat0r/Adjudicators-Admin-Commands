import { selectPlayers } from "../lib/selectors.js";

export const uneffectCommand = {
  name: "uneffect",
  minRank: 3, 
  usage: ":uneffect <selector> [effect]",
  description: "Clears all or a specific effect from selected players",
  examples: [
    ":uneffect",
    ":uneffect others",
    ":uneffect me speed",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const effect = args[1]; 

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        if (effect) {
          p.runCommand(`effect @s ${effect} 0`);
        } else {
          p.runCommand("effect @s clear");
        }
        count++;
      } catch {}
    }

    player.sendMessage(
      effect
        ? `removed ${effect} from ${count} player(s).`
        : `cleared all effects from ${count} player(s).`
    );
  },
};
