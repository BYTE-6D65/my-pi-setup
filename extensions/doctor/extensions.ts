import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Finding, Section } from "./shared.ts";
import { error, ok, warn } from "./shared.ts";

export function checkExtensions(dir: string): Section {
  const findings: Finding[] = [];
  const extDir = join(dir, "extensions");

  if (!existsSync(extDir)) {
    findings.push(warn("extensions directory does not exist"));
    return { title: "Extensions", findings };
  }

  const entries = readdirSync(extDir);

  for (const entry of entries) {
    const fullPath = join(extDir, entry);
    const stat = lstatSync(fullPath, { throwIfNoEntry: false });

    if (!stat) continue;

    // .disabled files
    if (entry.endsWith(".ts.disabled")) {
      const originalName = entry.replace(".disabled", "");
      findings.push(warn(`${originalName} is disabled (renamed to ${entry})`));
      continue;
    }

    // Non-ts, non-directory entries
    if (!entry.endsWith(".ts") && !stat.isDirectory()) {
      continue;
    }

    // Single .ts file extension
    if (entry.endsWith(".ts") && stat.isFile()) {
      validateExtensionFile(fullPath, entry, findings);
      continue;
    }

    // Directory extension — must have index.ts
    if (stat.isDirectory()) {
      // Skip if it starts with . (hidden)
      if (entry.startsWith(".")) continue;

      const indexPath = join(fullPath, "index.ts");
      if (!existsSync(indexPath)) {
        findings.push(warn(`${entry}/: directory extension has no index.ts`));
        continue;
      }

      // Check all .ts files in directory
      validateDirectoryExtension(fullPath, entry, findings);
    }
  }

  // Check for node_modules in extensions dir (shouldn't be there — use package deps instead)
  const nmPath = join(extDir, "node_modules");
  if (existsSync(nmPath)) {
    findings.push(warn("extensions/node_modules exists — extension deps should be in agent package.json, not local to extensions/"));
  }

  return { title: "Extensions", findings };
}

function validateExtensionFile(filePath: string, name: string, findings: Finding[]) {
  try {
    const content = readFileSync(filePath, "utf8");

    // Check for default export
    if (!/export\s+default\s+/.test(content)) {
      findings.push(error(`${name}: missing default export function`));
      return;
    }

    // Check it imports from the right package
    const usesOldName = content.includes('"@mariozechner/pi-coding-agent"');
    const usesNewName = content.includes('"@earendil-works/pi-coding-agent"');

    if (!usesOldName && !usesNewName) {
      // Might import from a re-export or not need pi types — not necessarily an error
    }

    findings.push(ok(`${name}: valid`));
  } catch (err) {
    findings.push(error(`${name}: could not read — ${err instanceof Error ? err.message : String(err)}`));
  }
}

function validateDirectoryExtension(dirPath: string, name: string, findings: Finding[]) {
  const tsFiles = findTsFiles(dirPath);
  let hasDefaultExport = false;
  let parseErrors = 0;

  for (const file of tsFiles) {
    try {
      const content = readFileSync(file, "utf8");
      if (/export\s+default\s+/.test(content)) {
        hasDefaultExport = true;
      }
    } catch {
      parseErrors++;
    }
  }

  if (parseErrors > 0) {
    findings.push(warn(`${name}/: ${parseErrors} file(s) could not be read`));
  }

  if (!hasDefaultExport) {
    findings.push(error(`${name}/: no file has a default export`));
  } else {
    findings.push(ok(`${name}/: valid (${tsFiles.length} .ts file(s))`));
  }
}

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        results.push(join(dir, entry.name));
      }
      // Don't recurse into subdirectories or node_modules
    }
  } catch {
    // best effort
  }
  return results;
}
