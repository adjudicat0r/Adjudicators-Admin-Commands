
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { selectPlayers } from "../lib/selectors.js";

function joinMsg(args, start = 0) {
  return args.slice(start).join(" ").trim();
}

function showAnnounceToPlayer(target, form, onDone) {
  form
    .show(target)
    .then((res) => {
      if (res?.canceled && res.cancelationReason === "UserBusy") {
        
        return system.runTimeout(() => showAnnounceToPlayer(target, form, onDone), 10);
      }
      onDone?.();
    })
    .catch(() => {
      
      system.runTimeout(() => showAnnounceToPlayer(target, form, onDone), 10);
    });
}

export const announceCommand = {
  name: "announce",
  minRank: 3, 
  usage: ":announce <message>",
  description: 'Shows a popup announcement to everyone (retries if player is "busy").',
  examples: [":announce Server reboot in 5 minutes."],

  execute({ player, args }) {
    const msg = joinMsg(args, 0);
    if (!msg) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const title = `Announcement from ${player.name}`;
    const targets = selectPlayers(player, "all");

    if (!targets.length) {
      player.sendMessage("No targets found.");
      return;
    }

    let attempted = 0;
    let delivered = 0;

    for (const t of targets) {
      attempted++;

      
      const form = new ActionFormData().title(title).body(msg).button("OK");

      showAnnounceToPlayer(t, form, () => {
        delivered++;
        
        if (delivered === attempted) {
          try {
            player.sendMessage(`Announcement delivered to ${delivered} player(s).`);
          } catch {}
        }
      });
    }

    
    player.sendMessage(`Sending announcement to ${attempted} player(s)...`);
  },
};
