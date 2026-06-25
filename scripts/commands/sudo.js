
import { system } from "@minecraft/server";
import { selectPlayers } from "../lib/selectors.js";
import { handleCommandMessage } from "./index.js";

export const sudoCommand = {
  name: "sudo",
  minRank: 4, 
  usage: ":sudo <selector> <command...>",
  description: "Runs a chat/admin command as another player.",
  examples: [
    ":sudo greg smite me",
    ":sudo random fire me 5",
    ":sudo others :pos me",
  ],

  execute({ player, args }) {
    const selector = args[0];
    const rest = args.slice(1).join(" ").trim();

    if (!selector || !rest) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const targets = selectPlayers(player, selector);
    if (!targets.length) {
      player.sendMessage(`No targets matched: ${selector}`);
      return;
    }

    
    const msg = rest.startsWith(":") ? rest : `:${rest}`;

    let count = 0;
    for (const t of targets) {
      try {
        
        system.run(() => handleCommandMessage(t, msg));
        count++;
      } catch {}
    }

    player.sendMessage(`Sudo ran for ${count} player(s): ${msg}`);
  },
};
