# CSV Azure Importer - Deployment Guide

This guide explains how to use the deployment script to manage the CSV Azure Importer application in production.

## Prerequisites

- Ubuntu server with Docker and Docker Compose installed
- Git repository access
- SSL certificates in `/etc/letsencrypt/live/rpm-importer-dev.rpmit.com/`
- Sudo access

## Deployment Script

The `deploy.sh` script provides easy commands for managing the application.

### Installation

1. Copy the `deploy.sh` script to the server:
   ```bash
   scp deploy.sh user@server:/opt/customer-importer/
   ```

2. Make it executable:
   ```bash
   sudo chmod +x /opt/customer-importer/deploy.sh
   ```

### Commands

#### Deploy Application

Deploy the application with existing code:
```bash
sudo /opt/customer-importer/deploy.sh deploy
```

Deploy with latest code from Git:
```bash
sudo /opt/customer-importer/deploy.sh deploy --pull
# or
sudo /opt/customer-importer/deploy.sh deploy -p
```

This command will:
- Pull latest code from Git (if `--pull` flag is used)
- Create/verify environment files
- Create/verify Docker Compose configuration
- Create/verify Nginx configuration
- Copy SSL certificates
- Build Docker images
- Start all containers
- Initialize database tables
- Add default admin user

#### Restart Application

Restart all containers without rebuilding:
```bash
sudo /opt/customer-importer/deploy.sh restart
```

#### Stop Application

Stop all containers:
```bash
sudo /opt/customer-importer/deploy.sh stop
```

#### View Logs

View real-time application logs:
```bash
sudo /opt/customer-importer/deploy.sh logs
```

Press `Ctrl+C` to exit log viewing.

#### Check Status

Check container status:
```bash
sudo /opt/customer-importer/deploy.sh status
```

## Configuration Files

The deployment script automatically creates these files if they don't exist:

### `.env.production`
Environment variables for the application including:
- Azure AD configuration
- Database connection
- Session secrets
- Azure SQL configuration

### `docker-compose.production.yml`
Docker Compose configuration defining:
- Application container
- MySQL database container
- Nginx reverse proxy container

### `deployment/nginx.conf`
Nginx configuration for:
- HTTP proxy on port 8080
- HTTPS proxy on port 8443
- SSL certificate configuration

### `deployment/ssl/`
SSL certificates copied from Let's Encrypt:
- `fullchain.pem`
- `privkey.pem`

## Database Initialization

The deployment script automatically:
1. Creates `sessions` table for session storage
2. Creates `users` table for user authentication
3. Adds default admin user (rtwaddell@rpmit.com)

## Troubleshooting

### Containers won't start

Check logs:
```bash
sudo /opt/customer-importer/deploy.sh logs
```

Check container status:
```bash
sudo /opt/customer-importer/deploy.sh status
```

### Database connection errors

Verify MySQL container is healthy:
```bash
sudo docker ps | grep mysql
```

Check MySQL logs:
```bash
sudo docker logs rpm-importer-mysql
```

### SSL certificate errors

Verify certificates exist:
```bash
ls -la /etc/letsencrypt/live/rpm-importer-dev.rpmit.com/
```

Renew certificates if expired:
```bash
sudo certbot renew
```

### Environment variables not loading

Verify `.env.production` exists:
```bash
cat /opt/customer-importer/.env.production
```

Recreate if missing:
```bash
sudo /opt/customer-importer/deploy.sh deploy
```

## Manual Operations

### Access MySQL Database

```bash
sudo docker exec -it rpm-importer-mysql mysql -uroot -prootpassword csv_importer
```

### View All Users

```bash
sudo docker exec rpm-importer-mysql mysql -uroot -prootpassword csv_importer -e "SELECT id, name, email, role FROM users;"
```

### Add Admin User

```bash
sudo docker exec rpm-importer-mysql mysql -uroot -prootpassword csv_importer -e "UPDATE users SET role='admin' WHERE email='user@example.com';"
```

### Backup Database

```bash
sudo docker exec rpm-importer-mysql mysqldump -uroot -prootpassword csv_importer > backup.sql
```

### Restore Database

```bash
sudo docker exec -i rpm-importer-mysql mysql -uroot -prootpassword csv_importer < backup.sql
```

## Application URLs

- **HTTPS (Production)**: https://rpm-importer-dev.rpmit.com:8443
- **HTTP (Development)**: http://rpm-importer-dev.rpmit.com:8080

## Support

For issues or questions, contact the development team.
