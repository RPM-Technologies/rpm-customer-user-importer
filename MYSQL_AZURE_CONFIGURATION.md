# MySQL Database Configuration for Azure Deployment

## RPM Customer User Importer - Azure Database Setup Guide

This guide provides detailed instructions for configuring the MySQL database when deploying the RPM Customer User Importer application to Azure App Services. The application requires a MySQL database to store application-specific data including database connection configurations, field mapping templates, and audit logs.

---

## Overview

The application architecture separates data storage into two distinct database systems, each serving a specific purpose:

**Application Database (MySQL)**: Stores application configuration and operational data including Azure SQL connection strings, saved mapping templates, import history, and cleanup audit logs. This database is managed by you and can be hosted on Azure Database for MySQL or any MySQL-compatible service.

**Target Database (Azure SQL Server)**: The destination database where customer user data is imported. This is your existing Azure SQL Server at rpm-reporting.database.windows.net with the RPM_Reporting database. The application connects to this database to import CSV data into the [other].[CustomerData] table.

This separation ensures that application configuration data remains isolated from business data, providing better security, scalability, and maintenance capabilities.

---

## MySQL Deployment Options for Azure

When deploying to Azure App Services, you have three primary options for hosting the MySQL database that stores application data.

### Option 1: Azure Database for MySQL Flexible Server (Recommended)

Azure Database for MySQL Flexible Server provides a fully managed MySQL service with enterprise-grade security, automatic backups, high availability, and seamless integration with Azure App Services. This is the recommended option for production deployments due to its reliability, security features, and ease of management.

**Advantages**: Fully managed service with automatic backups, patching, and monitoring. Built-in high availability and disaster recovery capabilities. Automatic scaling options. Enterprise-grade security with private endpoints and firewall rules. No server maintenance required.

**Disadvantages**: Higher cost compared to self-hosted options. Minimum pricing tier may be more than needed for small deployments. Some MySQL features may be limited compared to self-hosted installations.

**Best For**: Production environments, applications requiring high availability, teams without dedicated database administrators, compliance-sensitive deployments requiring audit trails and security certifications.

### Option 2: MySQL in Azure Container Instance

Azure Container Instances allow you to run the MySQL Docker container alongside your application container. This approach provides more control over the MySQL configuration and version while still leveraging Azure's container orchestration capabilities.

**Advantages**: Full control over MySQL version and configuration. Lower cost for small to medium workloads. Can use the same Docker Compose configuration with minor modifications. Easier migration path from local development to cloud deployment.

**Disadvantages**: Requires manual backup and disaster recovery setup. No automatic high availability. You are responsible for security patches and updates. Requires more DevOps expertise to manage properly.

**Best For**: Development and staging environments, cost-sensitive deployments, applications with specific MySQL version requirements, teams with container orchestration experience.

### Option 3: Third-Party MySQL Hosting

Services like PlanetScale, Amazon RDS for MySQL, or DigitalOcean Managed Databases can host your MySQL database while your application runs on Azure App Services. These services often provide MySQL-compatible databases with additional features.

**Advantages**: May offer better pricing or features than Azure Database for MySQL. Can leverage multi-cloud strategies. Some services offer serverless MySQL with automatic scaling. May provide better performance for specific workloads.

**Disadvantages**: Data egress costs between cloud providers. Increased network latency compared to same-region Azure services. More complex networking and security configuration. Vendor lock-in to third-party service.

**Best For**: Multi-cloud deployments, organizations already using specific database providers, applications requiring features not available in Azure Database for MySQL, cost optimization scenarios.

---

## Option 1: Azure Database for MySQL Flexible Server Setup

This section provides step-by-step instructions for creating and configuring Azure Database for MySQL Flexible Server, which is the recommended approach for production deployments.

### Step 1: Create MySQL Flexible Server

Create a new Azure Database for MySQL Flexible Server instance using the Azure CLI. This command creates a server with appropriate settings for the application.

```bash
az mysql flexible-server create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --location eastus \
  --admin-user adminuser \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 8.0.21 \
  --storage-size 32 \
  --backup-retention 7 \
  --public-access 0.0.0.0
```

**Parameter Explanation**: The resource group should match the one created for your App Service. The server name must be globally unique across all Azure subscriptions. Choose a location close to your App Service for optimal performance. The admin password must meet Azure's complexity requirements (minimum 8 characters with uppercase, lowercase, numbers, and special characters). The Standard_B1ms SKU provides 1 vCPU and 2 GB RAM, suitable for moderate workloads. The Burstable tier offers cost-effective performance for applications with variable load. MySQL version 8.0.21 ensures compatibility with the application. Storage size of 32 GB is sufficient for most deployments and can be increased later. Backup retention of 7 days provides a week of recovery options. Public access setting allows Azure services to connect; this will be restricted further with firewall rules.

### Step 2: Configure Firewall Rules

Configure the MySQL server firewall to allow connections from your Azure App Service while blocking unauthorized access.

**Allow Azure Services**:

```bash
az mysql flexible-server firewall-rule create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

This special rule (0.0.0.0 to 0.0.0.0) allows all Azure services within the same region to connect to your MySQL server. While convenient, this is less secure than specifying individual IP addresses.

**Allow Specific App Service IPs (More Secure)**:

For enhanced security, restrict access to only your App Service's outbound IP addresses:

```bash
# Get App Service outbound IPs
az webapp show \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --query outboundIpAddresses \
  --output tsv
```

This command returns a comma-separated list of IP addresses. Create a firewall rule for each IP address:

```bash
az mysql flexible-server firewall-rule create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --rule-name AllowAppService1 \
  --start-ip-address <IP-ADDRESS-1> \
  --end-ip-address <IP-ADDRESS-1>
```

Repeat this command for each outbound IP address, using unique rule names (AllowAppService1, AllowAppService2, etc.). This approach provides better security by limiting access to only your application.

### Step 3: Create Application Database

Create the specific database that the application will use for storing its data:

```bash
az mysql flexible-server db create \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --database-name rpm_importer
```

The database name `rpm_importer` matches the default configuration in the application. You can use a different name if you update the DATABASE_URL environment variable accordingly.

### Step 4: Configure SSL/TLS

Azure Database for MySQL enforces SSL connections by default for security. Verify that SSL is enabled:

```bash
az mysql flexible-server parameter show \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --name require_secure_transport
```

The value should be "ON". If it's not enabled, enable it with:

```bash
az mysql flexible-server parameter set \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --name require_secure_transport \
  --value ON
```

SSL encryption protects data in transit between your application and the database, preventing eavesdropping and man-in-the-middle attacks.

### Step 5: Configure App Service Environment Variables

Update your Azure App Service with the MySQL connection string and other required environment variables:

```bash
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings \
    DATABASE_URL="mysql://adminuser:YourSecurePassword123!@rpm-importer-mysql.mysql.database.azure.com:3306/rpm_importer?ssl=true"
```

**Connection String Format**: The DATABASE_URL follows the standard MySQL connection string format: `mysql://username:password@hostname:port/database?options`. Replace `adminuser` with your admin username, `YourSecurePassword123!` with your actual password, and `rpm-importer-mysql` with your server name. The `?ssl=true` parameter is critical as it enforces SSL encryption for the connection.

**Important Security Note**: Never commit database passwords to version control. Use Azure Key Vault for production deployments to securely manage sensitive configuration values.

### Step 6: Initialize Database Schema

After deploying your application to Azure App Service, you need to initialize the database schema by running migrations.

**Access App Service SSH Console**:

1. Navigate to your App Service in the Azure Portal
2. Select "SSH" from the Development Tools section in the left menu
3. Click "Go" to open the SSH console in your browser

**Run Database Migrations**:

In the SSH console, navigate to the application directory and execute the migration command:

```bash
cd /app
pnpm db:push
```

This command uses Drizzle ORM to create all necessary tables in the MySQL database:

**Tables Created**:
- `users`: Stores user authentication information and profiles
- `azure_connections`: Stores Azure SQL Server connection configurations
- `mapping_templates`: Stores saved field mapping configurations for reuse
- `import_jobs`: Tracks import history with status and metadata
- `cleanup_audit_logs`: Records all data cleanup operations for audit purposes

Verify that the migration completed successfully by checking for any error messages in the console output. If errors occur, they typically relate to connection issues or permission problems.

### Step 7: Verify Database Connection

Test the database connection to ensure everything is configured correctly:

**From App Service SSH Console**:

```bash
mysql -h rpm-importer-mysql.mysql.database.azure.com \
  -u adminuser \
  -p \
  --ssl-mode=REQUIRED \
  rpm_importer
```

Enter your password when prompted. If the connection succeeds, you'll see the MySQL prompt. Run a simple query to verify:

```sql
SHOW TABLES;
```

You should see the tables created by the migration (users, azure_connections, mapping_templates, import_jobs, cleanup_audit_logs).

**From Application**:

Access your application through the web browser and try to perform an operation that requires database access, such as creating a new Azure SQL connection. If the operation succeeds, the database is properly configured.

---

## Option 2: MySQL in Azure Container Instance

This section explains how to deploy MySQL as a container alongside your application, providing more control over the database configuration.

### Step 1: Create Azure Container Instance for MySQL

Create a container instance running MySQL with persistent storage:

```bash
# Create storage account for persistent data
az storage account create \
  --name rpmimportermysqlstorage \
  --resource-group rpm-importer-rg \
  --location eastus \
  --sku Standard_LRS

# Get storage account key
STORAGE_KEY=$(az storage account keys list \
  --resource-group rpm-importer-rg \
  --account-name rpmimportermysqlstorage \
  --query '[0].value' \
  --output tsv)

# Create file share for MySQL data
az storage share create \
  --name mysql-data \
  --account-name rpmimportermysqlstorage \
  --account-key $STORAGE_KEY

# Create container instance
az container create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-container \
  --image mysql:8.0 \
  --dns-name-label rpm-importer-mysql \
  --ports 3306 \
  --cpu 1 \
  --memory 2 \
  --environment-variables \
    MYSQL_ROOT_PASSWORD=YourSecureRootPassword123! \
    MYSQL_DATABASE=rpm_importer \
    MYSQL_USER=csvuser \
    MYSQL_PASSWORD=YourSecurePassword123! \
  --azure-file-volume-account-name rpmimportermysqlstorage \
  --azure-file-volume-account-key $STORAGE_KEY \
  --azure-file-volume-share-name mysql-data \
  --azure-file-volume-mount-path /var/lib/mysql
```

**Storage Configuration**: The Azure File Share provides persistent storage for MySQL data. Without this, all data would be lost when the container restarts. The storage account uses Standard_LRS (Locally Redundant Storage) for cost-effectiveness while maintaining durability.

**Container Configuration**: The container is allocated 1 CPU and 2 GB memory, suitable for moderate workloads. The DNS name label creates a fully qualified domain name (FQDN) for accessing the MySQL instance. Environment variables configure the MySQL instance with a root password, application database, and application user credentials.

### Step 2: Configure Networking

By default, Azure Container Instances are publicly accessible. For production deployments, integrate with a Virtual Network for enhanced security:

```bash
# Create Virtual Network
az network vnet create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name mysql-subnet \
  --subnet-prefix 10.0.1.0/24

# Create container instance in VNet
az container create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-container \
  --image mysql:8.0 \
  --vnet rpm-importer-vnet \
  --subnet mysql-subnet \
  --environment-variables \
    MYSQL_ROOT_PASSWORD=YourSecureRootPassword123! \
    MYSQL_DATABASE=rpm_importer \
    MYSQL_USER=csvuser \
    MYSQL_PASSWORD=YourSecurePassword123! \
  --azure-file-volume-account-name rpmimportermysqlstorage \
  --azure-file-volume-account-key $STORAGE_KEY \
  --azure-file-volume-share-name mysql-data \
  --azure-file-volume-mount-path /var/lib/mysql
```

With VNet integration, the MySQL container is only accessible from within the virtual network, significantly improving security.

### Step 3: Configure App Service VNet Integration

Connect your App Service to the same Virtual Network so it can access the MySQL container:

```bash
# Create subnet for App Service
az network vnet subnet create \
  --resource-group rpm-importer-rg \
  --vnet-name rpm-importer-vnet \
  --name app-subnet \
  --address-prefix 10.0.2.0/24 \
  --delegations Microsoft.Web/serverFarms

# Enable VNet integration for App Service
az webapp vnet-integration add \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --vnet rpm-importer-vnet \
  --subnet app-subnet
```

The subnet delegation to Microsoft.Web/serverFarms is required for App Service VNet integration. This allows the App Service to inject network interfaces into the subnet.

### Step 4: Configure App Service Environment Variables

Update the App Service with the MySQL connection string pointing to the container instance:

```bash
# Get container IP address
MYSQL_IP=$(az container show \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-container \
  --query ipAddress.ip \
  --output tsv)

# Set environment variable
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings \
    DATABASE_URL="mysql://csvuser:YourSecurePassword123!@${MYSQL_IP}:3306/rpm_importer"
```

If using VNet integration, you can use the container's private IP address instead of the public IP for enhanced security.

### Step 5: Backup Configuration

Since you're managing MySQL yourself, you need to configure backups manually:

**Create Backup Script**:

```bash
#!/bin/bash
# backup-mysql.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="rpm_importer_backup_${TIMESTAMP}.sql"

# Create backup
mysqldump -h rpm-importer-mysql-container.eastus.azurecontainer.io \
  -u csvuser \
  -pYourSecurePassword123! \
  rpm_importer > ${BACKUP_DIR}/${BACKUP_FILE}

# Compress backup
gzip ${BACKUP_DIR}/${BACKUP_FILE}

# Upload to Azure Blob Storage
az storage blob upload \
  --account-name rpmimporterbackups \
  --container-name mysql-backups \
  --name ${BACKUP_FILE}.gz \
  --file ${BACKUP_DIR}/${BACKUP_FILE}.gz

# Clean up old local backups (keep last 7 days)
find ${BACKUP_DIR} -name "rpm_importer_backup_*.sql.gz" -mtime +7 -delete
```

Schedule this script to run daily using Azure Automation or a cron job on a management VM.

---

## Database Connection String Reference

The DATABASE_URL environment variable uses the standard MySQL connection string format with various options for different deployment scenarios.

### Connection String Format

```
mysql://username:password@hostname:port/database?options
```

### Component Breakdown

| Component | Description | Example |
|-----------|-------------|---------|
| Protocol | Database type identifier | `mysql://` |
| Username | MySQL user with database access | `adminuser` or `csvuser` |
| Password | User's password (URL-encoded if special chars) | `YourSecurePassword123!` |
| Hostname | MySQL server address | `rpm-importer-mysql.mysql.database.azure.com` |
| Port | MySQL port (default: 3306) | `3306` |
| Database | Database name | `rpm_importer` |
| Options | Connection parameters | `?ssl=true&connectionLimit=10` |

### Common Connection String Examples

**Azure Database for MySQL Flexible Server**:
```
mysql://adminuser:YourPassword@rpm-importer-mysql.mysql.database.azure.com:3306/rpm_importer?ssl=true
```

**Azure Container Instance (Public IP)**:
```
mysql://csvuser:YourPassword@20.121.45.67:3306/rpm_importer
```

**Azure Container Instance (VNet Private IP)**:
```
mysql://csvuser:YourPassword@10.0.1.4:3306/rpm_importer
```

**With Connection Pool Settings**:
```
mysql://adminuser:YourPassword@rpm-importer-mysql.mysql.database.azure.com:3306/rpm_importer?ssl=true&connectionLimit=10&connectTimeout=10000
```

### URL Encoding Special Characters

If your password contains special characters, they must be URL-encoded to avoid parsing errors:

| Character | Encoded |
|-----------|---------|
| @ | %40 |
| # | %23 |
| $ | %24 |
| % | %25 |
| & | %26 |
| + | %2B |
| = | %3D |
| ? | %3F |
| / | %2F |

**Example**: If your password is `P@ssw0rd!`, the encoded version is `P%40ssw0rd!`

---

## Security Best Practices

Implementing proper security measures is critical when deploying databases in cloud environments. Follow these best practices to protect your MySQL database and application data.

### Use Azure Key Vault for Secrets

Instead of storing database passwords in environment variables, use Azure Key Vault to securely manage sensitive configuration values:

**Create Key Vault**:

```bash
az keyvault create \
  --name rpm-importer-vault \
  --resource-group rpm-importer-rg \
  --location eastus
```

**Store Database Password**:

```bash
az keyvault secret set \
  --vault-name rpm-importer-vault \
  --name DatabasePassword \
  --value "YourSecurePassword123!"
```

**Grant App Service Access**:

```bash
# Enable managed identity for App Service
az webapp identity assign \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer

# Get the managed identity principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --query principalId \
  --output tsv)

# Grant access to Key Vault
az keyvault set-policy \
  --name rpm-importer-vault \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

**Reference Secret in App Service**:

```bash
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings \
    DATABASE_PASSWORD="@Microsoft.KeyVault(SecretUri=https://rpm-importer-vault.vault.azure.net/secrets/DatabasePassword/)"
```

The application can now retrieve the password securely from Key Vault without it being visible in environment variables.

### Enable Private Endpoints

For maximum security, use Azure Private Link to access your MySQL database over a private network connection:

```bash
# Create private endpoint
az network private-endpoint create \
  --resource-group rpm-importer-rg \
  --name rpm-mysql-private-endpoint \
  --vnet-name rpm-importer-vnet \
  --subnet app-subnet \
  --private-connection-resource-id $(az mysql flexible-server show \
    --resource-group rpm-importer-rg \
    --name rpm-importer-mysql \
    --query id \
    --output tsv) \
  --group-id mysqlServer \
  --connection-name rpm-mysql-connection
```

With a private endpoint, the MySQL server is accessible only through the private IP address within your virtual network, completely blocking public internet access.

### Implement Least Privilege Access

Create dedicated MySQL users with minimal required permissions instead of using the admin account:

```sql
-- Connect as admin user
-- Create application user with limited permissions
CREATE USER 'app_user'@'%' IDENTIFIED BY 'SecureAppPassword123!';

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON rpm_importer.* TO 'app_user'@'%';

-- Revoke dangerous permissions
REVOKE CREATE, DROP, ALTER, INDEX ON rpm_importer.* FROM 'app_user'@'%';

FLUSH PRIVILEGES;
```

Update the DATABASE_URL to use the new limited-privilege user instead of the admin account.

### Enable Audit Logging

Configure MySQL audit logging to track database access and changes:

```bash
az mysql flexible-server parameter set \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --name audit_log_enabled \
  --value ON

az mysql flexible-server parameter set \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --name audit_log_events \
  --value "CONNECTION,QUERY_DDL,QUERY_DML"
```

Audit logs can be forwarded to Azure Monitor or Log Analytics for centralized monitoring and alerting.

### Regular Security Updates

Keep MySQL updated with the latest security patches:

**For Azure Database for MySQL**: Updates are applied automatically during maintenance windows. Configure your preferred maintenance window:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --maintenance-window "Mon:02:00"
```

**For Container Instances**: Regularly update the MySQL container image:

```bash
# Pull latest MySQL 8.0 image
docker pull mysql:8.0

# Recreate container instance with updated image
az container delete \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-container \
  --yes

# Recreate with same configuration (use creation command from Option 2)
```

---

## Performance Optimization

Optimizing MySQL performance ensures your application responds quickly and handles concurrent users efficiently.

### Connection Pooling

The application uses connection pooling by default through Drizzle ORM. Configure pool settings for optimal performance:

```bash
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings \
    DATABASE_URL="mysql://adminuser:YourPassword@rpm-importer-mysql.mysql.database.azure.com:3306/rpm_importer?ssl=true&connectionLimit=10&connectTimeout=10000&idleTimeout=30000"
```

**Connection Pool Parameters**:
- `connectionLimit=10`: Maximum number of concurrent connections (adjust based on your App Service tier and expected load)
- `connectTimeout=10000`: Maximum time (ms) to wait for a connection
- `idleTimeout=30000`: Time (ms) before idle connections are closed

### Query Performance

Monitor slow queries and optimize them:

```bash
# Enable slow query log
az mysql flexible-server parameter set \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --name slow_query_log \
  --value ON

az mysql flexible-server parameter set \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --name long_query_time \
  --value 2
```

Queries taking longer than 2 seconds will be logged for analysis.

### Database Indexing

Ensure proper indexes exist on frequently queried columns. The application's migration creates necessary indexes, but you can add custom indexes for specific query patterns:

```sql
-- Index on import job status for faster filtering
CREATE INDEX idx_import_jobs_status ON import_jobs(status);

-- Index on cleanup audit logs timestamp for faster date range queries
CREATE INDEX idx_cleanup_logs_timestamp ON cleanup_audit_logs(created_at);

-- Composite index for common query patterns
CREATE INDEX idx_mapping_templates_user_name ON mapping_templates(user_id, template_name);
```

### Scaling Considerations

As your usage grows, you may need to scale the MySQL database:

**Vertical Scaling (Azure Database for MySQL)**:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --sku-name Standard_D2ds_v4 \
  --tier GeneralPurpose
```

This upgrades to 2 vCPUs and 8 GB RAM for better performance.

**Read Replicas** (for read-heavy workloads):

```bash
az mysql flexible-server replica create \
  --replica-name rpm-importer-mysql-replica \
  --resource-group rpm-importer-rg \
  --source-server rpm-importer-mysql
```

Configure the application to route read queries to the replica and write queries to the primary server.

---

## Backup and Disaster Recovery

Implementing robust backup and recovery procedures ensures business continuity and data protection.

### Automated Backups (Azure Database for MySQL)

Azure Database for MySQL Flexible Server automatically performs backups:

**Backup Configuration**:
- **Frequency**: Automated daily full backups
- **Retention**: 7 days (Burstable tier) or 35 days (General Purpose/Memory Optimized tiers)
- **Storage**: Geo-redundant backup storage available for disaster recovery

**Modify Backup Retention**:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --backup-retention 14
```

This increases retention to 14 days (requires General Purpose or higher tier).

### Point-in-Time Restore

Restore the database to any point within the backup retention period:

```bash
az mysql flexible-server restore \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-restored \
  --source-server rpm-importer-mysql \
  --restore-time "2025-01-15T10:30:00Z"
```

This creates a new server with data restored to the specified timestamp.

### Manual Backups

Create on-demand backups before major changes:

```bash
# Export database to SQL file
mysqldump -h rpm-importer-mysql.mysql.database.azure.com \
  -u adminuser \
  -p \
  --ssl-mode=REQUIRED \
  --single-transaction \
  --routines \
  --triggers \
  rpm_importer > rpm_importer_backup.sql

# Compress backup
gzip rpm_importer_backup.sql

# Upload to Azure Blob Storage
az storage blob upload \
  --account-name rpmimporterbackups \
  --container-name manual-backups \
  --name rpm_importer_backup_$(date +%Y%m%d).sql.gz \
  --file rpm_importer_backup.sql.gz
```

### Restore from Manual Backup

Restore a manual backup when needed:

```bash
# Download backup from Azure Blob Storage
az storage blob download \
  --account-name rpmimporterbackups \
  --container-name manual-backups \
  --name rpm_importer_backup_20250115.sql.gz \
  --file rpm_importer_backup.sql.gz

# Decompress backup
gunzip rpm_importer_backup.sql.gz

# Restore to database
mysql -h rpm-importer-mysql.mysql.database.azure.com \
  -u adminuser \
  -p \
  --ssl-mode=REQUIRED \
  rpm_importer < rpm_importer_backup.sql
```

### Disaster Recovery Plan

Implement a comprehensive disaster recovery strategy:

**1. Regular Testing**: Test backup restoration quarterly to ensure backups are valid and the restoration process works correctly.

**2. Geo-Redundant Backups**: Enable geo-redundant backup storage for protection against regional failures:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --geo-redundant-backup Enabled
```

**3. Documentation**: Maintain detailed documentation of the restoration procedure, including connection strings, credentials locations, and step-by-step instructions.

**4. Monitoring**: Set up alerts for backup failures:

```bash
az monitor metrics alert create \
  --name mysql-backup-failed \
  --resource-group rpm-importer-rg \
  --scopes $(az mysql flexible-server show \
    --resource-group rpm-importer-rg \
    --name rpm-importer-mysql \
    --query id \
    --output tsv) \
  --condition "count backup_storage_used < 1" \
  --window-size 24h \
  --evaluation-frequency 12h
```

---

## Monitoring and Troubleshooting

Effective monitoring helps identify and resolve issues before they impact users.

### Enable Azure Monitor Integration

Configure Azure Monitor to collect MySQL metrics and logs:

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group rpm-importer-rg \
  --workspace-name rpm-importer-logs

# Get workspace ID
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group rpm-importer-rg \
  --workspace-name rpm-importer-logs \
  --query id \
  --output tsv)

# Enable diagnostic settings
az monitor diagnostic-settings create \
  --name mysql-diagnostics \
  --resource $(az mysql flexible-server show \
    --resource-group rpm-importer-rg \
    --name rpm-importer-mysql \
    --query id \
    --output tsv) \
  --workspace $WORKSPACE_ID \
  --logs '[{"category": "MySqlSlowLogs", "enabled": true}, {"category": "MySqlAuditLogs", "enabled": true}]' \
  --metrics '[{"category": "AllMetrics", "enabled": true}]'
```

### Key Metrics to Monitor

Monitor these critical metrics to ensure database health:

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| CPU Percentage | Database server CPU utilization | > 80% for 10 minutes |
| Memory Percentage | Database server memory utilization | > 85% for 10 minutes |
| Storage Percentage | Database storage utilization | > 80% |
| Active Connections | Number of active database connections | > 80% of max connections |
| Failed Connections | Number of failed connection attempts | > 10 per minute |
| Replication Lag | Delay in replication (if using replicas) | > 30 seconds |

### Common Issues and Solutions

**Issue: Connection Timeout Errors**

**Symptoms**: Application logs show "Connection timeout" or "Too many connections" errors.

**Solution**: Increase connection pool size or upgrade MySQL server tier:

```bash
# Upgrade to higher tier with more connection capacity
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --sku-name Standard_D2ds_v4
```

**Issue: Slow Query Performance**

**Symptoms**: Application pages load slowly, especially import history or audit logs.

**Solution**: Analyze slow query log and add indexes:

```bash
# Download slow query log
az mysql flexible-server server-logs download \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --log-file-name slow_query.log
```

Review the log and create indexes on frequently queried columns.

**Issue: SSL Connection Failures**

**Symptoms**: Application cannot connect to MySQL with "SSL connection error" messages.

**Solution**: Verify SSL is properly configured in the connection string:

```bash
# Ensure connection string includes ssl=true parameter
DATABASE_URL="mysql://user:pass@host:3306/db?ssl=true"

# Verify SSL is required on server
az mysql flexible-server parameter show \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --name require_secure_transport
```

**Issue: Database Storage Full**

**Symptoms**: Insert operations fail with "disk full" or "out of space" errors.

**Solution**: Increase storage size:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --storage-size 64
```

Storage can only be increased, not decreased. Plan for future growth when sizing.

---

## Cost Optimization

Managing database costs effectively ensures sustainable operations without sacrificing performance or reliability.

### Pricing Tiers Comparison

| Tier | vCPU | RAM | Storage | Backup Retention | Estimated Monthly Cost |
|------|------|-----|---------|------------------|----------------------|
| Burstable B1ms | 1 | 2 GB | 32 GB | 7 days | $15-20 |
| Burstable B2s | 2 | 4 GB | 64 GB | 7 days | $30-40 |
| General Purpose D2ds_v4 | 2 | 8 GB | 128 GB | 35 days | $120-150 |
| General Purpose D4ds_v4 | 4 | 16 GB | 256 GB | 35 days | $240-300 |

**Note**: Costs are estimates for US East region and may vary based on actual usage, backup storage, and data transfer.

### Cost Reduction Strategies

**Right-Size Your Database**: Start with the Burstable B1ms tier for development and testing. Monitor actual resource utilization and scale up only when needed. Many applications run efficiently on smaller tiers than initially provisioned.

**Use Reserved Capacity**: Purchase reserved capacity for 1 or 3 years to save up to 60% compared to pay-as-you-go pricing:

```bash
# Reserved capacity must be purchased through Azure Portal or Enterprise Agreement
# Pricing example: 1-year reserved B1ms ~$12/month vs $18/month pay-as-you-go
```

**Optimize Backup Retention**: Reduce backup retention to the minimum required for your recovery objectives. Burstable tier includes 7 days free; longer retention requires General Purpose tier and incurs additional costs.

**Schedule Scaling**: For non-production environments, scale down during off-hours:

```bash
# Scale down at night (example: 10 PM)
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-dev \
  --sku-name Standard_B1s

# Scale up in morning (example: 6 AM)
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-dev \
  --sku-name Standard_B1ms
```

Automate this with Azure Automation runbooks or Azure Functions on a schedule.

**Delete Unused Resources**: Regularly review and delete development/testing databases that are no longer needed:

```bash
# List all MySQL servers in resource group
az mysql flexible-server list \
  --resource-group rpm-importer-rg \
  --output table

# Delete unused server
az mysql flexible-server delete \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql-old \
  --yes
```

---

## Migration from Local Development to Azure

When moving from local development (using docker-compose) to Azure production, follow this migration checklist.

### Pre-Migration Checklist

**1. Export Local Data**: If you have test data or configurations in your local MySQL database that you want to preserve:

```bash
# Export from local Docker MySQL
docker exec csv-importer-mysql mysqldump \
  -u csvuser \
  -pcsvpassword \
  rpm_importer > local_data_export.sql
```

**2. Document Environment Variables**: List all environment variables currently used in your local docker-compose.yml and ensure they're configured in Azure App Service.

**3. Test Connection Strings**: Verify that your Azure MySQL connection string works by testing it locally before deploying:

```bash
# Test connection to Azure MySQL from local machine
mysql -h rpm-importer-mysql.mysql.database.azure.com \
  -u adminuser \
  -p \
  --ssl-mode=REQUIRED \
  rpm_importer
```

### Migration Steps

**Step 1: Create Azure MySQL Database** (follow Option 1 or Option 2 above)

**Step 2: Import Local Data to Azure**:

```bash
# Import local data to Azure MySQL
mysql -h rpm-importer-mysql.mysql.database.azure.com \
  -u adminuser \
  -p \
  --ssl-mode=REQUIRED \
  rpm_importer < local_data_export.sql
```

**Step 3: Update Application Configuration**:

Update your App Service environment variables to point to the Azure MySQL database instead of the local Docker container.

**Step 4: Run Database Migrations**:

Even if you imported data, run migrations to ensure the schema is up to date:

```bash
# SSH into App Service and run migrations
cd /app
pnpm db:push
```

**Step 5: Verify Data Integrity**:

Check that all data was migrated correctly:

```sql
-- Connect to Azure MySQL
-- Verify record counts match
SELECT COUNT(*) FROM azure_connections;
SELECT COUNT(*) FROM mapping_templates;
SELECT COUNT(*) FROM import_jobs;
SELECT COUNT(*) FROM cleanup_audit_logs;
```

Compare these counts with your local database to ensure all data was transferred.

**Step 6: Test Application Functionality**:

Thoroughly test all application features in the Azure environment:
- Create new Azure SQL connections
- Upload and import CSV files
- Save and load mapping templates
- View import history
- Perform data cleanup
- Check audit logs

### Post-Migration Tasks

**1. Configure Backups**: Set up automated backup schedule and test restoration procedure.

**2. Enable Monitoring**: Configure Azure Monitor alerts for database health metrics.

**3. Document Configuration**: Update documentation with Azure-specific connection details, credentials locations (Key Vault), and operational procedures.

**4. Decommission Local Resources**: Once Azure deployment is verified, you can stop the local Docker containers to free up resources.

---

## Conclusion

This guide has provided comprehensive instructions for configuring MySQL database when deploying the RPM Customer User Importer application to Azure App Services. You now have detailed knowledge of multiple deployment options, security best practices, performance optimization techniques, backup strategies, and troubleshooting procedures.

The recommended approach for production deployments is Azure Database for MySQL Flexible Server due to its managed nature, enterprise-grade security, automatic backups, and high availability features. For development and testing environments or cost-sensitive deployments, MySQL in Azure Container Instance provides a viable alternative with more control over configuration.

Regardless of which option you choose, following the security best practices, monitoring recommendations, and backup procedures outlined in this guide will ensure a reliable and secure database infrastructure for your application.

For additional support or questions about MySQL configuration, refer to the Azure Database for MySQL documentation or contact your database administrator.

---

## Additional Resources

- [Azure Database for MySQL Documentation](https://docs.microsoft.com/azure/mysql/)
- [Azure Container Instances Documentation](https://docs.microsoft.com/azure/container-instances/)
- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Azure Key Vault Documentation](https://docs.microsoft.com/azure/key-vault/)

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Author**: Manus AI
