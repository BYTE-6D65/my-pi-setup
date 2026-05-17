import { execFileSync } from "node:child_process";
import { join } from "node:path";
import type { Finding, Section } from "./shared.ts";
import { agentDir, error, ok, readJson, warn } from "./shared.ts";

const PI_PACKAGES = [
  "@mariozechner/pi-ai",
  "@mariozechner/pi-coding-agent",
  "@mariozechner/pi-tui",
];

export function checkVersions(dir: string): Section {
  const findings: Finding[] = [];

  // Binary version — pi --version outputs to stderr, so use shell redirect
  let binaryVersion = "";
  try {
    const raw = execFileSync("/bin/sh", ["-lc", "pi --version 2>&1"], { encoding: "utf8", timeout: 5_000 }).trim();
    binaryVersion = raw.split("\n").filter((l: string) => l.trim())[0] || raw;
    findings.push(ok(`pi binary: ${binaryVersion}`));
  } catch {
    findings.push(warn("could not run `pi --version` — version drift check skipped"));
  }

  // Local package versions
  const pkgPath = join(dir, "package.json");
  const pkg = readJson(pkgPath);
  const deps = pkg?.dependencies as Record<string, string> | undefined;

  if (!deps) {
    findings.push(warn("no dependencies in package.json to check"));
    return { title: "Versions", findings };
  }

  // Check each pi package in local node_modules
  for (const name of PI_PACKAGES) {
    const required = deps[name];
    if (!required) {
      findings.push(warn(`${name} not in package.json dependencies`));
      continue;
    }

    const installedPkgPath = join(dir, "node_modules", name, "package.json");
    const installed = readJson(installedPkgPath);
    if (!installed) {
      findings.push(error(`${name}: listed in package.json but not installed in node_modules`));
      continue;
    }

    const installedVersion = installed.version as string | undefined;
    findings.push(ok(`${name}: ${installedVersion ?? "unknown"} (wanted ${required})`));
  }

  // Drift detection: compare binary semver to local package semver
  const localPiAgent = readJson(join(dir, "node_modules", "@mariozechner", "pi-coding-agent", "package.json"));
  if (localPiAgent?.version) {
    if (localPiAgent.version !== binaryVersion) {
      findings.push(warn(`version drift: binary ${binaryVersion} vs local ${localPiAgent.version} — run /update to sync`));
    } else {
      findings.push(ok("binary and local package versions match"));
    }
  }

  return { title: "Versions", findings };
}
