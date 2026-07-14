# Oracle VM Migration Complete - Production Guide

**Migration Date:** February 3, 2026  
**Source:** 100.105.31.42 (Ubuntu 24.04 LTS)  
**Target:** 100.81.231.58 (Oracle VM - Tailscale) / 147.224.178.93 (Public IP)

---

## 🎯 System Overview

### Infrastructure
- **OS:** Ubuntu (Oracle Cloud)
- **Docker:** 29.2.1
- **Docker Compose:** v5.0.2
- **Networking:** 
  - Edge network: `172.18.0.0/16` (public-facing)
  - Backend network: `172.19.0.0/16` (internal services)
- **Reverse Proxy:** Cloudflare Tunnels + Zero Trust
- **Database:** PostgreSQL 15 (`cocstack`)

### Services Running
| Service | Container Name | Port | Status | Auto-Deploy |
|---------|---------------|------|--------|-------------|
| PostgreSQL | `infra-new-cocstack-db-1` | 5432 | ✅ Healthy | Manual |
| Discord Bot | `infra-new-coc-bot-1` | - | ✅ Running | ✅ Yes |
| Clan Map | `infra-new-clan-map-1` | 5552 | ✅ Running | ✅ Yes |

---

## 📁 Directory Structure

```
/opt/
├── infra-new/
│   └── compose/
│       ├── docker-compose.yml    # Main orchestration
│       └── .env                  # Environment variables
└── apps/
    ├── apps/
    │   ├── coc-discord-bot/      # Bot application code
    │   └── clan-map/             # Map application code
    └── logs/
        ├── coc-bot/              # Bot logs (UID 1000)
        └── clan-map/             # Map logs (UID 1000)
```

---

## 🔐 Secrets & Configuration

### Environment Variables (`/opt/infra-new/compose/.env`)
```bash
# Database
POSTGRES_DB=cocstack
POSTGRES_USER=cocuser
POSTGRES_PASSWORD=google123

# Discord Bot
DISCORD_TOKEN=MTM3MTk1MDk0NDAxODg5NDkwOQ.GpicIa...
SUPERCELL_API_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGc... (IP: 147.224.178.93)
CLAN_TAG=#2VUCUCV
GUILD_ID=403910977302822913

# Rate Limiting
RATE_LIMIT_STRICT=true
MAX_API_RETRIES=3
API_TIMEOUT=30

# Domain
DOMAIN=yancmo.xyz
ACME_EMAIL=admin@yancmo.xyz
```

**⚠️ CRITICAL:** New Supercell API token is IP-restricted to **147.224.178.93** (Oracle VM public IP)

---

## 🗄️ Database Information

### Connection Details
- **Host:** `infra-new-cocstack-db-1` (or `localhost:5432`)
- **Database:** `cocstack`
- **User:** `cocuser`
- **Password:** `google123`

### Migrated Data (as of Feb 3, 2026)
- ✅ 11 tables migrated
- ✅ 34 players
- ✅ 96 bonus history records
- ✅ CWL data (November 2025)
- ✅ Enhanced with location columns for map

### Schema Enhancements
Added to `players` table:
- `location` TEXT
- `latitude` DOUBLE PRECISION
- `longitude` DOUBLE PRECISION
- `favorite_troop` VARCHAR(50)
- `location_updated` TIMESTAMP

---

## 🚀 Common Operations

### Service Management

#### View All Containers
```bash
ssh ubuntu@100.81.231.58
docker ps -a
```

#### Restart a Service
```bash
cd /opt/infra-new/compose
docker compose -p infra-new restart coc-discord-bot
# or
docker compose -p infra-new restart clan-map
```

#### View Logs
```bash
docker logs infra-new-coc-bot-1 --tail 50 -f
docker logs infra-new-clan-map-1 --tail 50 -f
docker logs infra-new-cocstack-db-1 --tail 50
```

#### Stop/Start All Services
```bash
cd /opt/infra-new/compose
docker compose -p infra-new down
docker compose -p infra-new up -d
```

### Database Operations

#### Backup Database
```bash
docker exec infra-new-cocstack-db-1 pg_dump -U cocuser cocstack > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Access PostgreSQL CLI
```bash
docker exec -it infra-new-cocstack-db-1 psql -U cocuser -d cocstack
```

#### Quick Stats
```sql
SELECT COUNT(*) FROM players;
SELECT COUNT(*) FROM bonus_history;
SELECT COUNT(*) FROM cwl_history;
```

### Manual Deploy

#### Discord Bot
```bash
cd /opt/infra-new/compose
docker compose -p infra-new pull coc-discord-bot
docker compose -p infra-new up -d coc-discord-bot
docker logs infra-new-coc-bot-1 --tail 20
```

#### Clan Map
```bash
cd /opt/infra-new/compose
docker compose -p infra-new pull clan-map
docker compose -p infra-new up -d clan-map
docker logs infra-new-clan-map-1 --tail 20
```

---

## 🌐 External Access

### Cloudflare Tunnel Configuration

#### Clan Map: `clashmap.yancmo.xyz`
- **Target:** `http://localhost:5552`
- **Setup:** Cloudflare Zero Trust Dashboard → Tunnels → Add Public Hostname

#### Discord Bot
- No external web access needed (Discord WebSocket connection only)

---

## 🤖 Auto-Deploy System

### How It Works
1. Push code to `main` branch on GitHub
2. GitHub Actions builds Docker image
3. Pushes to `ghcr.io/yancmo1/[repo]:latest`
4. SSHs to Oracle VM
5. Pulls latest image
6. Restarts container

### GitHub Secrets Required (Set in Both Repos)
- `ORACLE_VM_HOST` = `100.81.231.58`
- `ORACLE_VM_USER` = `ubuntu`
- `ORACLE_VM_SSH_KEY` = Your SSH private key

### Test Auto-Deploy
```bash
# In either repo:
git commit --allow-empty -m "test: trigger deploy"
git push origin main
# Watch: GitHub → Actions tab
```

---

## 🔍 Monitoring & Health Checks

### Quick Status Check
```bash
ssh ubuntu@100.81.231.58 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
```

### Bot Discord Status
Check if bot is online in guild `403910977302822913`

### Database Health
```bash
docker exec infra-new-cocstack-db-1 pg_isready -U cocuser
```

### Disk Space
```bash
ssh ubuntu@100.81.231.58 'df -h && docker system df'
```

---

## 🐛 Troubleshooting

### Discord Bot Issues

#### Bot Offline
```bash
docker logs infra-new-coc-bot-1 --tail 100 | grep -i error
# Check Discord token validity
# Verify network connectivity
```

#### API Rate Limiting
```bash
docker logs infra-new-coc-bot-1 | grep -i "rate limit"
# Adjust RATE_LIMIT_STRICT, MAX_API_RETRIES in .env
```

#### Database Connection Failed
```bash
docker exec infra-new-coc-bot-1 env | grep POSTGRES
# Verify PostgreSQL container is healthy
docker exec -it infra-new-cocstack-db-1 psql -U cocuser -d cocstack -c "SELECT 1"
```

### Clan Map Issues

#### Map Not Loading
- Check logs: `docker logs infra-new-clan-map-1 --tail 50`
- Verify database connection
- Check file permissions on `/opt/apps/logs/clan-map` (should be UID 1000)

#### Cloudflare Tunnel Not Working
- Verify tunnel is running: `sudo systemctl status cloudflared`
- Check tunnel config points to `localhost:5552`
- Test internal access: `curl -I http://localhost:5552`

### General Issues

#### Container Won't Start
```bash
# Check logs
docker logs [container-name] --tail 100

# Verify depends_on services
docker ps | grep cocstack-db

# Check network connectivity
docker network inspect backend
```

#### Disk Full
```bash
# Clean up old images
docker image prune -a

# Clean up volumes
docker volume prune

# Check log sizes
du -sh /opt/apps/logs/*
```

---

## 📝 Migration Notes

### What Was Migrated
✅ Complete database with all 11 tables  
✅ Discord bot application code  
✅ Clan map application code  
✅ Environment variables and secrets  
✅ Docker infrastructure (networks, volumes)  
✅ Auto-deploy GitHub Actions workflows

### What Was NOT Migrated
- ❌ Traefik (replaced by Cloudflare Tunnels)
- ❌ Old server IP-based API token (new one created)
- ❌ nginx configuration (not needed)

### Known Issues
- Traefik v3.3 has Docker API compatibility issues with Docker 29.2.1 → Using Cloudflare instead
- Bot has read-only cache file warning (non-blocking)

---

## 🔗 Quick Links

- **Old Server:** `ssh yancmo@100.105.31.42`
- **New Server:** `ssh ubuntu@100.81.231.58`
- **Repos:**
  - https://github.com/yancmo1/coc-discord-bot
  - https://github.com/yancmo1/clan-map
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Discord Guild:** 403910977302822913

---

## 👉 Next Steps

1. **Set up GitHub Secrets** for auto-deploy (see `ORACLE-VM-DEPLOY-SETUP.md`)
2. **Configure Cloudflare Tunnel** for `clashmap.yancmo.xyz`
3. **Test auto-deploy** by pushing a test commit
4. **Monitor services** for 24-48 hours
5. **Decommission old server** (100.105.31.42) once stable

---

**Questions?** Check bot/map repo README files or deployment guides.
