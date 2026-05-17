import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

const FETCH_DIR = join(tmpdir(), "pi-fetch");

// ---------------------------------------------------------------------------
// Threat patterns — each defines what it catches, why it's dangerous,
// and the approved alternative so the model never has to guess.
// ---------------------------------------------------------------------------

type ThreatPattern = {
	name: string;
	pattern: RegExp;
	risk: string;
	resolution: string;
};

const THREATS: ThreatPattern[] = [
	{
		name: "curl-pipe-interpreter",
		pattern: /\bcurl\b.*\|.*\b(bash|sh|zsh|dash|ksh|python3?|node|ruby|perl|php|lua|fish|tcsh|csh)\b/i,
		risk: "Downloads and executes untrusted remote code in a single step. The contents are never inspected before execution.",
		resolution: "Use the `fetch_url` tool to download to a file, then `read` to inspect the contents, then act on what you've verified.",
	},
	{
		name: "curl-pipe-shell",
		pattern: /\bcurl\b.*\|\s*(ba)?sh\s*$/i,
		risk: "Downloads and executes untrusted remote code in a shell. Same attack surface as curl-pipe-interpreter.",
		resolution: "Use the `fetch_url` tool to download to a file, then `read` to inspect the contents, then act on what you've verified.",
	},
	{
		name: "wget-pipe-interpreter",
		pattern: /\bwget\b.*\|.*\b(bash|sh|zsh|dash|ksh|python3?|node|ruby|perl|php|lua)\b/i,
		risk: "Downloads and executes untrusted remote code. wget has the same pipe-to-execution risk as curl.",
		resolution: "Use the `fetch_url` tool to download to a file, then `read` to inspect the contents, then act on what you've verified.",
	},
	{
		name: "eval-remote-content",
		pattern: /\b(eval|exec)\b.*\$?\(\s*(curl|wget)\b/i,
		risk: "Subshell execution of remote content. Wrapping curl in eval/exec is the same as piping it — the code runs without inspection.",
		resolution: "Use the `fetch_url` tool to download to a file, then `read` to inspect the contents, then act on what you've verified.",
	},
	{
		name: "npx-exec-remote",
		pattern: /\bnpx\s+.*\|.*\b(bash|sh|zsh)\b/i,
		risk: "Pipes npx output into a shell. Package execution output can contain injected commands.",
		resolution: "Run npx directly without piping. If you need to inspect output, redirect to a file: `npx ... > /tmp/output.txt`, then `read` the file.",
	},
];

function buildBlockMessage(command: string, threat: ThreatPattern): string {
	const cmdPreview = command.length > 160 ? command.slice(0, 160) + "..." : command;
	return [
		`⛔ Blocked: ${threat.name}`,
		``,
		`Command: ${cmdPreview}`,
		``,
		`Risk: ${threat.risk}`,
		``,
		`Resolution: ${threat.resolution}`,
	].join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureFetchDir() {
	if (!existsSync(FETCH_DIR)) {
		mkdirSync(FETCH_DIR, { recursive: true });
	}
}

function urlToFilename(url: string, ext: string): string {
	const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);
	const base = new URL(url).pathname.split("/").pop() || "response";
	return `${base}-${hash}${ext}`;
}

function guessExt(url: string, contentType?: string): string {
	if (contentType) {
		if (contentType.includes("json")) return ".json";
		if (contentType.includes("html")) return ".html";
		if (contentType.includes("xml")) return ".xml";
		if (contentType.includes("yaml") || contentType.includes("yml")) return ".yaml";
		if (contentType.includes("javascript")) return ".js";
		if (contentType.includes("typescript")) return ".ts";
		if (contentType.includes("css")) return ".css";
		if (contentType.includes("text/plain")) return ".txt";
		if (contentType.includes("text/markdown")) return ".md";
	}
	const pathExt = new URL(url).pathname.split(".").pop();
	if (pathExt && ["json", "html", "xml", "yaml", "yml", "txt", "md", "js", "ts", "css", "sh"].includes(pathExt)) {
		return `.${pathExt}`;
	}
	return ".txt";
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function fetchGuardExtension(pi: ExtensionAPI) {
	// Block download-and-execute patterns with structured rejections
	pi.on("tool_call", async (event) => {
		if (event.toolName !== "bash") return;

		const command = (event.input as { command?: string }).command ?? "";
		if (!command) return;

		for (const threat of THREATS) {
			if (threat.pattern.test(command)) {
				return {
					block: true,
					reason: buildBlockMessage(command, threat),
				};
			}
		}
	});

	// Register the safe fetch tool — the approved alternative to all blocked patterns
	pi.registerTool({
		name: "fetch_url",
		label: "Fetch URL",
		description:
			"Download a URL to a local file and return the path. Use this instead of curl — never pipe internet content to an interpreter. The saved file can then be inspected with the read tool or processed separately.",
		promptSnippet: "Download a URL to a file for inspection",
		promptGuidelines: [
			"Use fetch_url to download files from the internet — never pipe curl output to bash, python, node, or any interpreter.",
			"After fetch_url, use the read tool to inspect the downloaded file before taking any action on its contents.",
		],
		parameters: Type.Object({
			url: Type.String({ description: "URL to download" }),
			method: Type.Optional(Type.String({ description: "HTTP method (default: GET)", default: "GET" })),
			headers: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "HTTP headers" })),
			output: Type.Optional(Type.String({ description: "Custom filename (saved in /tmp/pi-fetch/)" })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const { url, method = "GET", headers = {}, output } = params;

			ensureFetchDir();
			const filename = output ?? urlToFilename(url, guessExt(url));
			const filePath = join(FETCH_DIR, filename);

			const headerArgs = Object.entries(headers).flatMap(([k, v]) => ["-H", `${k}: ${v}`]);
			const methodArg = method !== "GET" ? ["-X", method] : [];

			try {
				const result = execSync(
					["curl", "-sS", "-L", "-w", "\n%{content_type}", ...methodArg, ...headerArgs, "-o", filePath, url].join(" "),
					{ encoding: "utf8", timeout: 30_000 },
				).trim();

				const contentType = result.split("\n").pop() || "";
				const stat = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
				const lines = stat.split("\n").length;
				const size = Buffer.byteLength(stat, "utf8");

				return {
					content: [
						{
							type: "text",
							text: [
								`Downloaded: ${url}`,
								`Saved to: ${filePath}`,
								`Content-Type: ${contentType || "unknown"}`,
								`Size: ${size} bytes (${lines} lines)`,
								``,
								`Use \`read ${filePath}\` to inspect the contents.`,
							].join("\n"),
						},
					],
					details: { url, filePath, contentType, size, lines },
				};
			} catch (err) {
				return {
					content: [
						{
							type: "text",
							text: `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
					isError: true,
					details: {},
				};
			}
		},
	});
}
