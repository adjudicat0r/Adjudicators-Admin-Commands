import { world, system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";

export const propsCommand = {
  name: "props",
  minRank: 4,
  usage: ":props",
  description: "Opens a UI to view dynamic properties on the world and players.",
  examples: [
    ":props",
  ],


  async execute({ player }) {
    try {
      const nav = createNavigator(player);
      await nav.push(screenHome(nav));
    } catch (e) {
      player.sendMessage(`UI error: ${e?.message ?? e}`);
    }
  },
};







function forceOpen(player, form) {
  return new Promise((resolve) => {
    const tryShow = () => {
      system.run(() => {
        form
          .show(player)
          .then((res) => {
            if (res?.canceled && isUserBusy(res)) {
              system.runTimeout(tryShow, 2);
              return;
            }
            resolve(res);
          })
          .catch((error) => {
            console.warn("Error showing form:", error);
            resolve(undefined);
          });
      });
    };

    tryShow();
  });
}

function isUserBusy(res) {
  const r = res?.cancelationReason;

  
  if (r === FormCancelationReason?.userBusy) return true;
  if (r === FormCancelationReason?.UserBusy) return true;

  
  if (typeof r === "string") {
    const s = r.toLowerCase();
    return s === "userbusy" || s === "user_busy";
  }

  return false;
}




function createNavigator(player) {
  
  const stack = [];

  return {
    player,
    async push(screenFn) {
      stack.push(screenFn);
      await screenFn();
    },
    async back() {
      stack.pop();
      const prev = stack[stack.length - 1];
      if (prev) await prev();
    },
    canBack() {
      return stack.length > 1;
    },
  };
}




function screenHome(nav) {
  return async () => {
    const form = new ActionFormData()
      .title("Dynamic Properties")
      .body("Choose what to view:")
      .button("World properties")
      .button("Player properties");

    const res = await forceOpen(nav.player, form);
    if (!res || res.canceled) return;

    if (res.selection === 0) {
      const store = makePropStore({
        title: "World",
        getIds: () => world.getDynamicPropertyIds?.() ?? [],
        getValue: (id) => world.getDynamicProperty(id),
      });
      return nav.push(screenPropList(nav, store));
    }

    if (res.selection === 1) {
      return nav.push(screenPlayerPicker(nav));
    }
  };
}

function screenPlayerPicker(nav) {
  return async () => {
    const players = world.getAllPlayers();

    const form = new ActionFormData()
      .title("Players")
      .body(players.length ? "Pick a player:" : "(No players found)");

    for (const p of players) form.button(p.name);
    if (nav.canBack()) form.button("Back");

    const res = await forceOpen(nav.player, form);
    if (!res || res.canceled) return;

    if (nav.canBack() && res.selection === players.length) return nav.back();

    const target = players[res.selection];
    if (!target) return;

    const store = makePropStore({
      title: `Player: ${target.name}`,
      getIds: () => target.getDynamicPropertyIds?.() ?? [],
      getValue: (id) => target.getDynamicProperty(id),
    });

    return nav.push(screenPropList(nav, store));
  };
}




function screenPropList(nav, store) {
  const state = {
    page: 0,
    pageSize: 12,
  };

  return async function run() {
    const ids = store.safeIds();

    const pageCount = Math.max(1, Math.ceil(ids.length / state.pageSize));
    state.page = clamp(state.page, 0, pageCount - 1);

    const start = state.page * state.pageSize;
    const pageIds = ids.slice(start, start + state.pageSize);

    const header = [
      `Scope: ${store.title}`,
      `Total IDs: ${ids.length}`,
      `Page: ${state.page + 1}/${pageCount}`,
      "",
      "Select a property to view details.",
    ].join("\n");

    const form = new ActionFormData().title("Dynamic Properties").body(header);

    for (const id of pageIds) {
      const v = store.safeGetValue(id);
      form.button(`${id}\n${previewValue(v, 40)}`);
    }

    if (pageCount > 1) {
      form.button("Prev page");
      form.button("Next page");
    }

    if (nav.canBack()) form.button("Back");

    const res = await forceOpen(nav.player, form);
    if (!res || res.canceled) return;

    let idx = res.selection;

    
    if (idx < pageIds.length) {
      const id = pageIds[idx];
      return nav.push(screenPropDetail(nav, store, id));
    }
    idx -= pageIds.length;

    
    if (pageCount > 1) {
      if (idx === 0) {
        state.page--;
        return run();
      }
      if (idx === 1) {
        state.page++;
        return run();
      }
      idx -= 2;
    }

    
    if (nav.canBack() && idx === 0) return nav.back();
  };
}

function screenPropDetail(nav, store, id) {
  return async () => {
    const value = store.safeGetValue(id);
    const details = formatDetails(value);

    const form = new ActionFormData().title(id).body(details).button("Back");

    const res = await forceOpen(nav.player, form);
    if (!res || res.canceled) return;

    return nav.back();
  };
}




function makePropStore({ title, getIds, getValue }) {
  return {
    title,
    safeIds() {
      try {
        const ids = getIds?.();
        return Array.isArray(ids) ? ids.slice().sort() : [];
      } catch {
        return [];
      }
    },
    safeGetValue(id) {
      try {
        return getValue(id);
      } catch {
        return undefined;
      }
    },
  };
}

function previewValue(v, maxLen) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";

  let s;
  const t = typeof v;

  if (t === "string") s = JSON.stringify(v);
  else if (t === "number" || t === "boolean") s = String(v);
  else s = safeStringify(v);

  s = s.replace(/\s+/g, " ");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

function formatDetails(v) {
  const type = v === null ? "null" : typeof v;

  let valueStr;
  if (v === undefined) valueStr = "undefined";
  else if (v === null) valueStr = "null";
  else if (typeof v === "string") valueStr = v;
  else valueStr = safeStringify(v);

  const meta = [`Type: ${type}`];
  if (typeof v === "string") meta.push(`Length: ${v.length}`);
  if (Array.isArray(v)) meta.push(`Array length: ${v.length}`);

  return `${meta.join("\n")}\n\n---\n\n${clip(valueStr, 3500)}`;
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function clip(s, maxLen) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 20) + "\n...(clipped)";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
