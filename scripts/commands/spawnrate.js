
import { world } from "@minecraft/server";

const KEY = "acspawnrate_v1";
const MAX_ENTRIES = 200;

function norm(s) {
  return String(s ?? "").toLowerCase().trim();
}

function toTypeId(raw) {
  const s = norm(raw).replace(/^minecraft:/, "");
  if (!s) return null;
  
  return s.includes(":") ? s : `minecraft:${s}`;
}

function getMap() {
  try {
    return JSON.parse(world.getDynamicProperty(KEY) ?? "{}") || {};
  } catch {
    return {};
  }
}

function saveMap(map) {
  world.setDynamicProperty(KEY, JSON.stringify(map));
}

export const spawnrateCommand = {
  name: "spawnrate",
  minRank: 6, 
  usage: ":spawnrate <entity> <multiplier> | :spawnrate list | :spawnrate del <entity>",
  description:
    "Multiplies naturally spawned entities. Example: :spawnrate enderman 5",
  examples: [
    ":spawnrate enderman 5",
    ":spawnrate iron_golem 2",
    ":spawnrate list",
    ":spawnrate del enderman",
  ],

  execute({ player, args }) {
    const sub = norm(args[0]);

    
    if (!sub || sub === "list") {
      const map = getMap();
      const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
      if (!keys.length) {
        player.sendMessage("No spawnrate rules set.");
        return;
      }
      player.sendMessage(`Spawnrate rules (${keys.length}):`);
      for (const k of keys.slice(0, 30)) {
        player.sendMessage(`${k} -> x${map[k]}`);
      }
      if (keys.length > 30) player.sendMessage(`...and ${keys.length - 30} more`);
      return;
    }

    
    if (sub === "del" || sub === "delete" || sub === "remove") {
      const typeId = toTypeId(args[1]);
      if (!typeId) {
        player.sendMessage("Usage: :spawnrate del <entity>");
        return;
      }
      const map = getMap();
      if (!map[typeId]) {
        player.sendMessage(`No rule found for ${typeId}`);
        return;
      }
      delete map[typeId];
      try {
        saveMap(map);
        player.sendMessage(`Removed spawnrate rule for ${typeId}`);
      } catch {
        player.sendMessage("Failed to save (storage limit hit).");
      }
      return;
    }

    
    const typeId = toTypeId(args[0]);
    const mul = Math.floor(Number(args[1]));

    if (!typeId || !Number.isFinite(mul) || mul < 1) {
      player.sendMessage(`Usage: :spawnrate <entity> <multiplier>`);
      return;
    }

    
    const safeMul = Math.min(mul, 50);

    const map = getMap();
    if (!map[typeId] && Object.keys(map).length >= MAX_ENTRIES) {
      player.sendMessage(`Rule limit reached (${MAX_ENTRIES}).`);
      return;
    }

    if (safeMul === 1) {
      delete map[typeId];
      try {
        saveMap(map);
        player.sendMessage(`Multiplier 1 => rule removed for ${typeId}`);
      } catch {
        player.sendMessage("Failed to save (storage limit hit).");
      }
      return;
    }

    map[typeId] = safeMul;
    try {
      saveMap(map);
      player.sendMessage(`Set spawnrate: ${typeId} -> x${safeMul}`);
      if (safeMul !== mul) player.sendMessage(`(capped to x${safeMul})`);
    } catch {
      player.sendMessage("Failed to save (storage limit hit).");
    }
  },
};
