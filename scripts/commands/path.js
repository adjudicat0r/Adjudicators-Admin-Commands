
import { system } from "@minecraft/server";


function floorVec3(v) { return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) }; }
function key3(x, y, z) { return `${x},${y},${z}`; }
function parseXYZ(args) {
  const x = Number(args[0]), y = Number(args[1]), z = Number(args[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function dist2D(a, b) { return Math.hypot((a.x + 0.5) - (b.x + 0.5), (a.z + 0.5) - (b.z + 0.5)); }


const PASSABLE = new Set([
  "minecraft:air", "minecraft:cave_air", "minecraft:void_air",
  "minecraft:tall_grass", "minecraft:short_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:deadbush",
  "minecraft:seagrass", "minecraft:tall_seagrass", "minecraft:vine", "minecraft:snow_layer",
  "minecraft:dandelion", "minecraft:poppy", "minecraft:blue_orchid", "minecraft:allium", "minecraft:azure_bluet",
  "minecraft:red_tulip", "minecraft:orange_tulip", "minecraft:white_tulip", "minecraft:pink_tulip",
  "minecraft:oxeye_daisy", "minecraft:cornflower", "minecraft:lily_of_the_valley", "minecraft:wither_rose",
  "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush", "minecraft:peony",
  "minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroots", "minecraft:nether_wart",
  "minecraft:sweet_berry_bush", "minecraft:bamboo_sapling", "minecraft:waterlily",
  
  "minecraft:water",
]);

function isPassable(block) {
  if (!block) return false;
  const id = block.typeId;
  if (PASSABLE.has(id)) return true;

  if (id.endsWith("_door") || id.endsWith("_trapdoor") || id.endsWith("_fence_gate")) {
    try {
      const open = block.permutation.getState("open");
      if (typeof open === "boolean") return open;
    } catch { }
    return true; 
  }

  if (id.endsWith("_sign") || id.endsWith("_hanging_sign")) return true;
  if (id === "minecraft:torch" || id.endsWith("_torch") || id === "minecraft:lantern" || id === "minecraft:soul_lantern") return true;
  if (id === "minecraft:candle" || id.endsWith("_candle")) return true;
  if (id.includes("rail")) return true;
  if (id.endsWith("_button") || id.endsWith("_pressure_plate") || id === "minecraft:tripwire" || id === "minecraft:tripwire_hook") return true;

  return false;
}
function isSolidLike(block) { return !!block && !isPassable(block); }

function canStand(dim, x, y, z) {
  const feet = dim.getBlock({ x, y, z });
  const head = dim.getBlock({ x, y: y + 1, z });
  const below = dim.getBlock({ x, y: y - 1, z });
  if (!feet || !head || !below) return false; 
  if (!isPassable(feet) || !isPassable(head)) return false;
  if (!isSolidLike(below)) return false;
  return true;
}


function isOnGroundLike(player) {
  try {
    if (typeof player.isOnGround === "boolean") return player.isOnGround;
  } catch { }

  const dim = player.dimension;
  const p = player.location;
  const bx = Math.floor(p.x);
  const by = Math.floor(p.y - 0.05);
  const bz = Math.floor(p.z);
  const below = dim.getBlock({ x: bx, y: by - 1, z: bz });
  return isSolidLike(below);
}


function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

function forwardness(node, start, finalGoal) {
  
  const vx = (finalGoal.x - start.x);
  const vz = (finalGoal.z - start.z);
  const wx = (node.x - start.x);
  const wz = (node.z - start.z);
  return vx * wx + vz * wz;
}

function getNeighbors(dim, node) {
  const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  const out = [];

  for (const d of dirs) {
    const nx = node.x + d.x, nz = node.z + d.z;

    
    if (canStand(dim, nx, node.y, nz)) out.push({ x: nx, y: node.y, z: nz });

    
    if (canStand(dim, nx, node.y + 1, nz)) out.push({ x: nx, y: node.y + 1, z: nz });

    
    if (canStand(dim, nx, node.y - 1, nz)) out.push({ x: nx, y: node.y - 1, z: nz });
  }
  return out;
}





function aStar(dim, start, goal, opts) {
  const {
    maxNodes = 8000,
    maxCost = 6000,
    maxMs = 15,
    goalRadius = 0,
    allowPartial = true,

    
    finalGoal = goal,        
    minForwardDot = 0,       
  } = opts ?? {};

  const t0 = Date.now();

  
  let g = goal;
  if (!canStand(dim, g.x, g.y, g.z)) {
    const tries = [];
    for (let dy = -6; dy <= 6; dy++) tries.push({ x: g.x, y: g.y + dy, z: g.z });
    const ok = tries.find(p => canStand(dim, p.x, p.y, p.z));
    if (ok) g = ok;
  }

  
  let s = start;
  if (!canStand(dim, s.x, s.y, s.z)) {
    const tries = [];
    for (let dy = -2; dy <= 6; dy++) tries.push({ x: s.x, y: s.y + dy, z: s.z });
    const ok = tries.find(p => canStand(dim, p.x, p.y, p.z));
    if (!ok) return null;
    s = ok;
  }

  const startK = key3(s.x, s.y, s.z);
  const cameFrom = new Map();
  const gScore = new Map();

  const openSet = new Set();
  const openArr = []; 

  const pushOpen = (node, f) => {
    const k = key3(node.x, node.y, node.z);
    openSet.add(k);
    openArr.push({ k, node, f });
  };
  const popBest = () => {
    let best = -1, bestF = Infinity;
    for (let i = 0; i < openArr.length; i++) {
      const it = openArr[i];
      if (!openSet.has(it.k)) continue;
      if (it.f < bestF) { bestF = it.f; best = i; }
    }
    if (best === -1) return null;
    const it = openArr[best];
    openSet.delete(it.k);
    return it.node;
  };

  const reconstruct = (endNode) => {
    const ck = key3(endNode.x, endNode.y, endNode.z);
    const path = [endNode];
    let k = ck;
    while (cameFrom.has(k)) {
      k = cameFrom.get(k);
      const [x, y, z] = k.split(",").map(Number);
      path.push({ x, y, z });
    }
    path.reverse();
    return path;
  };

  gScore.set(startK, 0);
  pushOpen(s, heuristic(s, g));

  
  
  
  let bestForwardNode = s;
  let bestForwardDot = -Infinity;
  let bestForwardH = Infinity;

  let bestAnyNode = s;
  let bestAnyH = heuristic(s, g);

  let expanded = 0;

  while (true) {
    if (expanded >= maxNodes) break;
    if (Date.now() - t0 > maxMs) break;

    const cur = popBest();
    if (!cur) break;
    expanded++;

    const ck = key3(cur.x, cur.y, cur.z);
    const curG = gScore.get(ck) ?? Infinity;
    if (curG > maxCost) break;

    const h = heuristic(cur, g);
    if (h < bestAnyH) { bestAnyH = h; bestAnyNode = cur; }

    const dot = forwardness(cur, s, finalGoal);
    if (dot >= minForwardDot) {
      
      if (dot > bestForwardDot || (dot === bestForwardDot && h < bestForwardH)) {
        bestForwardDot = dot;
        bestForwardH = h;
        bestForwardNode = cur;
      }
    }

    if (
      Math.abs(cur.x - g.x) <= goalRadius &&
      Math.abs(cur.y - g.y) <= goalRadius &&
      Math.abs(cur.z - g.z) <= goalRadius
    ) {
      return reconstruct(cur);
    }

    for (const nb of getNeighbors(dim, cur)) {
      const nk = key3(nb.x, nb.y, nb.z);
      const tentative = curG + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, ck);
        gScore.set(nk, tentative);
        pushOpen(nb, tentative + heuristic(nb, g));
      }
    }
  }

  
  if (allowPartial) {
    
    const movedForward = bestForwardNode && !(bestForwardNode.x === s.x && bestForwardNode.y === s.y && bestForwardNode.z === s.z);
    if (movedForward && bestForwardDot >= minForwardDot) return reconstruct(bestForwardNode);

    const movedAny = bestAnyNode && !(bestAnyNode.x === s.x && bestAnyNode.y === s.y && bestAnyNode.z === s.z);
    if (movedAny) return reconstruct(bestAnyNode);
  }

  return null;
}


const activeKb = new Map(); 

function stopKb(player) {
  const c = activeKb.get(player.id);
  if (!c) return;
  if (c.moveIntervalId) system.clearRun(c.moveIntervalId);
  if (c.planIntervalId) system.clearRun(c.planIntervalId);
  activeKb.delete(player.id);
}

function computeLookaheadTarget(from, goal, radius) {
  const vx = goal.x - from.x;
  const vz = goal.z - from.z;
  const d = Math.hypot(vx, vz);
  if (d <= radius) return { ...goal };

  const ux = vx / d;
  const uz = vz / d;

  const tx = Math.floor(from.x + ux * radius);
  const tz = Math.floor(from.z + uz * radius);
  return { x: tx, y: from.y, z: tz };
}

function skipBehindNodes(ctrl, player, maxAdvance = 24) {
  if (!ctrl.path || ctrl.i >= ctrl.path.length) return;

  const pos = player.location;
  const gx = (ctrl.goal.x + 0.5) - pos.x;
  const gz = (ctrl.goal.z + 0.5) - pos.z;
  const gLen = Math.hypot(gx, gz) || 1;
  const ux = gx / gLen, uz = gz / gLen;

  let advanced = 0;
  while (ctrl.i < ctrl.path.length && advanced < maxAdvance) {
    const n = ctrl.path[ctrl.i];
    const nx = (n.x + 0.5) - pos.x;
    const nz = (n.z + 0.5) - pos.z;
    const dot = nx * ux + nz * uz;
    const dist = Math.hypot(nx, nz);

    if (dot < -0.25 || dist < 0.65) { ctrl.i++; advanced++; continue; }
    break;
  }
}


function pickLocalStep(dim, pos, towardXZ, preferYawRad, maxStep = 1) {
  const px = Math.floor(pos.x);
  const py = Math.floor(pos.y);
  const pz = Math.floor(pos.z);

  const baseDist = Math.hypot((towardXZ.x + 0.5) - pos.x, (towardXZ.z + 0.5) - pos.z);

  const angles = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, Math.PI / 2, -Math.PI / 2, Math.PI];
  let best = null;
  let bestScore = -1e9;

  for (const da of angles) {
    const a = preferYawRad + da;
    const dx = Math.round(Math.cos(a) * maxStep);
    const dz = Math.round(Math.sin(a) * maxStep);
    if (dx === 0 && dz === 0) continue;

    const nx = px + dx;
    const nz = pz + dz;

    for (const ny of [py, py + 1, py - 1]) {
      if (!canStand(dim, nx, ny, nz)) continue;

      const nxw = nx + 0.5, nzw = nz + 0.5;
      const dToT = Math.hypot((towardXZ.x + 0.5) - nxw, (towardXZ.z + 0.5) - nzw);
      const improve = baseDist - dToT;

      const score = improve - Math.abs(da) * 0.05;
      if (score > bestScore) { bestScore = score; best = { x: nx, y: ny, z: nz }; }
      break;
    }
  }

  return best;
}


function panicPop(player, yawRad, forceH = 0.12, forceV = 1.55) {
  const j = (Math.random() - 0.5) * 0.6; 
  const a = yawRad + Math.PI + j; 
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  try {
    player.applyKnockback({ x: dx * forceH, z: dz * forceH }, forceV);
    return true;
  } catch {
    return false;
  }
}

function startStreamingPath(player, finalGoal, opts) {
  stopKb(player);

  const {
    tickDelay = 1,
    speed = 0.35,
    arriveDist = 0.50,
    maxSkip = 3,

    hopStrength = 1.2,
    hopCooldown = 5,
    stuckWindow = 12,
    stuckMinMove = 0.08,

    descendArriveDist = 0.85,
    descendGroundForceMul = 0.65,
    airborneNudgeEvery = 3,
    airborneNudgeMul = 0.12,

    planEveryTicks = 10,
    extendWhenLeft = 10,

    segmentRadius = 96,
    minSegmentRadius = 18,

    astarMaxMs = 18,
    astarMaxNodes = 9000,
    astarMaxCost = 7000,

    
    allowGoalRadius = 1,
    hardStuckReplanAt = 25,
    hardStuckEscapeAt = 35,
    forceReplanCooldown = 12,

    
    panicPopAt = 55,
    panicPopEvery = 8,

    
    segTargetRelockFrac = 0.33, 
  } = opts ?? {};

  const dim = player.dimension;

  const ctrl = {
    goal: { ...finalGoal },
    path: [],
    i: 0,

    segRadius: segmentRadius,
    lastPlanTick: -999999,
    planFails: 0,

    
    segTarget: null,

    tick: 0,
    lastPos: { x: player.location.x, z: player.location.z },
    stuckTicks: 0,
    hopCd: 0,

    moveIntervalId: 0,

    lastDebugTick: -999999,
    lastForcedReplanTick: -999999,

    fallbackYaw: 0,
  };

  function remaining() { return Math.max(0, ctrl.path.length - ctrl.i); }
  function debug(msg) {
    if (ctrl.tick - ctrl.lastDebugTick < 40) return;
    ctrl.lastDebugTick = ctrl.tick;
    player.sendMessage(msg);
  }
  function clearPath() { ctrl.path = []; ctrl.i = 0; }

  function forceReplan(reason = "") {
    if (ctrl.tick - ctrl.lastForcedReplanTick < forceReplanCooldown) return false;
    ctrl.lastForcedReplanTick = ctrl.tick;
    clearPath();
    ctrl.segTarget = null; 
    ctrl.segRadius = Math.max(minSegmentRadius, Math.floor(ctrl.segRadius * 0.6));
    if (reason) debug(`Replan: ${reason} radius->${ctrl.segRadius}`);
    return true;
  }

  function getLockedSegTarget(start) {
    if (!ctrl.segTarget) {
      ctrl.segTarget = computeLookaheadTarget(start, ctrl.goal, ctrl.segRadius);
      return ctrl.segTarget;
    }

    
    const relockDist = Math.max(4, ctrl.segRadius * segTargetRelockFrac);
    if (remaining() === 0 || dist2D(start, ctrl.segTarget) <= relockDist) {
      ctrl.segTarget = computeLookaheadTarget(start, ctrl.goal, ctrl.segRadius);
    }
    return ctrl.segTarget;
  }

  function tryExtendPath(force = false) {
    if (!force && (ctrl.tick - ctrl.lastPlanTick < planEveryTicks)) return;
    ctrl.lastPlanTick = ctrl.tick;

    if (!force && remaining() > extendWhenLeft) return;

    const start = floorVec3(player.location);
    const goal = ctrl.goal;

    
    const segTarget = getLockedSegTarget(start);

    const seg = aStar(dim, start, segTarget, {
      maxNodes: astarMaxNodes,
      maxCost: astarMaxCost,
      maxMs: astarMaxMs,
      goalRadius: allowGoalRadius,
      allowPartial: true,

      
      finalGoal: goal,
      minForwardDot: 0,
    });

    if (!seg || seg.length < 2) {
      ctrl.planFails++;
      ctrl.segRadius = Math.max(minSegmentRadius, Math.floor(ctrl.segRadius * 0.7));
      ctrl.segTarget = null; 
      debug(`Planner: no segment (fails=${ctrl.planFails}) radius->${ctrl.segRadius}`);
      return false;
    }

    ctrl.planFails = 0;
    ctrl.segRadius = Math.min(segmentRadius, ctrl.segRadius + 8);

    if (ctrl.path.length === 0 || ctrl.i >= ctrl.path.length) {
      ctrl.path = seg;
      ctrl.i = 0;
      skipBehindNodes(ctrl, player);
      return true;
    }

    const next = ctrl.path[ctrl.i];
    const pos = player.location;
    const distToNext = Math.hypot((next.x + 0.5) - pos.x, (next.z + 0.5) - pos.z);

    
    if (distToNext > 6) {
      ctrl.path = seg;
      ctrl.i = 0;
      skipBehindNodes(ctrl, player);
      return true;
    }

    
    if (seg.length >= 2 && ctrl.i < ctrl.path.length) {
      const segFirst = seg[1];
      const diverged = !(next && next.x === segFirst.x && next.y === segFirst.y && next.z === segFirst.z);
      if (diverged) {
        ctrl.path = seg;
        ctrl.i = 0;
        skipBehindNodes(ctrl, player);
        return true;
      }
    }

    for (let k = 1; k < seg.length; k++) ctrl.path.push(seg[k]);
    skipBehindNodes(ctrl, player);
    return true;
  }

  
  tryExtendPath(true);

  ctrl.moveIntervalId = system.runInterval(() => {
    ctrl.tick++;

    try {
      if (player?.isValid && !player.isValid()) { stopKb(player); return; }
    } catch { }

    const pos = player.location;
    const g = ctrl.goal;

    const gx = (g.x + 0.5) - pos.x;
    const gz = (g.z + 0.5) - pos.z;
    const goalYaw = Math.atan2(gz, gx);
    ctrl.fallbackYaw = goalYaw;

    const gdist = Math.hypot(gx, gz);
    if (gdist <= 1.2 && Math.abs(Math.floor(pos.y) - g.y) <= 1) {
      stopKb(player);
      player.sendMessage("Arrived.");
      return;
    }

    tryExtendPath(false);

    
    const moved = Math.hypot(pos.x - ctrl.lastPos.x, pos.z - ctrl.lastPos.z);
    ctrl.lastPos = { x: pos.x, z: pos.z };
    if (moved < stuckMinMove) ctrl.stuckTicks++;
    else ctrl.stuckTicks = 0;

    if (ctrl.stuckTicks === hardStuckReplanAt) forceReplan("stuck");
    if (ctrl.stuckTicks === hardStuckEscapeAt) {
      const look = computeLookaheadTarget(floorVec3(pos), ctrl.goal, Math.max(minSegmentRadius, ctrl.segRadius));
      const step = pickLocalStep(dim, pos, { x: look.x, z: look.z }, goalYaw + Math.PI, 1);
      if (step) {
        ctrl.path = [floorVec3(pos), step];
        ctrl.i = 1;
        ctrl.stuckTicks = 0;
      } else {
        forceReplan("no-escape-step");
      }
    }

    
    if (ctrl.stuckTicks >= panicPopAt && (ctrl.tick % panicPopEvery === 0)) {
      panicPop(player, goalYaw, 0.14, 1.65);
      return;
    }

    const havePath = ctrl.path.length > 0 && ctrl.i < ctrl.path.length;

    
    let tx, tz, targetNodeY;
    const curFeetY = Math.floor(pos.y);

    if (havePath) {
      const targetY0 = ctrl.path[ctrl.i].y;
      const steppingDown0 = (targetY0 - curFeetY) < 0;
      const arriveDistDyn = steppingDown0 ? Math.max(arriveDist, descendArriveDist) : arriveDist;

      for (let s = 0; s < maxSkip && ctrl.i < ctrl.path.length; s++) {
        const n2 = ctrl.path[ctrl.i];
        const tx2 = n2.x + 0.5, tz2 = n2.z + 0.5;
        const d2 = Math.hypot(tx2 - pos.x, tz2 - pos.z);
        if (d2 <= arriveDistDyn) ctrl.i++;
        else break;
      }
      if (ctrl.i >= ctrl.path.length) return;

      const n = ctrl.path[ctrl.i];
      tx = n.x + 0.5;
      tz = n.z + 0.5;
      targetNodeY = n.y;
    } else {
      
      const look = computeLookaheadTarget(floorVec3(pos), ctrl.goal, ctrl.segRadius);
      const step = pickLocalStep(dim, pos, { x: look.x, z: look.z }, goalYaw, 1);
      if (!step) {
        forceReplan("fallback-dead");
        return;
      }
      tx = step.x + 0.5;
      tz = step.z + 0.5;
      targetNodeY = step.y;
    }

    
    let dx = tx - pos.x;
    let dz = tz - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.0001) return;
    dx /= dist; dz /= dist;

    const dy = (targetNodeY ?? curFeetY) - curFeetY;
    const steppingUp = dy > 0;
    const steppingDown = dy < 0;

    const onGround = isOnGroundLike(player);
    const scale = Math.min(1, dist / 1.4);

    const airborneDescend = steppingDown && !onGround;
    if (airborneDescend) {
      if (airborneNudgeEvery !== Infinity && airborneNudgeEvery > 0) {
        if (ctrl.tick % airborneNudgeEvery !== 0) return;
      } else return;
    }

    let force;
    if (!havePath) {
      force = speed * 0.45 * scale;
    } else if (airborneDescend) {
      force = speed * airborneNudgeMul;
    } else if (steppingDown && onGround) {
      force = speed * scale * descendGroundForceMul;
    } else {
      force = speed * scale;
    }

    if (ctrl.hopCd > 0) ctrl.hopCd--;

    const shouldHop =
      havePath &&
      !steppingDown &&
      ctrl.hopCd === 0 &&
      (steppingUp || ctrl.stuckTicks >= stuckWindow);

    const verticalStrength = shouldHop ? hopStrength : 0;
    if (shouldHop) {
      ctrl.hopCd = hopCooldown;
      if (ctrl.stuckTicks >= stuckWindow) ctrl.stuckTicks = 0;
    }

    try {
      player.applyKnockback({ x: dx * force, z: dz * force }, verticalStrength);
    } catch (e) {
      stopKb(player);
      player.sendMessage(`Knockback failed: ${String(e)}`);
    }
  }, tickDelay);

  activeKb.set(player.id, ctrl);
}


export const pathCommand = {
  name: "path",
  minRank: 1,
  usage: ":pathkb <x> <y> <z> [speed=0.35] | :pathkb stop",
  description: "Streams A* segments toward XYZ and follows using applyKnockback impulses.",
  examples: [":pathkb 100 64 -30", ":pathkb 100 64 -30 0.25", ":pathkb stop"],

  execute({ player, args }) {
    const sub = (args[0] ?? "").toLowerCase();
    if (sub === "stop" || sub === "cancel") {
      stopKb(player);
      player.sendMessage("Stopped knockback path run.");
      return;
    }

    const xyz = parseXYZ(args);
    if (!xyz) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const speed = clamp(Number(args[3] ?? 0.35) || 0.35, 0.05, 1.2);
    const goal = { x: Math.floor(xyz.x), y: Math.floor(xyz.y), z: Math.floor(xyz.z) };

    player.sendMessage(`Streaming path to ${goal.x} ${goal.y} ${goal.z}...`);
    startStreamingPath(player, goal, {
      tickDelay: 1,
      speed,

      segmentRadius: 96,
      minSegmentRadius: 18,
      planEveryTicks: 10,
      extendWhenLeft: 12,

      astarMaxMs: 18,
      astarMaxNodes: 9000,
      astarMaxCost: 7000,

      allowGoalRadius: 1,

      hardStuckReplanAt: 25,
      hardStuckEscapeAt: 35,

      panicPopAt: 55,
      panicPopEvery: 8,

      
      segTargetRelockFrac: 0.33,
    });
  },
};
