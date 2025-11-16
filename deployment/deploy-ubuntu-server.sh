#!/bin/bash

################################################################################
# RPM Customer User Importer - Ubuntu Server Deployment Script
################################################################################
#
# This script deploys the RPM Customer User Importer application on an Ubuntu
# server using Docker containers with custom port mapping (8080:8443).
#
# Prerequisites:
# - Ubuntu 20.04 or later
# - Docker and Docker Compose installed
# - Git installed
# - Sudo privileges
#
# Usage:
#   sudo ./deployment/deploy-ubuntu-server.sh [options]
#
# Options:
#   --domain DOMAIN      Domain name for the application (optional)
#   --email EMAIL        Email for SSL certificate (required if domain is set)
#   --skip-mysql         Skip MySQL container setup (use external database)
#   --help               Show this help message
#
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DOMAIN=""
EMAIL=""
SKIP_MYSQL=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

################################################################################
# Helper Functions
################################################################################

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

show_help() {
    sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^# //'
    exit 0
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Installing Docker..."
        install_docker
    else
        log_success "Docker is installed"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Installing Docker Compose..."
        install_docker_compose
    else
        log_success "Docker Compose is installed"
    fi
    
    # Check if Git is installed
    if ! command -v git &> /dev/null; then
        log_info "Git is not installed. Installing Git..."
        apt-get update
        apt-get install -y git
    else
        log_success "Git is installed"
    fi
    
    log_success "All prerequisites met"
}

install_docker() {
    log_info "Installing Docker..."
    
    # Update package index
    apt-get update
    
    # Install required packages
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    log_success "Docker installed successfully"
}

install_docker_compose() {
    log_info "Installing Docker Compose..."
    
    # Docker Compose v2 is installed as a Docker plugin
    # If we're here, it means the plugin wasn't installed
    apt-get update
    apt-get install -y docker-compose-plugin
    
    log_success "Docker Compose installed successfully"
}

################################################################################
# Configuration Functions
################################################################################

create_env_file() {
    log_info "Creating environment configuration file..."
    
    local env_file="$PROJECT_DIR/.env.production"
    
    if [ -f "$env_file" ]; then
        log_warning "Environment file already exists. Backing up..."
        cp "$env_file" "$env_file.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    cat > "$env_file" << 'EOF'
# RPM Customer User Importer - Production Environment Configuration

# Database Configuration
DATABASE_URL=mysql://csvuser:csvpassword@mysql:3306/csv_importer?ssl=false

# Application Configuration
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=CHANGE_THIS_TO_A_RANDOM_SECRET

# OAuth Configuration (if using Manus OAuth)
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
VITE_APP_ID=
OWNER_OPEN_ID=
OWNER_NAME=

# Application Branding
VITE_APP_TITLE=RPM Customer User Importer
VITE_APP_LOGO=

# Manus Forge API (if using built-in services)
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=

# Analytics (optional)
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
EOF
    
    # Generate random JWT secret
    local jwt_secret=$(openssl rand -base64 32)
    sed -i "s|JWT_SECRET=CHANGE_THIS_TO_A_RANDOM_SECRET|JWT_SECRET=$jwt_secret|g" "$env_file"
    
    log_success "Environment file created at $env_file"
    log_warning "Please edit $env_file and configure your settings before starting the application"
}

create_docker_compose_production() {
    log_info "Creating production Docker Compose configuration..."
    
    local compose_file="$PROJECT_DIR/docker-compose.production.yml"
    
    cat > "$compose_file" << 'EOF'
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: rpm-importer-app
    restart: unless-stopped
    ports:
      - "8080:3000"
      - "8443:3000"
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
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-prootpassword"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  nginx:
    image: nginx:alpine
    container_name: rpm-importer-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deployment/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deployment/ssl:/etc/nginx/ssl:ro
      - nginx-cache:/var/cache/nginx
    depends_on:
      - app
    networks:
      - rpm-importer-network

networks:
  rpm-importer-network:
    driver: bridge

volumes:
  mysql-data:
    driver: local
  app-data:
    driver: local
  nginx-cache:
    driver: local
EOF
    
    log_success "Production Docker Compose file created"
}

create_nginx_config() {
    log_info "Creating Nginx configuration..."
    
    local nginx_dir="$PROJECT_DIR/deployment"
    mkdir -p "$nginx_dir/ssl"
    
    local nginx_conf="$nginx_dir/nginx.conf"
    
    if [ -n "$DOMAIN" ]; then
        # Configuration with domain name
        cat > "$nginx_conf" << EOF
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name $DOMAIN;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name $DOMAIN;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 100M;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }
    }
}
EOF
    else
        # Configuration without domain (port-based access)
        cat > "$nginx_conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name _;

        client_max_body_size 100M;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
EOF
    fi
    
    log_success "Nginx configuration created"
}

setup_ssl_certificate() {
    if [ -z "$DOMAIN" ]; then
        log_info "No domain specified, skipping SSL certificate setup"
        return
    fi
    
    if [ -z "$EMAIL" ]; then
        log_error "Email is required for SSL certificate generation"
        exit 1
    fi
    
    log_info "Setting up SSL certificate with Let's Encrypt..."
    
    # Install certbot
    if ! command -v certbot &> /dev/null; then
        apt-get update
        apt-get install -y certbot
    fi
    
    # Stop nginx if running
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" stop nginx 2>/dev/null || true
    
    # Obtain certificate
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"
    
    # Copy certificates to deployment directory
    local ssl_dir="$PROJECT_DIR/deployment/ssl"
    mkdir -p "$ssl_dir"
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$ssl_dir/cert.pem"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$ssl_dir/key.pem"
    
    log_success "SSL certificate configured"
}

################################################################################
# Deployment Functions
################################################################################

build_application() {
    log_info "Building Docker image..."
    
    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.production.yml build --no-cache
    
    log_success "Docker image built successfully"
}

start_services() {
    log_info "Starting services..."
    
    cd "$PROJECT_DIR"
    
    if [ "$SKIP_MYSQL" = true ]; then
        docker-compose -f docker-compose.production.yml up -d app nginx
    else
        docker-compose -f docker-compose.production.yml up -d
    fi
    
    log_success "Services started"
}

run_database_migrations() {
    if [ "$SKIP_MYSQL" = true ]; then
        log_warning "Skipping database migrations (MySQL container not started)"
        return
    fi
    
    log_info "Waiting for database to be ready..."
    sleep 10
    
    log_info "Running database migrations..."
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec -T app pnpm db:push
    
    log_success "Database migrations completed"
}

configure_firewall() {
    log_info "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 8080/tcp
        ufw allow 8443/tcp
        log_success "Firewall rules added"
    else
        log_warning "UFW not installed, skipping firewall configuration"
    fi
}

setup_auto_restart() {
    log_info "Setting up auto-restart on system boot..."
    
    # Docker containers with restart: unless-stopped will automatically restart
    # Ensure Docker service starts on boot
    systemctl enable docker
    
    log_success "Auto-restart configured"
}

show_deployment_info() {
    local server_ip=$(hostname -I | awk '{print $1}')
    
    log_info "========================================="
    log_info "Deployment Complete!"
    log_info "========================================="
    
    if [ -n "$DOMAIN" ]; then
        log_info "Application URL: https://$DOMAIN"
    else
        log_info "Application URLs:"
        log_info "  - HTTP:  http://$server_ip:8080"
        log_info "  - HTTPS: https://$server_ip:8443 (if SSL configured)"
        log_info "  - Nginx: http://$server_ip (port 80)"
    fi
    
    log_info ""
    log_info "MySQL Database:"
    log_info "  - Host: localhost"
    log_info "  - Port: 3306"
    log_info "  - Database: csv_importer"
    log_info "  - User: csvuser"
    log_info "  - Password: csvpassword"
    
    log_info ""
    log_info "========================================="
    log_info "Next Steps:"
    log_info "1. Edit .env.production and configure your settings"
    log_info "2. Restart services: docker-compose -f docker-compose.production.yml restart"
    log_info "3. View logs: docker-compose -f docker-compose.production.yml logs -f"
    log_info "4. Access the application at the URL above"
    log_info "========================================="
    log_info ""
    log_info "Useful Commands:"
    log_info "  - Stop services:    docker-compose -f docker-compose.production.yml stop"
    log_info "  - Start services:   docker-compose -f docker-compose.production.yml start"
    log_info "  - Restart services: docker-compose -f docker-compose.production.yml restart"
    log_info "  - View logs:        docker-compose -f docker-compose.production.yml logs -f"
    log_info "  - Remove all:       docker-compose -f docker-compose.production.yml down -v"
    log_info "========================================="
}

################################################################################
# Main Execution
################################################################################

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --skip-mysql)
                SKIP_MYSQL=true
                shift
                ;;
            --help)
                show_help
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                ;;
        esac
    done
    
    log_info "Starting Ubuntu Server deployment for RPM Customer User Importer"
    log_info "========================================="
    
    check_root
    check_prerequisites
    create_env_file
    create_docker_compose_production
    create_nginx_config
    
    if [ -n "$DOMAIN" ]; then
        setup_ssl_certificate
    fi
    
    build_application
    start_services
    run_database_migrations
    configure_firewall
    setup_auto_restart
    show_deployment_info
    
    log_success "Deployment completed successfully!"
}

# Run main function
main "$@"
