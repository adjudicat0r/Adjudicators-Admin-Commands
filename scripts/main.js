
import { world, system } from "@minecraft/server";

import { handleCommandMessage } from "./commands/index.js";
import {
  handleDataToolBlock,
  handleDataToolEntity,
} from "./buildingtools/datatool.js";
import { handleResizeToolBlock } from "./buildingtools/resizetool.js";
import { handleHistoryToolUse } from "./buildingtools/historytool.js";
import { handleCloneToolClick } from "./buildingtools/clonetool.js";
import { handleBuildToolBlock } from "./buildingtools/buildtool.js";

import { getMotd, setPlayerRank } from "./storage/db.js";
import { owner } from "./system/config.js";

import { startChatSystem } from "./system/chats.js";
import { startLoops } from "./system/loops.js";
import { startSpawnRateSystem } from "./system/spawnrate.js";
import { startAutobroadcastSystem } from "./system/autobroadcast.js";

startChatSystem();
startLoops({ intervalTicks: 2 });
startSpawnRateSystem();
startAutobroadcastSystem();

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  const motd = getMotd();
  if (!player || !motd) return;

  try {
    player.sendMessage(`§6[MOTD]§r ${motd}`);
  } catch {}
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      if (
        String(player.nameTag ?? "").toLowerCase() ===
        String(owner?.nametag ?? "").toLowerCase()
      ) {
        setPlayerRank(player, 6);
      }
    } catch {}
  }
}, 40); 

function isNamedStick(item, wantedName) {
  if (!item || item.typeId !== "minecraft:stick") return false;
  const n = item.nameTag ?? "";
  return n === `§r${wantedName}` || n === wantedName;
}





const CLICK_COOLDOWN_MS = 150;
const lastToolFire = new Map(); 

function gate(player, channel) {
  const key = `${player.id}:${channel}`;
  const t = Date.now();
  const last = lastToolFire.get(key) ?? 0;
  if (t - last < CLICK_COOLDOWN_MS) return false;
  lastToolFire.set(key, t);
  return true;
}


world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const player = event.player;
  const item = event.itemStack;
  if (!item) return;

  
  const name = item.nameTag ?? "";
  const isBtoolStick =
    item.typeId === "minecraft:stick" &&
    (name === "data tool" ||
      name === "§rdata tool" ||
      name === "resize tool" ||
      name === "§rresize tool" ||
      name === "build tool" ||
      name === "§rbuild tool" ||
      name === "clone tool" ||
      name === "§rclone tool");

  if (!isBtoolStick) return;

  
  event.cancel = true;

  
  if (!gate(player, "block")) return;

  const block = event.block;

  system.run(() => {
    if (isNamedStick(item, "data tool")) {
      handleDataToolBlock(player, block);
      return;
    }
    if (isNamedStick(item, "resize tool")) {
      handleResizeToolBlock(player, block);
      return;
    }
    if (isNamedStick(item, "clone tool")) {
      handleCloneToolClick(player, block);
      return;
    }
    if (isNamedStick(item, "build tool")) {
      handleBuildToolBlock(player, block);
      return;
    }
  });
});


world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const player = event.player;
  const item = event.itemStack;
  if (!isNamedStick(item, "data tool")) return;

  event.cancel = true;
  if (!gate(player, "entity")) return;

  const entity = event.target;
  system.run(() => handleDataToolEntity(player, entity));
});


world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!isNamedStick(item, "history tool")) return;

  if (!gate(player, "use")) return;

  system.run(() => handleHistoryToolUse(player));
});


const VEIN_TARGETS = new Set([
  
  "minecraft:coal_ore",
  "minecraft:deepslate_coal_ore",

  "minecraft:copper_ore",
  "minecraft:deepslate_copper_ore",

  "minecraft:iron_ore",
  "minecraft:deepslate_iron_ore",

  "minecraft:gold_ore",
  "minecraft:deepslate_gold_ore",

  "minecraft:redstone_ore",
  "minecraft:deepslate_redstone_ore",

  "minecraft:lapis_ore",
  "minecraft:deepslate_lapis_ore",

  "minecraft:emerald_ore",
  "minecraft:deepslate_emerald_ore",

  "minecraft:diamond_ore",
  "minecraft:deepslate_diamond_ore",

  "minecraft:nether_gold_ore",
  "minecraft:ancient_debris",

  
  "minecraft:oak_log",
  "minecraft:spruce_log",
  "minecraft:birch_log",
  "minecraft:jungle_log",
  "minecraft:acacia_log",
  "minecraft:dark_oak_log",

  "minecraft:mangrove_log",
  "minecraft:cherry_log",
  "minecraft:crimson_stem",
  "minecraft:warped_stem",

  
  "minecraft:bamboo",
  "minecraft:sugar_cane",
  "minecraft:cactus",

  
  "minecraft:glowstone",
  "minecraft:nether_quartz_ore",

  
  "minecraft:amethyst_block",
]);

const MAX_BLOCKS = 48;
const MAX_RADIUS = 16;

const NEIGHBORS_6 = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

const key = (p) => `${p.x},${p.y},${p.z}`;
const manhattan = (a, b) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

function breakWithDrops(dim, p) {
  
  dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
}

function* veinJob(dim, start, typeId) {
  const seen = new Set();
  const q = [];

  
  for (const d of NEIGHBORS_6) {
    const n = { x: start.x + d.x, y: start.y + d.y, z: start.z + d.z };
    const k = key(n);
    if (!seen.has(k)) {
      seen.add(k);
      q.push(n);
    }
  }

  let broken = 0;

  while (q.length && broken < MAX_BLOCKS) {
    const p = q.shift();
    if (manhattan(start, p) > MAX_RADIUS) continue;

    let b;
    try {
      b = dim.getBlock(p);
    } catch {
      continue;
    }
    if (!b || b.typeId !== typeId) continue;

    
    try {
      breakWithDrops(dim, p);
    } catch {}
    broken++;

    
    for (const d of NEIGHBORS_6) {
      const n = { x: p.x + d.x, y: p.y + d.y, z: p.z + d.z };
      const k = key(n);
      if (!seen.has(k)) {
        seen.add(k);
        q.push(n);
      }
    }

    
    if (broken % 8 === 0) yield;
  }
}

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const typeId = ev.brokenBlockPermutation?.type?.id; 
  if (!typeId || !VEIN_TARGETS.has(typeId)) return;

  const dim = ev.dimension ?? ev.player?.dimension;

  const loc = ev.block?.location ?? ev.blockLocation ?? ev.location;
  if (!dim || !loc) return;

  const start = { x: loc.x, y: loc.y, z: loc.z };

  system.runJob(veinJob(dim, start, typeId));
});
