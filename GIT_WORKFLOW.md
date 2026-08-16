# Git Workflow - Preventing Merge Conflicts

## The Problem
When working on a feature branch while `main` is being updated, diverging changes can create merge conflicts on the PR.

## The Solution: Pre-Push Hook

A git pre-push hook has been installed at `.git/hooks/pre-push`. This hook:

1. **Fetches latest from remote** before you push
2. **Checks for divergence** between your branch and origin/main
3. **Warns you** if conflicts would occur
4. **Asks for confirmation** before pushing

## Workflow (Recommended)

Before pushing feature branches:

```bash
git fetch origin
git rebase origin/main
git push
```

This keeps your branch synced with main and prevents divergence conflicts.

## What Happens on Push

If you try to push a branch that diverges from main:

```
⚠️  CONFLICT WARNING: Your branch diverges from origin/main
This push may create merge conflicts.

Fix: Run 'git rebase origin/main' first to sync with latest changes

Continue push anyway? (y/n)
```

**Choose `n`** to stop and rebase first, or **choose `y`** to push despite conflicts (which will need manual resolution on the PR).

## Key Commands

```bash
# Sync your branch with latest main
git rebase origin/main

# Check for conflicts before rebasing (dry run)
git merge-base --is-ancestor origin/main HEAD

# Push after syncing
git push
```

## Why This Works

Rebasing keeps your branch linear with main's history instead of creating a merge commit, which prevents divergence and eliminates most conflicts automatically.
