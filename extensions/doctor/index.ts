import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { Finding, Section } from "./shared.ts";
import { agentDir } from "./shared.ts";
import { checkExtensions } from "./extensions.ts";
import { checkPackages } from "./packages.ts";
import { checkSettings } from "./settings.ts";
import { checkVersions } from "./versions.ts";

const TICK = "✓";
const CROSS = "✗";
const WARN = "⚠";

function renderSections(sections: Section[]): string {
  const lines: string[] = ["Pi Doctor", ""];

  for (const section of sections) {
    const hasError = section.findings.some((f) => f.status === "error");
    const hasWarn = section.findings.some((f) => f.status === "warn");
    const icon = hasError ? CROSS : hasWarn ? WARN : TICK;
    lines.push(`${icon} ${section.title}`);

    for (const f of section.findings) {
      const prefix = f.status === "ok" ? "  ✓" : f.status === "warn" ? "  ⚠" : "  ✗";
      lines.push(`${prefix} ${f.message}`);
    }

    lines.push("");
  }

  const totalErrors = sections.reduce((sum, s) => sum + s.findings.filter((f) => f.status === "error").length, 0);
  const totalWarns = sections.reduce((sum, s) => sum + s.findings.filter((f) => f.status === "warn").length, 0);

  if (totalErrors > 0) {
    lines.push(`${CROSS} ${totalErrors} error(s), ${totalWarns} warning(s)`);
  } else if (totalWarns > 0) {
    lines.push(`${WARN} ${totalWarns} warning(s), no errors`);
  } else {
    lines.push(`${TICK} All checks passed`);
  }

  return lines.join("\n");
}

function showReport(ctx: ExtensionCommandContext, report: string) {
  if (!ctx.hasUI) {
    console.log(report);
    return;
  }
  ctx.ui.setWidget("doctor", report.split("\n"));
  ctx.ui.notify("Doctor report shown above the editor.", "info");
}

export default function doctorExtension(pi: ExtensionAPI) {
  pi.registerCommand("doctor", {
    description: "Run pi environment diagnostics (settings, packages, extensions, versions)",
    async handler(_args, ctx) {
      await ctx.waitForIdle();
      const dir = agentDir();

      const sections: Section[] = [
        checkSettings(dir),
        checkVersions(dir),
        checkPackages(dir),
        checkExtensions(dir),
      ];

      showReport(ctx, renderSections(sections));
    },
  });
}
