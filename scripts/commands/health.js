import { selectPlayers } from "../lib/selectors.js";

function getHealthComponent(target) {
  try {
    return target.getComponent("minecraft:health") ?? target.getComponent("health") ?? null;
  } catch {
    return null;
  }
}

export const healthCommand = {
  name: "health",
  minRank: 3,
  usage: ":health <selector> <amount>",
  description: "Adds health to targets by the given amount.",
  examples: [
    ":health me 5",
    ":health others 10",
    ":health entity:rabbit 2",
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
        const max = Number(health.effectiveMax ?? health.defaultValue ?? current);
        const next = Math.max(0, Math.min(max, current + amount));
        health.setCurrentValue(next);
        count++;
      } catch {}
    }

    player.sendMessage(`Added ${amount} health to ${count} target(s).`);
  },
};
