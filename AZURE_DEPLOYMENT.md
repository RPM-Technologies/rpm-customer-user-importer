# Azure App Services Deployment Guide

## RPM Customer User Importer - Docker Deployment

This guide provides comprehensive step-by-step instructions for deploying the RPM Customer User Importer application to Azure App Services using Docker containers. The deployment includes both the application container and a MySQL database for storing application data (connections, templates, and audit logs).

---

## Architecture Overview

The deployment consists of two primary components that work together to provide a complete solution:

**Application Container**: A Node.js application built with React frontend and Express backend, packaged as a Docker container. This container handles all user interactions, CSV processing, field mapping, and communication with both the MySQL database and Azure SQL Server.

**Azure Database for MySQL**: A managed MySQL database service that stores application-specific data including database connection configurations, mapping templates, and audit logs. This is separate from the Azure SQL Server database where customer data is imported.

**Azure SQL Server**: The target database (rpm-reporting.database.windows.net) where customer user data is imported. This is configured through the application interface and is not part of the deployment infrastructure.

---

## Prerequisites

Before beginning the deployment process, ensure you have the following requirements in place:

| Requirement | Description | Purpose |
|-------------|-------------|---------|
| Azure Subscription | Active Azure subscription with appropriate permissions | Required to create and manage Azure resources |
| Azure CLI | Version 2.0 or later installed locally | Command-line tool for Azure resource management |
| Docker | Docker Desktop or Docker Engine installed | Local testing and container registry operations |
| Git | Git client installed | Clone repository and manage source code |
| Azure Container Registry | Or Docker Hub account | Store and manage Docker images |

You will also need access credentials for the Azure SQL Server (rpm-reporting.database.windows.net) where customer data will be imported.

---

## Step 1: Clone the Repository

Begin by cloning the application repository from GitHub to your local development environment. This provides access to all application code, Docker configuration files, and deployment scripts.

```bash
git clone https://github.com/RPM-Technologies/rpm-customer-user-importer.git
cd rpm-customer-user-importer
```

The repository contains several important files for deployment:

**Dockerfile**: Multi-stage build configuration that creates an optimized production image. The first stage builds the React frontend with Vite, the second stage compiles TypeScript backend code, and the final stage creates a minimal runtime image with only production dependencies.

**docker-compose.yml**: Development configuration for local testing with MySQL container. This file is useful for validating the application before deploying to Azure.

**docker-compose.prod.yml**: Production-ready configuration with security hardening, resource limits, and logging configuration. This serves as a reference for production deployment settings.

---

## Step 2: Create Azure Resources

### 2.1 Login to Azure

Authenticate with Azure using the Azure CLI. This establishes your identity and allows you to create and manage resources within your subscription.

```bash
az login
```

Set your default subscription if you have multiple subscriptions associated with your account:

```bash
az account set --subscription "Your-Subscription-Name"
```

### 2.2 Create Resource Group

Create a resource group to organize all related Azure resources for this application. Resource groups provide a logical container for managing resources as a single unit.

```bash
az group create \
  --name rpm-importer-rg \
  --location eastus
```

The location parameter determines the Azure region where your resources will be deployed. Choose a region close to your users or your Azure SQL Server for optimal performance.

### 2.3 Create Azure Container Registry

Azure Container Registry (ACR) provides a private Docker registry for storing your application images. This ensures secure image storage and fast deployment to Azure services.

```bash
az acr create \
  --resource-group rpm-importer-rg \
  --name rpmimporteracr \
  --sku Basic \
  --admin-enabled true
```

**Important**: The registry name must be globally unique across all Azure subscriptions. If "rpmimporteracr" is unavailable, choose a different name and update all subsequent commands accordingly.

Retrieve the registry credentials that will be used for authentication during image push and pull operations:

```bash
az acr credential show --name rpmimporteracr --resource-group rpm-importer-rg
```

Save the username and password from the output, as these will be needed for Docker login and App Service configuration.

### 2.4 Create Azure Database for MySQL

The application requires a MySQL database to store connection configurations, mapping templates, and audit logs. Azure Database for MySQL provides a fully managed database service with automatic backups, high availability, and security features.

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
  --public-access 0.0.0.0
```

**Security Note**: The admin password should be a strong password that meets Azure's complexity requirements (minimum 8 characters, including uppercase, lowercase, numbers, and special characters). Store this password securely as it will be needed for the DATABASE_URL environment variable.

The `--public-access 0.0.0.0` parameter allows connections from Azure services. For enhanced security, you can restrict this to specific IP addresses after deployment.

Create the application database within the MySQL server:

```bash
az mysql flexible-server db create \
  --resource-group rpm-importer-rg \
  --server-name rpm-importer-mysql \
  --database-name rpm_importer
```

Configure the firewall to allow Azure services to access the database:

```bash
az mysql flexible-server firewall-rule create \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

---

## Step 3: Build and Push Docker Image

### 3.1 Build the Docker Image

Build the production Docker image locally using the multi-stage Dockerfile. This process compiles the frontend, builds the backend, and creates an optimized production image.

```bash
docker build -t rpm-customer-user-importer:latest .
```

The build process typically takes 5-10 minutes depending on your system performance and network speed. The multi-stage build ensures that only production dependencies and compiled code are included in the final image, resulting in a smaller and more secure container.

### 3.2 Test the Image Locally (Optional)

Before deploying to Azure, it is recommended to test the Docker image locally to verify that it runs correctly. Create a `.env` file with the required environment variables:

```bash
# .env file for local testing
DATABASE_URL=mysql://adminuser:YourSecurePassword123!@rpm-importer-mysql.mysql.database.azure.com:3306/rpm_importer?ssl=true
JWT_SECRET=your-jwt-secret-key-min-32-characters-long
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
VITE_APP_TITLE=RPM Customer User Importer
```

Run the container locally:

```bash
docker run -p 3000:3000 --env-file .env rpm-customer-user-importer:latest
```

Access the application at http://localhost:3000 to verify functionality.

### 3.3 Tag and Push to Azure Container Registry

Login to your Azure Container Registry using the credentials retrieved earlier:

```bash
az acr login --name rpmimporteracr
```

Tag the image with the full registry path:

```bash
docker tag rpm-customer-user-importer:latest \
  rpmimporteracr.azurecr.io/rpm-customer-user-importer:latest
```

Push the image to Azure Container Registry:

```bash
docker push rpmimporteracr.azurecr.io/rpm-customer-user-importer:latest
```

The push operation uploads all image layers to the registry. Subsequent pushes will be faster as only changed layers are uploaded.

Verify the image was pushed successfully:

```bash
az acr repository list --name rpmimporteracr --output table
```

---

## Step 4: Create Azure App Service

### 4.1 Create App Service Plan

An App Service Plan defines the compute resources (CPU, memory) for your application. The plan determines the pricing tier and scaling capabilities.

```bash
az appservice plan create \
  --name rpm-importer-plan \
  --resource-group rpm-importer-rg \
  --is-linux \
  --sku B1
```

The B1 (Basic) tier provides 1.75 GB RAM and 1 vCPU, which is suitable for moderate workloads. For production environments with higher traffic, consider upgrading to Standard (S1) or Premium (P1V2) tiers that offer auto-scaling capabilities.

### 4.2 Create Web App

Create the Web App that will host your Docker container:

```bash
az webapp create \
  --resource-group rpm-importer-rg \
  --plan rpm-importer-plan \
  --name rpm-customer-user-importer \
  --deployment-container-image-name rpmimporteracr.azurecr.io/rpm-customer-user-importer:latest
```

**Important**: The web app name must be globally unique as it becomes part of the URL (rpm-customer-user-importer.azurewebsites.net). If the name is unavailable, choose a different name.

### 4.3 Configure Container Registry Authentication

Configure the Web App to authenticate with your Azure Container Registry:

```bash
az webapp config container set \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg \
  --docker-custom-image-name rpmimporteracr.azurecr.io/rpm-customer-user-importer:latest \
  --docker-registry-server-url https://rpmimporteracr.azurecr.io \
  --docker-registry-server-user <ACR-USERNAME> \
  --docker-registry-server-password <ACR-PASSWORD>
```

Replace `<ACR-USERNAME>` and `<ACR-PASSWORD>` with the credentials obtained in Step 2.3.

---

## Step 5: Configure Environment Variables

The application requires several environment variables for proper operation. These variables configure database connections, authentication, and application settings.

### 5.1 Required Environment Variables

Configure the following environment variables in your App Service:

```bash
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings \
    DATABASE_URL="mysql://adminuser:YourSecurePassword123!@rpm-importer-mysql.mysql.database.azure.com:3306/rpm_importer?ssl=true" \
    JWT_SECRET="your-jwt-secret-key-minimum-32-characters-long-for-security" \
    OAUTH_SERVER_URL="https://api.manus.im" \
    VITE_OAUTH_PORTAL_URL="https://oauth.manus.im" \
    VITE_APP_TITLE="RPM Customer User Importer" \
    VITE_APP_ID="your-manus-app-id" \
    OWNER_OPEN_ID="your-owner-open-id" \
    OWNER_NAME="RPM Technologies" \
    PORT="3000"
```

### 5.2 Environment Variable Reference

The following table describes each environment variable and its purpose:

| Variable | Required | Description | Example Value |
|----------|----------|-------------|---------------|
| DATABASE_URL | Yes | MySQL connection string for application database | mysql://user:pass@host:3306/db?ssl=true |
| JWT_SECRET | Yes | Secret key for session token signing (min 32 chars) | randomly-generated-secure-string-32-chars |
| OAUTH_SERVER_URL | Yes | Manus OAuth backend URL | https://api.manus.im |
| VITE_OAUTH_PORTAL_URL | Yes | Manus OAuth login portal URL | https://oauth.manus.im |
| VITE_APP_TITLE | Yes | Application title displayed in UI | RPM Customer User Importer |
| VITE_APP_ID | Yes | Manus OAuth application ID | your-app-id-from-manus |
| OWNER_OPEN_ID | Yes | Owner's Manus OpenID | your-openid-from-manus |
| OWNER_NAME | No | Organization name | RPM Technologies |
| PORT | No | Port number for the application (default: 3000) | 3000 |

**Security Best Practice**: Never commit environment variables containing secrets to version control. Use Azure Key Vault for production deployments to manage sensitive configuration values securely.

---

## Step 6: Configure Azure SQL Server Firewall

The application needs to connect to your Azure SQL Server (rpm-reporting.database.windows.net) to import customer data. You must configure the firewall to allow connections from your App Service.

### 6.1 Get App Service Outbound IP Addresses

Retrieve the outbound IP addresses used by your App Service:

```bash
az webapp show \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --query outboundIpAddresses \
  --output tsv
```

This command returns a comma-separated list of IP addresses. All of these addresses should be added to the Azure SQL Server firewall rules.

### 6.2 Add Firewall Rules to Azure SQL Server

For each outbound IP address, create a firewall rule on your Azure SQL Server:

```bash
az sql server firewall-rule create \
  --resource-group <your-sql-server-resource-group> \
  --server rpm-reporting \
  --name AllowAppService1 \
  --start-ip-address <IP-ADDRESS-1> \
  --end-ip-address <IP-ADDRESS-1>
```

Repeat this command for each IP address returned in Step 6.1, using unique rule names (AllowAppService1, AllowAppService2, etc.).

**Alternative Approach**: For simplified management, you can allow all Azure services to access your SQL Server:

```bash
az sql server firewall-rule create \
  --resource-group <your-sql-server-resource-group> \
  --server rpm-reporting \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

**Security Note**: Allowing all Azure services (0.0.0.0) is less secure than specifying individual IP addresses, but it simplifies management when outbound IPs change during scaling operations.

---

## Step 7: Enable Continuous Deployment

Configure continuous deployment to automatically update your application when new images are pushed to the container registry.

### 7.1 Enable Webhook

Enable the container registry webhook that triggers deployment on image updates:

```bash
az webapp deployment container config \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg \
  --enable-cd true
```

### 7.2 Get Webhook URL

Retrieve the webhook URL that will be configured in your container registry:

```bash
az webapp deployment container show-cd-url \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg
```

### 7.3 Configure ACR Webhook

Create a webhook in Azure Container Registry that calls the App Service webhook URL when a new image is pushed:

```bash
az acr webhook create \
  --registry rpmimporteracr \
  --name appservicewebhook \
  --actions push \
  --uri <WEBHOOK-URL-FROM-PREVIOUS-STEP>
```

With this configuration in place, any time you push a new image to the registry with the `latest` tag, Azure App Service will automatically pull and deploy the updated image.

---

## Step 8: Configure Custom Domain (Optional)

If you want to use a custom domain instead of the default azurewebsites.net domain, follow these steps.

### 8.1 Add Custom Domain

Add your custom domain to the App Service:

```bash
az webapp config hostname add \
  --webapp-name rpm-customer-user-importer \
  --resource-group rpm-importer-rg \
  --hostname importer.rpmtechnologies.com
```

Before executing this command, you must configure DNS records with your domain registrar:

**CNAME Record**: Create a CNAME record pointing your subdomain to the App Service default domain:
- Name: `importer`
- Type: `CNAME`
- Value: `rpm-customer-user-importer.azurewebsites.net`

**TXT Record**: Create a TXT record for domain verification:
- Name: `asuid.importer`
- Type: `TXT`
- Value: (obtained from Azure Portal or CLI)

### 8.2 Enable HTTPS

Azure App Service provides free SSL certificates through managed certificates. Enable HTTPS for your custom domain:

```bash
az webapp config ssl bind \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

The managed certificate is automatically renewed before expiration, ensuring continuous HTTPS availability.

---

## Step 9: Verify Deployment

### 9.1 Check Application Status

Verify that the application is running correctly:

```bash
az webapp show \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg \
  --query state
```

The state should return "Running". If the application is not running, check the logs for error messages.

### 9.2 Access the Application

Open your web browser and navigate to your application URL:

```
https://rpm-customer-user-importer.azurewebsites.net
```

Or if you configured a custom domain:

```
https://importer.rpmtechnologies.com
```

You should see the RPM Customer User Importer login page with the RPM Technologies branding.

### 9.3 View Application Logs

Monitor application logs to troubleshoot any issues:

```bash
az webapp log tail \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg
```

This command streams real-time logs from your application. Press Ctrl+C to stop streaming.

For historical logs, use the Azure Portal:
1. Navigate to your App Service in the Azure Portal
2. Select "Log stream" from the left menu
3. View real-time logs or download log files

---

## Step 10: Database Migration

After the application is deployed and running, you need to initialize the database schema.

### 10.1 Access the App Service Console

The easiest way to run database migrations is through the App Service SSH console:

1. Navigate to your App Service in the Azure Portal
2. Select "SSH" from the Development Tools section
3. Click "Go" to open the SSH console

### 10.2 Run Database Migrations

In the SSH console, navigate to the application directory and run the migration command:

```bash
cd /app
pnpm db:push
```

This command uses Drizzle ORM to create all necessary tables in the MySQL database:
- `users` - User authentication and profile data
- `azure_connections` - Azure SQL Server connection configurations
- `mapping_templates` - Saved field mapping templates
- `import_jobs` - Import history and status tracking
- `cleanup_audit_logs` - Audit trail for data cleanup operations

Verify that the migration completed successfully by checking for any error messages in the output.

---

## Updating the Application

When you need to deploy updates to the application, follow this streamlined process.

### Update Process

First, pull the latest code changes from the repository:

```bash
git pull origin main
```

Build the new Docker image with an updated tag:

```bash
docker build -t rpm-customer-user-importer:v1.1 .
```

Tag the image for your container registry:

```bash
docker tag rpm-customer-user-importer:v1.1 \
  rpmimporteracr.azurecr.io/rpm-customer-user-importer:latest
```

Push the updated image to Azure Container Registry:

```bash
docker push rpmimporteracr.azurecr.io/rpm-customer-user-importer:latest
```

If you enabled continuous deployment in Step 7, the application will automatically update within a few minutes. Otherwise, manually restart the App Service:

```bash
az webapp restart \
  --name rpm-customer-user-importer \
  --resource-group rpm-importer-rg
```

Monitor the deployment progress through the log stream to ensure the new version deploys successfully.

---

## Scaling Considerations

As your usage grows, you may need to scale the application to handle increased load.

### Vertical Scaling

Upgrade to a higher App Service Plan tier for more CPU and memory resources:

```bash
az appservice plan update \
  --name rpm-importer-plan \
  --resource-group rpm-importer-rg \
  --sku S1
```

The Standard tier (S1) provides 1.75 GB RAM and supports auto-scaling. Premium tiers (P1V2, P2V2, P3V2) offer even more resources and advanced networking features.

### Horizontal Scaling

Enable auto-scaling to automatically adjust the number of instances based on load:

```bash
az monitor autoscale create \
  --resource-group rpm-importer-rg \
  --resource rpm-customer-user-importer \
  --resource-type Microsoft.Web/sites \
  --name autoscale-rule \
  --min-count 1 \
  --max-count 5 \
  --count 1
```

Configure scale-out rules based on CPU usage:

```bash
az monitor autoscale rule create \
  --resource-group rpm-importer-rg \
  --autoscale-name autoscale-rule \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1
```

### Database Scaling

For the MySQL database, you can scale up to a higher tier when needed:

```bash
az mysql flexible-server update \
  --resource-group rpm-importer-rg \
  --name rpm-importer-mysql \
  --sku-name Standard_D2ds_v4 \
  --tier GeneralPurpose
```

The General Purpose tier provides better performance and higher connection limits compared to the Burstable tier.

---

## Monitoring and Maintenance

### Application Insights

Enable Application Insights for comprehensive monitoring and diagnostics:

```bash
az monitor app-insights component create \
  --app rpm-importer-insights \
  --location eastus \
  --resource-group rpm-importer-rg \
  --application-type web
```

Connect Application Insights to your App Service:

```bash
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="<instrumentation-key>"
```

Application Insights provides real-time metrics, request tracking, dependency monitoring, and failure analysis.

### Backup Configuration

Configure automated backups for your App Service:

```bash
az webapp config backup create \
  --resource-group rpm-importer-rg \
  --webapp-name rpm-customer-user-importer \
  --container-url "<storage-account-sas-url>" \
  --backup-name daily-backup \
  --frequency 1d \
  --retain-one true
```

For the MySQL database, Azure automatically performs backups with a 7-day retention period for Burstable tier and 35 days for General Purpose tier.

### Security Best Practices

Implement these security measures for production deployments:

**Managed Identity**: Use Azure Managed Identity instead of connection strings for accessing Azure resources. This eliminates the need to store credentials in environment variables.

**Key Vault Integration**: Store sensitive configuration values in Azure Key Vault and reference them in App Service settings:

```bash
az keyvault secret set \
  --vault-name rpm-importer-vault \
  --name DatabasePassword \
  --value "YourSecurePassword123!"
```

**Network Isolation**: Configure Virtual Network integration to restrict database access to only your App Service:

```bash
az webapp vnet-integration add \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --vnet MyVNet \
  --subnet AppServiceSubnet
```

**SSL/TLS Configuration**: Enforce HTTPS-only traffic and use TLS 1.2 or higher:

```bash
az webapp update \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer \
  --https-only true
```

---

## Troubleshooting

### Common Issues and Solutions

**Application Not Starting**

If the application fails to start, check the following:

1. Verify all required environment variables are set correctly
2. Check that the DATABASE_URL connection string is valid
3. Review application logs for error messages
4. Ensure the Docker image was built and pushed successfully
5. Verify that the App Service can pull from the container registry

**Database Connection Failures**

If the application cannot connect to MySQL:

1. Verify the MySQL server firewall allows connections from Azure services
2. Check that the database name in DATABASE_URL matches the created database
3. Confirm the admin username and password are correct
4. Test connectivity using MySQL Workbench or Azure Cloud Shell
5. Ensure SSL is enabled in the connection string (?ssl=true)

**Azure SQL Connection Failures**

If the application cannot connect to Azure SQL Server (rpm-reporting):

1. Verify the App Service outbound IP addresses are whitelisted in Azure SQL firewall
2. Check that the connection credentials are correct in the application
3. Confirm the Azure SQL Server allows Azure services to connect
4. Test the connection using SQL Server Management Studio
5. Review the application logs for specific error messages

**Performance Issues**

If the application is slow or unresponsive:

1. Check the App Service Plan tier and consider upgrading
2. Review Application Insights metrics for bottlenecks
3. Monitor MySQL database performance and consider scaling up
4. Check for slow queries in the application logs
5. Enable caching for frequently accessed data

**Deployment Failures**

If deployments fail or the application doesn't update:

1. Verify the Docker image was pushed successfully to ACR
2. Check that the webhook is configured correctly
3. Review deployment logs in the Azure Portal
4. Manually restart the App Service to force a pull
5. Verify the image tag matches the configured image name

---

## Cost Optimization

### Estimated Monthly Costs

The following table provides estimated monthly costs for different deployment configurations:

| Component | Basic Tier | Standard Tier | Premium Tier |
|-----------|-----------|---------------|--------------|
| App Service Plan (B1/S1/P1V2) | $13 | $75 | $150 |
| Azure Container Registry (Basic) | $5 | $5 | $5 |
| MySQL Flexible Server (B1ms/D2ds_v4) | $15 | $120 | $240 |
| Application Insights | $0-5 | $5-20 | $20-50 |
| **Total Estimated Cost** | **$33-38** | **$205-220** | **$415-445** |

**Note**: Costs are estimates based on US East region pricing and may vary based on actual usage, data transfer, and storage requirements.

### Cost Reduction Strategies

**Development/Testing Environments**: Use the Basic tier (B1) for development and testing environments. Scale up to Standard or Premium only for production.

**Auto-Shutdown**: Configure auto-shutdown for non-production environments during off-hours:

```bash
az webapp config appsettings set \
  --resource-group rpm-importer-rg \
  --name rpm-customer-user-importer-dev \
  --settings WEBSITE_TIME_ZONE="Eastern Standard Time"
```

**Reserved Instances**: Purchase reserved instances for App Service Plans if you plan to run the application continuously for 1-3 years. This can provide up to 55% cost savings.

**Right-Sizing**: Monitor resource utilization through Application Insights and adjust the App Service Plan tier based on actual usage patterns. Many applications can run efficiently on lower tiers than initially provisioned.

---

## Conclusion

This deployment guide has provided comprehensive instructions for deploying the RPM Customer User Importer application to Azure App Services using Docker containers. The deployment includes a fully managed MySQL database for application data and integrates with your existing Azure SQL Server for customer data imports.

The application is now accessible via a secure HTTPS endpoint and includes features for CSV import, advanced field mapping with concatenation support, mapping templates, data cleanup, and comprehensive audit logging. The Docker-based deployment ensures consistency across environments and simplifies the update process through continuous deployment.

For additional support or questions about the deployment process, refer to the Azure documentation or contact the RPM Technologies development team.

---

## Additional Resources

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/azure/container-registry/)
- [Azure Database for MySQL Documentation](https://docs.microsoft.com/azure/mysql/)
- [Docker Documentation](https://docs.docker.com/)
- [Application GitHub Repository](https://github.com/RPM-Technologies/rpm-customer-user-importer)

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Author**: Manus AI
