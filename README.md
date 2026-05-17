# my-pi-setup

My personal [pi](https://github.com/mariozechner/pi) coding agent configuration — extensions, settings, and themes.

Forked from [davis7dotsh/my-pi-setup](https://github.com/davis7dotsh/my-pi-setup).

## Structure

```
~/.pi/agent/
├── settings.json       # pi settings (provider, model, tracked packages)
├── package.json        # dependencies for extensions + pi packages
├── bun.lock            # pinned dependency versions
├── extensions/         # custom slash commands and tools
├── themes/             # custom TUI themes
├── AGENTS.md           # rules and guidelines for the coding agent
└── sessions/           # session history (gitignored)
```

## Extensions

| Command | File | Description |
|---------|------|-------------|
| `/yeet` | `yeet.ts` | Stage all changes, commit with an AI-generated message, and push |
| `/lg` | `lg.ts` | Summarize unstaged git changes with per-file +/- line counts |
| `/diff` | `diff.ts` | Open a diff view of changed files |
| `/copy-all` | `copy-all.ts` | Copy conversation content to clipboard |
| `/update` | `update.ts` | Update pi packages and sync versions |
| `/usage` | `usage.ts` | Generate a token usage report across sessions |
| `/doctor` | `doctor/` | Run environment diagnostics (settings, packages, extensions, versions) |
| `/zsh-user-bash` | `zsh-user-bash.ts` | Run user bash commands through zsh with proper shell config |
| `ephemeral` | `ephemeral/` | Ephemeral file management extension |
| `pi-mcp` | `pi-mcp/` | MCP server integration |

**Disabled extensions** are renamed to `.ts.disabled` (e.g. `firecrawl-search.ts.disabled`).

### TUI Widgets

- **git-status-widget** (`git-status-widget.ts`) — shows current branch and file counts in the TUI
- **flow-title** (`flow-title.ts`) — styled pi ASCII title banner

## Packages

Managed via `pi install` and tracked in `settings.json` → `packages`:

- `pi-codex-goal` — long-running goal tracking for pi

## Setup

```bash
# Clone into ~/.pi/agent
git clone https://github.com/BYTE-6D65/my-pi-setup.git ~/.pi/agent

# Install dependencies
cd ~/.pi/agent
bun install
```

## Configuration

- **Package manager:** `bun` (configured via `npmCommand` in settings.json)
- **Provider:** `zai`
- **Model:** `glm-5.1`
- **Thinking level:** `high`

## Theme

- `github-dark-default.json` — GitHub Dark-inspired TUI theme
