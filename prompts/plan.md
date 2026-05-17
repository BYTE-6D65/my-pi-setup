---
description: Build a decision map that accounts for second-order effects before acting
argument-hint: "<goal or problem statement>"
---

# Planning: $@

You are helping me plan an approach to the following goal:

**$@**

## Planning Protocol

Follow these steps in order. Do not skip ahead.

### Step 1: Decompose the Goal

Break the goal into the smallest meaningful set of decisions that need to be made. Each decision should be atomic — it answers one question with one choice.

Output a numbered list of decisions to make.

### Step 2: Map Dependencies

For each decision, identify:
- Which other decisions it depends on (must be resolved first)
- Which decisions depend on it (blocked until this is resolved)

Output a dependency-ordered list. Resolve leaf decisions first.

### Step 3: Second-Order Effect Analysis

For each decision, trace the consequences two levels deep:

- **First-order effect**: The direct, intended consequence of this decision.
- **Second-order effect**: What happens as a side effect of the first-order effect. These are often unintended.
- **Risk**: Which second-order effects are undesirable? How likely are they? How severe?

Format as a table:

| Decision | First-order | Second-order | Risk (Likelihood × Severity) |
|----------|------------|-------------|------------------------------|
| ...      | ...        | ...         | ...                          |

Flag any decision where a second-order risk is **Medium** or above — these need mitigation or an alternative.

### Step 4: Research

Before finalizing decisions, check if any of the choices involve libraries, frameworks, or technologies you are not certain about.

**Research rules — be conservative:**
1. Check `~/Work/Scratch/btca/` for already-cloned repos. Use these first.
2. Only clone a new repo if the technology is **directly and materially** involved in the decision — not tangentially related, not "might be useful", not "for background context".
3. **Maximum 2 new clones per planning session.** If you've hit the limit, note what you couldn't research and flag the uncertainty.
4. When in doubt about whether to clone — don't. Note the uncertainty instead.

### Step 5: Decision Synthesis

For each decision from Step 1, state:
- The choice
- The rationale (tied to first-order effects)
- Acknowledged second-order risks and mitigations
- Any open uncertainties (things we couldn't research or don't know yet)

### Step 6: Cross-Decision Audit

Look at all decisions together and check for:
- **Compounding second-order effects**: Do the second-order effects of two separate decisions amplify each other?
- **Contradictions**: Does any decision undermine another?
- **Missing decisions**: Did the combination of choices create a new problem we didn't plan for?

Output a brief summary of the audit findings. If issues are found, propose adjustments.

### Step 7: Final Plan

Output the complete, ordered plan as a checklist. Each item should be actionable. Include the acknowledged risks and uncertainties inline.

End with a **watch list** — specific things to monitor during execution that would signal a second-order effect materializing.
