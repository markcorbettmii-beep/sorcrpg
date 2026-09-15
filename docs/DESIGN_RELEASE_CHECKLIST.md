# Website Development and Release Checklist

This is the lightweight release process for changes to the SORC website and dynamic application.

## Protect the live version

- Treat the deployed version as the approved baseline.
- Work in a feature branch or separate worktree.
- Do not edit or deploy directly from a dirty working directory.
- Keep unrelated local edits out of the release.
- Make one bounded visual change per commit.
- Keep secrets and production data out of local files and preview environments.

## Before implementation

- State the intended visual result in one sentence.
- Identify the affected page, source copy, and deployed public copy.
- List the states that must be checked.
- List the smallest supported viewport and the widest expected viewport.

## Visual and responsive review

Check the change at the actual target widths, including the smallest phone width:

- Does the layout preserve the intended relationship between elements?
- Does text remain readable without unexpected wrapping or overflow?
- Are long names, long labels, and empty values handled?
- Are loading, error, disabled, locked, BASIC, and PRO states handled where applicable?
- Are touch targets, focus states, contrast, and link text usable?
- Capture before and after screenshots for the change.

For a single-row requirement, confirm both that the row stays together and that it fits the narrowest supported viewport. If it cannot fit, choose an intentional responsive behavior rather than allowing accidental clipping.

## Automated checks

Run these from the repository root:

```bash
npm run check-publish
npm run check-design
```

After a deployment, verify the live apex checks:

```bash
npm run check-live-apex
```

Add a focused regression marker to `scripts/check-design-regressions.mjs` when a visual relationship is important enough to protect automatically.

## Dynamic-site safeguards

- Use separate local, preview, and production environments.
- Use separate preview data stores when a change can write data.
- Keep database migrations backward-compatible while old code may still be running.
- Back up production data before destructive schema or data changes.
- Keep API errors and deployment logs available for diagnosis.
- Run a smoke check after deployment before treating the release as complete.

## Release

1. Review the diff and confirm that only intended files changed.
2. Preview the feature or inspect the generated page at target widths.
3. Commit the bounded change with a descriptive message.
4. Review and merge the exact commit that passed the checks.
5. Deploy that reviewed commit.
6. Verify the deployed URL and record the deployment version.
7. Tag or otherwise record the known-good release so it can be restored.

## Rollback

If a release is wrong, stop making new changes on the live baseline. Redeploy the last known-good commit or release tag, then investigate the failed change separately.