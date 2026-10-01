---
description: Generate a PR description as a plain bullet-point summary — no headers, no test plan, no references to the gitignored .claude/tasks/ folder, closes the matching GitHub Issue if one exists
allowed-tools: Bash(git:*), Bash(gh:*), Read
---

Look at the current branch's diff against `main` — `git log --oneline main..HEAD`,
`git diff main --stat`, and the actual diffs where needed to understand _why_
a change was made, not just _what_ changed.

Check for a matching open Issue this branch resolves: `gh issue list --repo
<owner>/<repo> --state open --search "<keywords from the branch/diff>"` (repo
inferred from `git remote get-url origin`). If exactly one Issue is clearly
the one this branch addresses (title/body matches the actual diff, not just
a loose keyword overlap), note its number for the `Closes` line below. If
none match confidently, or more than one plausibly does, leave it out rather
than guessing — a wrong `Closes #N` silently closes the wrong Issue on merge.

Write the PR description as a flat bulleted list summarizing the changes and
their motivation. Rules:

- No markdown headers of any kind — no `##`, no "Summary", no
  "Test plan"/"Test Plan" section.
- Never reference `.claude/tasks/` or any file under it. That folder is
  gitignored and never committed, so a link to it is broken for anyone
  reviewing the PR who doesn't have this exact local checkout.
- Group related changes into one bullet rather than listing every touched
  file — this is a description, not a diff manifest.
- If a matching Issue was found above, end with its own line: `Closes #N`
  (GitHub's exact magic-keyword syntax — auto-closes the Issue and updates
  its Project item on merge). Omit this line entirely when no Issue matched.
- Output the whole description inside a single fenced ```markdown code
  block, and nothing else.
