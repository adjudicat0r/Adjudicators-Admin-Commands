
import { selectPlayers } from "../lib/selectors.js";

export const dupeCommand = {
  name: "dupe",
  minRank: 3, 
  usage: ":dupe <selector>",
  description: "Duplicates the item the selector(s) are holding into a free inventory slot.",
  examples: [":dupe", ":dupe me", ":dupe others"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let success = 0;
    let failed = 0;

    for (const p of targets) {
      try {
        const inv = p.getComponent("inventory")?.container;
        if (!inv) {
          failed++;
          continue;
        }

        const held = inv.getItem(p.selectedSlotIndex);
        if (!held) {
          failed++;
          continue;
        }

        
        let copy;
        try {
          copy = held.clone();
        } catch {
          
          copy = held;
        }

        
        let placed = false;
        for (let i = 0; i < inv.size; i++) {
          if (i === p.selectedSlotIndex) continue;
          const cur = inv.getItem(i);
          if (!cur) {
            inv.setItem(i, copy);
            placed = true;
            break;
          }
        }

        if (placed) success++;
        else failed++; 
      } catch {
        failed++;
      }
    }

    player.sendMessage(`Duped for ${success} player(s). Failed for ${failed}.`);
  },
};
