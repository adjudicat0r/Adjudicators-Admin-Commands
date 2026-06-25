import { selectPlayers } from "../lib/selectors.js";

function fmt(n) {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

export const posCommand = {
  name: "pos",
  minRank: 1,
  usage: ":pos <selector>",
  description: "Shows coordinates for selectors.",
  examples: [":pos", ":pos me", ":pos greg", ":pos others"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const targets = selectPlayers(player, selector);

    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    for (const p of targets) {
      try {
        const l = p.location;
        const name = p.name ?? p.nameTag ?? "player";
        player.sendMessage(
          `${name}: ` +
          `X: §c${fmt(l.x)}§r ` +
          `Y: §a${fmt(l.y)}§r ` +
          `Z: §9${fmt(l.z)}§r`
        );
      } catch {}
    }
  },
};
