import { selectPlayers } from "../lib/selectors.js";

function getHealthComponent(target) {
  try {
    return target.getComponent("minecraft:health") ?? target.getComponent("health") ?? null;
  } catch {
    return null;
  }
}

export const damageCommand = {
  name: "damage",
  minRank: 3,
  usage: ":damage <selector> <amount>",
  description: "Removes health from targets by the given amount.",
  examples: [
    ":damage me 5",
    ":damage others 10",
    ":damage entity:rabbit 2",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const amount = Number(args[1]);

    if (!Number.isFinite(amount) || amount <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const target of targets) {
      const health = getHealthComponent(target);
      if (!health) continue;

      try {
        const current = Number(health.currentValue ?? 0);
        const next = Math.max(0, current - amount);
        health.setCurrentValue(next);
        count++;
      } catch {}
    }

    player.sendMessage(`Removed ${amount} health from ${count} target(s).`);
  },
};
