# Production Deployment Guide

This guide covers deploying the CSV to Azure SQL Importer application in a production environment using Docker Compose with enhanced security and resource management.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- Linux server with at least 4GB RAM and 2 CPU cores
- Domain name (optional, for SSL/TLS)
- Azure SQL Server with firewall configured
- Reverse proxy (nginx/Caddy) for SSL termination (recommended)

## Quick Start

### 1. Prepare the Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Create application directory
mkdir -p /opt/csv-azure-importer
cd /opt/csv-azure-importer
```

### 2. Clone the Repository

```bash
git clone https://github.com/rtwaddell-RPM/csv-azure-importer.git .
```

### 3. Configure Environment

```bash
# Copy production environment template
cp .env.production.template .env.production

# Edit with your actual values
nano .env.production
```

**Required configurations:**
- `MYSQL_ROOT_PASSWORD`: Strong password for MySQL root user
- `MYSQL_PASSWORD`: Strong password for application database user
- `JWT_SECRET`: Generate with `openssl rand -base64 32`
- `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`: Your Manus OAuth credentials

### 4. Create Data Directory

```bash
# Create directory for MySQL data
mkdir -p ./data/mysql
chmod 755 ./data/mysql

# Create directory for MySQL logs
mkdir -p ./mysql-logs
chmod 755 ./mysql-logs
```

### 5. Deploy

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 6. Verify Deployment

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check application health
curl http://localhost:3000

# Check MySQL connection
docker-compose -f docker-compose.prod.yml exec mysql mysql -u csvuser -p -e "SHOW DATABASES;"
```

## Production Features

### Security Enhancements

1. **Container Security**
   - `no-new-privileges`: Prevents privilege escalation
   - `cap_drop: ALL`: Drops all Linux capabilities
   - Minimal capabilities added back (only what's needed)
   - Localhost-only port binding (127.0.0.1)

2. **Network Isolation**
   - Dedicated bridge network with custom subnet
   - Containers communicate via internal network only
   - No direct external access to MySQL

3. **Read-Only Filesystem** (configurable)
   - Application runs with minimal write permissions
   - Temporary files in tmpfs mount

### Resource Management

**MySQL Container:**
- CPU Limit: 2.0 cores
- Memory Limit: 2GB
- CPU Reservation: 0.5 cores
- Memory Reservation: 512MB

**Application Container:**
- CPU Limit: 2.0 cores
- Memory Limit: 1GB
- CPU Reservation: 0.25 cores
- Memory Reservation: 256MB

### Logging Configuration

- **Log Driver**: JSON file
- **MySQL Logs**: Max 10MB per file, 3 files retained
- **App Logs**: Max 10MB per file, 5 files retained
- **Log Location**: `/var/lib/docker/containers/`

View logs:
```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs app

# MySQL logs
docker-compose -f docker-compose.prod.yml logs mysql

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f
```

## Reverse Proxy Setup (nginx)

### Install nginx

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Configure nginx

Create `/etc/nginx/sites-available/csv-importer`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy settings
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # File upload size limit
    client_max_body_size 50M;
}
```

### Enable and obtain SSL certificate

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/csv-importer /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Reload nginx
sudo systemctl reload nginx
```

## Backup and Restore

### Backup MySQL Data

```bash
# Create backup directory
mkdir -p ./backups

# Backup database
docker-compose -f docker-compose.prod.yml exec mysql mysqldump \
  -u root -p${MYSQL_ROOT_PASSWORD} \
  --all-databases --single-transaction --quick --lock-tables=false \
  > ./backups/backup-$(date +%Y%m%d-%H%M%S).sql

# Backup MySQL data volume
sudo tar -czf ./backups/mysql-data-$(date +%Y%m%d-%H%M%S).tar.gz ./data/mysql
```

### Restore from Backup

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore data volume
sudo tar -xzf ./backups/mysql-data-YYYYMMDD-HHMMSS.tar.gz -C ./

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Or restore from SQL dump
docker-compose -f docker-compose.prod.yml exec -T mysql mysql \
  -u root -p${MYSQL_ROOT_PASSWORD} < ./backups/backup-YYYYMMDD-HHMMSS.sql
```

### Automated Backups

Create `/etc/cron.daily/csv-importer-backup`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/csv-azure-importer/backups"
RETENTION_DAYS=30

# Create backup
cd /opt/csv-azure-importer
docker-compose -f docker-compose.prod.yml exec -T mysql mysqldump \
  -u root -p${MYSQL_ROOT_PASSWORD} \
  --all-databases --single-transaction --quick --lock-tables=false \
  > ${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).sql

# Remove old backups
find ${BACKUP_DIR} -name "backup-*.sql" -mtime +${RETENTION_DAYS} -delete
```

Make it executable:
```bash
sudo chmod +x /etc/cron.daily/csv-importer-backup
```

## Monitoring

### Health Checks

```bash
# Check container health status
docker-compose -f docker-compose.prod.yml ps

# View health check logs
docker inspect --format='{{json .State.Health}}' csv-importer-app-prod | jq
docker inspect --format='{{json .State.Health}}' csv-importer-mysql-prod | jq
```

### Resource Usage

```bash
# Monitor resource usage
docker stats csv-importer-app-prod csv-importer-mysql-prod

# View detailed container info
docker-compose -f docker-compose.prod.yml top
```

## Maintenance

### Update Application

```bash
# Pull latest code
cd /opt/csv-azure-importer
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -f
```

### Database Migrations

```bash
# Run migrations (if needed)
docker-compose -f docker-compose.prod.yml exec app pnpm db:push
```

### View Application Logs

```bash
# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 app

# Follow logs
docker-compose -f docker-compose.prod.yml logs -f app

# Export logs
docker-compose -f docker-compose.prod.yml logs --no-color > app-logs.txt
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check environment variables
docker-compose -f docker-compose.prod.yml config

# Verify file permissions
ls -la ./data/mysql
```

### Database Connection Issues

```bash
# Test MySQL connection
docker-compose -f docker-compose.prod.yml exec mysql mysql -u csvuser -p

# Check MySQL logs
docker-compose -f docker-compose.prod.yml logs mysql

# Verify network connectivity
docker-compose -f docker-compose.prod.yml exec app ping mysql
```

### High Resource Usage

```bash
# Check resource limits
docker-compose -f docker-compose.prod.yml config | grep -A 5 resources

# Adjust limits in docker-compose.prod.yml if needed
# Then restart services
docker-compose -f docker-compose.prod.yml up -d
```

## Security Best Practices

1. **Use strong passwords** for all credentials
2. **Keep Docker updated** to the latest stable version
3. **Enable firewall** (ufw/iptables) and allow only necessary ports
4. **Use SSL/TLS** with valid certificates (Let's Encrypt)
5. **Regular backups** with offsite storage
6. **Monitor logs** for suspicious activity
7. **Update application** regularly for security patches
8. **Restrict SSH access** with key-based authentication
9. **Configure Azure SQL firewall** to allow only your server IP
10. **Use environment-specific secrets** (never commit .env files)

## Performance Tuning

### MySQL Optimization

Edit docker-compose.prod.yml to add MySQL configuration:

```yaml
mysql:
  command:
    - --max_connections=200
    - --innodb_buffer_pool_size=1G
    - --innodb_log_file_size=256M
```

### Application Scaling

To run multiple application instances:

```yaml
app:
  deploy:
    replicas: 3
```

Then use a load balancer (nginx/HAProxy) to distribute traffic.

## Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.prod.yml logs`
- Review documentation: README.md
- Contact support through the application interface
