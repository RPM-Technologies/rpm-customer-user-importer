<#
.SYNOPSIS
    RPM Customer User Importer - Azure Deployment Script (PowerShell)

.DESCRIPTION
    This script automates the complete deployment of the RPM Customer User 
    Importer application to Azure App Services with MySQL database.

.PARAMETER ConfigFile
    Path to configuration file (default: deployment\config.json)

.PARAMETER SkipMySQL
    Skip MySQL database creation

.PARAMETER SkipACR
    Skip Azure Container Registry creation

.PARAMETER SkipApp
    Skip App Service creation

.EXAMPLE
    .\deployment\Deploy-Azure.ps1

.EXAMPLE
    .\deployment\Deploy-Azure.ps1 -ConfigFile "deployment\prod-config.json"

.EXAMPLE
    .\deployment\Deploy-Azure.ps1 -SkipMySQL -SkipACR

.NOTES
    Prerequisites:
    - Azure CLI installed and logged in (az login)
    - Docker installed (for building container images)
    - Configuration file (deployment/config.json) with required variables
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "deployment\config.json",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipMySQL,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipACR,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipApp
)

################################################################################
# Script Configuration
################################################################################

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

################################################################################
# Helper Functions
################################################################################

function Write-ColorOutput {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet("Info", "Success", "Warning", "Error")]
        [string]$Type = "Info"
    )
    
    $color = switch ($Type) {
        "Info"    { "Cyan" }
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
    }
    
    $prefix = switch ($Type) {
        "Info"    { "[INFO]" }
        "Success" { "[SUCCESS]" }
        "Warning" { "[WARNING]" }
        "Error"   { "[ERROR]" }
    }
    
    Write-Host "$prefix $Message" -ForegroundColor $color
}

function Test-Prerequisites {
    Write-ColorOutput "Checking prerequisites..." -Type Info
    
    # Check if Azure CLI is installed
    try {
        $null = az version 2>&1
    } catch {
        Write-ColorOutput "Azure CLI is not installed. Please install it from https://docs.microsoft.com/cli/azure/install-azure-cli" -Type Error
        exit 1
    }
    
    # Check if Docker is installed
    try {
        $null = docker --version 2>&1
    } catch {
        Write-ColorOutput "Docker is not installed. Please install it from https://docs.docker.com/get-docker/" -Type Error
        exit 1
    }
    
    # Check if logged in to Azure
    try {
        $null = az account show 2>&1
    } catch {
        Write-ColorOutput "Not logged in to Azure. Please run 'az login' first." -Type Error
        exit 1
    }
    
    Write-ColorOutput "All prerequisites met" -Type Success
}

function Get-Configuration {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-ColorOutput "Configuration file not found: $Path" -Type Error
        Write-ColorOutput "Please create the configuration file. See deployment\config.json.example" -Type Info
        exit 1
    }
    
    Write-ColorOutput "Loading configuration from $Path" -Type Info
    
    try {
        $config = Get-Content $Path -Raw | ConvertFrom-Json
    } catch {
        Write-ColorOutput "Failed to parse configuration file: $_" -Type Error
        exit 1
    }
    
    # Validate required properties
    $requiredProps = @(
        "subscriptionId",
        "resourceGroup",
        "location",
        "appName",
        "acrName",
        "mysqlServerName",
        "mysqlAdminUser",
        "mysqlAdminPassword",
        "mysqlDatabaseName"
    )
    
    foreach ($prop in $requiredProps) {
        if (-not $config.$prop) {
            Write-ColorOutput "Required property '$prop' is missing in configuration file" -Type Error
            exit 1
        }
    }
    
    Write-ColorOutput "Configuration loaded successfully" -Type Success
    return $config
}

################################################################################
# Deployment Functions
################################################################################

function Set-AzureSubscription {
    param([string]$SubscriptionId)
    
    Write-ColorOutput "Setting Azure subscription to $SubscriptionId" -Type Info
    az account set --subscription $SubscriptionId
    Write-ColorOutput "Subscription set" -Type Success
}

function New-ResourceGroup {
    param(
        [string]$Name,
        [string]$Location
    )
    
    Write-ColorOutput "Creating resource group: $Name in $Location" -Type Info
    
    $existing = az group show --name $Name 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "Resource group $Name already exists" -Type Warning
    } else {
        az group create --name $Name --location $Location
        Write-ColorOutput "Resource group created" -Type Success
    }
}

function New-MySQLDatabase {
    param($Config)
    
    if ($SkipMySQL) {
        Write-ColorOutput "Skipping MySQL database creation" -Type Warning
        return
    }
    
    Write-ColorOutput "Creating MySQL Flexible Server: $($Config.mysqlServerName)" -Type Info
    
    $existing = az mysql flexible-server show `
        --resource-group $Config.resourceGroup `
        --name $Config.mysqlServerName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "MySQL server $($Config.mysqlServerName) already exists" -Type Warning
    } else {
        az mysql flexible-server create `
            --resource-group $Config.resourceGroup `
            --name $Config.mysqlServerName `
            --location $Config.location `
            --admin-user $Config.mysqlAdminUser `
            --admin-password $Config.mysqlAdminPassword `
            --sku-name $($Config.mysqlSku ?? "Standard_B1ms") `
            --tier $($Config.mysqlTier ?? "Burstable") `
            --version $($Config.mysqlVersion ?? "8.0.21") `
            --storage-size $($Config.mysqlStorageSize ?? 32) `
            --backup-retention $($Config.mysqlBackupRetention ?? 7) `
            --public-access 0.0.0.0
        
        Write-ColorOutput "MySQL server created" -Type Success
    }
    
    # Create database
    Write-ColorOutput "Creating database: $($Config.mysqlDatabaseName)" -Type Info
    
    $existing = az mysql flexible-server db show `
        --resource-group $Config.resourceGroup `
        --server-name $Config.mysqlServerName `
        --database-name $Config.mysqlDatabaseName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "Database $($Config.mysqlDatabaseName) already exists" -Type Warning
    } else {
        az mysql flexible-server db create `
            --resource-group $Config.resourceGroup `
            --server-name $Config.mysqlServerName `
            --database-name $Config.mysqlDatabaseName
        Write-ColorOutput "Database created" -Type Success
    }
    
    # Configure firewall
    Write-ColorOutput "Configuring MySQL firewall rules" -Type Info
    az mysql flexible-server firewall-rule create `
        --resource-group $Config.resourceGroup `
        --name $Config.mysqlServerName `
        --rule-name AllowAzureServices `
        --start-ip-address 0.0.0.0 `
        --end-ip-address 0.0.0.0 `
        --output none 2>&1 | Out-Null
    
    Write-ColorOutput "MySQL database setup complete" -Type Success
}

function New-ContainerRegistry {
    param($Config)
    
    if ($SkipACR) {
        Write-ColorOutput "Skipping Azure Container Registry creation" -Type Warning
        return
    }
    
    Write-ColorOutput "Creating Azure Container Registry: $($Config.acrName)" -Type Info
    
    $existing = az acr show `
        --name $Config.acrName `
        --resource-group $Config.resourceGroup 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "Container registry $($Config.acrName) already exists" -Type Warning
    } else {
        az acr create `
            --resource-group $Config.resourceGroup `
            --name $Config.acrName `
            --sku $($Config.acrSku ?? "Basic") `
            --admin-enabled true
        Write-ColorOutput "Container registry created" -Type Success
    }
}

function Build-AndPushImage {
    param($Config)
    
    if ($SkipACR) {
        Write-ColorOutput "Skipping Docker image build and push" -Type Warning
        return
    }
    
    Write-ColorOutput "Building Docker image" -Type Info
    docker build -t "$($Config.appName):latest" .
    Write-ColorOutput "Docker image built" -Type Success
    
    Write-ColorOutput "Logging in to Azure Container Registry" -Type Info
    az acr login --name $Config.acrName
    
    Write-ColorOutput "Tagging and pushing image to ACR" -Type Info
    $acrLoginServer = az acr show `
        --name $Config.acrName `
        --resource-group $Config.resourceGroup `
        --query loginServer `
        --output tsv
    
    docker tag "$($Config.appName):latest" "$acrLoginServer/$($Config.appName):latest"
    docker push "$acrLoginServer/$($Config.appName):latest"
    Write-ColorOutput "Image pushed to ACR" -Type Success
}

function New-AppServicePlan {
    param($Config)
    
    if ($SkipApp) {
        Write-ColorOutput "Skipping App Service Plan creation" -Type Warning
        return
    }
    
    $planName = "$($Config.appName)-plan"
    Write-ColorOutput "Creating App Service Plan: $planName" -Type Info
    
    $existing = az appservice plan show `
        --name $planName `
        --resource-group $Config.resourceGroup 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "App Service Plan $planName already exists" -Type Warning
    } else {
        az appservice plan create `
            --name $planName `
            --resource-group $Config.resourceGroup `
            --is-linux `
            --sku $($Config.appServiceSku ?? "B1")
        Write-ColorOutput "App Service Plan created" -Type Success
    }
}

function New-WebApp {
    param($Config)
    
    if ($SkipApp) {
        Write-ColorOutput "Skipping Web App creation" -Type Warning
        return
    }
    
    $planName = "$($Config.appName)-plan"
    Write-ColorOutput "Creating Web App: $($Config.appName)" -Type Info
    
    $acrLoginServer = az acr show `
        --name $Config.acrName `
        --resource-group $Config.resourceGroup `
        --query loginServer `
        --output tsv
    
    $existing = az webapp show `
        --name $Config.appName `
        --resource-group $Config.resourceGroup 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "Web App $($Config.appName) already exists" -Type Warning
    } else {
        az webapp create `
            --resource-group $Config.resourceGroup `
            --plan $planName `
            --name $Config.appName `
            --deployment-container-image-name "$acrLoginServer/$($Config.appName):latest"
        Write-ColorOutput "Web App created" -Type Success
    }
    
    # Configure container registry credentials
    Write-ColorOutput "Configuring container registry credentials" -Type Info
    $acrUsername = az acr credential show `
        --name $Config.acrName `
        --query username `
        --output tsv
    
    $acrPassword = az acr credential show `
        --name $Config.acrName `
        --query "passwords[0].value" `
        --output tsv
    
    az webapp config container set `
        --name $Config.appName `
        --resource-group $Config.resourceGroup `
        --docker-custom-image-name "$acrLoginServer/$($Config.appName):latest" `
        --docker-registry-server-url "https://$acrLoginServer" `
        --docker-registry-server-user $acrUsername `
        --docker-registry-server-password $acrPassword
    
    Write-ColorOutput "Container registry configured" -Type Success
}

function Set-AppSettings {
    param($Config)
    
    if ($SkipApp) {
        Write-ColorOutput "Skipping App Settings configuration" -Type Warning
        return
    }
    
    Write-ColorOutput "Configuring application settings" -Type Info
    
    # Build DATABASE_URL
    $databaseUrl = "mysql://$($Config.mysqlAdminUser):$($Config.mysqlAdminPassword)@$($Config.mysqlServerName).mysql.database.azure.com:3306/$($Config.mysqlDatabaseName)?ssl=true"
    
    # Generate JWT secret if not provided
    $jwtSecret = $Config.jwtSecret
    if (-not $jwtSecret) {
        $bytes = New-Object byte[] 32
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $jwtSecret = [Convert]::ToBase64String($bytes)
    }
    
    $settings = @(
        "DATABASE_URL=$databaseUrl",
        "JWT_SECRET=$jwtSecret",
        "OAUTH_SERVER_URL=$($Config.oauthServerUrl ?? '')",
        "VITE_OAUTH_PORTAL_URL=$($Config.viteOAuthPortalUrl ?? '')",
        "VITE_APP_ID=$($Config.viteAppId ?? '')",
        "OWNER_OPEN_ID=$($Config.ownerOpenId ?? '')",
        "OWNER_NAME=$($Config.ownerName ?? '')",
        "VITE_APP_TITLE=$($Config.viteAppTitle ?? 'RPM Customer User Importer')",
        "VITE_APP_LOGO=$($Config.viteAppLogo ?? '')",
        "BUILT_IN_FORGE_API_URL=$($Config.builtInForgeApiUrl ?? '')",
        "BUILT_IN_FORGE_API_KEY=$($Config.builtInForgeApiKey ?? '')",
        "VITE_FRONTEND_FORGE_API_KEY=$($Config.viteFrontendForgeApiKey ?? '')",
        "VITE_FRONTEND_FORGE_API_URL=$($Config.viteFrontendForgeApiUrl ?? '')",
        "WEBSITES_PORT=3000"
    )
    
    az webapp config appsettings set `
        --resource-group $Config.resourceGroup `
        --name $Config.appName `
        --settings $settings
    
    Write-ColorOutput "Application settings configured" -Type Success
}

function Enable-ContinuousDeployment {
    param($Config)
    
    if ($SkipApp) {
        Write-ColorOutput "Skipping continuous deployment configuration" -Type Warning
        return
    }
    
    Write-ColorOutput "Enabling continuous deployment" -Type Info
    
    az webapp deployment container config `
        --name $Config.appName `
        --resource-group $Config.resourceGroup `
        --enable-cd true
    
    $webhookUrl = az webapp deployment container show-cd-url `
        --name $Config.appName `
        --resource-group $Config.resourceGroup `
        --query CI_CD_URL `
        --output tsv
    
    Write-ColorOutput "Webhook URL: $webhookUrl" -Type Info
    Write-ColorOutput "Continuous deployment enabled" -Type Success
}

function Restart-WebApp {
    param($Config)
    
    if ($SkipApp) {
        Write-ColorOutput "Skipping Web App restart" -Type Warning
        return
    }
    
    Write-ColorOutput "Restarting Web App" -Type Info
    az webapp restart --name $Config.appName --resource-group $Config.resourceGroup
    Write-ColorOutput "Web App restarted" -Type Success
}

function Show-DeploymentInfo {
    param($Config)
    
    Write-ColorOutput "=========================================" -Type Info
    Write-ColorOutput "Deployment Complete!" -Type Info
    Write-ColorOutput "=========================================" -Type Info
    
    if (-not $SkipApp) {
        $appUrl = az webapp show `
            --name $Config.appName `
            --resource-group $Config.resourceGroup `
            --query defaultHostName `
            --output tsv
        Write-ColorOutput "Application URL: https://$appUrl" -Type Info
    }
    
    if (-not $SkipMySQL) {
        Write-ColorOutput "MySQL Server: $($Config.mysqlServerName).mysql.database.azure.com" -Type Info
        Write-ColorOutput "MySQL Database: $($Config.mysqlDatabaseName)" -Type Info
    }
    
    if (-not $SkipACR) {
        $acrLoginServer = az acr show `
            --name $Config.acrName `
            --resource-group $Config.resourceGroup `
            --query loginServer `
            --output tsv
        Write-ColorOutput "Container Registry: $acrLoginServer" -Type Info
    }
    
    Write-ColorOutput "=========================================" -Type Info
    Write-ColorOutput "Next Steps:" -Type Info
    Write-ColorOutput "1. Access your application at the URL above" -Type Info
    Write-ColorOutput "2. Run database migrations (see MYSQL_AZURE_CONFIGURATION.md)" -Type Info
    Write-ColorOutput "3. Configure custom domain (optional)" -Type Info
    Write-ColorOutput "4. Set up monitoring and alerts" -Type Info
    Write-ColorOutput "=========================================" -Type Info
}

################################################################################
# Main Execution
################################################################################

try {
    Write-ColorOutput "Starting Azure deployment for RPM Customer User Importer" -Type Info
    Write-ColorOutput "=========================================" -Type Info
    
    Test-Prerequisites
    $config = Get-Configuration -Path $ConfigFile
    Set-AzureSubscription -SubscriptionId $config.subscriptionId
    New-ResourceGroup -Name $config.resourceGroup -Location $config.location
    New-MySQLDatabase -Config $config
    New-ContainerRegistry -Config $config
    Build-AndPushImage -Config $config
    New-AppServicePlan -Config $config
    New-WebApp -Config $config
    Set-AppSettings -Config $config
    Enable-ContinuousDeployment -Config $config
    Restart-WebApp -Config $config
    Show-DeploymentInfo -Config $config
    
    Write-ColorOutput "Deployment completed successfully!" -Type Success
    
} catch {
    Write-ColorOutput "Deployment failed: $_" -Type Error
    Write-ColorOutput $_.ScriptStackTrace -Type Error
    exit 1
}
