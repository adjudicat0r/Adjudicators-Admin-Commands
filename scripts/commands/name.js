import { selectPlayers } from "../lib/selectors.js";

function runNameAction({ player, args, usage, clearOnly }) {
  const selector = args[0] ?? "me";
  const raw = String(args.slice(1).join(" ") ?? "").trim();

  if (!clearOnly && !raw) {
    player.sendMessage(`Usage: ${usage}`);
    return;
  }

  const targets = selectPlayers(player, selector);
  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  const shouldClear = clearOnly || raw.toLowerCase() === "reset" || raw.toLowerCase() === "clear";

  let count = 0;
  for (const target of targets) {
    try {
      const isPlayer = typeof target?.name === "string";
      const nextNameTag = shouldClear ? (isPlayer ? target.name : "") : raw;

      try {
        target.nameTag = nextNameTag;
      } catch {}

      if (isPlayer) {
        target.setDynamicProperty("acname", shouldClear ? undefined : raw);
      }

      count++;
    } catch {}
  }

  player.sendMessage(
    shouldClear
      ? `Cleared forced names for ${count} player(s).`
      : `Set forced name for ${count} player(s).`
  );
}

export function makeNameCommand({ name, description, usage, examples, clearOnly = false }) {
  return {
    name,
    minRank: 3,
    usage,
    description,
    examples,
    execute({ player, args }) {
      runNameAction({ player, args, usage: this.usage, clearOnly });
    },
  };
}

export const nameCommand = makeNameCommand({
  name: "name",
  usage: ':name <selector> <name...>  (use "reset" to clear)',
  description: "Forces selectors' nameTags via a dynamic property + loops.",
  examples: [
    ':name me "§lAdmin"',
    ":name greg Greg_917",
    ":name others reset",
  ],
});
