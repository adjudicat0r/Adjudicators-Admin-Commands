import { selectPlayers } from "../lib/selectors.js";

function getInventory(target) {
  try {
    return target.getComponent("inventory")?.container ?? null;
  } catch {
    return null;
  }
}

function shuffle(items) {
  const out = items.slice();
  for (let index = out.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [out[index], out[swapIndex]] = [out[swapIndex], out[index]];
  }
  return out;
}

function scrambleTargetInventory(target) {
  const inventory = getInventory(target);
  if (!inventory) return false;

  try {
    const items = [];
    for (let slot = 0; slot < inventory.size; slot++) {
      items.push(inventory.getItem(slot));
    }

    const shuffled = shuffle(items);
    for (let slot = 0; slot < shuffled.length; slot++) {
      inventory.setItem(slot, shuffled[slot]);
    }

    return true;
  } catch {
    return false;
  }
}

export const scrambleinvCommand = {
  name: "scrambleinv",
  minRank: 3,
  usage: ":scrambleinv <selector>",
  description: "Randomizes inventory slots.",
  examples: [
    ":scrambleinv Steve",
    ":scrambleinv others",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const target of targets) {
      if (scrambleTargetInventory(target)) count++;
    }

    if (!count) {
      player.sendMessage("No matching targets had an inventory to scramble.");
      return;
    }

    player.sendMessage(`Scrambled inventory slots for ${count} target(s).`);
  },
};
