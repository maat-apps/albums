---
description: Push the current branch and open a GitHub PR with a generated description, then wire up CI monitoring
allowed-tools: Bash(git:*), Bash(gh:*), Read
---

Do NOT proceed past step 1 without stopping and telling the user why.

1. **Preconditions.**
   - `git branch --show-current` — refuse if it's `main`. Tell the user to
     branch first.
   - `git status --short` — refuse if there are uncommitted changes. Tell the
     user to commit or stash first; never commit on their behalf here.

2. **Push the branch — no local verification first.** CI runs the full
   check set (lint/format/typecheck/test/build/audit) and Auto-fix
   handles any failure automatically.
   - `git rev-parse --abbrev-ref --symbolic-full-name @{u}` to check if it
     already tracks a remote branch.
   - If untracked: `git push -u origin <branch>`. If tracked: `git push`
     (only if local is ahead of remote — check first, don't force; if
     rejected because the remote has new commits — e.g. from a branch
     update via the GitHub API — `git rebase origin/<branch>` then push).
   - `gh pr view <branch> --json number` (or reuse `ccd_pr.get_status` if
     already bound this session) to check whether this branch already has
     an open PR.

3. **No existing PR: draft and create one immediately** — no preview
   shown in chat, no confirmation pause.
   - Title: short (under 70 chars), imperative, no trailing period.
   - Description: follow the exact rules from `/pr-description` — inspect
     `git log --oneline main..HEAD`, `git diff main --stat`, and the actual
     diffs to understand _why_, not just _what_. Output a flat bulleted
     list, no markdown headers, no "Summary"/"Test plan" sections, no
     reference to `.claude/tasks/` (gitignored, invisible to reviewers),
     changes grouped logically rather than one bullet per file, and a
     trailing `Closes #N` line if (and only if) exactly one open Issue
     confidently matches what this branch does.
   - Create via:
     ```
     gh pr create --title "<title>" --body "$(cat <<'EOF'
     <body>
     EOF
     )"
     ```
     End the body with the attribution lines given in this conversation's
     system-reminder, when one is present.
   - Then wire up CI monitoring: `ccd_pr` tools (`bind_pr`, then
     `set_monitor`) so checks are watched and Auto-fix can react —
     instead of polling `gh` by hand.
   - **Merge once CI is green** — the ecosystem standard (maat-core
     `STRUCTURE.md`'s PR workflow). If the repo allows auto-merge, enable
     it right away (`ccd_pr` `set_auto_merge`, squash) so GitHub merges on
     green; otherwise merge with `gh pr merge <n> --squash` as soon as a
     check result shows green. Respect a required order: a PR stacked on
     another, or needing an unmerged prerequisite, waits for it. A red
     check means fix and push, never merge; a PR with no checks at all
     isn't merged without asking.

4. **Existing PR: regenerate the description from the full diff, don't
   just leave it describing the state at creation.** Re-derive it the
   same way as step 3 (rules from `/pr-description`, inspecting the full
   `main..HEAD` diff, not just the new commits), then
   `gh pr edit <n> --body "$(cat <<'EOF' ... EOF)"`. CI monitoring is
   already bound from when the PR was created — no need to re-bind; the
   same merge-once-green rule applies to the new push.

5. Confirm briefly that the push/PR update happened — no title/body, no
   URL.
