import { system } from "@minecraft/server";

function floorVec3(v) {
  return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
}

function key3(x, y, z) {
  return `${x},${y},${z}`;
}

function parseXYZ(args) {
  const x = Number(args[0]);
  const y = Number(args[1]);
  const z = Number(args[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dist2D(a, b) {
  return Math.hypot((a.x + 0.5) - (b.x + 0.5), (a.z + 0.5) - (b.z + 0.5));
}

function dist3D(a, b) {
  return Math.hypot((a.x + 0.5) - (b.x + 0.5), (a.y + 0.5) - (b.y + 0.5), (a.z + 0.5) - (b.z + 0.5));
}

const PASSABLE = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
  "minecraft:tall_grass",
  "minecraft:short_grass",
  "minecraft:fern",
  "minecraft:large_fern",
  "minecraft:deadbush",
  "minecraft:seagrass",
  "minecraft:tall_seagrass",
  "minecraft:vine",
  "minecraft:snow_layer",
  "minecraft:dandelion",
  "minecraft:poppy",
  "minecraft:blue_orchid",
  "minecraft:allium",
  "minecraft:azure_bluet",
  "minecraft:red_tulip",
  "minecraft:orange_tulip",
  "minecraft:white_tulip",
  "minecraft:pink_tulip",
  "minecraft:oxeye_daisy",
  "minecraft:cornflower",
  "minecraft:lily_of_the_valley",
  "minecraft:wither_rose",
  "minecraft:sunflower",
  "minecraft:lilac",
  "minecraft:rose_bush",
  "minecraft:peony",
  "minecraft:wheat",
  "minecraft:carrots",
  "minecraft:potatoes",
  "minecraft:beetroots",
  "minecraft:nether_wart",
  "minecraft:sweet_berry_bush",
  "minecraft:bamboo_sapling",
  "minecraft:waterlily",
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
    } catch {}
    return true;
  }

  if (id.endsWith("_sign") || id.endsWith("_hanging_sign")) return true;
  if (id === "minecraft:torch" || id.endsWith("_torch") || id === "minecraft:lantern" || id === "minecraft:soul_lantern") return true;
  if (id === "minecraft:candle" || id.endsWith("_candle")) return true;
  if (id.includes("rail")) return true;
  if (id.endsWith("_button") || id.endsWith("_pressure_plate") || id === "minecraft:tripwire" || id === "minecraft:tripwire_hook") return true;

  return false;
}

function isSolidLike(block) {
  return !!block && !isPassable(block);
}

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
  } catch {}

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

function lineClear(dim, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * 4;
  if (steps <= 0) return true;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(a.x + dx * t);
    const y = Math.floor(a.y + dy * t);
    const z = Math.floor(a.z + dz * t);
    if (!canStand(dim, x, y, z)) return false;
  }

  return true;
}

function findStandableNear(dim, point, radius = 4) {
  const base = floorVec3(point);
  let best = null;
  let bestScore = Infinity;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const x = base.x + dx;
        const y = base.y + dy;
        const z = base.z + dz;
        if (!canStand(dim, x, y, z)) continue;
        const candidate = { x, y, z };
        const score = dist3D(candidate, point);
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
  }

  return best;
}

function findGoalAnchor(dim, goal) {
  const snapped = findStandableNear(dim, goal, 6);
  if (snapped) return snapped;
  for (let dy = 0; dy <= 8; dy++) {
    if (canStand(dim, goal.x, goal.y + dy, goal.z)) return { x: goal.x, y: goal.y + dy, z: goal.z };
    if (canStand(dim, goal.x, goal.y - dy, goal.z)) return { x: goal.x, y: goal.y - dy, z: goal.z };
  }
  return null;
}

function findEscapeAnchors(dim, start, goal, radius = 12) {
  const base = floorVec3(start);
  const goalVecX = goal.x - start.x;
  const goalVecZ = goal.z - start.z;
  const scored = [];

  for (let dy = 1; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const x = base.x + dx;
        const y = base.y + dy;
        const z = base.z + dz;
        if (!canStand(dim, x, y, z)) continue;

        const candidate = { x, y, z };
        const relX = candidate.x - start.x;
        const relZ = candidate.z - start.z;
        const dot = relX * goalVecX + relZ * goalVecZ;
        const awayBonus = dot < 0 ? 8 : 0;
        const heightBonus = dy * 12;
        const rangePenalty = dist3D(candidate, start) * 0.35;
        const goalPenalty = dist3D(candidate, goal) * 0.1;
        const score = heightBonus + awayBonus + (dist2D(candidate, start) * 0.25) - rangePenalty - goalPenalty;
        scored.push({ candidate, score });
      }
    }
  }

  scored.sort((left, right) => right.score - left.score);
  return scored.map((entry) => entry.candidate);
}

function findStartAnchor(dim, start) {
  const snapped = findStandableNear(dim, start, 3);
  if (snapped) return snapped;
  for (let dy = -2; dy <= 6; dy++) {
    if (canStand(dim, start.x, start.y + dy, start.z)) return { x: start.x, y: start.y + dy, z: start.z };
  }
  return null;
}

function getNeighbors(dim, node) {
  const moves = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
    { x: 1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: -1, z: -1 },
  ];
  const out = [];

  for (const move of moves) {
    const nx = node.x + move.x;
    const nz = node.z + move.z;
    const diagonal = move.x !== 0 && move.z !== 0;
    const candidates = [node.y, node.y + 1, node.y - 1];

    for (const ny of candidates) {
      if (!canStand(dim, nx, ny, nz)) continue;

      if (diagonal) {
        if (!canStand(dim, node.x + move.x, ny, node.z) || !canStand(dim, node.x, ny, node.z + move.z)) continue;
      }

      const cost = diagonal ? 1.414 : 1;
      out.push({ x: nx, y: ny, z: nz, cost });
      break;
    }
  }

  return out;
}

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const tail = this.items.pop();
    if (this.items.length > 0 && tail) {
      this.items[0] = tail;
      this.bubbleDown(0);
    }
    return top;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].f <= this.items[index].f) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    const length = this.items.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = left + 1;
      if (left < length && this.items[left].f < this.items[smallest].f) smallest = left;
      if (right < length && this.items[right].f < this.items[smallest].f) smallest = right;
      if (smallest === index) break;
      [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
      index = smallest;
    }
  }

  get size() {
    return this.items.length;
  }
}

function reconstructPath(cameFrom, endNode) {
  const path = [endNode];
  let current = key3(endNode.x, endNode.y, endNode.z);
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    const [x, y, z] = current.split(",").map(Number);
    path.push({ x, y, z });
  }
  path.reverse();
  return path;
}

function smoothPath(dim, path) {
  if (path.length <= 2) return path;

  const out = [path[0]];
  let anchorIndex = 0;

  while (anchorIndex < path.length - 1) {
    let furthest = anchorIndex + 1;
    for (let i = path.length - 1; i > anchorIndex; i--) {
      if (lineClear(dim, path[anchorIndex], path[i])) {
        furthest = i;
        break;
      }
    }
    out.push(path[furthest]);
    anchorIndex = furthest;
  }

  return out;
}

function aStar(dim, start, goal, opts) {
  const {
    maxNodes = 12000,
    maxCost = 9000,
    maxMs = 20,
    goalRadius = 0,
    allowPartial = true,
  } = opts ?? {};

  const t0 = Date.now();
  const s = findStartAnchor(dim, start);
  if (!s) return null;

  const g = findGoalAnchor(dim, goal);
  if (!g) return null;

  const startK = key3(s.x, s.y, s.z);
  const cameFrom = new Map();
  const gScore = new Map([[startK, 0]]);
  const open = new MinHeap();
  open.push({ node: s, f: heuristic(s, g) });

  let bestAny = s;
  let bestAnyH = heuristic(s, g);
  let bestGoalLike = s;
  let bestGoalLikeH = bestAnyH;

  const seen = new Set([startK]);
  let expanded = 0;

  while (open.size > 0) {
    if (expanded >= maxNodes) break;
    if (Date.now() - t0 > maxMs) break;

    const currentItem = open.pop();
    if (!currentItem) break;
    const cur = currentItem.node;
    const ck = key3(cur.x, cur.y, cur.z);
    const curG = gScore.get(ck);
    if (curG == null || curG > maxCost) continue;
    expanded++;

    const h = heuristic(cur, g);
    if (h < bestAnyH) {
      bestAnyH = h;
      bestAny = cur;
    }

    const goalLike = dist3D(cur, g);
    if (goalLike < bestGoalLikeH) {
      bestGoalLikeH = goalLike;
      bestGoalLike = cur;
    }

    if (
      Math.abs(cur.x - g.x) <= goalRadius &&
      Math.abs(cur.y - g.y) <= goalRadius &&
      Math.abs(cur.z - g.z) <= goalRadius
    ) {
      return smoothPath(dim, reconstructPath(cameFrom, cur));
    }

    for (const neighbor of getNeighbors(dim, cur)) {
      const nk = key3(neighbor.x, neighbor.y, neighbor.z);
      const tentative = curG + neighbor.cost;
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
      cameFrom.set(nk, ck);
      gScore.set(nk, tentative);
      const f = tentative + heuristic(neighbor, g);
      if (!seen.has(nk)) seen.add(nk);
      open.push({ node: { x: neighbor.x, y: neighbor.y, z: neighbor.z }, f });
    }
  }

  if (!allowPartial) return null;

  const chosen = dist3D(bestGoalLike, s) > 0.01 ? bestGoalLike : bestAny;
  if (dist3D(chosen, s) <= 0.01) return null;
  return smoothPath(dim, reconstructPath(cameFrom, chosen));
}

const activeKb = new Map();

function stopKb(player) {
  const ctrl = activeKb.get(player.id);
  if (!ctrl) return;
  if (ctrl.moveIntervalId) system.clearRun(ctrl.moveIntervalId);
  activeKb.delete(player.id);
}

function computeLookaheadTarget(from, goal, radius) {
  const vx = goal.x - from.x;
  const vz = goal.z - from.z;
  const d = Math.hypot(vx, vz);
  if (d <= radius) return { ...goal };

  const ux = vx / d;
  const uz = vz / d;
  return {
    x: Math.floor(from.x + ux * radius),
    y: goal.y,
    z: Math.floor(from.z + uz * radius),
  };
}

function pickLocalStep(dim, pos, towardXZ, preferYawRad, maxStep = 1) {
  const px = Math.floor(pos.x);
  const py = Math.floor(pos.y);
  const pz = Math.floor(pos.z);
  const baseDist = Math.hypot((towardXZ.x + 0.5) - pos.x, (towardXZ.z + 0.5) - pos.z);

  const angles = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, Math.PI / 2, -Math.PI / 2, Math.PI];
  let best = null;
  let bestScore = -Infinity;

  for (const delta of angles) {
    const a = preferYawRad + delta;
    const dx = Math.round(Math.cos(a) * maxStep);
    const dz = Math.round(Math.sin(a) * maxStep);
    if (dx === 0 && dz === 0) continue;

    const nx = px + dx;
    const nz = pz + dz;

    for (const ny of [py, py + 1, py - 1]) {
      if (!canStand(dim, nx, ny, nz)) continue;
      const dToTarget = Math.hypot((towardXZ.x + 0.5) - (nx + 0.5), (towardXZ.z + 0.5) - (nz + 0.5));
      const improve = baseDist - dToTarget;
      const score = improve - Math.abs(delta) * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = { x: nx, y: ny, z: nz };
      }
      break;
    }
  }

  return best;
}

function panicPop(player, yawRad, forceH = 0.12, forceV = 1.55) {
  const jitter = (Math.random() - 0.5) * 0.6;
  const angle = yawRad + Math.PI + jitter;
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  try {
    player.applyKnockback({ x: dx * forceH, z: dz * forceH }, forceV);
    return true;
  } catch {
    return false;
  }
}

function compressPath(dim, path) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  let anchor = 0;

  while (anchor < path.length - 1) {
    let candidate = anchor + 1;
    for (let i = path.length - 1; i > anchor; i--) {
      if (lineClear(dim, path[anchor], path[i])) {
        candidate = i;
        break;
      }
    }
    out.push(path[candidate]);
    anchor = candidate;
  }

  return out;
}

function startStreamingPath(player, finalGoal, opts) {
  stopKb(player);

  const {
    tickDelay = 1,
    speed = 0.35,
    arriveDist = 0.55,
    maxSkip = 4,
    hopStrength = 1.1,
    hopCooldown = 5,
    stuckWindow = 12,
    stuckMinMove = 0.08,
    descendArriveDist = 0.9,
    descendGroundForceMul = 0.65,
    airborneNudgeEvery = 3,
    airborneNudgeMul = 0.12,
    planEveryTicks = 8,
    extendWhenLeft = 10,
    segmentRadius = 96,
    minSegmentRadius = 18,
    astarMaxMs = 20,
    astarMaxNodes = 12000,
    astarMaxCost = 9000,
    allowGoalRadius = 1,
    hardStuckReplanAt = 24,
    hardStuckEscapeAt = 36,
    forceReplanCooldown = 10,
    panicPopAt = 55,
    panicPopEvery = 8,
  } = opts ?? {};

  const dim = player.dimension;

  const ctrl = {
    goal: { ...finalGoal },
    path: [],
    i: 0,
    segRadius: segmentRadius,
    lastPlanTick: -999999,
    lastForcedReplanTick: -999999,
    planFails: 0,
    tick: 0,
    lastPos: { x: player.location.x, z: player.location.z },
    stuckTicks: 0,
    hopCd: 0,
    moveIntervalId: 0,
    fallbackYaw: 0,
  };

  function remaining() {
    return Math.max(0, ctrl.path.length - ctrl.i);
  }

  function debug(msg) {
    if (ctrl.tick % 40 !== 0) return;
    player.sendMessage(msg);
  }

  function clearPath() {
    ctrl.path = [];
    ctrl.i = 0;
  }

  function forceReplan(reason = "") {
    if (ctrl.tick - ctrl.lastForcedReplanTick < forceReplanCooldown) return false;
    ctrl.lastForcedReplanTick = ctrl.tick;
    clearPath();
    ctrl.segRadius = Math.max(minSegmentRadius, Math.floor(ctrl.segRadius * 0.65));
    if (reason) debug(`Replan: ${reason} radius=${ctrl.segRadius}`);
    return true;
  }

  function planFrom(currentStart, force = false) {
    if (!force && ctrl.tick - ctrl.lastPlanTick < planEveryTicks) return false;
    ctrl.lastPlanTick = ctrl.tick;
    if (!force && remaining() > extendWhenLeft) return false;

    const segRadius = Math.max(minSegmentRadius, Math.min(segmentRadius, ctrl.segRadius));
    const planTargets = [];
    const lookahead = computeLookaheadTarget(currentStart, ctrl.goal, segRadius);
    planTargets.push(findGoalAnchor(dim, lookahead) ?? lookahead);

    const shouldEscape = ctrl.goal.y > currentStart.y + 2 && (ctrl.planFails > 0 || ctrl.stuckTicks > 0);
    if (shouldEscape) {
      for (const candidate of findEscapeAnchors(dim, currentStart, ctrl.goal, Math.min(14, segRadius)).slice(0, 10)) {
        planTargets.push(candidate);
      }
    }

    planTargets.push(findGoalAnchor(dim, ctrl.goal) ?? ctrl.goal);

    let seg = null;
    for (const target of planTargets) {
      seg = aStar(dim, currentStart, target, {
        maxNodes: astarMaxNodes,
        maxCost: astarMaxCost,
        maxMs: astarMaxMs,
        goalRadius: allowGoalRadius,
        allowPartial: true,
      });
      if (seg && seg.length >= 2) break;
    }

    if (!seg || seg.length < 2) {
      ctrl.planFails++;
      ctrl.segRadius = Math.max(minSegmentRadius, Math.floor(ctrl.segRadius * 0.75));
      if (ctrl.planFails % 3 === 1) debug(`Planner failed; radius=${ctrl.segRadius}`);
      return false;
    }

    ctrl.planFails = 0;
    ctrl.segRadius = Math.min(segmentRadius, ctrl.segRadius + 8);
    ctrl.path = compressPath(dim, seg);
    ctrl.i = 0;
    return true;
  }

  function ensurePath() {
    const currentStart = floorVec3(player.location);
    if (ctrl.path.length === 0 || ctrl.i >= ctrl.path.length) {
      return planFrom(currentStart, true);
    }

    const currentTarget = ctrl.path[ctrl.i];
    if (!currentTarget) return planFrom(currentStart, true);

    const dist = dist3D(currentStart, currentTarget);
    if (dist > 8) {
      return planFrom(currentStart, true);
    }

    if (ctrl.i > 0) {
      const prev = ctrl.path[ctrl.i - 1];
      if (prev && lineClear(dim, currentStart, currentTarget)) {
        while (ctrl.i + 1 < ctrl.path.length && lineClear(dim, currentStart, ctrl.path[ctrl.i + 1])) {
          ctrl.i++;
        }
      }
    }

    return planFrom(currentStart, false);
  }

  function nearestProgressIndex(currentPos) {
    let bestIndex = ctrl.i;
    let bestDistance = Infinity;
    for (let idx = ctrl.i; idx < Math.min(ctrl.path.length, ctrl.i + 12); idx++) {
      const node = ctrl.path[idx];
      const d = dist2D(currentPos, node);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = idx;
      }
    }
    return bestIndex;
  }

  ensurePath();

  ctrl.moveIntervalId = system.runInterval(() => {
    ctrl.tick++;

    try {
      if (player?.isValid && !player.isValid()) {
        stopKb(player);
        return;
      }
    } catch {}

    const pos = player.location;
    const goal = ctrl.goal;
    const goalDeltaX = (goal.x + 0.5) - pos.x;
    const goalDeltaZ = (goal.z + 0.5) - pos.z;
    const goalDist = Math.hypot(goalDeltaX, goalDeltaZ);
    const goalYaw = Math.atan2(goalDeltaZ, goalDeltaX);
    ctrl.fallbackYaw = goalYaw;

    if (goalDist <= 1.2 && Math.abs(Math.floor(pos.y) - goal.y) <= 1) {
      stopKb(player);
      player.sendMessage("Arrived.");
      return;
    }

    ensurePath();

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
        forceReplan("escape");
      }
    }

    if (ctrl.stuckTicks >= panicPopAt && ctrl.tick % panicPopEvery === 0) {
      panicPop(player, goalYaw, 0.14, 1.65);
      return;
    }

    if (ctrl.path.length > 0 && ctrl.i < ctrl.path.length) {
      ctrl.i = nearestProgressIndex(pos);
      while (ctrl.i < ctrl.path.length) {
        const node = ctrl.path[ctrl.i];
        const targetY = node.y;
        const steppingDown = targetY < Math.floor(pos.y);
        const targetDist = steppingDown ? Math.max(arriveDist, descendArriveDist) : arriveDist;
        const d = dist2D(pos, node);
        if (d <= targetDist) ctrl.i++;
        else break;
      }
      if (ctrl.i >= ctrl.path.length) return;
    }

    const curFeetY = Math.floor(pos.y);
    let target;
    let targetNodeY;
    let havePath = ctrl.path.length > 0 && ctrl.i < ctrl.path.length;

    if (havePath) {
      let furthest = ctrl.i;
      for (let idx = ctrl.i + 1; idx < Math.min(ctrl.path.length, ctrl.i + 8); idx++) {
        if (!lineClear(dim, floorVec3(pos), ctrl.path[idx])) break;
        furthest = idx;
      }
      if (furthest !== ctrl.i) ctrl.i = furthest;

      const node = ctrl.path[ctrl.i];
      target = { x: node.x + 0.5, z: node.z + 0.5 };
      targetNodeY = node.y;
    } else {
      const look = computeLookaheadTarget(floorVec3(pos), ctrl.goal, ctrl.segRadius);
      const preferYaw = ctrl.goal.y > curFeetY + 2 ? goalYaw + Math.PI : goalYaw;
      const step = pickLocalStep(dim, pos, { x: look.x, z: look.z }, preferYaw, 1);
      if (!step) {
        forceReplan("fallback");
        return;
      }
      target = { x: step.x + 0.5, z: step.z + 0.5 };
      targetNodeY = step.y;
      havePath = false;
    }

    let dx = target.x - pos.x;
    let dz = target.z - pos.z;
    let dist = Math.hypot(dx, dz);
    if (dist < 0.0001) return;
    dx /= dist;
    dz /= dist;

    const dy = (targetNodeY ?? curFeetY) - curFeetY;
    const steppingUp = dy > 0;
    const steppingDown = dy < 0;
    const onGround = isOnGroundLike(player);
    const scale = clamp(dist / 1.25, 0.25, 1);

    const airborneDescend = steppingDown && !onGround;
    if (airborneDescend) {
      if (airborneNudgeEvery > 0 && ctrl.tick % airborneNudgeEvery !== 0) return;
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
    const shouldHop = havePath && !steppingDown && ctrl.hopCd === 0 && (steppingUp || ctrl.stuckTicks >= stuckWindow);
    const verticalStrength = shouldHop ? hopStrength : 0;
    if (shouldHop) {
      ctrl.hopCd = hopCooldown;
      if (ctrl.stuckTicks >= stuckWindow) ctrl.stuckTicks = 0;
    }

    try {
      player.applyKnockback({ x: dx * force, z: dz * force }, verticalStrength);
    } catch (error) {
      stopKb(player);
      player.sendMessage(`Knockback failed: ${String(error)}`);
    }
  }, tickDelay);

  activeKb.set(player.id, ctrl);
}

export const pathCommand = {
  name: "path",
  minRank: 1,
  usage: ":path <x> <y> <z> [speed] | :path stop",
  description: "Guides you toward XYZ with smarter path planning and recovery.",
  examples: [":path 100 64 -30", ":path 100 64 -30 0.25", ":path stop"],

  execute({ player, args }) {
    const sub = (args[0] ?? "").toLowerCase();
    if (sub === "stop" || sub === "cancel") {
      stopKb(player);
      player.sendMessage("Stopped path run.");
      return;
    }

    const xyz = parseXYZ(args);
    if (!xyz) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const speed = clamp(Number(args[3] ?? 0.35) || 0.35, 0.05, 1.2);
    const goal = { x: Math.floor(xyz.x), y: Math.floor(xyz.y), z: Math.floor(xyz.z) };

    player.sendMessage(`Planning path to ${goal.x} ${goal.y} ${goal.z}...`);
    startStreamingPath(player, goal, {
      tickDelay: 1,
      speed,
      segmentRadius: 96,
      minSegmentRadius: 18,
      planEveryTicks: 8,
      extendWhenLeft: 10,
      astarMaxMs: 20,
      astarMaxNodes: 12000,
      astarMaxCost: 9000,
      allowGoalRadius: 1,
      hardStuckReplanAt: 24,
      hardStuckEscapeAt: 36,
      panicPopAt: 55,
      panicPopEvery: 8,
    });
  },
};
