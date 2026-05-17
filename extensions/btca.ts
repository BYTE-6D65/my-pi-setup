import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SANDBOX = join(homedir(), "Work", "Scratch", "btca");

function run(cmd: string, cwd?: string) {
	return execSync(cmd, { encoding: "utf8", cwd, timeout: 60_000 }).trim();
}

function repoNameFromUrl(url: string): string {
	// Handle https://github.com/owner/repo.git or just owner/repo
	const base = url.replace(/\.git$/, "").split("/").pop();
	if (!base) throw new Error(`Could not parse repo name from: ${url}`);
	return base;
}

function buildTree(dir: string, prefix = "", maxDepth = 3, depth = 0): string[] {
	if (depth >= maxDepth) return [`${prefix}...`];

	const entries = readdirSync(dir, { withFileTypes: true })
		.filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
		.sort((a, b) => {
			// Directories first, then files
			if (a.isDirectory() && !b.isDirectory()) return -1;
			if (!a.isDirectory() && b.isDirectory()) return 1;
			return a.name.localeCompare(b.name);
		});

	const lines: string[] = [];
	const maxEntries = 30;
	const shown = entries.slice(0, maxEntries);

	for (const entry of shown) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			lines.push(`${prefix}${entry.name}/`);
			lines.push(...buildTree(fullPath, `${prefix}  `, maxDepth, depth + 1));
		} else {
			lines.push(`${prefix}${entry.name}`);
		}
	}

	if (entries.length > maxEntries) {
		lines.push(`${prefix}... (${entries.length - maxEntries} more)`);
	}

	return lines;
}

export default function btcaExtension(pi: ExtensionAPI) {
	pi.registerCommand("btca", {
		description: "Clone a repo into ~/Work/Scratch/btca/ and print its structure for exploration",
		async handler(args, ctx) {
			const raw = args?.trim();
			// Take only the first token as the URL — anything after is commentary
			const url = raw?.split(/\s+/)[0];
			if (!url) {
				// No args — list what's already cloned
				if (!existsSync(SANDBOX) || readdirSync(SANDBOX).length === 0) {
					pi.sendUserMessage("No repos cloned yet. Use `/btca <repo-url>` to get started.");
					return;
				}

				const repos = readdirSync(SANDBOX, { withFileTypes: true })
					.filter((e) => e.isDirectory())
					.map((e) => `  - ${e.name}/`)
					.join("\n");

				pi.sendUserMessage(`Cloned repos in ~/Work/Scratch/btca/:\n${repos}\n\nUse \`/btca <repo-url>\` to clone or update one.`);
				return;
			}

			const name = repoNameFromUrl(url);
			const target = join(SANDBOX, name);

			if (!ctx.isIdle()) {
				pi.sendUserMessage(
					`Cloning/updating ${name} into ${target}. I'll explore it once the current task finishes.`,
					{ deliverAs: "followUp" },
				);
			}

			const lines: string[] = [];

			if (existsSync(join(target, ".git"))) {
				lines.push(`Updating ${name}...`);
				try {
					run("git pull --ff-only", target);
					lines.push(`Pulled latest for ${name}`);
				} catch {
					lines.push(`Could not pull — local changes or divergence. Continuing with current state.`);
				}
			} else {
				lines.push(`Cloning ${url}...`);
				try {
					run(`git clone --depth 1 ${url} ${target}`);
					lines.push(`Cloned ${name}`);
				} catch (err) {
					// Try without --depth 1 in case the remote doesn't support shallow clones
					try {
						run(`git clone ${url} ${target}`);
						lines.push(`Cloned ${name} (full history)`);
					} catch {
						lines.push(`Failed to clone: ${err instanceof Error ? err.message : String(err)}`);
						pi.sendUserMessage(lines.join("\n"));
						return;
					}
				}
			}

			// Print the tree
			lines.push("");
			lines.push(`${name}/`);
			lines.push(...buildTree(target));

			const output = lines.join("\n");

			const prompt = `I've just cloned/updated the repo \`${name}\` into \`${target}\`.

Here's the repo structure:

\`\`\`
${output}
\`\`\`

The working directory for exploring this repo is \`${target}\`. When searching or reading files in this repo, use paths starting with \`${target}/\`.`;

			pi.sendUserMessage(prompt);
		},
	});
}
