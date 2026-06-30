import { selectPlayers } from "../lib/selectors.js";
import { clearSlipperyState, setSlipperyState } from "../system/slippery.js";

function runSlipperyToggle({ player, args, enabled, usage }) {
  const selector = args[0] ?? "me";
  const targets = selectPlayers(player, selector);

  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  let count = 0;
  for (const target of targets) {
    const ok = enabled ? setSlipperyState(target, true) : clearSlipperyState(target);
    if (ok) count++;
  }

  if (!count) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  player.sendMessage(
    enabled
      ? `Slippery movement enabled for ${count} target(s).`
      : `Slippery movement disabled for ${count} target(s).`
  );
}

export const slipperyCommand = {
  name: "slippery",
  minRank: 3,
  usage: ":slippery <selector>",
  description: "Makes targets keep sliding horizontally like they are on ice.",
  examples: [":slippery me", ":slippery others", ":slippery entity:rabbit"],

  execute({ player, args }) {
    runSlipperyToggle({ player, args, enabled: true, usage: this.usage });
  },
};

export const unslipperyCommand = {
  name: "unslippery",
  minRank: 3,
  usage: ":unslippery <selector>",
  description: "Stops the extra icy sliding effect on targets.",
  examples: [":unslippery me", ":unslippery others", ":unslippery entity:rabbit"],

  execute({ player, args }) {
    runSlipperyToggle({ player, args, enabled: false, usage: this.usage });
  },
};
