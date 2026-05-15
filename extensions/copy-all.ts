import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type Platform = "macos" | "linux-x11" | "linux-wayland" | "unknown";

function textFromContent(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      if (!("type" in block)) return "";

      if (
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return block.text;
      }

      if (block.type === "image") return "[image]";

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function detectPlatform(): Platform {
  const sys = process.platform;
  if (sys === "darwin") return "macos";

  // Linux: check for Wayland vs X11
  const session = (process.env.XDG_SESSION_TYPE || "").toLowerCase();
  const waylandDisplay = !!process.env.WAYLAND_DISPLAY;
  if (session === "wayland" || waylandDisplay) return "linux-wayland";
  if (session === "x11" || process.env.DISPLAY) return "linux-x11";

  return "unknown";
}

function getClipboardCommand(platform: Platform): { command: string; args: string[] } | null {
  switch (platform) {
    case "macos":
      return { command: "pbcopy", args: [] };
    case "linux-wayland":
      return { command: "wl-copy", args: [] };
    case "linux-x11":
      // Prefer xclip, fall back to xsel
      return { command: "xclip", args: ["-selection", "clipboard"] };
    default:
      return null;
  }
}

function copyToClipboard(text: string): Promise<void> {
  const platform = detectPlatform();
  let spec = getClipboardCommand(platform);

  // If the primary command isn't available, try fallbacks
  if (platform === "linux-x11") {
    // xclip might not be installed, try xsel as fallback
  }

  if (!spec) {
    throw new Error(
      `Clipboard not supported on this platform (${process.platform}). ` +
      `Install pbcopy (macOS), wl-copy (Wayland), or xclip/xsel (X11).`
    );
  }

  return new Promise<void>((resolve, reject) => {
    const child = spawn(spec!.command, spec!.args);
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (err) => {
      // If the command wasn't found, try fallback for linux-x11
      if (platform === "linux-x11" && spec!.command === "xclip") {
        spec = { command: "xsel", args: ["--clipboard", "--input"] };
        const fallback = spawn(spec.command, spec.args);
        let fbStderr = "";
        fallback.stderr.on("data", (chunk) => { fbStderr += String(chunk); });
        fallback.on("error", () => {
          reject(new Error(
            `No clipboard utility found. Install xclip or xsel.\n` +
            `  sudo apt install xclip   OR   sudo apt install xsel`
          ));
        });
        fallback.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(fbStderr.trim() || `xsel exited with code ${code}`));
        });
        fallback.stdin.end(text);
        return;
      }
      reject(
        new Error(
          `Clipboard command "${spec!.command}" not found. ` +
          `Install it or check your PATH.\n${stderr.trim()}`
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `${spec!.command} exited with code ${code}`));
      }
    });

    child.stdin.end(text);
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("copy-all", {
    description:
      "Copy all previous user and assistant messages in this thread to the clipboard",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();

      const messages = ctx.sessionManager
        .getBranch()
        .filter((entry) => entry.type === "message")
        .map((entry) => entry.message)
        .filter(
          (message) => message.role === "user" || message.role === "assistant",
        );

      const text = messages
        .map((message) => {
          const content = textFromContent(message.content).trim();
          return `${message.role.toUpperCase()}:\n${content}`;
        })
        .filter((section) => !section.endsWith(":\n"))
        .join("\n\n---\n\n");

      if (!text) {
        ctx.ui.notify("No user or assistant messages to copy", "info");
        return;
      }

      try {
        await copyToClipboard(text);
        ctx.ui.notify(`Copied ${messages.length} messages to clipboard`, "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Clipboard error: ${msg}`, "error");
      }
    },
  });
}
