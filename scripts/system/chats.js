
import { system, world } from "@minecraft/server";
import { handleCommandMessage } from "../commands/index.js";

function getStringProp(p, key) {
  try {
    const v = p.getDynamicProperty(key);
    return typeof v === "string" && v.length ? v : null;
  } catch {
    return null;
  }
}



function getChatName(player) {
  const forced = getStringProp(player, "acname");
  if (!forced) return player.name;
  return forced.replace(/^§r/, "");
}

export function handleChatMessage(event) {
  const player = event.sender;
  const msg = event.message;

  if (!msg) return;

  
  if (msg.startsWith(".")) {
    event.cancel = true;
    system.run(() => handleCommandMessage(player, msg));
    return;
  }
  if (msg.startsWith(":")) {
    
    system.run(() => handleCommandMessage(player, msg));
    return;
  }
  
  event.cancel = true;

  const name = getChatName(player);
  world.sendMessage(`[${name}]: ${msg}`);
}

export function startChatSystem() {
  world.beforeEvents.chatSend.subscribe(handleChatMessage);
}
