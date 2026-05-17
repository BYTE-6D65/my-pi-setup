import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Finding = {
  status: "ok" | "warn" | "error";
  message: string;
};

export type Section = {
  title: string;
  findings: Finding[];
};

export function ok(message: string): Finding {
  return { status: "ok", message };
}

export function warn(message: string): Finding {
  return { status: "warn", message };
}

export function error(message: string): Finding {
  return { status: "error", message };
}

export function agentDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

export function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
