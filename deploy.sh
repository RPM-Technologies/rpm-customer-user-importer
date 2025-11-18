#!/bin/bash

###############################################################################
# CSV Azure Importer - Production Deployment Script
# This script handles deployment, environment setup, and database initialization
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/customer-importer"
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root or with sudo
check_permissions() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run this script with sudo"
        exit 1
    fi
}

# Create environment file if it doesn't exist
create_env_file() {
    log_info "Checking environment file..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Environment file not found. Creating from template..."
        
        cat > "$ENV_FILE" << 'EOF'
NODE_ENV=production
APP_BASE_URL=https://rpm-importer-dev.rpmit.com:8443

# Azure AD Configuration
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Database Configuration
DATABASE_URL=mysql://csvuser:csvpassword@mysql:3306/csv_importer

# Session Secrets
SESSION_SECRET=rpm-importer-session-secret-key-2024
COOKIE_SECRET=rpm-importer-cookie-secret-key-2024-32chars

# Azure SQL Configuration (for data import)
AZURE_SQL_SERVER=your-sql-server.database.windows.net
AZURE_SQL_DATABASE=your-database
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
EOF
        
        chmod 644 "$ENV_FILE"
        log_success "Environment file created"
    else
        log_success "Environment file exists"
    fi
}

# Create docker-compose file if it doesn't exist
create_docker_compose() {
    log_info "Checking docker-compose file..."
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_warning "Docker compose file not found. Creating..."
        
        cat > "$DOCKER_COMPOSE_FILE" << 'EOF'
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: rpm-importer-app
    image: customer-importer-app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - rpm-importer-network
    volumes:
      - app-data:/app/data

  mysql:
    image: mysql:8.0
    container_name: rpm-importer-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: csv_importer
      MYSQL_USER: csvuser
      MYSQL_PASSWORD: csvpassword
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - rpm-importer-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: rpm-importer-nginx
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "8443:8443"
    volumes:
      - ./deployment/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deployment/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - rpm-importer-network

networks:
  rpm-importer-network:
    driver: bridge

volumes:
  mysql-data:
  app-data:
EOF
        
        log_success "Docker compose file created"
    else
        log_success "Docker compose file exists"
    fi
}

# Create nginx configuration
create_nginx_config() {
    log_info "Checking nginx configuration..."
    
    mkdir -p deployment/ssl
    
    if [ ! -f "deployment/nginx.conf" ] || [ -d "deployment/nginx.conf" ]; then
        log_warning "Nginx config not found or is a directory. Creating..."
        
        rm -rf deployment/nginx.conf
        
        cat > deployment/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 8080;
        server_name _;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }

    server {
        listen 8443 ssl;
        server_name rpm-importer-dev.rpmit.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
EOF
        
        log_success "Nginx config created"
    else
        log_success "Nginx config exists"
    fi
    
    # Copy SSL certificates
    if [ ! -f "deployment/ssl/fullchain.pem" ]; then
        log_info "Copying SSL certificates..."
        cp /etc/letsencrypt/live/rpm-importer-dev.rpmit.com/fullchain.pem deployment/ssl/
        cp /etc/letsencrypt/live/rpm-importer-dev.rpmit.com/privkey.pem deployment/ssl/
        log_success "SSL certificates copied"
    fi
}

# Initialize database tables
init_database() {
    log_info "Initializing database tables..."
    
    # Wait for MySQL to be ready
    log_info "Waiting for MySQL to be healthy..."
    for i in {1..30}; do
        if docker exec rpm-importer-mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
            log_success "MySQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "MySQL failed to become ready"
            exit 1
        fi
        sleep 2
    done
    
    # Create sessions table
    log_info "Creating sessions table..."
    docker exec rpm-importer-mysql mysql -uroot -prootpassword csv_importer << 'SQL' 2>/dev/null
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT(11) UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
SQL
    
    # Create users table
    log_info "Creating users table..."
    docker exec rpm-importer-mysql mysql -uroot -prootpassword csv_importer << 'SQL' 2>/dev/null
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),
  role ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL
    
    # Add default admin user
    log_info "Adding default admin user..."
    docker exec rpm-importer-mysql mysql -uroot -prootpassword csv_importer << 'SQL' 2>/dev/null
INSERT INTO users (openId, name, email, loginMethod, role)
VALUES ('28bdef1f-c7ed-4a19-a60e-f2c9856f2537', 'Ron Twaddell', 'rtwaddell@rpmit.com', 'azure-ad', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';
SQL
    
    log_success "Database initialized"
}

# Main deployment function
deploy() {
    log_info "Starting deployment..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest code
    if [ "$1" == "--pull" ] || [ "$1" == "-p" ]; then
        log_info "Pulling latest code from Git..."
        git fetch rpm-org --prune
        git reset --hard rpm-org/master
        log_success "Code updated"
    fi
    
    # Create configuration files
    create_env_file
    create_docker_compose
    create_nginx_config
    
    # Build and start containers
    log_info "Building Docker images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build app 2>&1 | tail -5
    
    log_info "Starting containers..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Initialize database
    init_database
    
    # Show status
    log_info "Container status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    log_success "Deployment complete!"
    log_info "Application URL: https://rpm-importer-dev.rpmit.com:8443"
}

# Restart function
restart() {
    log_info "Restarting application..."
    
    cd "$PROJECT_DIR"
    docker-compose -f "$DOCKER_COMPOSE_FILE" restart
    
    log_success "Application restarted"
}

# Stop function
stop() {
    log_info "Stopping application..."
    
    cd "$PROJECT_DIR"
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    log_success "Application stopped"
}

# Logs function
logs() {
    cd "$PROJECT_DIR"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f --tail=50 app
}

# Status function
status() {
    cd "$PROJECT_DIR"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
}

# Main script
main() {
    check_permissions
    
    case "$1" in
        deploy)
            deploy "$2"
            ;;
        restart)
            restart
            ;;
        stop)
            stop
            ;;
        logs)
            logs
            ;;
        status)
            status
            ;;
        *)
            echo "Usage: $0 {deploy|restart|stop|logs|status} [--pull|-p]"
            echo ""
            echo "Commands:"
            echo "  deploy [--pull|-p]  Deploy the application (optionally pull latest code)"
            echo "  restart             Restart the application"
            echo "  stop                Stop the application"
            echo "  logs                Show application logs"
            echo "  status              Show container status"
            exit 1
            ;;
    esac
}

main "$@"
