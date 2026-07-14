# Oracle VM Auto-Deploy Setup

## GitHub Secrets Required

For auto-deploy to work, you need to add these secrets to **both repositories** (coc-discord-bot and clan-map):

### Navigate to Repository Settings:
1. Go to your repo on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### Add these 3 secrets:

#### 1. `ORACLE_VM_HOST`
```
100.81.231.58
```

#### 2. `ORACLE_VM_USER`
```
ubuntu
```

#### 3. `ORACLE_VM_SSH_KEY`
Your Tailscale SSH private key for the ubuntu user. Get it by running:
```bash
cat ~/.ssh/id_ed25519
```
Or if you have a specific Oracle VM key:
```bash
cat ~/Downloads/ssh-key-2026-02-03.key
```

**Important:** Copy the ENTIRE private key including:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- All the key content
- `-----END OPENSSH PRIVATE KEY-----`

---

## How Auto-Deploy Works

### When you push to `main` branch:
1. ✅ GitHub Actions builds new Docker image
2. ✅ Pushes to `ghcr.io/yancmo1/[repo-name]:latest`
3. ✅ SSHs into Oracle VM (100.81.231.58)
4. ✅ Pulls latest image
5. ✅ Restarts container with `docker compose`
6. ✅ Shows last 20 log lines for verification

### Test the workflow:
```bash
# Make a small change and commit
git add .
git commit -m "test: trigger auto-deploy"
git push origin main

# Watch the workflow
# Go to GitHub → Actions tab to see progress
```

---

## Manual Deploy Commands

If you need to manually deploy:

### Discord Bot:
```bash
ssh ubuntu@100.81.231.58
cd /opt/infra-new/compose
docker compose -p infra-new pull coc-discord-bot
docker compose -p infra-new up -d coc-discord-bot
docker logs infra-new-coc-bot-1 --tail 20
```

### Clan Map:
```bash
ssh ubuntu@100.81.231.58
cd /opt/infra-new/compose
docker compose -p infra-new pull clan-map
docker compose -p infra-new up -d clan-map
docker logs infra-new-clan-map-1 --tail 20
```

---

## Troubleshooting

### SSH Connection Issues:
- Ensure your SSH key has proper permissions: `chmod 600 ~/.ssh/id_ed25519`
- Test SSH manually: `ssh ubuntu@100.81.231.58 "echo Connected!"`
- Check Tailscale is running on both machines

### Docker Pull Issues:
- GitHub Container Registry requires authentication
- Images must be built before deploying
- Check GitHub Actions "build-and-push" job completed successfully

### Container Won't Start:
- Check logs: `docker logs infra-new-[service]-1 --tail 50`
- Verify environment variables in `/opt/infra-new/compose/.env`
- Ensure PostgreSQL is healthy: `docker ps | grep cocstack-db`
