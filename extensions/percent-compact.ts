/**
 * Percentage-Based Auto-Compaction
 *
 * Triggers compaction at a fixed 85% context usage, regardless of model
 * context window size. Works by listening to turn_end events and checking
 * the context usage percent reported by pi.
 *
 * Install:
 *   Add to ~/.pi/agent/settings.json:
 *     "extensions": ["extensions/percent-compact.ts"]
 *
 * Or run ad-hoc:
 *   pi --extension ~/.pi/agent/extensions/percent-compact.ts
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const COMPACT_THRESHOLD_PERCENT = 85;

const triggerCompaction = (ctx: ExtensionContext) => {
	ctx.compact({
		onComplete: () => {
			if (ctx.hasUI) {
				ctx.ui.notify("Context compacted", "info");
			}
		},
		onError: (error: Error) => {
			if (ctx.hasUI) {
				ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
			}
		},
	});
};

export default function (pi: ExtensionAPI) {
	let previousPercent: number | null = null;

	pi.on("turn_end", (_event, ctx) => {
		const usage = ctx.getContextUsage();
		if (!usage) return;

		const currentPercent = usage.percent;

		// Only trigger when crossing the threshold upward (not already above it)
		const crossedThreshold =
			previousPercent !== null &&
			previousPercent < COMPACT_THRESHOLD_PERCENT &&
			currentPercent >= COMPACT_THRESHOLD_PERCENT;

		previousPercent = currentPercent;

		if (!crossedThreshold) return;

		if (ctx.hasUI) {
			ctx.ui.notify(`Context at ${currentPercent}% — compacting...`, "info");
		}
		triggerCompaction(ctx);
	});
}
