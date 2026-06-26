import { system, world } from "@minecraft/server";

const TRIP_INTERVAL_TICKS = 20;

function isTripping(player) {
  try {
    return player.getDynamicProperty("actrip") === true;
  } catch {
    return false;
  }
}

function tickTrip() {
  for (const player of world.getAllPlayers()) {
    if (!isTripping(player)) continue;

    try {
      player.runCommand?.("camera @s fov_set 30 1 in_bounce");
    } catch {}

    system.runTimeout(() => {
      if (!isTripping(player)) return;
      try {
        player.runCommand?.("camera @s fov_set 110");
      } catch {}
    }, TRIP_INTERVAL_TICKS - 1);
  }
}

export function startTripSystem() {
  system.runInterval(tickTrip, TRIP_INTERVAL_TICKS);
}
