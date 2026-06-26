import { system, world } from "@minecraft/server";

const PET_INTERVAL_TICKS = 5;
const PET_FOLLOW_DISTANCE = 8;
const PET_MARKER_TAG = "ac_pet";

function makeOwnerTag(playerId) {
  const safe = String(playerId ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `ac_pet_owner_${safe}`;
}

export function getPetOwnerTag(player) {
  return makeOwnerTag(player?.id);
}

export function markEntityAsPet(entity, player) {
  const ownerTag = getPetOwnerTag(player);
  try {
    entity.addTag(PET_MARKER_TAG);
  } catch {}
  try {
    entity.addTag(ownerTag);
  } catch {}
}

export function unmarkEntityAsPet(entity, player) {
  const ownerTag = getPetOwnerTag(player);
  try {
    entity.removeTag(ownerTag);
  } catch {}
  try {
    entity.removeTag(PET_MARKER_TAG);
  } catch {}
}

function isPlayerOnGround(player) {
  try {
    return player.isOnGround === true;
  } catch {
    return false;
  }
}

function petTeleportLocation(player, index) {
  const base = player.location;
  const angle = (Math.PI * 2 * index) / 6;
  const distance = 1.5 + (index % 2) * 0.75;
  return {
    x: base.x + Math.cos(angle) * distance,
    y: base.y,
    z: base.z + Math.sin(angle) * distance,
  };
}

function tickPets() {
  for (const player of world.getAllPlayers()) {
    if (!isPlayerOnGround(player)) continue;

    let pets = [];
    try {
      pets = player.dimension.getEntities({
        tags: [PET_MARKER_TAG, getPetOwnerTag(player)],
      });
    } catch {
      continue;
    }

    let index = 0;
    for (const pet of pets) {
      if (!pet) continue;

      let distance = 0;
      try {
        distance = player.location.distance?.(pet.location) ?? Math.hypot(
          (pet.location?.x ?? 0) - player.location.x,
          (pet.location?.y ?? 0) - player.location.y,
          (pet.location?.z ?? 0) - player.location.z,
        );
      } catch {
        distance = 0;
      }

      if (!(distance > PET_FOLLOW_DISTANCE)) {
        index++;
        continue;
      }

      try {
        pet.teleport(petTeleportLocation(player, index), {
          dimension: player.dimension,
        });
      } catch {}
      index++;
    }
  }
}

export function startPetSystem() {
  system.runInterval(tickPets, PET_INTERVAL_TICKS);
}
