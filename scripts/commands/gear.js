
import { ItemStack } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

function giveItemMany(player, itemId, amount = 1, name = null) {
  const inv = player.getComponent("inventory")?.container;
  if (!inv) return 0;

  let given = 0;
  let remaining = Math.max(1, Math.floor(amount));

  
  let maxAmount = 1;
  try {
    const probe = new ItemStack(itemId, 1);
    maxAmount = probe.maxAmount ?? 1; 
  } catch {
    maxAmount = 1;
  }

  while (remaining > 0) {
    const stackSize = Math.min(remaining, maxAmount);

    let stack;
    try {
      stack = new ItemStack(itemId, stackSize);
      if (name) stack.nameTag = `§r${name}`;
    } catch {
      break;
    }

    try {
      
      const leftover = inv.addItem(stack);

      if (!leftover) {
        
        given += stackSize;
        remaining -= stackSize;
        continue;
      }

      
      const leftAmt = leftover.amount ?? stackSize;
      const added = stackSize - leftAmt;
      if (added > 0) given += added;

      break; 
    } catch {
      break;
    }
  }

  return given;
}

export const gearCommand = {
  name: "gear",
  minRank: 3, 
  usage: ':gear <selector> <item> [amount] ["display name"]',
  description: "Gives selectors an item, with optional amount and name.",
  examples: [
    ":gear me diamond_sword",
    ":gear me diamond_sword 5",
    ':gear me diamond_sword 5 "lol"',
    ":gear others apple 32",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const rawItem = String(args[1] ?? "").trim();

    if (!rawItem) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const itemId = rawItem.startsWith("minecraft:")
      ? rawItem
      : "minecraft:" + rawItem;

    let amount = 1;
    let name = null;

    if (args[2] != null) {
      const n = Number(args[2]);
      if (Number.isFinite(n) && n > 0) {
        amount = Math.min(Math.floor(n), 2304); 
        name = args.slice(3).join(" ").trim() || null;
      } else {
        name = args.slice(2).join(" ").trim() || null;
      }
    }

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let playersDone = 0;
    let itemsGivenTotal = 0;

    for (const p of targets) {
      try {
        const g = giveItemMany(p, itemId, amount, name);
        if (g > 0) {
          playersDone++;
          itemsGivenTotal += g;
        }
      } catch {}
    }

    player.sendMessage(
      `Geared ${playersDone} player(s) with ${itemsGivenTotal}x ${itemId}` +
        (name ? ` named "${name}"` : "") +
        `.`
    );
  },
};
