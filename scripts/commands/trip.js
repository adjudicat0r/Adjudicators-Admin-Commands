import { selectPlayers } from "../lib/selectors.js";

function setTripState(target, enabled) {
  try {
    target.setDynamicProperty("actrip", enabled);
    return true;
  } catch {
    return false;
  }
}

function runTripToggle({ player, args, enabled }) {
  const selector = args[0] ?? "me";
  const targets = selectPlayers(player, selector);

  if (!targets.length) {
    player.sendMessage(`No targets matched: ${selector}`);
    return;
  }

  let count = 0;
  for (const target of targets) {
    if (!setTripState(target, enabled)) continue;

    if (!enabled) {
      try {
        target.runCommand?.("camera @s fov_clear");
      } catch {}
    }
    count++;
  }

  player.sendMessage(
    enabled
      ? `Tripped ${count} player(s).`
      : `Untripped ${count} player(s).`
  );
}

export const tripCommand = {
  name: "trip",
  minRank: 3,
  usage: ":trip <selector>",
  description: "wacky visuals!",
  examples: [":trip me", ":trip others", ":trip all"],

  execute({ player, args }) {
    runTripToggle({ player, args, enabled: true });
  },
};

export const untripCommand = {
  name: "untrip",
  minRank: 3,
  usage: ":untrip <selector>",
  description: "wacky visuals!",
  examples: [":untrip me", ":untrip others", ":untrip all"],

  execute({ player, args }) {
    runTripToggle({ player, args, enabled: false });
  },
};
