
import { selectPlayers } from "../lib/selectors.js";

function randUnitXZ() {
  const a = Math.random() * Math.PI * 2;
  return { x: Math.cos(a), z: Math.sin(a) };
}

export const flingCommand = {
  name: "fling",
  minRank: 3, 
  usage: ":fling <selector> <power>",
  description: "Applies knockback in a random horizontal direction to selectors.",
  examples: [":fling me 2", ":fling others 4"],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const power = Number(args[1]);

    if (!Number.isFinite(power) || power <= 0) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (targets.length === 0) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    
    const h = Math.min(power, 10);                 
    const v = Math.min(Math.max(power * 0.35, 0), 3.5); 

    let count = 0;
    for (const p of targets) {
      try {
        const d = randUnitXZ();
        p.applyKnockback({ x: d.x * h, z: d.z * h }, v);
        count++;
      } catch {}
    }

    player.sendMessage(`Flinged ${count} player(s) with power ${h}.`);
  },
};
