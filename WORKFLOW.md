# Development Workflow for 404 Project

## When You Paste a New Issue

This is the standard workflow for handling GitHub issues:

### 1. Create Worktree

When you share a GitHub issue URL (e.g., `https://github.com/Shivam-Bhardwaj/404/issues/5`):

```bash
# Extract issue number (e.g., 5)
ISSUE_NUM=5

# Create worktree with feature branch
cd /404-public/repo
git worktree add ../404-issue-${ISSUE_NUM} -b issue-${ISSUE_NUM}
cd ../404-issue-${ISSUE_NUM}
```

### 2. Implement Changes

Work on the issue in the worktree:
- Make code changes
- Test locally
- Commit changes

```bash
git add -A
git commit -m "feat/fix: Brief description

Fixes #${ISSUE_NUM}"
```

### 3. Push to Staging Branch

```bash
# Push feature branch
git push origin issue-${ISSUE_NUM}

# Or merge to staging for deployment
git checkout staging
git merge issue-${ISSUE_NUM}
git push origin staging
```

### 4. Deploy to Staging (Manual)

Since this machine IS the staging server:

**Frontend (Docker):**
```bash
cd /404-public/repo
git checkout staging
git pull origin staging
docker compose -f docker-compose.staging.yml up -d --build
```

**Backend (PM2):**
```bash
cd /404-public/repo/backend
cargo build --release
pm2 restart 404-backend
# or if new backend:
pm2 stop 404-backend && pm2 delete 404-backend
pm2 start target/release/physics-backend --name 404-backend
pm2 save
```

### 5. Review on Staging

You review changes in browser at: **https://staging.too.foo/**

If changes look good → proceed to merge
If changes need work → make more commits and redeploy

### 6. Merge to Main (When Approved)

```bash
cd /404-public/repo
git checkout main
git pull origin main
git merge staging -m "Merge staging: [description]"
git push origin main
```

### 7. Cleanup Worktree (Optional)

```bash
cd /404-public/repo
git worktree remove ../404-issue-${ISSUE_NUM}
git branch -d issue-${ISSUE_NUM}
git push origin --delete issue-${ISSUE_NUM}
```

## Key Principles

### GitHub Usage
- **Version Control**: Store code history
- **Issue Tracking**: Track bugs/features, share screenshots
- **NO GitHub Actions**: All CI/CD removed - test locally, deploy manually

### Testing
- **Local first**: All development and testing done on this machine
- **Staging review**: Final check on https://staging.too.foo/ before production
- **No automated tests in CI**: Manual testing only

### Deployment
- **Manual deployments**: All deployments done by running commands on this server
- **Staging environment**: Same machine, different Docker container + PM2 process
- **No secrets needed**: Everything runs locally

## Directory Structure

```
/404-public/
├── repo/                    # Main repository (staging & main branches)
├── 404-issue-X/            # Worktrees for each issue
├── 404-issue-Y/
└── ...
```

## Common Commands

### Check what's running
```bash
docker ps                    # Frontend containers
pm2 list                     # Backend processes
```

### View logs
```bash
docker logs 404-app-staging  # Frontend logs
pm2 logs 404-backend         # Backend logs
```

### Restart services
```bash
# Frontend
docker compose -f docker-compose.staging.yml restart

# Backend
pm2 restart 404-backend
```

## Notes

- This machine is the staging server
- No CI/CD pipelines - everything is manual
- Review on staging before merging to main
- Worktrees keep issues isolated

