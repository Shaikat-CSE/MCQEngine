#!/bin/bash

#####################################################
#  MCQ Finder VPS Non-Docker Native Host Deployment
#  Target: Hostinger VPS (mcq.codemybd.com)
#  Usage: sudo ./scripts/deploy.sh
#####################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/var/www/mcqfinder"
BACKUP_DIR="/var/backups/mcqfinder"
BRANCH="main"

log() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }
error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"; }

# Header
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         MCQ Finder Host Deployment & Update            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root: sudo ./scripts/deploy.sh"
    exit 1
fi

# Verify directory
if [ ! -d "$PROJECT_DIR" ]; then
    error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

log "Working directory: $(pwd)"
log "Target Branch: $BRANCH"

# Create directories
mkdir -p "$BACKUP_DIR"
mkdir -p data

# Step 1: Backup current SQLite Database
log "Step 1/8: Backing up current database..."
if [ -f "mcq_finder.db" ]; then
    BACKUP_FILE="$BACKUP_DIR/mcq_finder_$(date +%Y%m%d_%H%M%S).db"
    cp mcq_finder.db "$BACKUP_FILE"
    gzip "$BACKUP_FILE"
    success "Database backup saved to ${BACKUP_FILE}.gz"
else
    warn "No database file found to backup (fresh install?)"
fi

# Step 2: Pull latest code from GitHub
log "Step 2/8: Pulling latest commits from GitHub..."
git fetch origin
# Make sure we checkout main and pull
git checkout "$BRANCH"
git pull origin "$BRANCH"
success "Code updated to commit: $(git rev-parse --short HEAD)"

# Step 3: Update Backend Virtual Env and Dependencies
log "Step 3/8: Updating Python backend packages..."
cd "$PROJECT_DIR/backend"

# Ensure python3-venv and python3-pip are installed
if ! dpkg -s python3-venv &>/dev/null; then
    log "python3-venv is missing on system. Installing it..."
    apt-get update && apt-get install -y python3-venv python3-pip
fi

if [ ! -f "venv/bin/activate" ]; then
    log "Creating virtual environment..."
    rm -rf venv
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create tables & run importer scan
log "Running database updates & Excel sheet scan..."
python3 -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine); from app.importer import scan_data_directory; scan_data_directory()"
deactivate
success "Backend dependencies and database synced"

# Step 4: Update Frontend Node Packages & Build
log "Step 4/8: Building frontend Next.js assets..."
cd "$PROJECT_DIR/frontend"

# Build configuration env
echo 'NEXT_PUBLIC_API_URL=""' > .env.production

# Install npm packages
npm install --legacy-peer-deps

# Build the Next.js static production bundle
npm run build
success "Frontend built successfully"

# Step 5: Configure and Restart systemd Backend Service
log "Step 5/8: Restarting FastAPI Backend service..."
# Ensure backend systemd service descriptor exists
SERVICE_FILE="/etc/systemd/system/mcq-backend.service"
if [ ! -f "$SERVICE_FILE" ]; then
    log "Creating new systemd backend service file..."
    cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=MCQ Finder FastAPI Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/mcqfinder/backend
ExecStart=/var/www/mcqfinder/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8010
Restart=always
RestartSec=5
Environment=DATABASE_URL=sqlite:////var/www/mcqfinder/mcq_finder.db
Environment=DATA_DIR=/var/www/mcqfinder/data

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable mcq-backend
fi

sudo systemctl restart mcq-backend
success "FastAPI backend running on port 8010"

# Step 6: Configure and Restart PM2 Frontend Process
log "Step 6/8: Restarting Next.js Frontend server with PM2..."
cd "$PROJECT_DIR/frontend"
if pm2 list | grep -q "mcq-frontend"; then
    pm2 restart mcq-frontend
else
    pm2 start npm --name "mcq-frontend" -- run start -- -p 3010
    pm2 save
fi
success "Next.js frontend running on port 3010"

# Step 7: Verify Nginx Routing & Reload
log "Step 7/8: Verifying Nginx configuration..."
NGINX_CONF="/etc/nginx/sites-available/mcq.codemybd.com"
if [ ! -f "$NGINX_CONF" ]; then
    log "Creating new Nginx site configuration for mcq.codemybd.com..."
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name mcq.codemybd.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://mcq.codemybd.com$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mcq.codemybd.com;

    ssl_certificate /etc/letsencrypt/live/mcq.codemybd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcq.codemybd.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;

    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Route /api/ to FastAPI Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Route Swagger docs
    location /docs {
        proxy_pass http://127.0.0.1:8010/docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8010/openapi.json;
        proxy_set_header Host $host;
    }

    # Route Web Pages
    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
fi

# Reload Nginx
nginx -t
systemctl reload nginx
success "Nginx reloaded successfully"

# Step 8: Perform Health Checks
log "Step 8/8: Finalizing health checks..."
sleep 4
HEALTH_OK=true

# Check backend status
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8010/api/status || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    success "Backend is online (HTTP 200)"
else
    warn "Backend health check failed (HTTP $BACKEND_STATUS)"
    HEALTH_OK=false
fi

# Check frontend status
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3010 || echo "000")
if [[ "$FRONTEND_STATUS" =~ ^(200|301|302|308)$ ]]; then
    success "Frontend is online (HTTP $FRONTEND_STATUS)"
else
    warn "Frontend health check failed (HTTP $FRONTEND_STATUS)"
    HEALTH_OK=false
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
if [ "$HEALTH_OK" = true ]; then
    echo -e "${CYAN}║          ${GREEN}✅ MCQ Finder Live & Healthy!${CYAN}                 ║${NC}"
else
    echo -e "${CYAN}║        ${YELLOW}⚠️  Deploy completed with warnings!${CYAN}             ║${NC}"
fi
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 Website:${NC}    https://mcq.codemybd.com"
echo -e "${GREEN}📊 Commit:${NC}     $(git rev-parse --short HEAD)"
echo ""
echo -e "${YELLOW}📋 Process Actions:${NC}"
echo "   Backend Status:   sudo systemctl status mcq-backend"
echo "   Frontend Status:  pm2 status mcq-frontend"
echo "   Frontend Logs:    pm2 logs mcq-frontend"
echo "   Nginx Status:     sudo nginx -t"
echo ""

if [ "$HEALTH_OK" = true ]; then
    exit 0
else
    exit 1
fi
