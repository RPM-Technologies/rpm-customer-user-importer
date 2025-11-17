# Azure Entra ID App Registration - Quick Start

This quick start guide provides the essential steps to register your application in Azure Entra ID and configure authentication. For detailed information, see [AZURE_ENTRA_AUTH.md](./AZURE_ENTRA_AUTH.md).

## Step 1: Register Application in Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Entra ID** → **App registrations** → **New registration**
3. Configure the registration:
   - **Name:** RPM Customer User Importer
   - **Supported account types:** Accounts in this organizational directory only (Single tenant)
   - **Redirect URI:** Web - `https://rpm-importer-dev.rpmit.com:8443/api/oauth/callback`
4. Click **Register**

## Step 2: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Set description: "Production Secret"
4. Set expiration: 24 months (recommended)
5. Click **Add**
6. **IMPORTANT:** Copy the **Value** immediately (you won't see it again)

## Step 3: Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - User.Read
   - email
   - profile
   - openid
4. Click **Grant admin consent for [Your Organization]**

## Step 4: Collect Configuration Values

From the **Overview** page, copy these values:

| Configuration | Value | Example |
|--------------|-------|---------|
| Application (client) ID | Copy from Overview | `12345678-1234-1234-1234-123456789abc` |
| Directory (tenant) ID | Copy from Overview | `87654321-4321-4321-4321-cba987654321` |
| Client Secret Value | Copied in Step 2 | `abc123...xyz789` |

## Step 5: Update Server Configuration

SSH into your server and update the environment file:

```bash
ssh rpmadmin@rpm-dev01.eastus2.cloudapp.azure.com
cd /opt/customer-importer
sudo nano .env.production
```

Add these lines (replace with your actual values):

```bash
# Azure Entra ID Authentication
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here
APP_BASE_URL=https://rpm-importer-dev.rpmit.com:8443
```

Save the file (Ctrl+X, Y, Enter).

## Step 6: Install Dependencies and Update Code

The application code needs to be updated to support Azure Entra ID authentication. This requires:

1. Adding npm packages (passport, passport-azure-ad, express-session)
2. Creating authentication configuration files
3. Updating server routes
4. Modifying frontend authentication hooks

**Detailed code changes are provided in [AZURE_ENTRA_AUTH.md](./AZURE_ENTRA_AUTH.md) - Step 2 and Step 3.**

After making code changes, rebuild and restart:

```bash
cd /opt/customer-importer
sudo docker-compose -f docker-compose.production.yml down
sudo docker-compose -f docker-compose.production.yml build --no-cache app
sudo docker-compose -f docker-compose.production.yml up -d
```

## Step 7: Test Authentication

1. Open https://rpm-importer-dev.rpmit.com:8443
2. Click "Sign in with Microsoft"
3. Enter your organizational credentials
4. Complete MFA if prompted
5. Accept permissions consent (first login only)
6. Verify you're redirected back to the application

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Redirect URI mismatch error | Verify the redirect URI in Azure matches exactly: `https://rpm-importer-dev.rpmit.com:8443/api/oauth/callback` |
| Invalid client secret | Generate a new secret in Azure Portal and update `.env.production` |
| Permission consent required | Click "Grant admin consent" in API permissions |
| Session not persisting | Ensure application is accessed via HTTPS and cookies are enabled |

## Next Steps

After successful authentication:

1. Configure user roles and permissions in your application
2. Set up conditional access policies in Azure AD
3. Configure session timeout and security settings
4. Implement audit logging for authentication events
5. Plan for client secret rotation before expiration

For detailed information, troubleshooting, and security best practices, see the complete guide: [AZURE_ENTRA_AUTH.md](./AZURE_ENTRA_AUTH.md)
