# Ubuntu Server Deployment Guide

## RPM Customer User Importer - Self-Hosted Docker Deployment

This guide provides comprehensive instructions for deploying the RPM Customer User Importer application on an Ubuntu server using Docker containers with custom port mapping (8080:8443). The deployment includes the application, MySQL database, and Nginx reverse proxy, all running in isolated Docker containers with automatic restart capabilities and optional SSL/TLS encryption.

---

## Overview

The Ubuntu server deployment script automates the complete setup process for running the application in a production environment on your own infrastructure. This self-hosted approach provides full control over the deployment, data storage, and security configuration while maintaining the benefits of containerization for easy management and updates.

**Deployment Architecture**: The application runs in three Docker containers coordinated by Docker Compose. The application container hosts the Node.js server on internal port 3000. The MySQL container provides the database backend with persistent storage. The Nginx container acts as a reverse proxy and handles SSL/TLS termination, exposing the application on ports 80 (HTTP), 443 (HTTPS), 8080, and 8443.

**Port Mapping**: The application is accessible on multiple ports to support different access patterns. Port 8080 provides HTTP access directly to the application container. Port 8443 provides an alternative HTTPS access point. Port 80 serves HTTP traffic through Nginx. Port 443 serves HTTPS traffic through Nginx with SSL/TLS encryption.

**Data Persistence**: All application data and database records are stored in Docker volumes that persist across container restarts and updates. The MySQL database uses a dedicated volume for data files, ensuring no data loss when containers are stopped or recreated.

---

## Prerequisites

Before running the deployment script, ensure your Ubuntu server meets the following requirements and has the necessary software installed.

### System Requirements

**Operating System**: Ubuntu 20.04 LTS or later (Ubuntu 22.04 LTS recommended). The script is tested on Ubuntu Server but should work on Ubuntu Desktop as well.

**Hardware Specifications**: Minimum 2 CPU cores and 4 GB RAM for small deployments. Recommended 4 CPU cores and 8 GB RAM for production use with multiple concurrent users. At least 20 GB of available disk space for Docker images, application files, and database storage.

**Network Configuration**: A static IP address or DHCP reservation to ensure consistent access. Open firewall ports 80, 443, 8080, and 8443 for incoming connections. If using a domain name, DNS records must point to the server's IP address.

### Required Software

**Docker Engine**: Version 20.10 or later. The deployment script can automatically install Docker if not present. Docker provides the containerization platform for running the application in isolated environments.

**Docker Compose**: Version 2.0 or later (Docker Compose Plugin). The script can automatically install Docker Compose if not present. Docker Compose orchestrates multiple containers and manages their networking and dependencies.

**Git**: Required for cloning the repository and managing code updates. The script can automatically install Git if not present.

**OpenSSL**: Usually pre-installed on Ubuntu. Required for generating JWT secrets and SSL certificates.

### Optional Software

**Certbot**: Required only if you want to use Let's Encrypt SSL certificates with a domain name. The script can automatically install Certbot when needed.

**UFW (Uncomplicated Firewall)**: Recommended for managing firewall rules. The script will configure UFW rules if it's installed.

---

## Installation

The installation process involves cloning the repository, running the deployment script, and configuring the application settings. The script automates most of the setup, but some manual configuration is required for security and customization.

### Step 1: Clone the Repository

Connect to your Ubuntu server via SSH and clone the application repository to a suitable location. The recommended location is `/opt` for system-wide applications or your home directory for user-specific installations.

```bash
# Navigate to installation directory
cd /opt

# Clone the repository
sudo git clone https://github.com/RPM-Technologies/rpm-customer-user-importer.git

# Change ownership to your user (optional)
sudo chown -R $USER:$USER rpm-customer-user-importer

# Navigate to project directory
cd rpm-customer-user-importer
```

### Step 2: Run the Deployment Script

Execute the deployment script with sudo privileges. The script will check for prerequisites, install missing software, create configuration files, build Docker images, and start all services.

**Basic Deployment** (without domain name):

```bash
sudo ./deployment/deploy-ubuntu-server.sh
```

This command deploys the application with default settings, accessible via IP address on ports 8080 and 8443.

**Deployment with Domain Name and SSL**:

```bash
sudo ./deployment/deploy-ubuntu-server.sh \
  --domain importer.rpm-technologies.com \
  --email admin@rpm-technologies.com
```

This command deploys the application with a domain name and automatically obtains a free SSL certificate from Let's Encrypt. The email address is used for certificate expiration notifications.

**Deployment with External Database**:

```bash
sudo ./deployment/deploy-ubuntu-server.sh --skip-mysql
```

Use this option if you have an existing MySQL database server and don't want to run MySQL in a container. You'll need to manually configure the DATABASE_URL in the environment file.

### Step 3: Configure Environment Variables

After the script completes, edit the environment configuration file to customize settings for your deployment. The file is located at `.env.production` in the project root directory.

```bash
nano /opt/rpm-customer-user-importer/.env.production
```

**Critical Settings to Configure**:

**Database Connection** (if using external MySQL):
```
DATABASE_URL=mysql://username:password@hostname:3306/database_name?ssl=true
```

**JWT Secret**: The script generates a random secret automatically, but you can replace it with your own if needed. This secret is used for signing authentication tokens and must be kept confidential.

**OAuth Configuration** (if using Manus OAuth or other OAuth providers):
```
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your-app-id
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name
```

**Application Branding**:
```
VITE_APP_TITLE=RPM Customer User Importer
VITE_APP_LOGO=/logo.png
```

**Save and Exit**: Press `Ctrl+X`, then `Y`, then `Enter` to save changes in nano.

### Step 4: Restart Services

After editing the environment file, restart the application containers to apply the new configuration.

```bash
cd /opt/rpm-customer-user-importer
sudo docker-compose -f docker-compose.production.yml restart
```

The restart typically takes 10-20 seconds. Monitor the logs to ensure services start successfully.

### Step 5: Verify Deployment

Check that all containers are running and healthy.

```bash
sudo docker-compose -f docker-compose.production.yml ps
```

You should see three containers running: `rpm-importer-app`, `rpm-importer-mysql`, and `rpm-importer-nginx`.

**View Application Logs**:

```bash
sudo docker-compose -f docker-compose.production.yml logs -f app
```

Press `Ctrl+C` to stop following logs.

**Test Application Access**:

Open a web browser and navigate to your server's IP address or domain name:
- `http://your-server-ip:8080`
- `http://your-server-ip` (port 80 through Nginx)
- `https://your-domain.com` (if configured with SSL)

You should see the RPM Customer User Importer login page.

---

## Configuration

This section provides detailed information about configuration files and customization options for the deployment.

### Docker Compose Configuration

The production deployment uses `docker-compose.production.yml`, which defines three services and their relationships. This file is automatically created by the deployment script but can be manually edited for advanced customization.

**Application Service** (`app`):
- Built from the Dockerfile in the project root
- Exposes internal port 3000
- Mapped to host ports 8080 and 8443
- Depends on MySQL service being healthy before starting
- Uses environment variables from `.env.production`
- Restarts automatically unless manually stopped

**MySQL Service** (`mysql`):
- Uses official MySQL 8.0 image
- Exposes port 3306 for database connections
- Stores data in persistent Docker volume `mysql-data`
- Includes health check to verify database is ready
- Default credentials: user `csvuser`, password `csvpassword`, database `csv_importer`

**Nginx Service** (`nginx`):
- Uses official Nginx Alpine image for minimal footprint
- Exposes ports 80 (HTTP) and 443 (HTTPS)
- Loads configuration from `deployment/nginx.conf`
- Acts as reverse proxy to application container
- Handles SSL/TLS termination if certificates are configured

### Nginx Configuration

The Nginx configuration file (`deployment/nginx.conf`) controls how HTTP requests are routed to the application container. The deployment script creates different configurations based on whether a domain name is specified.

**Without Domain Name**: Nginx listens on port 80 and forwards all requests to the application container on port 3000. No SSL/TLS encryption is configured. Access the application via `http://server-ip`.

**With Domain Name**: Nginx listens on both port 80 and port 443. Port 80 automatically redirects to HTTPS on port 443. SSL/TLS certificates are loaded from `deployment/ssl/` directory. Access the application via `https://domain.com`.

**Custom Nginx Configuration**: To modify Nginx behavior, edit `deployment/nginx.conf` and restart the Nginx container:

```bash
sudo docker-compose -f docker-compose.production.yml restart nginx
```

Common customizations include adding custom headers, configuring rate limiting, setting up additional proxy rules, or enabling gzip compression.

### Environment Variables

The `.env.production` file contains all configuration settings for the application. Each variable serves a specific purpose and should be configured according to your deployment requirements.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | MySQL connection string | `mysql://user:pass@host:3306/db` |
| `NODE_ENV` | Yes | Node.js environment (always `production`) | `production` |
| `PORT` | Yes | Internal application port (always `3000`) | `3000` |
| `JWT_SECRET` | Yes | Secret for JWT token signing | Auto-generated random string |
| `OAUTH_SERVER_URL` | No | OAuth server base URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | No | OAuth login portal URL | `https://portal.manus.im` |
| `VITE_APP_ID` | No | OAuth application ID | Your app ID |
| `OWNER_OPEN_ID` | No | Owner's OAuth identifier | Your open ID |
| `OWNER_NAME` | No | Owner's display name | Your name |
| `VITE_APP_TITLE` | No | Application title | `RPM Customer User Importer` |
| `VITE_APP_LOGO` | No | Application logo path | `/logo.png` |

### SSL/TLS Certificates

SSL/TLS certificates enable encrypted HTTPS connections to protect data in transit. The deployment supports both Let's Encrypt certificates (free, automated) and custom certificates (purchased from certificate authorities).

**Let's Encrypt Certificates** (Automatic):

When you deploy with the `--domain` and `--email` options, the script automatically obtains a certificate from Let's Encrypt using Certbot. The certificate is valid for 90 days and should be renewed before expiration.

**Manual Certificate Renewal**:

```bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/rpm-customer-user-importer/deployment/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/rpm-customer-user-importer/deployment/ssl/key.pem
sudo docker-compose -f /opt/rpm-customer-user-importer/docker-compose.production.yml restart nginx
```

**Automatic Certificate Renewal** (Recommended):

Set up a cron job to automatically renew certificates:

```bash
sudo crontab -e
```

Add the following line to run renewal check daily at 2 AM:

```
0 2 * * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/*.pem /opt/rpm-customer-user-importer/deployment/ssl/ && docker-compose -f /opt/rpm-customer-user-importer/docker-compose.production.yml restart nginx
```

**Custom Certificates**:

If you have purchased SSL certificates from a certificate authority, place them in the `deployment/ssl/` directory:

```bash
sudo cp your-certificate.crt /opt/rpm-customer-user-importer/deployment/ssl/cert.pem
sudo cp your-private-key.key /opt/rpm-customer-user-importer/deployment/ssl/key.pem
sudo docker-compose -f /opt/rpm-customer-user-importer/docker-compose.production.yml restart nginx
```

---

## Management

This section covers common administrative tasks for managing the deployed application.

### Starting and Stopping Services

**Start All Services**:

```bash
cd /opt/rpm-customer-user-importer
sudo docker-compose -f docker-compose.production.yml start
```

**Stop All Services**:

```bash
cd /opt/rpm-customer-user-importer
sudo docker-compose -f docker-compose.production.yml stop
```

**Restart All Services**:

```bash
cd /opt/rpm-customer-user-importer
sudo docker-compose -f docker-compose.production.yml restart
```

**Restart Individual Service**:

```bash
sudo docker-compose -f docker-compose.production.yml restart app
sudo docker-compose -f docker-compose.production.yml restart mysql
sudo docker-compose -f docker-compose.production.yml restart nginx
```

### Viewing Logs

Logs are essential for troubleshooting issues and monitoring application behavior.

**View All Logs**:

```bash
sudo docker-compose -f docker-compose.production.yml logs
```

**Follow Logs in Real-Time**:

```bash
sudo docker-compose -f docker-compose.production.yml logs -f
```

Press `Ctrl+C` to stop following logs.

**View Logs for Specific Service**:

```bash
sudo docker-compose -f docker-compose.production.yml logs app
sudo docker-compose -f docker-compose.production.yml logs mysql
sudo docker-compose -f docker-compose.production.yml logs nginx
```

**View Last N Lines of Logs**:

```bash
sudo docker-compose -f docker-compose.production.yml logs --tail=100 app
```

### Updating the Application

To deploy new versions of the application code, pull the latest changes from the repository and rebuild the Docker image.

**Step 1: Pull Latest Code**:

```bash
cd /opt/rpm-customer-user-importer
sudo git pull origin main
```

**Step 2: Rebuild Docker Image**:

```bash
sudo docker-compose -f docker-compose.production.yml build --no-cache app
```

**Step 3: Restart Application**:

```bash
sudo docker-compose -f docker-compose.production.yml up -d app
```

The `up -d` command recreates the container with the new image while keeping other services running.

**Step 4: Run Database Migrations** (if schema changed):

```bash
sudo docker-compose -f docker-compose.production.yml exec app pnpm db:push
```

### Database Backup and Restore

Regular database backups are critical for disaster recovery and data protection.

**Create Database Backup**:

```bash
# Create backup directory
sudo mkdir -p /opt/backups

# Export database
sudo docker-compose -f /opt/rpm-customer-user-importer/docker-compose.production.yml exec -T mysql \
  mysqldump -u csvuser -pcsvpassword csv_importer > /opt/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore Database from Backup**:

```bash
# Restore from backup file
sudo docker-compose -f /opt/rpm-customer-user-importer/docker-compose.production.yml exec -T mysql \
  mysql -u csvuser -pcsvpassword csv_importer < /opt/backups/backup_20250116_120000.sql
```

**Automated Backup Script**:

Create a backup script at `/opt/backup-rpm-importer.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR
cd /opt/rpm-customer-user-importer

# Create backup
docker-compose -f docker-compose.production.yml exec -T mysql \
  mysqldump -u csvuser -pcsvpassword csv_importer > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql

# Delete backups older than retention period
find $BACKUP_DIR -name "backup_*.sql" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $(date)"
```

Make it executable and add to crontab:

```bash
sudo chmod +x /opt/backup-rpm-importer.sh
sudo crontab -e
```

Add line to run daily at 3 AM:

```
0 3 * * * /opt/backup-rpm-importer.sh >> /var/log/rpm-importer-backup.log 2>&1
```

### Monitoring Resource Usage

Monitor Docker container resource consumption to ensure optimal performance.

**View Container Resource Usage**:

```bash
sudo docker stats
```

This displays real-time CPU, memory, network, and disk I/O statistics for all running containers.

**View Disk Usage**:

```bash
sudo docker system df
```

This shows disk space used by Docker images, containers, and volumes.

**Clean Up Unused Resources**:

```bash
# Remove unused images
sudo docker image prune -a

# Remove unused volumes (WARNING: This deletes data!)
sudo docker volume prune

# Remove everything unused
sudo docker system prune -a --volumes
```

---

## Troubleshooting

This section addresses common issues and their solutions.

### Application Not Accessible

**Symptom**: Cannot access the application via browser, connection timeout or refused.

**Possible Causes and Solutions**:

**Firewall Blocking Ports**: Check if UFW or iptables is blocking the required ports.

```bash
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8443/tcp
```

**Containers Not Running**: Verify all containers are running.

```bash
sudo docker-compose -f docker-compose.production.yml ps
```

If containers are not running, start them:

```bash
sudo docker-compose -f docker-compose.production.yml up -d
```

**Port Already in Use**: Another service may be using the required ports.

```bash
sudo netstat -tulpn | grep -E ':(80|443|8080|8443|3306)'
```

Stop the conflicting service or change the port mapping in `docker-compose.production.yml`.

**DNS Not Resolving**: If using a domain name, verify DNS records are correct.

```bash
nslookup your-domain.com
dig your-domain.com
```

The DNS A record should point to your server's IP address.

### Database Connection Errors

**Symptom**: Application logs show "Cannot connect to database" or "Connection refused" errors.

**Possible Causes and Solutions**:

**MySQL Container Not Ready**: The application may have started before MySQL was fully initialized.

```bash
# Check MySQL container health
sudo docker-compose -f docker-compose.production.yml ps mysql

# View MySQL logs
sudo docker-compose -f docker-compose.production.yml logs mysql
```

Wait for MySQL to complete initialization (usually 30-60 seconds on first start), then restart the application:

```bash
sudo docker-compose -f docker-compose.production.yml restart app
```

**Incorrect Database Credentials**: Verify the DATABASE_URL in `.env.production` matches the MySQL configuration.

```bash
# Check environment variable
sudo docker-compose -f docker-compose.production.yml exec app env | grep DATABASE_URL
```

The URL should match the MySQL credentials defined in `docker-compose.production.yml`.

**Database Network Issue**: Ensure containers are on the same Docker network.

```bash
sudo docker network inspect rpm-importer-network
```

Both `app` and `mysql` containers should be listed in the network.

### SSL Certificate Errors

**Symptom**: Browser shows "Your connection is not private" or "Certificate error" warnings.

**Possible Causes and Solutions**:

**Certificate Files Missing**: Verify certificate files exist in the correct location.

```bash
ls -la /opt/rpm-customer-user-importer/deployment/ssl/
```

You should see `cert.pem` and `key.pem` files.

**Certificate Expired**: Let's Encrypt certificates expire after 90 days.

```bash
sudo certbot certificates
```

Renew the certificate:

```bash
sudo certbot renew --force-renewal
```

**Self-Signed Certificate Warning**: If you're using a self-signed certificate for testing, browsers will show a warning. This is expected behavior. Click "Advanced" and "Proceed" to continue.

### High Memory Usage

**Symptom**: Server becomes slow or unresponsive, high memory usage reported.

**Possible Causes and Solutions**:

**Insufficient Server Resources**: Check available memory.

```bash
free -h
```

If memory is consistently near capacity, consider upgrading your server or reducing the number of concurrent connections.

**Memory Leak in Application**: Restart the application container to free memory.

```bash
sudo docker-compose -f docker-compose.production.yml restart app
```

If the issue persists, check application logs for errors and consider reporting the issue to the development team.

**MySQL Buffer Pool Too Large**: The MySQL buffer pool may be configured too large for your server's memory. Edit the MySQL configuration in `docker-compose.production.yml` to add:

```yaml
mysql:
  command: --innodb-buffer-pool-size=256M
```

Then restart MySQL:

```bash
sudo docker-compose -f docker-compose.production.yml restart mysql
```

---

## Security Best Practices

Follow these security recommendations to protect your deployment from unauthorized access and data breaches.

### Change Default Credentials

The default MySQL credentials (`csvuser`/`csvpassword`) should be changed immediately after deployment. Edit `docker-compose.production.yml` and `.env.production` to use strong, unique passwords.

**Step 1: Update docker-compose.production.yml**:

```yaml
mysql:
  environment:
    MYSQL_ROOT_PASSWORD: your-strong-root-password
    MYSQL_PASSWORD: your-strong-user-password
```

**Step 2: Update .env.production**:

```
DATABASE_URL=mysql://csvuser:your-strong-user-password@mysql:3306/csv_importer?ssl=false
```

**Step 3: Recreate MySQL container**:

```bash
sudo docker-compose -f docker-compose.production.yml stop mysql
sudo docker volume rm rpm-customer-user-importer_mysql-data  # WARNING: Deletes all data
sudo docker-compose -f docker-compose.production.yml up -d mysql
```

### Enable SSL/TLS Encryption

Always use HTTPS in production to encrypt data in transit. Follow the SSL certificate setup instructions in the Configuration section to enable HTTPS with Let's Encrypt or custom certificates.

### Restrict Database Access

The MySQL container exposes port 3306 to the host, which may allow external connections. If you don't need external database access, remove the port mapping from `docker-compose.production.yml`:

```yaml
mysql:
  # Remove or comment out this line:
  # ports:
  #   - "3306:3306"
```

This keeps MySQL accessible only to other Docker containers on the same network.

### Regular Security Updates

Keep your server and Docker images up to date with security patches.

**Update Ubuntu System**:

```bash
sudo apt update
sudo apt upgrade -y
```

**Update Docker Images**:

```bash
cd /opt/rpm-customer-user-importer
sudo docker-compose -f docker-compose.production.yml pull
sudo docker-compose -f docker-compose.production.yml up -d
```

### Implement Rate Limiting

Configure Nginx to limit the number of requests from a single IP address to prevent abuse and DDoS attacks. Add to `deployment/nginx.conf` inside the `http` block:

```nginx
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

server {
    location / {
        limit_req zone=mylimit burst=20 nodelay;
        # ... rest of configuration
    }
}
```

This limits each IP to 10 requests per second with a burst allowance of 20 requests.

### Use Fail2Ban

Install Fail2Ban to automatically block IP addresses that show malicious behavior (repeated failed login attempts).

```bash
sudo apt install fail2ban -y
```

Configure Fail2Ban to monitor Nginx logs and block suspicious IPs.

---

## Uninstalling

To completely remove the application and all associated data from your server, follow these steps.

**Step 1: Stop and Remove Containers**:

```bash
cd /opt/rpm-customer-user-importer
sudo docker-compose -f docker-compose.production.yml down -v
```

The `-v` flag removes all volumes, including the MySQL database. **This permanently deletes all application data.**

**Step 2: Remove Docker Images**:

```bash
sudo docker rmi $(sudo docker images -q 'rpm-customer-user-importer*')
```

**Step 3: Remove Project Directory**:

```bash
sudo rm -rf /opt/rpm-customer-user-importer
```

**Step 4: Remove Backups** (optional):

```bash
sudo rm -rf /opt/backups
```

**Step 5: Remove Firewall Rules** (optional):

```bash
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
sudo ufw delete allow 8080/tcp
sudo ufw delete allow 8443/tcp
```

**Step 6: Remove SSL Certificates** (if using Let's Encrypt):

```bash
sudo certbot delete --cert-name your-domain.com
```

---

## Support and Additional Resources

For additional help and information, consult these resources:

**Project Documentation**:
- `AZURE_DEPLOYMENT.md` - Azure App Services deployment guide
- `MYSQL_AZURE_CONFIGURATION.md` - MySQL configuration for Azure
- `deployment/README.md` - Automated Azure deployment scripts
- `README.md` - Application overview and features

**Docker Documentation**:
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

**Nginx Documentation**:
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Nginx Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)

**Community Support**:
- GitHub Issues (for this project)
- Stack Overflow (tags: docker, nginx, nodejs)
- Docker Community Forums

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Author**: Manus AI
