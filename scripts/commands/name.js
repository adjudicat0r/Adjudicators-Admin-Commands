
import { selectPlayers } from "../lib/selectors.js";

export const nameCommand = {
  name: "name",
  minRank: 3, 
  usage: ':name <selector> <name...>  (use "reset" to clear)',
  description: "Forces selectors' nameTags via a dynamic property + loops.",
  examples: [
    ':name me "§lAdmin"',
    ":name greg Greg_917",
    ":name others reset",
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const raw = String(args.slice(1).join(" ") ?? "").trim();

    if (!raw) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    const shouldClear = raw.toLowerCase() === "reset" || raw.toLowerCase() === "clear";

    let count = 0;
    for (const p of targets) {
      try {
        if (shouldClear) {
          p.setDynamicProperty("acname", undefined);
        } else {
          p.setDynamicProperty("acname", raw);
        }
        count++;
      } catch {}
    }

    player.sendMessage(
      shouldClear
        ? `Cleared forced names for ${count} player(s).`
        : `Set forced name for ${count} player(s).`
    );
  },
};
