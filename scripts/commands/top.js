import { selectPlayers } from "../lib/selectors.js";

export const topCommand = {
  name: "top",
  minRank: 3, 
  usage: ":top <selector>",
  description: "Teleports selectors to the top using spreadplayers.",
  examples: [":top", ":top me", ":top others"],

  async execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        
        await p.runCommand?.(`spreadplayers ~ ~ 0 1 @s`);
        count++;
      } catch {}
    }

    player.sendMessage(`Topped ${count} player(s).`);
  },
};
