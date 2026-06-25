
import { system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { handleCommandMessage } from "./index.js";

function addTextFieldCompat(form, label, placeholder, defaultValue = "") {
  
  try {
    form.textField(label, placeholder, { defaultValue });
    return;
  } catch {}

  
  try {
    form.textField(label, placeholder, defaultValue);
  } catch {
    
    try {
      form.textField(label, placeholder);
    } catch {}
  }
}

function openCmdbar(self) {
  const form = new ModalFormData().title("Command Bar");

  addTextFieldCompat(
    form,
    'Enter a command (":" optional)',
    "e.g. smite others",
    ""
  );

  form.show(self).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason == "UserBusy") {
        return system.runTimeout(() => openCmdbar(self), 10);
      }
      return;
    }

    const text = String(response.formValues?.[0] ?? "").trim();
    if (!text) return;

    const msg = text.startsWith(":") ? text : `:${text}`;
    system.run(() => handleCommandMessage(self, msg));
  });
}

export const cmdbarCommand = {
  name: "cmdbar",
  minRank: 3, 
  usage: ":cmdbar",
  description: "Opens a UI to type and run admin commands.",
  examples: [":cmdbar"],

  execute({ player }) {
    openCmdbar(player);
  },
};
