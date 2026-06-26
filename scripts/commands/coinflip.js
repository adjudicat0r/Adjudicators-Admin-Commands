import { world } from "@minecraft/server";

export const coinflipCommand = {
  name: "coinflip",
  minRank: 0,
  usage: ":coinflip",
  description: "Flips a coin in chat.",
  examples: [":coinflip"],

  execute({ player }) {
    const result = Math.random() < 0.5 ? "heads" : "tails";
    world.sendMessage(`${player.name} flipped a coin: ${result}`);
  },
};
