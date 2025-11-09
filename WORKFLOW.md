# Agent + Developer Workflow

These steps apply to **every** change against this repository. They exist so that
humans and LLM copilots follow the exact same routine whether the request comes
from a GitHub Issue link, chat prompt, or terminal note.

## 1. Start From a Worktree Per Issue

1. Copy the GitHub Issue URL.
2. Create a dedicated worktree rooted at the repository’s parent folder if one
   does not already exist. Use a descriptive name such as
   `git worktree add ../404-issue-123 staging`.
3. Check out or create the issue branch **inside that worktree** and do all
   editing/testing there. Never work directly inside `/404-public/repo`.

## 2. Implement and Test Locally

Run the standard suite before pushing:

- Frontend: `npm run lint`, `npm run test`, `npm run build`.
- Backend (when touched): `cargo fmt`, `cargo clippy --all-targets --all-features`,
  `cargo test --all`, `./test-backend-api.sh`.
- Feature-specific scripts (Keploy, GPU tests, etc.) when applicable.

Document any screenshots, curl logs, or benchmark results the issue asks for.

## 3. Push and Open a PR

1. Commit using the repository’s task/issue naming conventions.
2. Push the branch from the worktree.
3. Open a PR targeting `staging`, include the issue link (“Closes #123”), and
   paste the local test commands/output along with any required evidence.
4. Wait for the staging GitHub Action to redeploy, then verify at
   `https://staging.too.foo`.

Following this checklist means that any LLM—or person—who receives only the
issue URL knows to prepare a worktree, perform local validation, push a branch,
and produce a reviewable PR. Put differently: **issue link ⇒ worktree ⇒ local
tests ⇒ PR ⇒ staging verification**.
