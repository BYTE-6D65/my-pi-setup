Package and extension management:

- **use `bun` for everything** — never use `npm`, `yarn`, `pnpm`, or any other package manager
- install pi extensions with `pi install <source>` — never `bun add` or `npm install` directly, pi needs to track packages in settings.json
- if `pi install` fails, fix the root cause (permissions, `npmCommand` config, etc.) rather than working around it with a different package manager
- the `npmCommand` in settings.json must always be `["bun"]` — if it gets changed back to npm or removed, that's a bug
- never manually edit `package.json` to add/remove packages — use the appropriate install command (`pi install`, `bun add`, etc.)
- never run `npm install -g` — use `bun add -g` or `pi install` instead
- when writing extensions that need dependencies, add them to `~/.pi/agent/package.json` via `bun add` in the agent directory
- disabled extensions get renamed to `.ts.disabled` (not deleted) so they can be re-enabled easily
- before pushing to GH, verify `pi list` shows all expected packages and settings.json has the correct `npmCommand` and `packages` entries

When working in typescript:

- when adding a package to a project add it with an install command, instead of manually editing the package json
- run check/format/lint commands when your done making a change. if they don't exist, suggest making them for the project you're in
- avoid explicit return types unless absolutely needed
- `as any` should be an absolute last resort. always use real type safety. lean on type inference instead of manually writing new types over and over again
- avoid running `dev` or `build` commands. if you really need to, ask first

When working in react:

- prefer modern react patterns (hooks, function components)
- use the react best practices skill when writing react code

Context resources:

- `~/Work/Scratch/btca/` — repos cloned via `/btca` for exploring unfamiliar codebases. Use these when the user asks about a library/technology that's been cloned here

In general:

- when asking questions, ask them one at a time
- read the full contents of a file every time, never subsets so you don't miss important context
