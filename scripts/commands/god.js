
import { selectPlayers } from "../lib/selectors.js";

export const godCommand = {
  name: "god",
  minRank: 3, 
  usage: ":god <selector>",
  description: "Enables godmode for selected players or entities.",
  examples: [":god", ":god me", ":god others", ":god entity:sheep"],

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
        p.setDynamicProperty("acgod", true);
        count++;
      } catch {}
    }

    player.sendMessage(`God enabled for ${count} target(s).`);
  },
};

export const ungodCommand = {
  name: "ungod",
  minRank: 3, 
  usage: ":ungod <selector>",
  description: "Disables godmode for selected players or entities.",
  examples: [":ungod", ":ungod me", ":ungod others", ":ungod entity:sheep"],

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
        p.setDynamicProperty("acgod", false);
        count++;
      } catch {}
    }

    player.sendMessage(`God disabled for ${count} target(s).`);
  },
};
