export function makeDefaultEntityName(playerName, entityId) {
  const shortId = String(entityId ?? "")
    .replace(/^minecraft:/, "")
    .replace(/_/g, " ");
  return `${playerName}'s ${shortId}`;
}

function resolveEntityId(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text) return null;
  return text.startsWith("minecraft:") ? text : `minecraft:${text}`;
}

function spawnEntities(player, entityId, amount, nameTag) {
  const base = player.location;
  let count = 0;

  for (let index = 0; index < amount; index++) {
    const angle = (Math.PI * 2 * index) / Math.max(amount, 1);
    const distance = amount > 1 ? 1 + (index % 3) * 0.75 : 1;
    const location = {
      x: base.x + Math.cos(angle) * distance,
      y: base.y,
      z: base.z + Math.sin(angle) * distance,
    };

    try {
      const entity = player.dimension.spawnEntity(entityId, location);
      if (entity && nameTag) entity.nameTag = nameTag;
      count++;
    } catch {}
  }

  return count;
}

function runSpawnCommand({ player, args }) {
  const entityId = resolveEntityId(args[0]);
  if (!entityId) {
    player.sendMessage("Usage: :spawn <entity> [amount] [name]");
    return;
  }

  let amount = 1;
  let nameStart = 1;
  const parsedAmount = Number(args[1]);
  if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
    amount = Math.min(100, Math.floor(parsedAmount));
    nameStart = 2;
  }

  const customName = String(args.slice(nameStart).join(" ") ?? "").trim();
  const nameTag = customName || makeDefaultEntityName(player.name, entityId);
  const spawned = spawnEntities(player, entityId, amount, nameTag);

  if (!spawned) {
    player.sendMessage(`Failed to spawn ${entityId}.`);
    return;
  }

  player.sendMessage(`Spawned ${spawned} ${entityId.replace(/^minecraft:/, "")}(s) named "${nameTag}".`);
}

export const spawnCommand = {
  name: "spawn",
  minRank: 3,
  usage: ":spawn <entity> [amount] [name]",
  description: "Spawns entities on you with an optional amount and name.",
  examples: [
    ":spawn cow 5",
    ':spawn zombie 3 "Raid zombie"',
  ],

  execute(ctx) {
    runSpawnCommand(ctx);
  },
};

export const summonCommand = {
  name: "summon",
  minRank: 3,
  usage: ":summon <entity> [amount] [name]",
  description: "Alias of :spawn.",
  examples: [
    ":summon cow 5",
    ':summon zombie 3 "Raid zombie"',
  ],

  execute(ctx) {
    runSpawnCommand(ctx);
  },
};
