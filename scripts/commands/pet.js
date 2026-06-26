import { markEntityAsPet } from "../system/pet.js";
import { makeDefaultEntityName } from "./spawn.js";

function resolveEntityId(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text) return null;
  return text.startsWith("minecraft:") ? text : `minecraft:${text}`;
}

function spawnPetEntities(player, entityId, amount, nameTag) {
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
      if (!entity) continue;
      entity.nameTag = nameTag;
      markEntityAsPet(entity, player);
      count++;
    } catch {}
  }

  return count;
}

export const petCommand = {
  name: "pet",
  minRank: 3,
  usage: ":pet <entity> [amount] [name]",
  description: "Spawns pet entities that follow you when you are on the ground.",
  examples: [
    ":pet cow 5",
    ':pet wolf 2 "Guard dog"',
  ],

  execute({ player, args }) {
    const entityId = resolveEntityId(args[0]);
    if (!entityId) {
      player.sendMessage(`Usage: ${this.usage}`);
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
    const nameTag = customName || makeDefaultEntityName(player.name, entityId) + " pet";
    const spawned = spawnPetEntities(player, entityId, amount, nameTag);

    if (!spawned) {
      player.sendMessage(`Failed to spawn pet ${entityId}.`);
      return;
    }

    player.sendMessage(`Spawned ${spawned} pet ${entityId.replace(/^minecraft:/, "")}(s) named "${nameTag}".`);
  },
};
