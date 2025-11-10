# Automated Azure Deployment Scripts

## RPM Customer User Importer - One-Command Deployment

This directory contains automated deployment scripts that execute all Azure CLI commands required to deploy the RPM Customer User Importer application to Azure App Services with MySQL database. The scripts handle resource creation, container registry setup, database configuration, application deployment, and continuous integration setup in a single execution.

---

## Overview

The deployment scripts automate the complete Azure infrastructure setup and application deployment process, eliminating manual command execution and reducing the potential for configuration errors. Both Bash and PowerShell versions are provided to support different operating systems and user preferences.

**What the scripts do**: Create Azure Resource Group, provision MySQL Flexible Server with database and firewall rules, create Azure Container Registry, build and push Docker image to ACR, create App Service Plan and Web App, configure environment variables and database connection, enable continuous deployment with webhook, and restart the application.

**Time to deploy**: Approximately 15-20 minutes for a complete deployment from scratch, depending on Azure region and resource provisioning speed.

**Cost estimate**: Starting from approximately $20-30 per month for the minimal configuration (Burstable B1ms MySQL, Basic ACR, B1 App Service Plan). Costs scale with resource tier selections.

---

## Prerequisites

Before running the deployment scripts, ensure you have the following tools and access configured on your system.

### Required Tools

**Azure CLI** must be installed and accessible from your command line. The Azure CLI is used to interact with Azure services programmatically. Installation instructions are available at the official Microsoft documentation for Windows, macOS, and Linux platforms.

**Docker** must be installed and running on your system. Docker is required to build the application container image before pushing it to Azure Container Registry. Download Docker Desktop from the official Docker website for your operating system.

**Git** should be installed if you plan to clone the repository or manage version control. Most modern operating systems include Git by default, or it can be installed from the official Git website.

### Azure Account Requirements

You must have an active Azure subscription with sufficient permissions to create resources. The account needs Contributor or Owner role on the subscription or resource group where resources will be created. If you don't have an Azure subscription, you can create a free account at the Azure portal.

### Authentication

Before running the deployment scripts, you must authenticate with Azure using the Azure CLI. Open a terminal or PowerShell window and execute the login command:

```bash
az login
```

This opens a browser window where you can sign in with your Azure credentials. After successful authentication, the CLI stores your credentials locally for subsequent commands. If you have multiple subscriptions, you can verify which one is active by running `az account show` and set a different one if needed with `az account set --subscription <subscription-id>`.

---

## Configuration

The deployment scripts use configuration files to specify Azure resource names, locations, credentials, and application settings. Configuration files are separate from the scripts to allow easy customization without modifying the script code.

### Configuration File Formats

**Bash Script** uses `config.env` (environment variable format):
- Copy `deployment/config.env.example` to `deployment/config.env`
- Edit `config.env` with your specific values
- The file uses KEY=VALUE pairs, one per line
- Comments start with #

**PowerShell Script** uses `config.json` (JSON format):
- Copy `deployment/config.json.example` to `deployment/config.json`
- Edit `config.json` with your specific values
- The file uses standard JSON object notation
- Comments are included as "_comment" fields

### Required Configuration Values

The following table describes all configuration parameters that must be set before deployment. Parameters marked as "Required" must have values; optional parameters can be left empty or omitted.

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `subscriptionId` | Yes | Your Azure subscription ID | `12345678-1234-1234-1234-123456789abc` |
| `resourceGroup` | Yes | Resource group name (created if doesn't exist) | `rpm-importer-rg` |
| `location` | Yes | Azure region for all resources | `eastus`, `westus2`, `centralus` |
| `appName` | Yes | Application name (globally unique) | `rpm-customer-user-importer` |
| `acrName` | Yes | Container registry name (alphanumeric only, globally unique) | `rpmimporteracr` |
| `mysqlServerName` | Yes | MySQL server name (globally unique) | `rpm-importer-mysql` |
| `mysqlAdminUser` | Yes | MySQL administrator username | `adminuser` |
| `mysqlAdminPassword` | Yes | MySQL administrator password (8+ chars, mixed case, numbers, special chars) | `SecurePass123!` |
| `mysqlDatabaseName` | Yes | MySQL database name | `rpm_importer` |
| `appServiceSku` | No | App Service tier (default: B1) | `B1`, `B2`, `S1`, `P1V2` |
| `acrSku` | No | Container Registry tier (default: Basic) | `Basic`, `Standard`, `Premium` |
| `mysqlSku` | No | MySQL server SKU (default: Standard_B1ms) | `Standard_B1ms`, `Standard_D2ds_v4` |
| `mysqlTier` | No | MySQL tier (default: Burstable) | `Burstable`, `GeneralPurpose` |
| `jwtSecret` | No | JWT secret (auto-generated if empty) | Base64 string |
| `oauthServerUrl` | No | Manus OAuth server URL | `https://api.manus.im` |
| `viteAppTitle` | No | Application title (default: RPM Customer User Importer) | Custom title |

### Finding Your Azure Subscription ID

To find your Azure subscription ID, use one of these methods:

**Azure CLI**:
```bash
az account list --output table
```

**Azure Portal**:
1. Navigate to https://portal.azure.com
2. Search for "Subscriptions" in the top search bar
3. Click on your subscription name
4. Copy the Subscription ID from the overview page

### Choosing Azure Region

Select an Azure region close to your users or your existing Azure SQL Server for optimal performance. Common regions include `eastus`, `westus2`, `centralus`, `northeurope`, and `southeastasia`. To list all available regions, run:

```bash
az account list-locations --output table
```

### Security Best Practices for Configuration

**Never commit configuration files to version control**. The `.gitignore` file should include `config.env` and `config.json` to prevent accidental commits of sensitive credentials.

**Use strong passwords** for MySQL administrator account. Passwords must be at least 8 characters and include uppercase letters, lowercase letters, numbers, and special characters. Consider using a password manager to generate and store secure passwords.

**Rotate credentials regularly**. After initial deployment, consider rotating the MySQL administrator password and updating the App Service environment variables accordingly.

**Use Azure Key Vault for production**. For production deployments, store sensitive values like database passwords and JWT secrets in Azure Key Vault and reference them in the App Service configuration instead of using plain text environment variables.

---

## Usage

### Bash Script (Linux, macOS, WSL)

The Bash script `deploy-azure.sh` is designed for Unix-like environments including Linux, macOS, and Windows Subsystem for Linux (WSL).

**Basic Usage** (deploys everything):

```bash
./deployment/deploy-azure.sh
```

This command executes the complete deployment process using the configuration from `deployment/config.env`.

**Custom Configuration File**:

```bash
./deployment/deploy-azure.sh --config deployment/prod-config.env
```

Use this option to specify a different configuration file, useful for managing multiple environments (development, staging, production).

**Skip Specific Components**:

```bash
# Skip MySQL creation (use existing database)
./deployment/deploy-azure.sh --skip-mysql

# Skip Container Registry creation (use existing ACR)
./deployment/deploy-azure.sh --skip-acr

# Skip App Service creation (only update database/registry)
./deployment/deploy-azure.sh --skip-app

# Combine multiple skip options
./deployment/deploy-azure.sh --skip-mysql --skip-acr
```

Skip options are useful for partial deployments or updates. For example, if you already have a MySQL database configured, use `--skip-mysql` to avoid recreating it.

**Help Information**:

```bash
./deployment/deploy-azure.sh --help
```

Displays detailed usage information and all available command-line options.

### PowerShell Script (Windows, Cross-Platform)

The PowerShell script `Deploy-Azure.ps1` works on Windows PowerShell 5.1+ and PowerShell Core 7+ (cross-platform).

**Basic Usage** (deploys everything):

```powershell
.\deployment\Deploy-Azure.ps1
```

This command executes the complete deployment process using the configuration from `deployment\config.json`.

**Custom Configuration File**:

```powershell
.\deployment\Deploy-Azure.ps1 -ConfigFile "deployment\prod-config.json"
```

Use the `-ConfigFile` parameter to specify a different configuration file for environment-specific deployments.

**Skip Specific Components**:

```powershell
# Skip MySQL creation
.\deployment\Deploy-Azure.ps1 -SkipMySQL

# Skip Container Registry creation
.\deployment\Deploy-Azure.ps1 -SkipACR

# Skip App Service creation
.\deployment\Deploy-Azure.ps1 -SkipApp

# Combine multiple skip options
.\deployment\Deploy-Azure.ps1 -SkipMySQL -SkipACR
```

PowerShell uses switch parameters (flags without values) for skip options.

**Get Help**:

```powershell
Get-Help .\deployment\Deploy-Azure.ps1 -Detailed
```

Displays comprehensive help information including parameter descriptions and examples.

---

## Deployment Process

The scripts execute the following steps in sequence. Understanding the deployment process helps troubleshoot issues and customize the scripts for specific requirements.

### Step 1: Prerequisites Check

The script verifies that all required tools are installed and properly configured. It checks for Azure CLI installation, Docker installation, and Azure authentication status. If any prerequisite is missing, the script displays an error message with instructions for resolving the issue and exits without making any changes.

### Step 2: Configuration Loading and Validation

The script loads the configuration file and validates that all required parameters are present and properly formatted. Missing required parameters cause the script to exit with an error message indicating which parameter needs to be set. This validation prevents partial deployments that would fail midway due to missing configuration.

### Step 3: Azure Subscription Selection

The script sets the active Azure subscription to the one specified in the configuration. This ensures all resources are created in the correct subscription, which is particularly important if your Azure account has access to multiple subscriptions.

### Step 4: Resource Group Creation

The script creates the Azure Resource Group if it doesn't already exist. Resource Groups are logical containers for Azure resources, making it easy to manage and delete all related resources together. If the resource group already exists, the script continues without error.

### Step 5: MySQL Database Provisioning

The script creates an Azure Database for MySQL Flexible Server with the specified configuration. This includes creating the MySQL server instance, creating the application database, and configuring firewall rules to allow Azure services to connect. The process takes approximately 5-10 minutes as Azure provisions the database infrastructure.

**MySQL Configuration Details**:
- Server is created with the specified SKU and tier
- SSL/TLS encryption is enabled by default for secure connections
- Firewall rule allows connections from Azure services (0.0.0.0/0)
- Backup retention is configured according to the specified number of days
- The application database is created within the MySQL server

### Step 6: Azure Container Registry Creation

The script creates an Azure Container Registry (ACR) to store Docker images. ACR provides a private registry for your container images with integration to Azure services. The admin account is enabled to allow the App Service to pull images using username/password authentication.

### Step 7: Docker Image Build and Push

The script builds the Docker image from the Dockerfile in the project root directory and pushes it to the Azure Container Registry. This step requires Docker to be running on your local machine. The image is tagged with the ACR login server address and the application name.

**Build Process**:
1. Docker builds the image using the Dockerfile
2. The script logs in to ACR using Azure CLI credentials
3. The image is tagged with the ACR repository path
4. The image is pushed to ACR for deployment

### Step 8: App Service Plan Creation

The script creates an Azure App Service Plan, which defines the compute resources (CPU, memory) for your application. The plan is configured for Linux containers with the specified SKU (pricing tier). If the plan already exists, the script continues without error.

### Step 9: Web App Creation and Configuration

The script creates the Azure Web App within the App Service Plan and configures it to use the Docker image from ACR. It sets up container registry credentials, allowing the Web App to pull the image. The Web App is configured with all necessary environment variables including the MySQL connection string.

**Environment Variables Configured**:
- `DATABASE_URL`: MySQL connection string with SSL enabled
- `JWT_SECRET`: Secret for JWT token signing (auto-generated if not provided)
- `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`: OAuth configuration
- `OWNER_OPEN_ID`, `OWNER_NAME`: Owner information
- `VITE_APP_TITLE`, `VITE_APP_LOGO`: Application branding
- `WEBSITES_PORT`: Port number (3000) for the application

### Step 10: Continuous Deployment Configuration

The script enables continuous deployment, which automatically updates the Web App when a new image is pushed to ACR. A webhook URL is generated and can be used to trigger deployments from CI/CD pipelines. This enables automated deployments when code changes are committed to the repository.

### Step 11: Application Restart

The script restarts the Web App to ensure all configuration changes take effect and the application starts with the latest settings. The restart typically takes 30-60 seconds.

### Step 12: Deployment Summary

The script displays a summary of the deployed resources including the application URL, MySQL server address, and container registry URL. It also provides next steps for completing the setup, such as running database migrations and configuring custom domains.

---

## Post-Deployment Steps

After the automated deployment completes successfully, perform these manual steps to finalize the application setup.

### Database Schema Initialization

The deployment scripts create the MySQL database but do not initialize the schema (tables, indexes, constraints). You must run database migrations to create the application tables.

**Access App Service SSH Console**:

1. Navigate to the Azure Portal (https://portal.azure.com)
2. Search for your App Service name in the top search bar
3. Click on your App Service
4. In the left menu, under "Development Tools", click "SSH"
5. Click "Go" to open the SSH console in your browser

**Run Migrations**:

In the SSH console, execute the following commands:

```bash
cd /app
pnpm db:push
```

The `pnpm db:push` command uses Drizzle ORM to create all necessary tables in the MySQL database. You should see output indicating successful table creation for users, azure_connections, mapping_templates, import_jobs, and cleanup_audit_logs.

**Verify Schema**:

Connect to the MySQL database and verify tables were created:

```bash
mysql -h <mysql-server-name>.mysql.database.azure.com \
  -u <admin-user> \
  -p \
  --ssl-mode=REQUIRED \
  <database-name>
```

Enter your MySQL admin password when prompted, then run:

```sql
SHOW TABLES;
```

You should see all application tables listed.

### Test Application Functionality

Access your application at the URL provided in the deployment summary (https://your-app-name.azurewebsites.net). Test the following functionality to ensure everything is working correctly:

1. **Authentication**: Sign in with your Manus account or configured OAuth provider
2. **Database Connections**: Create a new Azure SQL connection to verify database connectivity
3. **CSV Upload**: Upload a sample CSV file to test file handling
4. **Field Mapping**: Create and save a field mapping template
5. **Data Import**: Perform a test import to verify the complete workflow
6. **Audit Logs**: Check that import history and cleanup logs are being recorded

If any functionality fails, check the application logs in the Azure Portal under "Monitoring" → "Log stream" for error messages.

### Configure Custom Domain (Optional)

By default, your application is accessible at `https://your-app-name.azurewebsites.net`. To use a custom domain like `https://importer.rpm-technologies.com`, follow these steps:

**Add Custom Domain**:

1. In the Azure Portal, navigate to your App Service
2. In the left menu, under "Settings", click "Custom domains"
3. Click "Add custom domain"
4. Enter your domain name and click "Validate"
5. Follow the instructions to add DNS records to your domain registrar
6. After DNS propagation, click "Add custom domain"

**Enable HTTPS**:

1. In the "Custom domains" page, click "Add binding" next to your custom domain
2. Select "SNI SSL" as the TLS/SSL type
3. Choose "Create App Service Managed Certificate" for a free SSL certificate
4. Click "Add binding"

The SSL certificate is automatically provisioned and renewed by Azure.

### Set Up Monitoring and Alerts

Configure Azure Monitor to track application health and receive alerts for issues.

**Enable Application Insights**:

```bash
# Create Application Insights resource
az monitor app-insights component create \
  --app rpm-importer-insights \
  --location eastus \
  --resource-group rpm-importer-rg \
  --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app rpm-importer-insights \
  --resource-group rpm-importer-rg \
  --query instrumentationKey \
  --output tsv)

# Configure App Service to use Application Insights
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=$INSTRUMENTATION_KEY"
```

**Create Alert Rules**:

Set up alerts for critical conditions like high error rates, slow response times, or database connection failures. In the Azure Portal, navigate to "Monitoring" → "Alerts" and create alert rules based on metrics like HTTP 5xx errors, response time, and CPU usage.

### Configure Backup Schedule

While Azure Database for MySQL performs automatic backups, you should verify the backup configuration and consider creating manual backups before major changes.

**Verify Backup Configuration**:

```bash
az mysql flexible-server show \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --query "{backupRetentionDays:backup.backupRetentionDays, geoRedundantBackup:backup.geoRedundantBackup}"
```

**Create Manual Backup**:

```bash
# Export database
mysqldump -h rpm-importer-mysql.mysql.database.azure.com \
  -u adminuser \
  -p \
  --ssl-mode=REQUIRED \
  --single-transaction \
  rpm_importer > backup_$(date +%Y%m%d).sql

# Upload to Azure Blob Storage (requires storage account)
az storage blob upload \
  --account-name <storage-account> \
  --container-name backups \
  --name backup_$(date +%Y%m%d).sql \
  --file backup_$(date +%Y%m%d).sql
```

---

## Troubleshooting

This section addresses common issues encountered during deployment and provides solutions.

### Authentication Errors

**Error**: "Please run 'az login' first"

**Cause**: Azure CLI is not authenticated or the authentication token has expired.

**Solution**: Run `az login` to authenticate. If you've already logged in but still see this error, your session may have expired. Log out with `az logout` and log in again.

### Resource Name Conflicts

**Error**: "The name 'xxx' is already in use" or "Name not available"

**Cause**: Azure resource names must be globally unique across all Azure subscriptions. Someone else may already be using the name you specified.

**Solution**: Change the resource name in your configuration file to something more unique. For example, instead of `rpm-importer-mysql`, use `rpm-importer-mysql-yourcompany` or append a random string.

### Docker Build Failures

**Error**: "Cannot connect to the Docker daemon"

**Cause**: Docker is not running on your system.

**Solution**: Start Docker Desktop or the Docker service. On Windows, launch Docker Desktop from the Start menu. On Linux, run `sudo systemctl start docker`. On macOS, launch Docker Desktop from Applications.

**Error**: "COPY failed: no source files were specified"

**Cause**: The Dockerfile references files that don't exist in the build context.

**Solution**: Ensure you're running the deployment script from the project root directory where the Dockerfile is located. The script should be executed as `./deployment/deploy-azure.sh`, not from within the deployment directory.

### MySQL Connection Errors

**Error**: "Client with IP address 'x.x.x.x' is not allowed to access the server"

**Cause**: The MySQL firewall is blocking connections from your App Service's IP address.

**Solution**: The deployment script should configure the firewall automatically, but if this error occurs, manually add the App Service's outbound IP addresses to the MySQL firewall rules:

```bash
# Get App Service outbound IPs
az webapp show \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --query outboundIpAddresses \
  --output tsv

# Add each IP to MySQL firewall
az mysql flexible-server firewall-rule create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --rule-name AllowAppService \
  --start-ip-address <IP-ADDRESS> \
  --end-ip-address <IP-ADDRESS>
```

### Container Registry Authentication Failures

**Error**: "Failed to pull image: unauthorized"

**Cause**: The Web App cannot authenticate with the Azure Container Registry.

**Solution**: Verify that ACR admin account is enabled and credentials are correctly configured:

```bash
# Enable admin account
az acr update \
  --name rpmimporteracr \
  --admin-enabled true

# Get credentials
az acr credential show --name rpmimporteracr

# Reconfigure Web App with correct credentials
az webapp config container set \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg \
  --docker-custom-image-name <acr-login-server>/rpm-customer-user-importer:latest \
  --docker-registry-server-url https://<acr-login-server> \
  --docker-registry-server-user <username> \
  --docker-registry-server-password <password>
```

### Application Not Starting

**Error**: "Application Error" or "503 Service Unavailable" when accessing the application URL

**Cause**: The application container failed to start, often due to missing environment variables or incorrect configuration.

**Solution**: Check application logs in the Azure Portal:

1. Navigate to your App Service
2. Click "Log stream" under "Monitoring"
3. Look for error messages in the logs

Common issues include missing DATABASE_URL, incorrect MySQL credentials, or the application not listening on the correct port (should be 3000).

### Insufficient Permissions

**Error**: "The client 'xxx' does not have authorization to perform action 'xxx'"

**Cause**: Your Azure account doesn't have sufficient permissions to create resources.

**Solution**: Contact your Azure subscription administrator to grant you Contributor or Owner role on the subscription or resource group. Alternatively, have an administrator run the deployment script.

### Quota Exceeded

**Error**: "Operation could not be completed as it results in exceeding approved quota"

**Cause**: Your Azure subscription has reached its quota limit for certain resources (e.g., number of cores, number of public IPs).

**Solution**: Request a quota increase through the Azure Portal:

1. Navigate to "Subscriptions"
2. Select your subscription
3. Click "Usage + quotas" in the left menu
4. Find the quota you need to increase
5. Click "Request increase" and submit the request

Quota increase requests are typically processed within a few business days.

---

## Updating the Deployment

After initial deployment, you may need to update the application code, configuration, or infrastructure. The deployment scripts support incremental updates using skip options.

### Updating Application Code

To deploy new application code without recreating the database or other infrastructure:

**Bash**:
```bash
./deployment/deploy-azure.sh --skip-mysql
```

**PowerShell**:
```powershell
.\deployment\Deploy-Azure.ps1 -SkipMySQL
```

This rebuilds the Docker image with your latest code changes and pushes it to ACR. The continuous deployment webhook automatically updates the Web App with the new image.

### Updating Configuration

To update environment variables or application settings without redeploying the code:

```bash
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings \
    VITE_APP_TITLE="New Title" \
    NEW_VARIABLE="value"
```

After updating settings, restart the Web App:

```bash
az webapp restart \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer
```

### Scaling Resources

To scale the App Service Plan to a higher tier for better performance:

```bash
az appservice plan update \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer-plan \
  --sku S1
```

To scale the MySQL server to a higher tier:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --sku-name Standard_D2ds_v4 \
  --tier GeneralPurpose
```

Scaling operations typically complete within a few minutes and may cause brief downtime.

---

## Cleanup and Deletion

To remove all deployed resources and avoid ongoing charges, delete the entire resource group. This permanently deletes all resources within the group including the App Service, MySQL database, Container Registry, and all data.

**Warning**: This operation is irreversible. Ensure you have backups of any data you want to preserve before proceeding.

**Delete Resource Group**:

```bash
az group delete \
  --name rpm-importer-rg \
  --yes \
  --no-wait
```

The `--yes` flag skips the confirmation prompt, and `--no-wait` returns immediately without waiting for the deletion to complete. Deletion typically takes 5-10 minutes.

**Verify Deletion**:

```bash
az group show --name rpm-importer-rg
```

This command returns an error if the resource group has been deleted.

**Selective Resource Deletion**:

To delete individual resources while keeping others:

```bash
# Delete Web App only
az webapp delete \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer

# Delete MySQL server
az mysql flexible-server delete \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --yes

# Delete Container Registry
az acr delete \
  --resource-group rpm-importer-rg \
  --name rpmimporteracr \
  --yes
```

---

## Best Practices

Follow these best practices to ensure secure, reliable, and cost-effective deployments.

### Use Separate Environments

Maintain separate resource groups and configurations for development, staging, and production environments. This isolation prevents accidental changes to production resources during testing and allows you to test deployments in staging before applying them to production.

**Example Configuration Structure**:
- `deployment/dev-config.env` - Development environment
- `deployment/staging-config.env` - Staging environment
- `deployment/prod-config.env` - Production environment

Deploy to each environment with:
```bash
./deployment/deploy-azure.sh --config deployment/dev-config.env
./deployment/deploy-azure.sh --config deployment/staging-config.env
./deployment/deploy-azure.sh --config deployment/prod-config.env
```

### Implement Infrastructure as Code

Store your configuration files in version control (excluding sensitive values) to track infrastructure changes over time. Use Azure Resource Manager (ARM) templates or Terraform for more advanced infrastructure management and version control.

### Enable Geo-Redundant Backups

For production deployments, enable geo-redundant backups to protect against regional failures:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --geo-redundant-backup Enabled
```

This stores backup copies in a geographically distant Azure region, allowing recovery even if the primary region becomes unavailable.

### Use Managed Identities

Instead of storing database credentials in environment variables, use Azure Managed Identities to authenticate the App Service to MySQL. This eliminates the need to manage credentials and reduces security risks.

### Monitor Costs

Set up Azure Cost Management alerts to notify you when spending exceeds thresholds:

```bash
# Create budget
az consumption budget create \
  --budget-name rpm-importer-budget \
  --amount 100 \
  --time-grain Monthly \
  --start-date 2025-01-01 \
  --end-date 2026-01-01 \
  --resource-group rpm-importer-rg
```

Regularly review the Azure Cost Management dashboard to identify optimization opportunities.

### Automate Deployments

Integrate the deployment scripts into your CI/CD pipeline (GitHub Actions, Azure DevOps, Jenkins) to automate deployments when code is pushed to specific branches. This ensures consistent deployments and reduces manual errors.

**Example GitHub Actions Workflow**:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy Application
        run: ./deployment/deploy-azure.sh --config deployment/prod-config.env
        env:
          MYSQL_ADMIN_PASSWORD: ${{ secrets.MYSQL_ADMIN_PASSWORD }}
```

---

## Support and Additional Resources

For additional help and information, consult these resources:

**Azure Documentation**:
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Database for MySQL Documentation](https://docs.microsoft.com/azure/mysql/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/azure/container-registry/)

**Project Documentation**:
- `AZURE_DEPLOYMENT.md` - Detailed manual deployment guide
- `MYSQL_AZURE_CONFIGURATION.md` - MySQL configuration and management
- `README.md` - Application overview and features

**Community Support**:
- Azure Community Forums
- Stack Overflow (tag: azure)
- GitHub Issues (for this project)

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Author**: Manus AI
