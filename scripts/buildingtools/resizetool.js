
import { ModalFormData } from "@minecraft/server-ui";
import { pushAction } from "./history.js";

const MAX_SIDE = 50;
const MAX_AFFECTED = 4000;

const X = ["left", "middle", "right"];
const Y = ["bottom", "center", "top"];
const Z = ["back", "center", "front"];

const ANCHORS = [];
for (const y of Y) for (const x of X) for (const z of Z) {
  ANCHORS.push({ label: `${y} ${x} ${z}`, x, y, z });
}

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

function snapshotPerm(block) {
  const perm = block.permutation;
  return {
    typeId: block.typeId,
    states: perm.getAllStates(),
  };
}

export async function handleResizeToolBlock(player, block) {
  try {
    if (!block) return;

    const dim = block.dimension;
    const base = block.location;

    const form = new ModalFormData()
      .title("Resize tool")
      
      .dropdown(
        "Anchor (clicked block position)",
        ANCHORS.map(a => a.label),
        { defaultValueIndex: 0 }
      )
      .textField("Length (X)", `1-${MAX_SIDE}`, { defaultValue: "10" })
      .textField("Width (Z)", `1-${MAX_SIDE}`, { defaultValue: "10" })
      .textField("Depth/Height (Y)", `1-${MAX_SIDE}`, { defaultValue: "10" });

    const res = await form.show(player);
    if (res.canceled) return;

    const anchor = ANCHORS[Number(res.formValues?.[0] ?? 0)] ?? ANCHORS[0];

    const L = clampInt(res.formValues?.[1], 1, MAX_SIDE, 10); 
    const W = clampInt(res.formValues?.[2], 1, MAX_SIDE, 10); 
    const H = clampInt(res.formValues?.[3], 1, MAX_SIDE, 10); 

    const total = L * W * H;
    if (total > MAX_AFFECTED) {
      player.sendMessage(`Too many blocks (${total}). Max per action is ${MAX_AFFECTED}.`);
      return;
    }

    const ax = anchorIndex(anchor.x, L);
    const ay = anchorIndex(anchor.y, H);
    const az = anchorIndex(anchor.z, W);

    const minX = base.x - ax;
    const minY = base.y - ay;
    const minZ = base.z - az;

    
    const after = snapshotPerm(block);
    const afterPerm = block.permutation; 

    
    const blocks = [];
    for (let dx = 0; dx < L; dx++) {
      for (let dy = 0; dy < H; dy++) {
        for (let dz = 0; dz < W; dz++) {
          const pos = { x: minX + dx, y: minY + dy, z: minZ + dz };
          const b = dim.getBlock(pos);
          if (!b) continue;

          blocks.push({
            x: pos.x, y: pos.y, z: pos.z,
            before: snapshotPerm(b),
          });
        }
      }
    }

    
    let placed = 0;
    for (const e of blocks) {
      const b = dim.getBlock({ x: e.x, y: e.y, z: e.z });
      if (!b) continue;

      try {
        if (b.typeId !== after.typeId) b.setType(after.typeId);
        b.setPermutation(afterPerm);
        placed++;
      } catch {
        
      }
    }

    
    const action = {
      kind: "resize",
      dim: dim.id,
      after,
      blocks,
    };

    const saved = pushAction(player, action);
    if (!saved) {
      player.sendMessage("Resize done, but undo history could not be saved (dynamic property not registered / too small).");
      return;
    }

    player.sendMessage(`Resize tool: filled ${placed} block(s).`);
  } catch (e) {
    player.sendMessage(`Resize tool error: ${String(e)}`);
  }
}
