
import { ActionFormData } from "@minecraft/server-ui";
import { undoLast, redoLast } from "./history.js";

const uiLock = new Set(); 

export function handleHistoryToolUse(player) {
  if (uiLock.has(player.id)) return;
  uiLock.add(player.id);

  Promise.resolve(showHistoryMenu(player))
    .finally(() => uiLock.delete(player.id));
}

async function showHistoryMenu(player) {
  const form = new ActionFormData()
    .title("History tool")
    .body("Undo/redo your last build actions (max 10).")
    .button("Undo")
    .button("Redo")
    .button("Close");

  const res = await form.show(player);
  if (res.canceled) return;

  if (res.selection === 0) {
    const r = undoLast(player);
    player.sendMessage(r.msg);
    return;
  }

  if (res.selection === 1) {
    const r = redoLast(player);
    player.sendMessage(r.msg);
    return;
  }
}
