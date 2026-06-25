export const loopCommand = {
  name: "loop",
  minRank: 5, 
  usage: ":loop <times> <tick delay> <command...>",
  description: "Runs a command repeatedly a set number of times with a tick interval.",
  examples: [
    ":loop 10 20 smite random",
    ":loop 5 0 spawn cow"
  ],


  execute({ player, args, manager }) {
    const times = Number(args[0]);
    const interval = Number(args[1]);
    const rest = args.slice(2).join(" ");

    if (!Number.isFinite(times) || times < 1 || times > 1000) {
      player.sendMessage("Bad times. Use 1..1000");
      return;
    }

    if (!Number.isFinite(interval) || interval < 0 || interval > 100000) {
      player.sendMessage("Bad ticks. Use 0..100000");
      return;
    }

    if (!rest) {
      player.sendMessage(`Usage: ${this.usage}`);
      return;
    }

    const line = rest.startsWith(":") ? rest : `:${rest}`;

    manager.loop(player, times, interval, line);
    player.sendMessage(`Looping ${times}x every ${interval} ticks: ${line}`);
  },
};
