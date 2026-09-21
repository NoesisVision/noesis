# Agent skills

`.agents/skills/` is the single home for every agent skill in this repo. It follows the
cross-tool [Agent Skills](https://skills.sh/) convention, so Codex, Cursor, Gemini CLI,
GitHub Copilot, Amp and other agents that read `.agents/skills/` pick the skills up directly.

## Why `.claude/skills/` still exists

Claude Code discovers project skills only from `.claude/skills/` — it does not read
`.agents/skills/`, and there is no setting to add another skills directory. It does follow
symlinks, so `.claude/skills/` contains nothing but relative symlinks into this folder:

```
.claude/skills/hono       -> ../../.agents/skills/hono
.claude/skills/logtape    -> ../../.agents/skills/logtape
...
```

Rule: skill files live here; `.claude/skills/<name>` is always a symlink, never a real
directory. Edit skills under `.agents/skills/` (editing through the symlink works too — it is
the same file).

## What is in here

| Skill | Origin | Tracked in `skills-lock.json` |
| --- | --- | --- |
| `commit-message` | Written in this repo | No |
| `hono` | `yusukebe/hono-skill` | Yes |
| `mantine-combobox`, `mantine-custom-components`, `mantine-form` | `mantinedev/skills` | Yes |
| `tanstack-query`, `tanstack-router` | `tanstack-skills/tanstack-skills` | Yes |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | Yes |
| `logtape` | Copied from the `@logtape/logtape` npm package (`skills/logtape/`), with local additions | No |

Third-party skills are vendored and hash-locked by `skills-lock.json` at the repo root.
Do not edit them by hand — local changes are lost on the next update. The whole `.agents/`
folder is excluded from Oxfmt (`ignorePatterns` in `.oxfmtrc.json`) so formatting never changes their hashes.

## Managing third-party skills with `npx skills`

The [`skills`](https://skills.sh/) CLI (verified with v1.7.0) installs a skill into
`.agents/skills/`, symlinks it into each selected agent's directory (for Claude Code:
`.claude/skills/`), and records its source and hash in `skills-lock.json`. Run it from the
repo root.

```sh
# Browse a repository's skills without installing
npx skills add mantinedev/skills --list

# Install one skill for Claude Code (plus any other agents you select)
npx skills add mantinedev/skills --skill mantine-form --agent claude-code

# Search the registry
npx skills find tanstack

# List project skills and the agents that see them
npx skills list
npx skills ls -a claude-code

# Update all project skills (or one by name) to the latest upstream version
npx skills update -p
npx skills update hono

# Remove a skill and its agent symlinks
npx skills remove mantine-form

# Fresh clone: restore vendored skills from skills-lock.json (experimental)
npx skills experimental_install
```

Do not pass `--copy`: it writes real directories into `.claude/skills/` instead of symlinks
and breaks the single-home rule.

After an install, update, or removal, commit the changed files under `.agents/skills/`,
`.claude/skills/`, and `skills-lock.json` together (a `chore(skills): …` commit).

## Adding a skill written in this repo

`npx skills` does not manage local skills, so create the symlink yourself:

```sh
npx skills init .agents/skills/my-skill          # or create .agents/skills/my-skill/SKILL.md by hand
ln -s ../../.agents/skills/my-skill .claude/skills/my-skill
```

Check with `npx skills list` — the skill should list `Claude Code` among its agents.

## Updating `logtape`

The LogTape skill ships inside the `@logtape/logtape` package, not in a skills repository, so
it is not in `skills-lock.json`. The vendored copy carries local additions: a paragraph
under "Full documentation" in `SKILL.md` (pointing at `references/llms.txt` and
`docs/logging.md`) and `references/llms.txt` itself (the index from logtape.org).

After upgrading LogTape, refresh `SKILL.md` from the installed package and re-apply the local
paragraph:

```sh
diff server/backend/node_modules/@logtape/logtape/skills/logtape/SKILL.md .agents/skills/logtape/SKILL.md
cp server/backend/node_modules/@logtape/logtape/skills/logtape/SKILL.md .agents/skills/logtape/SKILL.md
# then restore the local paragraph and bump the version it names
```

Keep `references/`; refresh `llms.txt` from <https://logtape.org/llms.txt> if it changed.
