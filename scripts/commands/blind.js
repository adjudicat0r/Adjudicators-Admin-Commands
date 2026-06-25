import { selectPlayers } from "../lib/selectors.js";

export const blindCommand = {
  name: "blind",
  minRank: 3, 
  usage: ":blind <selector>",
  description: "Blinds selectors.",
  examples: [":blind", ":blind others", ":blind greg"],

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
        p.setDynamicProperty("acblinded", true);
        count++;
      } catch {}
    }

    player.sendMessage(`Blinded ${count} player(s).`);
  },
};

export const unblindCommand = {
  name: "unblind",
  minRank: 3, 
  usage: ":unblind <selector>",
  description: "Unblinds selectors.",
  examples: [":unblind", ":unblind me", ":unblind others"],

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
        p.setDynamicProperty("acblinded", false);
        
        try {
          p.runCommand?.(`camera @s fade time 0 0 0 color 0 0 0`);
        } catch {}
        count++;
      } catch {}
    }

    player.sendMessage(`Unblinded ${count} player(s).`);
  },
};
