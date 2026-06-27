import { world } from "@minecraft/server";

function parseDice(text) {
  const match = String(text ?? "").trim().toLowerCase().match(/^(\d+)d(\d+)$/);
  if (!match) return null;

  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides)) return null;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return { count, sides };
}

export const diceCommand = {
  name: "dice",
  minRank: 0,
  usage: ":dice <count>d<sides>",
  description: "Roll dice in chat.",
  examples: [
    ":dice 2d20",
    ":dice 1d6",
  ],

  execute({ player, args }) {
    const spec = parseDice(args[0]);
    if (!spec) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const rolls = [];
    let total = 0;
    for (let index = 0; index < spec.count; index++) {
      const roll = 1 + Math.floor(Math.random() * spec.sides);
      rolls.push(roll);
      total += roll;
    }

    world.sendMessage(
      `${player.name} rolled ${spec.count}d${spec.sides}: ${rolls.join(", ")} (total ${total})`
    );
  },
};

export const rollCommand = {
  ...diceCommand,
  name: "roll",
  usage: ":roll <count>d<sides>",
  description: "Alias of :dice.",
  examples: [
    ":roll 2d20",
    ":roll 1d6",
  ],
};
