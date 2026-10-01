# shadcn config

The `components.json` choice routines uses — the actual shareable unit for
shadcn-generated primitives (`Button`, `Input`, `Select`, etc.), per
[maat-apps/maat-core#3](https://github.com/maat-apps/maat-core/issues/3):
generated files themselves aren't worth copying (they're meant to be
regenerated per repo via `npx shadcn add <component>`, and a copied file
drifts from what a fresh generate would produce), but the _config choice_
that decides what gets generated is worth keeping consistent.

## Usage

Prefer installing [`@maat-apps/ui`](../../packages/ui) over regenerating
`Button`/`Input`/`Select` yourself — it already ships the hand-patched
`button.tsx` below as a real dependency, so `npm update` gets you fixes
instead of a hand-patch to re-apply per repo. The steps below are only for
a component `@maat-apps/ui` doesn't have, or a repo that deliberately wants
to own a local, customizable copy instead of depending on the package.

1. Copy `components.json` to your new repo's root.
2. Adjust `tailwind.css` (`"src/app/globals.css"`) if your repo's Tailwind
   entry point lives somewhere else — this path is routines' own layout,
   not universal.
3. Run `npx shadcn init` (it'll pick up the copied `components.json`) or
   just start running `npx shadcn add <component>` directly.
4. **Re-apply this one hand-patch after generating `button.tsx`**: the
   `outline` variant needs
   `disabled:bg-background/40 disabled:text-muted-foreground disabled:opacity-100 disabled:backdrop-blur-md`
   added to its class string (see routines' `src/components/ui/button.tsx`,
   or [`../../packages/ui/src/button.tsx`](../../packages/ui/src/button.tsx)
   in this repo, which already carries the patch). A fresh
   `npx shadcn add button` doesn't know about this — it's routines' own
   deliberate addition on top of the generated output, not something the
   shadcn registry ships.

## What this doesn't cover

- Design tokens (colors, true-black OLED background, fonts) — per-app
  product decisions, not part of the shadcn setup itself. See
  [`../../packages/ui/README.md`](../../packages/ui/README.md)'s own note
  on this.
- A registry/CLI step to automate steps 1–4 for a brand-new repo — that's
  [maat-apps/maat-core#7](https://github.com/maat-apps/maat-core/issues/7)
  (project scaffolding command), not this.
