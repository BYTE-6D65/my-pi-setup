import { join } from "node:path";
import type { Finding, Section } from "./shared.ts";
import { error, ok, readJson, warn } from "./shared.ts";

export function checkSettings(dir: string): Section {
  const findings: Finding[] = [];
  const path = join(dir, "settings.json");
  const settings = readJson(path);

  if (!settings) {
    return { title: "Settings", findings: [error("settings.json is missing or invalid JSON")] };
  }

  // npmCommand must be ["bun"]
  const npmCommand = settings.npmCommand;
  if (!npmCommand) {
    findings.push(warn("npmCommand not set — pi will default to npm for package operations"));
  } else if (!Array.isArray(npmCommand)) {
    findings.push(error("npmCommand should be an array, got " + typeof npmCommand));
  } else if (npmCommand[0] !== "bun") {
    findings.push(error(`npmCommand is [${npmCommand.map((c: string) => `"${c}"`).join(", ")}] — expected ["bun"]`));
  } else {
    findings.push(ok('npmCommand is ["bun"]'));
  }

  // packages must be an array if present
  const packages = settings.packages;
  if (packages !== undefined && !Array.isArray(packages)) {
    findings.push(error("packages should be an array"));
  } else if (Array.isArray(packages)) {
    findings.push(ok(`${packages.length} package(s) tracked in settings`));
  }

  // package.json exists and is valid
  const pkgPath = join(dir, "package.json");
  const pkg = readJson(pkgPath);
  if (!pkg) {
    findings.push(error("package.json is missing or invalid"));
  } else {
    const deps = pkg.dependencies as Record<string, string> | undefined;
    if (!deps) {
      findings.push(warn("package.json has no dependencies"));
    } else {
      findings.push(ok(`package.json has ${Object.keys(deps).length} dependencies`));
    }
  }

  return { title: "Settings", findings };
}
