
import { system, world } from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";

function normName(s) {
  return String(s ?? "").toLowerCase().trim();
}


function addTextFieldCompat(form, label, placeholder, defaultValue = "") {
  try {
    form.textField(label, placeholder, { defaultValue });
    return;
  } catch {}
  try {
    form.textField(label, placeholder, defaultValue);
  } catch {}
}


function showWithRetry(target, form, onDone) {
  form
    .show(target)
    .then((res) => {
      if (res?.canceled && res.cancelationReason === "UserBusy") {
        return system.runTimeout(() => showWithRetry(target, form, onDone), 10);
      }
      onDone?.(res);
    })
    .catch(() => system.runTimeout(() => showWithRetry(target, form, onDone), 10));
}


const MAX_SCRIPT_CHARS = 8000;

function runUserScript(executor, code) {
  const logs = [];

  const api = {
    system,
    world,
    me: executor,
    log: (...args) => {
      const line = args.map(String).join(" ");
      logs.push(line);
      try { executor.sendMessage(`§7[script]§r ${line}`); } catch {}
    },
    nextTick: (fn) => system.run(fn),
    later: (ticks, fn) => system.runTimeout(fn, ticks),
  };
    let fn;
    try {
      fn = new Function(
        "api",
        `"use strict";
         const { system, world, me, log, nextTick, later } = api;
         ${code}
        `
      );
    } catch (e) {
      const msg = `Compile error:\n${String(e?.stack ?? e)}`;
      try { executor.sendMessage(`§c[script] ${msg}§r`); } catch {}
      throw e;
    }


  
  system.run(() => {
    Promise.resolve()
      .then(() => fn(api))
      .catch((e) => {
        const msg = String(e?.stack ?? e);
        logs.push(`ERROR: ${msg}`);
        try { executor.sendMessage(`§c[script] ${msg}§r`); } catch {}
      });
  });

  return logs;
}




function safeStringify(v) {
  try {
    if (v === undefined) return "undefined";
    if (typeof v === "bigint") return `${v}n`;
    return JSON.stringify(v);
  } catch {
    try {
      return String(v);
    } catch {
      return "[unprintable]";
    }
  }
}

function openScriptForm(executor) {
  const form = new ModalFormData().title("Run Script (Owner)");
  addTextFieldCompat(
    form,
    "Enter JavaScript to run (dangerous). Available: system, world, me, log(), nextTick(), later(ticks, fn)",
    "Example:\nlog('hi');\nworld.sendMessage('test');",
    ""
  );

  showWithRetry(executor, form, (res) => {
    if (res?.canceled) return;

    let code = String(res?.formValues?.[0] ?? "");
    code = code.replace(/\r\n/g, "\n").trim();

    if (!code) return;

    if (code.length > MAX_SCRIPT_CHARS) {
      try {
        executor.sendMessage(`§cScript too long (${code.length} chars). Max is ${MAX_SCRIPT_CHARS}.§r`);
      } catch {}
      return;
    }

    try {
      const logs = runUserScript(executor, code);

      const summary = logs.length
        ? `Ran script.\n\nOutput:\n${logs.slice(-20).join("\n")}`
        : "Ran script.\n\n(No output.)";

      const done = new ActionFormData().title("Script Result").body(summary).button("OK");
      showWithRetry(executor, done, () => {});
    } catch (e) {
      const msg = `Error:\n${String(e?.stack ?? e)}`;
      const err = new ActionFormData().title("Script Error").body(msg).button("OK");
      showWithRetry(executor, err, () => {});
      try {
        executor.sendMessage(`§c[script] ${String(e?.stack ?? e)}§r`);
      } catch {}
    }
  });
}

export const scriptCommand = {
  name: "script",
  minRank: 6, 
  usage: ":script",
  description: "Opens a form to enter and run a JavaScript snippet (OWNER ONLY).",
  examples: [":script"],

  execute({ player }) {
    openScriptForm(player);
  },
};
