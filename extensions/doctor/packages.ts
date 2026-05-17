import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Finding, Section } from "./shared.ts";
import { error, ok, readJson, warn } from "./shared.ts";

export function checkPackages(dir: string): Section {
  const findings: Finding[] = [];

  const settings = readJson(join(dir, "settings.json"));
  const pkgJson = readJson(join(dir, "package.json"));
  const tracked: string[] = Array.isArray(settings?.packages) ? (settings.packages as string[]) : [];
  const deps = (pkgJson?.dependencies ?? {}) as Record<string, string>;

  // Check that each tracked package is actually installed
  for (const source of tracked) {
    const pkgName = extractPackageName(source);
    if (!pkgName) {
      findings.push(warn(`unparseable package source: ${source}`));
      continue;
    }

    // Check if installed globally (bun global)
    const globalPath = join(
      process.env.BUN_INSTALL ?? join(dirname(process.execPath), ".."),
      "install",
      "global",
      "node_modules",
      pkgName,
    );

    // Check if installed locally
    const localPath = join(dir, "node_modules", pkgName);

    if (existsSync(localPath) || existsSync(globalPath)) {
      findings.push(ok(`${source}: installed`));
    } else {
      findings.push(error(`${source}: tracked in settings but not found (checked local + global node_modules)`));
    }
  }

  // Check for orphan deps — pi-related packages in package.json not tracked in settings
  // (Only flag packages that look like pi extensions — have a "pi" manifest key)
  for (const [name, version] of Object.entries(deps)) {
    if (name.startsWith("@mariozechner/") || name === "typebox" || name === "@sinclair/typebox") continue;
    if (name.startsWith("@mendable/") || name.startsWith("@types/")) continue;

    const localPkgPath = join(dir, "node_modules", name, "package.json");
    const localPkg = readJson(localPkgPath);
    if (localPkg?.pi) {
      // This has a pi manifest — should it be tracked?
      const trackedAs = tracked.find((s) => extractPackageName(s) === name);
      if (!trackedAs) {
        findings.push(warn(`${name}: has pi manifest in node_modules but not tracked in settings.packages — install via \`pi install\` instead of \`bun add\``));
      }
    }
  }

  // Packages tracked in settings but not in package.json deps (informational)
  for (const source of tracked) {
    const pkgName = extractPackageName(source);
    if (pkgName && !deps[pkgName]) {
      // This is ok — pi manages these separately via global install
    }
  }

  if (tracked.length === 0) {
    findings.push(ok("no external packages tracked"));
  }

  return { title: "Packages", findings };
}

function extractPackageName(source: string): string | null {
  // npm:@scope/pkg@version → @scope/pkg
  // npm:pkg@version → pkg
  if (source.startsWith("npm:")) {
    const spec = source.slice(4);
    // Remove version
    const atIdx = spec.indexOf("@", spec.startsWith("@") ? 1 : 0);
    return atIdx >= 0 ? spec.slice(0, atIdx) : spec;
  }

  // git: or https:// — can't easily extract
  if (source.startsWith("git:") || source.startsWith("https://") || source.startsWith("ssh://")) {
    return null;
  }

  return null;
}
