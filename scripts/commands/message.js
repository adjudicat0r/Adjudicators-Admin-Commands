
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { selectPlayers } from "../lib/selectors.js";

function normName(s) {
  return String(s ?? "").toLowerCase().trim();
}
function joinFrom(args, start) {
  return args.slice(start).join(" ").trim();
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

function parseBool(v, def = false) {
  const s = normName(v);
  if (!s) return def;
  if (s === "true" || s === "t" || s === "1" || s === "yes" || s === "y") return true;
  if (s === "false" || s === "f" || s === "0" || s === "no" || s === "n") return false;
  return def;
}

function openReplyForm(executor, fromPlayerName, originalMsg, toPlayerName) {
  const form = new ModalFormData().title(`Reply from ${toPlayerName}`);
  addTextFieldCompat(
    form,
    `Reply from ${toPlayerName} (to ${fromPlayerName})`,
    "Type your reply...",
    ""
  );

  showWithRetry(executor, form, (res) => {
    if (res?.canceled) return;

    const reply = String(res?.formValues?.[0] ?? "").trim();
    if (!reply) return;

    
    try {
      executor.sendMessage(`Reply sent to ${toPlayerName}.`);
    } catch {}

    
    
  });
}

function deliverMessageWithOptionalReply(executor, target, msg, canRespond) {
  const title = `Message from ${executor.name}`;
  const body = msg;

  if (!canRespond) {
    const form = new ActionFormData().title(title).body(body).button("OK");
    showWithRetry(target, form, () => {});
    return;
  }

  
  const form = new ActionFormData()
    .title(title)
    .body(body)
    .button("OK")
    .button("Reply");

  showWithRetry(target, form, (res) => {
    if (res?.canceled) return;

    const choice = Number(res.selection ?? 0);
    
    if (choice !== 1) return;

    
    const replyForm = new ModalFormData().title(`Reply to ${executor.name}`);
    addTextFieldCompat(replyForm, "Your reply", "Type a reply...", "");

    showWithRetry(target, replyForm, (replyRes) => {
      if (replyRes?.canceled) return;

      const reply = String(replyRes?.formValues?.[0] ?? "").trim();
      if (!reply) return;

      
      const showToExec = new ActionFormData()
        .title(`Reply from ${target.name}`)
        .body(`Original:\n${msg}\n\nReply:\n${reply}`)
        .button("OK");

      showWithRetry(executor, showToExec, () => {});

      
      try {
        target.sendMessage(`Reply delivered to ${executor.name}.`);
      } catch {}
    });
  });
}

export const messageCommand = {
  name: "message",
  minRank: 3, 
  usage: ":message <selector> <message> <canRespond true/false>",
  description:
    "Sends a popup message to players. If canRespond is true, recipients can reply and it pops up to the executor.",
  examples: [
    ':message me Hello false',
    ':message others "Stop that." false',
    ':message all Server reboot soon true',
  ],

  execute({ player, args }) {
    const selector = args[0] ?? "me";
    const canRespond = parseBool(args[args.length - 1], false);

    
    const msg = args.length >= 2 ? args.slice(1, -1).join(" ").trim() : "";
    if (!msg) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    let attempted = 0;
    for (const t of targets) {
      attempted++;
      try {
        deliverMessageWithOptionalReply(player, t, msg, canRespond);
      } catch {}
    }

    player.sendMessage(`Sending message to ${attempted} player(s)...`);
  },
};
