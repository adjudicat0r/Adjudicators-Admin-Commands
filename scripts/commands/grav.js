import { selectPlayers } from "../lib/selectors.js";
import { clearGravState, setGravState } from "../system/grav.js";

function runGravToggle({ player, args, enabled, usage }) {
  const selector = args[0] ?? "me";
  const targets = selectPlayers(player, selector);

  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  if (!enabled) {
    let count = 0;
    for (const target of targets) {
      if (clearGravState(target)) count++;
    }

    player.sendMessage(`Gravity override cleared for ${count} target(s).`);
    return;
  }

  const amount = Number(args[1]);
  if (!Number.isFinite(amount) || amount === 0) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  let count = 0;
  let requestedAmount = amount;
  for (const target of targets) {
    const result = setGravState(target, amount);
    if (!result.ok) continue;
    count++;
  }

  if (!count) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  player.sendMessage(
    requestedAmount > 0
      ? `Gravity pulling down on ${count} target(s) at ${requestedAmount}.`
      : `Gravity pulling up on ${count} target(s) at ${Math.abs(requestedAmount)}.`
  );
}

export const gravCommand = {
  name: "grav",
  minRank: 3,
  usage: ":grav <selector> <amount>",
  description: "Continuously pushes targets down, or up with negative values.",
  examples: [":grav me 3", ":grav others 1.5", ":grav entity:sheep -2"],

  execute({ player, args }) {
    runGravToggle({ player, args, enabled: true, usage: this.usage });
  },
};

export const ungravCommand = {
  name: "ungrav",
  minRank: 3,
  usage: ":ungrav <selector>",
  description: "Stops the continuous gravity override on targets.",
  examples: [":ungrav me", ":ungrav others", ":ungrav entity:sheep"],

  execute({ player, args }) {
    runGravToggle({ player, args, enabled: false, usage: this.usage });
  },
};
