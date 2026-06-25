
import { ModalFormData } from "@minecraft/server-ui";
import { BlockPermutation } from "@minecraft/server";
import { pushAction } from "./history.js";

const MAX_AFFECTED = 4000;

const X = ["left", "middle", "right"];
const Y = ["bottom", "center", "top"];
const Z = ["back", "center", "front"];

const ANCHORS = [];
for (const y of Y) for (const x of X) for (const z of Z) {
  ANCHORS.push({ label: `${y} ${x} ${z}`, x, y, z });
}

const ROT_LABELS = ["0", "90", "180", "270"];

const state = new Map(); 

function anchorIndex(mode, size) {
  if (size <= 1) return 0;
  if (mode === "left" || mode === "bottom" || mode === "back") return 0;
  if (mode === "right" || mode === "top" || mode === "front") return size - 1;
  return Math.floor((size - 1) / 2);
}

function snapshotBlock(block) {
  const perm = block.permutation;
  return { typeId: block.typeId, states: perm.getAllStates() };
}

function applySnapshot(block, snap) {
  try {
    if (block.typeId !== snap.typeId) block.setType(snap.typeId);
  } catch {
    return false;
  }
  try {
    const perm = BlockPermutation.resolve(snap.typeId, snap.states ?? {});
    block.setPermutation(perm);
    return true;
  } catch {
    return false;
  }
}

function rotateXZ(x, z, L, W, rot) {
  switch (rot) {
    case 90:  return { x: z,           z: (L - 1 - x) };
    case 180: return { x: (L - 1 - x), z: (W - 1 - z) };
    case 270: return { x: (W - 1 - z), z: x };
    default:  return { x, z };
  }
}

function rotatedDims(L, W, rot) {
  return (rot === 90 || rot === 270) ? { L: W, W: L } : { L, W };
}



function rotateStates(states, rot) {
  if (!states || rot === 0) return states;

  const s = { ...states };

  if (typeof s["minecraft:cardinal_direction"] === "string") {
    const map = {
      0:   { north: "north", east: "east", south: "south", west: "west" },
      90:  { north: "east",  east: "south", south: "west",  west: "north" },
      180: { north: "south", east: "west",  south: "north", west: "east" },
      270: { north: "west",  east: "north", south: "east",  west: "south" },
    }[rot];
    const v = s["minecraft:cardinal_direction"];
    if (map && map[v]) s["minecraft:cardinal_direction"] = map[v];
  }

  if (typeof s["facing_direction"] === "number") {
    const v = s["facing_direction"];
    const map = {
      0:   { 2:2, 3:3, 4:4, 5:5 },
      90:  { 2:5, 5:3, 3:4, 4:2 },
      180: { 2:3, 3:2, 4:5, 5:4 },
      270: { 2:4, 4:3, 3:5, 5:2 },
    }[rot];
    if (map && map[v] !== undefined) s["facing_direction"] = map[v];
  }

  if (typeof s["weirdo_direction"] === "number") {
    const v = s["weirdo_direction"];
    const add = rot === 90 ? 1 : rot === 180 ? 2 : rot === 270 ? 3 : 0;
    s["weirdo_direction"] = (v + add) % 4;
  }

  return s;
}

export function handleCloneToolClick(player, block) {
  if (!block) return;

  const pid = player.id;
  const st = state.get(pid) ?? { stage: 0 };

  if (st.stage === 0) {
    st.stage = 1;
    st.a = { dimId: block.dimension.id, loc: block.location };
    state.set(pid, st);
    player.sendMessage("Clone: corner A set. Click corner B.");
    return;
  }

  if (st.stage === 1) {
    st.stage = 2;
    st.b = { dimId: block.dimension.id, loc: block.location };
    state.set(pid, st);

    player.sendMessage("Clone: corner B set. Choose options...");
    void showCloneOptions(player);
    return;
  }

  if (st.stage === 3) {
    void pasteNow(player, block);
    return;
  }

  
}

async function showCloneOptions(player) {
  const pid = player.id;
  const st = state.get(pid);
  if (!st || st.stage !== 2) return;

  const form = new ModalFormData()
    .title("Clone tool")
    .dropdown(
      "Source anchor (what A/B box point equals your destination anchor)",
      ANCHORS.map((a) => a.label),
      { defaultValueIndex: 0 }
    )
    .dropdown(
      "Destination anchor (clicked block position)",
      ANCHORS.map((a) => a.label),
      { defaultValueIndex: 0 }
    )
    .dropdown("Rotation (Y axis)", ROT_LABELS, { defaultValueIndex: 0 });

  const res = await form.show(player);
  if (res.canceled) {
    state.delete(pid);
    return;
  }

  const srcAnchor = ANCHORS[Number(res.formValues?.[0] ?? 0)] ?? ANCHORS[0];
  const dstAnchor = ANCHORS[Number(res.formValues?.[1] ?? 0)] ?? ANCHORS[0];
  const rot = [0, 90, 180, 270][Number(res.formValues?.[2] ?? 0)] ?? 0;

  st.opts = { srcAnchor, dstAnchor, rot };
  st.stage = 3;
  state.set(pid, st);

  player.sendMessage("Clone: now click the destination anchor block to paste.");
}

function snapshotsEqual(a, b) {
  if (!a || !b) return false;
  if (a.typeId !== b.typeId) return false;

  const as = a.states ?? {};
  const bs = b.states ?? {};
  const ak = Object.keys(as);
  const bk = Object.keys(bs);
  if (ak.length !== bk.length) return false;

  for (const k of ak) {
    if (as[k] !== bs[k]) return false;
  }
  return true;
}

async function pasteNow(player, destBlock) {
  const pid = player.id;
  const st = state.get(pid);
  if (!st || st.stage !== 3) return;

  try {
    const a = st.a,
      b = st.b,
      opts = st.opts;
    if (!a || !b || !opts) return;

    const dim = destBlock.dimension;

    const ax = a.loc.x,
      ay = a.loc.y,
      az = a.loc.z;
    const bx = b.loc.x,
      by = b.loc.y,
      bz = b.loc.z;

    const minS = { x: Math.min(ax, bx), y: Math.min(ay, by), z: Math.min(az, bz) };
    const maxS = { x: Math.max(ax, bx), y: Math.max(ay, by), z: Math.max(az, bz) };

    const L = maxS.x - minS.x + 1; 
    const H = maxS.y - minS.y + 1; 
    const W = maxS.z - minS.z + 1; 

    const total = L * H * W;
    if (total > MAX_AFFECTED) {
      player.sendMessage(`Clone too big (${total}). Max is ${MAX_AFFECTED}.`);
      state.delete(pid);
      return;
    }

    const { L: Lr, W: Wr } = rotatedDims(L, W, opts.rot);

    const sax = anchorIndex(opts.srcAnchor.x, L);
    const say = anchorIndex(opts.srcAnchor.y, H);
    const saz = anchorIndex(opts.srcAnchor.z, W);

    const dax = anchorIndex(opts.dstAnchor.x, Lr);
    const day = anchorIndex(opts.dstAnchor.y, H);
    const daz = anchorIndex(opts.dstAnchor.z, Wr);

    const baseD = destBlock.location;
    const minD = { x: baseD.x - dax, y: baseD.y - day, z: baseD.z - daz };

    
    const anchorRot = rotateXZ(sax, saz, L, W, opts.rot);

    
    const destMap = new Map(); 
    let writes = 0;

    for (let x = 0; x < L; x++) {
      for (let y = 0; y < H; y++) {
        for (let z = 0; z < W; z++) {
          const srcPos = { x: minS.x + x, y: minS.y + y, z: minS.z + z };
          const srcB = dim.getBlock(srcPos);
          if (!srcB) continue;

          
          const absRot = rotateXZ(x, z, L, W, opts.rot);
          const rx = absRot.x - anchorRot.x;
          const rz = absRot.z - anchorRot.z;

          const ly = y - say;

          const dstPos = {
            x: minD.x + dax + rx,
            y: minD.y + day + ly,
            z: minD.z + daz + rz,
          };

          const dstB = dim.getBlock(dstPos);
          if (!dstB) continue;

          const key = `${dstPos.x},${dstPos.y},${dstPos.z}`;

          let rec = destMap.get(key);
          if (!rec) {
            rec = {
              x: dstPos.x,
              y: dstPos.y,
              z: dstPos.z,
              before: snapshotBlock(dstB),
              after: null,
            };
            destMap.set(key, rec);
          }

          const srcSnap = snapshotBlock(srcB);
          const after = {
            typeId: srcSnap.typeId,
            states: rotateStates(srcSnap.states, opts.rot),
          };

          rec.after = after; 

          applySnapshot(dstB, after);
          writes++;
        }
      }
    }

    
    const all = Array.from(destMap.values());
    const changed = all.filter((e) => e.after && !snapshotsEqual(e.before, e.after));

    const ok = pushAction(player, {
      kind: "clone",
      dim: dim.id,
      blocks: changed, 
    });

    player.sendMessage(
      ok
        ? `Cloned ${changed.length} block(s).`
        : `Cloned (writes: ${writes}) but UNDO SAVE FAILED (history too small).`
    );
  } catch (e) {
    player.sendMessage(`Clone tool error: ${String(e)}`);
  } finally {
    state.delete(pid);
  }
}
