
import { selectPlayers } from "../lib/selectors.js";

const PARTICLES = [
  "minecraft:huge_explosion_emitter",
  "minecraft:explosion_emitter",
  "minecraft:explosion_particle",
  "minecraft:dragon_breath_trail",
  "minecraft:endrod",
  "minecraft:lava_particle",
  "minecraft:portal_directional",
  "minecraft:campfire_smoke_particle",
  "minecraft:large_smoke",
  "minecraft:smoke",
  "minecraft:totem_particle",
  "minecraft:critical_hit_emitter",
  "minecraft:mobspell_emitter",
  "minecraft:ink_emitter",
  "minecraft:heart_particle",
  "minecraft:soul_particle",
  "minecraft:sculk_charge_particle",
  "minecraft:sculk_soul_particle",
];

function getLoc(p) {
  
  try {
    if (p.location) return p.location;
  } catch {}
  
  try {
    if (p.pos) return p.pos;
  } catch {}
  
  try {
    if (typeof p.getHeadLocation === "function") return p.getHeadLocation();
  } catch {}
  return undefined;
}

function trySpawnForTarget(target, particle, loc) {
  
  try {
    if (typeof target.spawnParticle === "function") {
      target.spawnParticle(particle, loc);
      return true;
    }
  } catch {}

  
  try {
    const dim = target.dimension;
    if (dim && typeof dim.spawnParticle === "function") {
      dim.spawnParticle(particle, loc);
      return true;
    }
  } catch {}

  return false;
}

function captureSpawnError(target, particle, loc) {
  
  try {
    target.spawnParticle(particle, loc);
    return null;
  } catch (e) {
    return String(e?.message ?? e);
  }

  
}

export const stresstestCommand = {
  name: "stresstest",
  minRank: 3, 
  usage: ":stresstest <selector> <power>",
  description:
    "Stress test: spawns EVERY particle in the list for EACH iteration of power.",
  examples: [":stresstest me 5", ":stresstest all 100"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const power = Number(args[1]);

    if (!Number.isFinite(power) || power <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let attempts = 0;
    let ok = 0;
    let firstErr = null;

    for (const t of targets) {
      const loc = getLoc(t);
      if (!loc) continue;

      for (let i = 0; i < power; i++) {
        for (const particle of PARTICLES) {
          attempts++;
          const success = trySpawnForTarget(t, particle, loc);
          if (success) {
            ok++;
          } else if (!firstErr) {
            
            firstErr = captureSpawnError(t, particle, loc) ?? "spawn failed (unknown)";
          }
        }
      }
    }

    if (ok === 0 && firstErr) {
      player.sendMessage(
        `STRESSTEST: 0/${attempts} spawned. First error: ${firstErr}`
      );
      return;
    }

    player.sendMessage(
      `STRESSTEST: spawned ${ok}/${attempts} (${PARTICLES.length} particles × ${power} power × ${targets.length} player(s))`
    );
  },
};
