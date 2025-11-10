#!/bin/bash

################################################################################
# RPM Customer User Importer - Azure Deployment Script (Bash)
################################################################################
#
# This script automates the complete deployment of the RPM Customer User 
# Importer application to Azure App Services with MySQL database.
#
# Prerequisites:
# - Azure CLI installed and logged in (az login)
# - Docker installed (for building container images)
# - Configuration file (deployment/config.env) with required variables
#
# Usage:
#   ./deployment/deploy-azure.sh [options]
#
# Options:
#   --config FILE    Path to configuration file (default: deployment/config.env)
#   --skip-mysql     Skip MySQL database creation
#   --skip-acr       Skip Azure Container Registry creation
#   --skip-app       Skip App Service creation
#   --help           Show this help message
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
CONFIG_FILE="deployment/config.env"
SKIP_MYSQL=false
SKIP_ACR=false
SKIP_APP=false

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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it from https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    
    log_success "All prerequisites met"
}

load_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        log_info "Please create the configuration file. See deployment/config.env.example"
        exit 1
    fi
    
    log_info "Loading configuration from $CONFIG_FILE"
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
    
    # Validate required variables
    required_vars=(
        "AZURE_SUBSCRIPTION_ID"
        "RESOURCE_GROUP"
        "LOCATION"
        "APP_NAME"
        "ACR_NAME"
        "MYSQL_SERVER_NAME"
        "MYSQL_ADMIN_USER"
        "MYSQL_ADMIN_PASSWORD"
        "MYSQL_DATABASE_NAME"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required variable $var is not set in $CONFIG_FILE"
            exit 1
        fi
    done
    
    log_success "Configuration loaded successfully"
}

################################################################################
# Deployment Functions
################################################################################

set_subscription() {
    log_info "Setting Azure subscription to $AZURE_SUBSCRIPTION_ID"
    az account set --subscription "$AZURE_SUBSCRIPTION_ID"
    log_success "Subscription set"
}

create_resource_group() {
    log_info "Creating resource group: $RESOURCE_GROUP in $LOCATION"
    
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "Resource group $RESOURCE_GROUP already exists"
    else
        az group create \
            --name "$RESOURCE_GROUP" \
            --location "$LOCATION"
        log_success "Resource group created"
    fi
}

create_mysql_database() {
    if [ "$SKIP_MYSQL" = true ]; then
        log_warning "Skipping MySQL database creation"
        return
    fi
    
    log_info "Creating MySQL Flexible Server: $MYSQL_SERVER_NAME"
    
    if az mysql flexible-server show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$MYSQL_SERVER_NAME" &> /dev/null; then
        log_warning "MySQL server $MYSQL_SERVER_NAME already exists"
    else
        az mysql flexible-server create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$MYSQL_SERVER_NAME" \
            --location "$LOCATION" \
            --admin-user "$MYSQL_ADMIN_USER" \
            --admin-password "$MYSQL_ADMIN_PASSWORD" \
            --sku-name "${MYSQL_SKU:-Standard_B1ms}" \
            --tier "${MYSQL_TIER:-Burstable}" \
            --version "${MYSQL_VERSION:-8.0.21}" \
            --storage-size "${MYSQL_STORAGE_SIZE:-32}" \
            --backup-retention "${MYSQL_BACKUP_RETENTION:-7}" \
            --public-access 0.0.0.0
        
        log_success "MySQL server created"
    fi
    
    # Create database
    log_info "Creating database: $MYSQL_DATABASE_NAME"
    if az mysql flexible-server db show \
        --resource-group "$RESOURCE_GROUP" \
        --server-name "$MYSQL_SERVER_NAME" \
        --database-name "$MYSQL_DATABASE_NAME" &> /dev/null; then
        log_warning "Database $MYSQL_DATABASE_NAME already exists"
    else
        az mysql flexible-server db create \
            --resource-group "$RESOURCE_GROUP" \
            --server-name "$MYSQL_SERVER_NAME" \
            --database-name "$MYSQL_DATABASE_NAME"
        log_success "Database created"
    fi
    
    # Configure firewall to allow Azure services
    log_info "Configuring MySQL firewall rules"
    az mysql flexible-server firewall-rule create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$MYSQL_SERVER_NAME" \
        --rule-name AllowAzureServices \
        --start-ip-address 0.0.0.0 \
        --end-ip-address 0.0.0.0 \
        --output none || log_warning "Firewall rule may already exist"
    
    log_success "MySQL database setup complete"
}

create_container_registry() {
    if [ "$SKIP_ACR" = true ]; then
        log_warning "Skipping Azure Container Registry creation"
        return
    fi
    
    log_info "Creating Azure Container Registry: $ACR_NAME"
    
    if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "Container registry $ACR_NAME already exists"
    else
        az acr create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$ACR_NAME" \
            --sku "${ACR_SKU:-Basic}" \
            --admin-enabled true
        log_success "Container registry created"
    fi
}

build_and_push_image() {
    if [ "$SKIP_ACR" = true ]; then
        log_warning "Skipping Docker image build and push"
        return
    fi
    
    log_info "Building Docker image"
    docker build -t "${APP_NAME}:latest" .
    log_success "Docker image built"
    
    log_info "Logging in to Azure Container Registry"
    az acr login --name "$ACR_NAME"
    
    log_info "Tagging and pushing image to ACR"
    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer --output tsv)
    docker tag "${APP_NAME}:latest" "${ACR_LOGIN_SERVER}/${APP_NAME}:latest"
    docker push "${ACR_LOGIN_SERVER}/${APP_NAME}:latest"
    log_success "Image pushed to ACR"
}

create_app_service_plan() {
    if [ "$SKIP_APP" = true ]; then
        log_warning "Skipping App Service Plan creation"
        return
    fi
    
    local plan_name="${APP_NAME}-plan"
    log_info "Creating App Service Plan: $plan_name"
    
    if az appservice plan show --name "$plan_name" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "App Service Plan $plan_name already exists"
    else
        az appservice plan create \
            --name "$plan_name" \
            --resource-group "$RESOURCE_GROUP" \
            --is-linux \
            --sku "${APP_SERVICE_SKU:-B1}"
        log_success "App Service Plan created"
    fi
}

create_web_app() {
    if [ "$SKIP_APP" = true ]; then
        log_warning "Skipping Web App creation"
        return
    fi
    
    local plan_name="${APP_NAME}-plan"
    log_info "Creating Web App: $APP_NAME"
    
    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer --output tsv)
    
    if az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "Web App $APP_NAME already exists"
    else
        az webapp create \
            --resource-group "$RESOURCE_GROUP" \
            --plan "$plan_name" \
            --name "$APP_NAME" \
            --deployment-container-image-name "${ACR_LOGIN_SERVER}/${APP_NAME}:latest"
        log_success "Web App created"
    fi
    
    # Configure container registry credentials
    log_info "Configuring container registry credentials"
    ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username --output tsv)
    ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" --output tsv)
    
    az webapp config container set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-custom-image-name "${ACR_LOGIN_SERVER}/${APP_NAME}:latest" \
        --docker-registry-server-url "https://${ACR_LOGIN_SERVER}" \
        --docker-registry-server-user "$ACR_USERNAME" \
        --docker-registry-server-password "$ACR_PASSWORD"
    
    log_success "Container registry configured"
}

configure_app_settings() {
    if [ "$SKIP_APP" = true ]; then
        log_warning "Skipping App Settings configuration"
        return
    fi
    
    log_info "Configuring application settings"
    
    # Build DATABASE_URL
    DATABASE_URL="mysql://${MYSQL_ADMIN_USER}:${MYSQL_ADMIN_PASSWORD}@${MYSQL_SERVER_NAME}.mysql.database.azure.com:3306/${MYSQL_DATABASE_NAME}?ssl=true"
    
    az webapp config appsettings set \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --settings \
            DATABASE_URL="$DATABASE_URL" \
            JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 32)}" \
            OAUTH_SERVER_URL="${OAUTH_SERVER_URL:-}" \
            VITE_OAUTH_PORTAL_URL="${VITE_OAUTH_PORTAL_URL:-}" \
            VITE_APP_ID="${VITE_APP_ID:-}" \
            OWNER_OPEN_ID="${OWNER_OPEN_ID:-}" \
            OWNER_NAME="${OWNER_NAME:-}" \
            VITE_APP_TITLE="${VITE_APP_TITLE:-RPM Customer User Importer}" \
            VITE_APP_LOGO="${VITE_APP_LOGO:-}" \
            BUILT_IN_FORGE_API_URL="${BUILT_IN_FORGE_API_URL:-}" \
            BUILT_IN_FORGE_API_KEY="${BUILT_IN_FORGE_API_KEY:-}" \
            VITE_FRONTEND_FORGE_API_KEY="${VITE_FRONTEND_FORGE_API_KEY:-}" \
            VITE_FRONTEND_FORGE_API_URL="${VITE_FRONTEND_FORGE_API_URL:-}" \
            WEBSITES_PORT=3000
    
    log_success "Application settings configured"
}

enable_continuous_deployment() {
    if [ "$SKIP_APP" = true ]; then
        log_warning "Skipping continuous deployment configuration"
        return
    fi
    
    log_info "Enabling continuous deployment"
    
    az webapp deployment container config \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --enable-cd true
    
    # Get webhook URL
    WEBHOOK_URL=$(az webapp deployment container show-cd-url \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query CI_CD_URL \
        --output tsv)
    
    log_info "Webhook URL: $WEBHOOK_URL"
    log_success "Continuous deployment enabled"
}

restart_web_app() {
    if [ "$SKIP_APP" = true ]; then
        log_warning "Skipping Web App restart"
        return
    fi
    
    log_info "Restarting Web App"
    az webapp restart --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"
    log_success "Web App restarted"
}

show_deployment_info() {
    log_info "========================================="
    log_info "Deployment Complete!"
    log_info "========================================="
    
    if [ "$SKIP_APP" = false ]; then
        APP_URL=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName --output tsv)
        log_info "Application URL: https://${APP_URL}"
    fi
    
    if [ "$SKIP_MYSQL" = false ]; then
        log_info "MySQL Server: ${MYSQL_SERVER_NAME}.mysql.database.azure.com"
        log_info "MySQL Database: $MYSQL_DATABASE_NAME"
    fi
    
    if [ "$SKIP_ACR" = false ]; then
        ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer --output tsv)
        log_info "Container Registry: $ACR_LOGIN_SERVER"
    fi
    
    log_info "========================================="
    log_info "Next Steps:"
    log_info "1. Access your application at the URL above"
    log_info "2. Run database migrations (see MYSQL_AZURE_CONFIGURATION.md)"
    log_info "3. Configure custom domain (optional)"
    log_info "4. Set up monitoring and alerts"
    log_info "========================================="
}

################################################################################
# Main Execution
################################################################################

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --skip-mysql)
                SKIP_MYSQL=true
                shift
                ;;
            --skip-acr)
                SKIP_ACR=true
                shift
                ;;
            --skip-app)
                SKIP_APP=true
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
    
    log_info "Starting Azure deployment for RPM Customer User Importer"
    log_info "========================================="
    
    check_prerequisites
    load_config
    set_subscription
    create_resource_group
    create_mysql_database
    create_container_registry
    build_and_push_image
    create_app_service_plan
    create_web_app
    configure_app_settings
    enable_continuous_deployment
    restart_web_app
    show_deployment_info
    
    log_success "Deployment completed successfully!"
}

# Run main function
main "$@"
