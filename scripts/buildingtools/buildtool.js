
import { ModalFormData } from "@minecraft/server-ui";
import { BlockPermutation } from "@minecraft/server";
import { pushAction } from "./history.js";

const MAX_AFFECTED = 12000;
const MAX_SIDE = 128;

const X = ["left", "middle", "right"];
const Y = ["bottom", "center", "top"];
const Z = ["back", "center", "front"];

const ANCHORS = [];
for (const y of Y) for (const x of X) for (const z of Z) {
  ANCHORS.push({ label: `${y} ${x} ${z}`, x, y, z });
}

const SHAPES = [
  "Rectangular prism",
  "Circle (2D)",
  "Cylinder",
  "Sphere",
  "Pyramid",
];

const PLANES = [
  "XZ (flat on ground)",
  "XY (vertical wall)",
  "YZ (vertical wall)",
];

function anchorIndex(mode, size) {
  if (size <= 1) return 0;
  if (mode === "left" || mode === "bottom" || mode === "back") return 0;
  if (mode === "right" || mode === "top" || mode === "front") return size - 1;
  return Math.floor((size - 1) / 2);
}

function clampInt(v, min, max, fallback) {
  const n = Number(String(v ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}

function snapshotBlock(block) {
  const perm = block.permutation;
  return { typeId: block.typeId, states: perm.getAllStates() };
}

function snapshotsEqual(a, b) {
  if (!a || !b) return false;
  if (a.typeId !== b.typeId) return false;

  const as = a.states ?? {};
  const bs = b.states ?? {};
  const ak = Object.keys(as);
  const bk = Object.keys(bs);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (as[k] !== bs[k]) return false;
  return true;
}

function makeAfterSnapshot(typeId) {
  return { typeId, states: {} };
}

function resolveAfterPerm(after) {
  return BlockPermutation.resolve(after.typeId, after.states ?? {});
}

function applyWithHistory(player, dim, positions, afterPerm, afterSnap) {
  const destMap = new Map(); 

  for (const p of positions) {
    const key = `${p.x},${p.y},${p.z}`;
    if (destMap.has(key)) continue;
    const b = dim.getBlock(p);
    if (!b) continue;
    destMap.set(key, { x: p.x, y: p.y, z: p.z, before: snapshotBlock(b) });
  }

  let changed = 0;
  for (const e of destMap.values()) {
    const b = dim.getBlock({ x: e.x, y: e.y, z: e.z });
    if (!b) continue;

    if (snapshotsEqual(e.before, afterSnap)) continue;

    try {
      b.setPermutation(afterPerm);
      changed++;
    } catch {}
  }

  const blocks = Array.from(destMap.values()).filter(e => !snapshotsEqual(e.before, afterSnap));

  const ok = pushAction(player, {
    kind: "build",
    dim: dim.id,
    after: afterSnap,
    blocks,
  });

  return { ok, changed, recorded: blocks.length };
}



function genBox(L, H, W, hollow) {
  const out = [];
  for (let x = 0; x < L; x++) {
    for (let y = 0; y < H; y++) {
      for (let z = 0; z < W; z++) {
        if (hollow) {
          const boundary =
            x === 0 || x === L - 1 ||
            y === 0 || y === H - 1 ||
            z === 0 || z === W - 1;
          if (!boundary) continue;
        }
        out.push({ x, y, z });
      }
    }
  }
  return out;
}

function genCircle2D(radius, plane, hollow) {
  const d = radius * 2 + 1;
  const c = radius;
  const out = [];

  const r2 = radius * radius;
  const inner = Math.max(0, radius - 1);
  const inner2 = inner * inner;

  for (let a = 0; a < d; a++) {
    for (let b = 0; b < d; b++) {
      const da = a - c;
      const db = b - c;
      const dist2 = da * da + db * db;

      if (dist2 > r2) continue;
      if (hollow && dist2 <= inner2) continue;

      if (plane === 0) out.push({ x: a, y: 0, z: b });        
      else if (plane === 1) out.push({ x: a, y: b, z: 0 });   
      else out.push({ x: 0, y: b, z: a });                    
    }
  }
  return { rel: out, L: d, H: plane === 0 ? 1 : d, W: plane === 2 ? 1 : d };
}

function genSphere(radius, hollow) {
  const d = radius * 2 + 1;
  const c = radius;
  const out = [];

  const r2 = radius * radius;
  const inner = Math.max(0, radius - 1);
  const inner2 = inner * inner;

  for (let x = 0; x < d; x++) {
    for (let y = 0; y < d; y++) {
      for (let z = 0; z < d; z++) {
        const dx = x - c, dy = y - c, dz = z - c;
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 > r2) continue;
        if (hollow && dist2 <= inner2) continue;
        out.push({ x, y, z });
      }
    }
  }
  return { rel: out, L: d, H: d, W: d };
}

function genCylinder(radius, height, hollow) {
  const d = radius * 2 + 1;
  const c = radius;
  const out = [];

  const r2 = radius * radius;
  const inner = Math.max(0, radius - 1);
  const inner2 = inner * inner;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < d; x++) {
      for (let z = 0; z < d; z++) {
        const dx = x - c, dz = z - c;
        const dist2 = dx * dx + dz * dz;
        if (dist2 > r2) continue;

        if (hollow) {
          const side = dist2 > inner2;
          const cap = y === 0 || y === height - 1;
          if (!(side || cap)) continue;
        }

        out.push({ x, y, z });
      }
    }
  }
  return { rel: out, L: d, H: height, W: d };
}

function genPyramid(baseX, baseZ, height, hollow) {
  const out = [];
  for (let y = 0; y < height; y++) {
    const insetX = Math.floor((y * baseX) / (2 * height));
    const insetZ = Math.floor((y * baseZ) / (2 * height));

    const x0 = insetX;
    const x1 = baseX - 1 - insetX;
    const z0 = insetZ;
    const z1 = baseZ - 1 - insetZ;

    if (x0 > x1 || z0 > z1) continue;

    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (hollow) {
          const boundary =
            y === 0 || y === height - 1 ||
            x === x0 || x === x1 ||
            z === z0 || z === z1;
          if (!boundary) continue;
        }
        out.push({ x, y, z });
      }
    }
  }
  return { rel: out, L: baseX, H: height, W: baseZ };
}



export async function handleBuildToolBlock(player, block) {
  try {
    if (!block) return;

    const dim = block.dimension;
    const base = block.location;

    const form = new ModalFormData()
      .title("Build tool")
      .textField("Block typeId", "minecraft:stone", { defaultValue: "minecraft:stone" })
      .dropdown("Shape", SHAPES, { defaultValueIndex: 0 })
      .dropdown("Anchor (clicked block position in bounding box)", ANCHORS.map(a => a.label), { defaultValueIndex: 13 })
      
      .toggle("Hollow", { defaultValue: false })
      .textField("Size A", "varies by shape", { defaultValue: "10" })
      .textField("Size B", "varies by shape", { defaultValue: "10" })
      .textField("Size C", "varies by shape", { defaultValue: "10" })
      .dropdown("Circle plane (only for Circle)", PLANES, { defaultValueIndex: 0 });

    const res = await form.show(player);
    if (res.canceled) return;

    const typeId = String(res.formValues?.[0] ?? "").trim();
    const shapeIdx = Number(res.formValues?.[1] ?? 0);
    const anchor = ANCHORS[Number(res.formValues?.[2] ?? 13)] ?? ANCHORS[13];
    const hollow = Boolean(res.formValues?.[3] ?? false);

    const A = clampInt(res.formValues?.[4], 1, MAX_SIDE, 10);
    const B = clampInt(res.formValues?.[5], 1, MAX_SIDE, 10);
    const C = clampInt(res.formValues?.[6], 1, MAX_SIDE, 10);
    const plane = Number(res.formValues?.[7] ?? 0);

    let afterPerm;
    const afterSnap = makeAfterSnapshot(typeId);
    try {
      afterPerm = resolveAfterPerm(afterSnap);
    } catch {
      player.sendMessage(`Invalid block typeId: ${typeId}`);
      return;
    }

    let relPoints = [];
    let L = 1, H = 1, W = 1;

    const shape = SHAPES[shapeIdx] ?? SHAPES[0];

    if (shape === "Rectangular prism") {
      L = A; H = B; W = C;
      relPoints = genBox(L, H, W, hollow);
    } else if (shape === "Circle (2D)") {
      const radius = clampInt(A, 1, 64, 6);
      const r = genCircle2D(radius, plane, hollow);
      relPoints = r.rel; L = r.L; H = r.H; W = r.W;
    } else if (shape === "Cylinder") {
      const radius = clampInt(A, 1, 64, 6);
      const height = clampInt(B, 1, MAX_SIDE, 10);
      const r = genCylinder(radius, height, hollow);
      relPoints = r.rel; L = r.L; H = r.H; W = r.W;
    } else if (shape === "Sphere") {
      const radius = clampInt(A, 1, 64, 6);
      const r = genSphere(radius, hollow);
      relPoints = r.rel; L = r.L; H = r.H; W = r.W;
    } else if (shape === "Pyramid") {
      const baseX = A;
      const baseZ = B;
      const height = clampInt(C, 1, MAX_SIDE, 10);
      const r = genPyramid(baseX, baseZ, height, hollow);
      relPoints = r.rel; L = r.L; H = r.H; W = r.W;
    }

    const ax = anchorIndex(anchor.x, L);
    const ay = anchorIndex(anchor.y, H);
    const az = anchorIndex(anchor.z, W);

    const minX = base.x - ax;
    const minY = base.y - ay;
    const minZ = base.z - az;

    const positions = [];
    for (const p of relPoints) {
      positions.push({ x: minX + p.x, y: minY + p.y, z: minZ + p.z });
    }

    if (positions.length > MAX_AFFECTED) {
      player.sendMessage(`Too many blocks (${positions.length}). Max is ${MAX_AFFECTED}.`);
      return;
    }

    const { ok, changed, recorded } = applyWithHistory(player, dim, positions, afterPerm, afterSnap);

    player.sendMessage(
      ok
        ? `Built: ${changed} changed (recorded ${recorded}).`
        : `Built: ${changed} changed, but history save FAILED (history too small).`
    );
  } catch (e) {
    player.sendMessage(`Build tool error: ${String(e)}`);
  }
}
