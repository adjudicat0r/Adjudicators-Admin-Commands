
import { selectPlayers } from "../lib/selectors.js";

function floorish(n) {
  return Math.floor(Number(n) * 1000) / 1000; 
}

export const lockCommand = {
  name: "lock",
  minRank: 3, 
  usage: ":lock <selector>",
  description: "Locks selectors in place (stores coords in dynamic properties; loops will spam-teleport).",
  examples: [":lock", ":lock me", ":lock others"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        const loc = p.location;
        const dimId = p.dimension?.id ?? "";

        p.setDynamicProperty("aclocked", true);
        p.setDynamicProperty("aclockX", floorish(loc.x));
        p.setDynamicProperty("aclockY", floorish(loc.y));
        p.setDynamicProperty("aclockZ", floorish(loc.z));
        p.setDynamicProperty("aclockDim", String(dimId));

        count++;
      } catch {}
    }

    player.sendMessage(`Locked ${count} player(s).`);
  },
};

export const unlockCommand = {
  name: "unlock",
  minRank: 3, 
  usage: ":unlock <selector>",
  description: "Unlocks selectors.",
  examples: [":unlock", ":unlock me", ":unlock others"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let count = 0;
    for (const p of targets) {
      try {
        p.setDynamicProperty("aclocked", false);
        p.setDynamicProperty("aclockX", undefined);
        p.setDynamicProperty("aclockY", undefined);
        p.setDynamicProperty("aclockZ", undefined);
        p.setDynamicProperty("aclockDim", undefined);
        count++;
      } catch {}
    }

    player.sendMessage(`Unlocked ${count} player(s).`);
  },
};
