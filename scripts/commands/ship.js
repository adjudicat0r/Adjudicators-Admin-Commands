import { world } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";

const S = "\u00A7";
const SHIP_LINES = [
  { max: 9, text: "This is not going to work at all" },
  { max: 19, text: "Very rough start" },
  { max: 29, text: "Not much chemistry here" },
  { max: 39, text: "A shaky connection" },
  { max: 49, text: "Maybe on a good day" },
  { max: 59, text: "There is some potential" },
  { max: 69, text: "A decent match" },
  { max: 79, text: "This could actually work" },
  { max: 89, text: "Strong compatibility" },
  { max: 99, text: "Very strong pairing" },
  { max: 100, text: "Perfect match" },
];

function getTargetLabel(target) {
  try {
    const nameTag = String(target?.nameTag ?? "").trim();
    if (nameTag) return nameTag;
  } catch {}

  try {
    const name = String(target?.name ?? "").trim();
    if (name) return name;
  } catch {}

  const typeId = String(target?.typeId ?? "target");
  return typeId.replace(/^minecraft:/, "");
}

function getShipLine(percent) {
  return SHIP_LINES.find((entry) => percent <= entry.max)?.text ?? "Unknown result";
}

function getShipColor(percent) {
  if (percent >= 90) return `${S}6`;
  if (percent >= 80) return `${S}d`;
  if (percent >= 70) return `${S}a`;
  if (percent >= 60) return `${S}2`;
  if (percent >= 50) return `${S}b`;
  if (percent >= 40) return `${S}e`;
  if (percent >= 30) return `${S}6`;
  if (percent >= 20) return `${S}c`;
  if (percent >= 10) return `${S}4`;
  return `${S}8`;
}

function buildBar(percent) {
  const filled = Math.max(1, Math.ceil(percent / 10));
  const parts = [];
  for (let index = 0; index < 10; index++) {
    parts.push(index < filled ? "|" : " ");
  }
  return `[${parts.join("")}]`;
}

export const shipCommand = {
  name: "ship",
  minRank: 0,
  usage: ":ship <target1> <target2>",
  description: "Rates the compatibility between two targets.",
  examples: [
    ":ship me others",
    ":ship steve alex",
    ":ship entity:cow entity:sheep",
  ],

  execute({ player, args }) {
    const rawA = String(args[0] ?? "").trim();
    const rawB = String(args[1] ?? "").trim();

    if (!rawA || !rawB) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const first = selectPlayers(player, rawA)[0];
    const second = selectPlayers(player, rawB)[0];

    if (!first) {
      player.sendMessage(`No targets matched: ${rawA}`);
      return;
    }
    if (!second) {
      player.sendMessage(`No targets matched: ${rawB}`);
      return;
    }

    const percent = 1 + Math.floor(Math.random() * 100);
    const color = getShipColor(percent);
    const firstName = getTargetLabel(first);
    const secondName = getTargetLabel(second);
    const line = getShipLine(percent);
    const bar = buildBar(percent);

    world.sendMessage(`${color}[SHIP]${S}r ${color}${firstName}${S}r + ${color}${secondName}${S}r`);
    world.sendMessage(`${color}${bar} ${percent}% compatibility${S}r`);
    world.sendMessage(`${color}${line}${S}r`);
  },
};
