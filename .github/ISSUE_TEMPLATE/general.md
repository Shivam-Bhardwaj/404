---
name: 404 Work Item
about: Track bugs, enhancements, or chores for staging.too.foo
title: ''
labels: []
assignees: ''
---

## Summary
_Describe the problem or goal._

## Acceptance Criteria
- [ ] …

## Evidence / Notes
_Attach screenshots, logs, or links that help reproduce the issue._

---

### Agent Instructions
When this issue URL is handed to an LLM or automation:
1. **Create (or reuse) a dedicated git worktree** for this issue; never modify `/404-public/repo` directly. Example:  
   ```bash
   git worktree add ../404-issue-${ISSUE_NUMBER} staging
   ```
2. Do all edits/tests inside that worktree, run the required local commands (`npm run lint`, `npm run test`, `npm run build`, plus backend scripts when relevant).
3. Push the branch, open a PR targeting `staging`, and include the test logs + evidence requested above.
4. Wait for the staging deployment (`https://staging.too.foo`) and verify in a browser before closing the issue.
