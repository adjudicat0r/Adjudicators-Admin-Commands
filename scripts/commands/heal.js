import { selectPlayers } from "../lib/selectors.js";

export const healCommand = {
  name: "heal",
  minRank: 3, 
  usage: ":heal <selector>",
  description: "Heals player(s) to full health.",
  examples: [
    ":heal me",
    ":heal greg",
    ":heal others",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets || targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        
        const health = p.getComponent("health");
        if (health) {
          health.setCurrentValue(health.defaultValue);
        }

        
        try {
          p.extinguishFire?.();
        } catch {}

        count++;
      } catch {}
    }

    player.sendMessage(`healed ${count} player(s).`);
  },
};