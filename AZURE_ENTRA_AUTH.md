# Azure Entra ID Authentication Setup Guide

## Overview

This guide provides step-by-step instructions for configuring Azure Entra ID (formerly Azure Active Directory) authentication for the RPM Customer User Importer application. Azure Entra ID integration enables single sign-on (SSO) using your organization's Microsoft identities, providing centralized user management, enhanced security through multi-factor authentication, and seamless integration with your existing Azure infrastructure.

## Prerequisites

Before beginning the configuration process, ensure you have the following prerequisites in place:

**Azure Requirements:**
- Active Azure subscription with administrative access
- Permissions to register applications in Azure Entra ID (Application Administrator or Global Administrator role)
- Access to Azure Portal (https://portal.azure.com)

**Application Requirements:**
- RPM Customer User Importer deployed and accessible at https://rpm-importer-dev.rpmit.com:8443
- SSH access to the deployment server (rpm-dev01.eastus2.cloudapp.azure.com)
- Ability to restart Docker containers and modify environment variables

## Architecture Overview

The authentication flow follows the OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange), which provides enhanced security for web applications. The integration architecture consists of three primary components:

**Client Application (Browser):** The React frontend initiates the authentication flow by redirecting users to Azure Entra ID's authorization endpoint. After successful authentication, Azure redirects back to the application with an authorization code.

**Backend Server (Node.js/Express):** The Express server exchanges the authorization code for access tokens, validates tokens, manages user sessions, and handles token refresh operations. The server maintains session state using JWT tokens stored in HTTP-only cookies.

**Azure Entra ID:** Microsoft's identity platform handles user authentication, issues access and refresh tokens, provides user profile information through Microsoft Graph API, and enforces organizational security policies including conditional access and multi-factor authentication.

## Step 1: Register Application in Azure Entra ID

Begin by registering your application in the Azure Portal to establish trust between your application and Azure Entra ID.

### 1.1 Create App Registration

Navigate to the Azure Portal and access the Azure Entra ID service. From the left navigation menu, select **App registrations**, then click **New registration** to create a new application registration.

Configure the application registration with the following settings:

**Name:** Enter "RPM Customer User Importer" as the application name. This name will be displayed to users during the consent process.

**Supported account types:** Select "Accounts in this organizational directory only (Single tenant)" to restrict access to users within your organization. This setting ensures that only members of your Azure AD tenant can authenticate.

**Redirect URI:** Configure the redirect URI where Azure will send authentication responses. Select "Web" as the platform type and enter the following URI:

```
https://rpm-importer-dev.rpmit.com:8443/api/oauth/callback
```

This endpoint must match exactly with the callback route configured in your application server. After completing these settings, click **Register** to create the application.

### 1.2 Configure Authentication Settings

After registration, navigate to the **Authentication** section in the left menu to configure additional security settings.

**Implicit grant and hybrid flows:** Leave all checkboxes unchecked. The application uses the Authorization Code Flow with PKCE, which is more secure than implicit grant flows.

**Allow public client flows:** Set to "No" since this is a confidential client application running on a server.

**Supported account types:** Verify this is set to "Single tenant" to maintain organizational security boundaries.

### 1.3 Create Client Secret

Navigate to **Certificates & secrets** in the left menu, then select the **Client secrets** tab. Click **New client secret** to generate a new secret.

Configure the client secret with these parameters:

**Description:** Enter "Production Secret" or a descriptive name that indicates the environment and purpose.

**Expires:** Select an appropriate expiration period. For production environments, Microsoft recommends 12 or 24 months. Note the expiration date in your calendar to ensure timely renewal before expiration.

After clicking **Add**, immediately copy the **Value** (not the Secret ID) and store it securely. This secret will only be displayed once and cannot be retrieved later. If you lose the secret, you must generate a new one.

### 1.4 Configure API Permissions

Navigate to **API permissions** in the left menu to configure the permissions your application needs to access user information.

Click **Add a permission**, select **Microsoft Graph**, then choose **Delegated permissions**. Add the following permissions:

**User.Read:** Allows the application to read the signed-in user's profile information including name, email, and basic profile data. This is the minimum required permission for authentication.

**email:** Explicitly grants access to the user's email address. While often included in User.Read, explicitly requesting this permission ensures consistent access across different Azure AD configurations.

**profile:** Grants access to the user's basic profile information including name, preferred username, and profile picture.

**openid:** Required for OpenID Connect authentication. This permission allows the application to receive an ID token containing user identity information.

After adding all permissions, click **Grant admin consent for [Your Organization]** to pre-approve these permissions for all users in your organization. This step prevents individual users from seeing consent prompts during their first login.

### 1.5 Collect Configuration Values

From the **Overview** page of your app registration, collect the following values which will be needed for application configuration:

**Application (client) ID:** A GUID that uniquely identifies your application (e.g., `12345678-1234-1234-1234-123456789abc`)

**Directory (tenant) ID:** A GUID that identifies your Azure AD tenant (e.g., `87654321-4321-4321-4321-cba987654321`)

**Client Secret Value:** The secret value you copied in step 1.3

## Step 2: Install Required Dependencies

The application requires the Passport.js authentication middleware and the Azure AD OAuth2 strategy to handle authentication flows.

### 2.1 SSH into Server

Connect to your deployment server using SSH with the credentials provided:

```bash
ssh rpmadmin@rpm-dev01.eastus2.cloudapp.azure.com
```

Navigate to the application directory:

```bash
cd /opt/customer-importer
```

### 2.2 Update Package Dependencies

The application needs additional npm packages to support Azure Entra ID authentication. Add the following dependencies to the `package.json` file:

```json
{
  "dependencies": {
    "passport": "^0.7.0",
    "passport-azure-ad": "^4.3.5",
    "express-session": "^1.18.0"
  }
}
```

These packages provide the following functionality:

**passport:** Core authentication middleware for Node.js that provides a consistent API for various authentication strategies.

**passport-azure-ad:** Official Microsoft strategy for Passport.js that implements OAuth 2.0 and OpenID Connect protocols for Azure AD authentication.

**express-session:** Session middleware for Express that manages user sessions and stores session data securely.

## Step 3: Configure Authentication Server Code

The authentication implementation requires modifications to the server-side code to integrate Passport.js and handle the OAuth flow.

### 3.1 Create Authentication Configuration

Create a new file `server/auth/azureAuth.ts` with the following configuration:

```typescript
import passport from 'passport';
import { OIDCStrategy, IProfile, VerifyCallback } from 'passport-azure-ad';
import { ENV } from '../_core/env';

// Azure AD configuration
const azureConfig = {
  identityMetadata: `https://login.microsoftonline.com/${ENV.azureTenantId}/v2.0/.well-known/openid-configuration`,
  clientID: ENV.azureClientId,
  clientSecret: ENV.azureClientSecret,
  responseType: 'code',
  responseMode: 'form_post',
  redirectUrl: `${ENV.appBaseUrl}/api/oauth/callback`,
  allowHttpForRedirectUrl: false,
  validateIssuer: true,
  passReqToCallback: false,
  scope: ['profile', 'email', 'openid'],
  loggingLevel: 'info',
};

// Configure Passport Azure AD strategy
passport.use(
  new OIDCStrategy(
    azureConfig,
    async (profile: IProfile, done: VerifyCallback) => {
      try {
        // Extract user information from Azure AD profile
        const user = {
          id: profile.oid, // Azure AD object ID
          email: profile._json.email || profile._json.preferred_username,
          name: profile.displayName,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          tenantId: profile._json.tid,
        };

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
```

### 3.2 Update Environment Configuration

Add the following environment variables to `server/_core/env.ts`:

```typescript
export const ENV = {
  // ... existing variables ...
  
  // Azure Entra ID Configuration
  azureTenantId: process.env.AZURE_TENANT_ID || '',
  azureClientId: process.env.AZURE_CLIENT_ID || '',
  azureClientSecret: process.env.AZURE_CLIENT_SECRET || '',
  appBaseUrl: process.env.APP_BASE_URL || 'https://rpm-importer-dev.rpmit.com:8443',
};
```

### 3.3 Create Authentication Routes

Create a new file `server/routes/auth.ts` to handle authentication endpoints:

```typescript
import { Router } from 'express';
import passport from '../auth/azureAuth';

const router = Router();

// Initiate Azure AD login
router.get('/login', 
  passport.authenticate('azuread-openidconnect', {
    failureRedirect: '/',
  })
);

// Azure AD callback handler
router.post('/oauth/callback',
  passport.authenticate('azuread-openidconnect', {
    failureRedirect: '/',
  }),
  (req, res) => {
    // Successful authentication, redirect to home
    res.redirect('/');
  }
);

// Logout endpoint
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

// Get current user endpoint
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router;
```

### 3.4 Update Server Entry Point

Modify `server/index.ts` to initialize Passport and register authentication routes:

```typescript
import express from 'express';
import session from 'express-session';
import passport from './auth/azureAuth';
import authRoutes from './routes/auth';
import { ENV } from './_core/env';

const app = express();

// Session configuration
app.use(
  session({
    secret: ENV.jwtSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Requires HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Register authentication routes
app.use('/api', authRoutes);

// ... rest of server configuration ...
```

## Step 4: Configure Frontend Authentication

The frontend React application needs to be updated to handle Azure AD authentication flows and manage user sessions.

### 4.1 Update Authentication Hook

Modify `client/src/hooks/useAuth.ts` to work with the new authentication endpoints:

```typescript
import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/me', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err as Error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = '/api/login';
  };

  const logout = async () => {
    window.location.href = '/api/logout';
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
```

### 4.2 Update Login Component

Create or update the login page component to use Azure AD authentication:

```typescript
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>RPM Customer User Importer</CardTitle>
          <CardDescription>
            Sign in with your RPM Technologies account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={login} 
            className="w-full"
            size="lg"
          >
            Sign in with Microsoft
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Step 5: Update Production Environment Variables

Configure the production environment with your Azure Entra ID credentials collected in Step 1.5.

### 5.1 Update .env.production File

SSH into the server and edit the environment file:

```bash
ssh rpmadmin@rpm-dev01.eastus2.cloudapp.azure.com
cd /opt/customer-importer
sudo nano .env.production
```

Add or update the following variables:

```bash
# Azure Entra ID Authentication
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here
APP_BASE_URL=https://rpm-importer-dev.rpmit.com:8443

# Session Secret (use a strong random string)
JWT_SECRET=your-existing-jwt-secret

# Remove or comment out Manus OAuth variables
# OAUTH_SERVER_URL=
# VITE_OAUTH_PORTAL_URL=
# VITE_APP_ID=
```

Replace the placeholder values with your actual Azure configuration:

- `your-tenant-id-here`: The Directory (tenant) ID from Azure
- `your-client-id-here`: The Application (client) ID from Azure
- `your-client-secret-here`: The client secret value you generated

### 5.2 Rebuild and Restart Application

After updating the environment variables, rebuild the application to incorporate the changes:

```bash
cd /opt/customer-importer
sudo docker-compose -f docker-compose.production.yml down
sudo docker-compose -f docker-compose.production.yml build --no-cache app
sudo docker-compose -f docker-compose.production.yml up -d
```

Wait approximately 30 seconds for all services to start, then verify the deployment:

```bash
sudo docker-compose -f docker-compose.production.yml ps
```

All three containers (app, mysql, nginx) should show "Up" status.

## Step 6: Test Authentication

Verify that Azure Entra ID authentication is working correctly by testing the complete authentication flow.

### 6.1 Access Application

Open your web browser and navigate to:

```
https://rpm-importer-dev.rpmit.com:8443
```

### 6.2 Verify Login Flow

The application should redirect you to the Microsoft login page. Complete the authentication process:

1. Enter your organizational email address
2. Enter your password
3. Complete multi-factor authentication if required
4. Review and accept the permissions consent (first login only)
5. Verify successful redirect back to the application

### 6.3 Verify User Session

After successful login, the application should display your user information. Open the browser's developer console (F12) and check the Network tab to verify:

- The `/api/me` endpoint returns your user profile
- Session cookies are set with `HttpOnly` and `Secure` flags
- No authentication errors appear in the console

### 6.4 Test Logout

Click the logout button and verify:

- You are redirected to the login page
- The session cookie is cleared
- Accessing protected routes redirects to login

## Security Considerations

When implementing Azure Entra ID authentication, consider the following security best practices to protect your application and user data.

**Client Secret Management:** Store client secrets securely using environment variables and never commit them to source control. Rotate secrets regularly according to your organization's security policy, typically every 12-24 months. Use Azure Key Vault for enhanced secret management in production environments.

**HTTPS Enforcement:** Always use HTTPS in production to protect authentication tokens and session cookies from interception. The current configuration enforces secure cookies which require HTTPS. Never set `allowHttpForRedirectUrl` to true in production environments.

**Session Configuration:** Configure session cookies with appropriate security flags including `httpOnly` to prevent JavaScript access, `secure` to require HTTPS, and `sameSite: 'lax'` to provide CSRF protection. Set reasonable session timeouts (24 hours recommended) to balance security and user experience.

**Token Validation:** The passport-azure-ad strategy automatically validates tokens including signature verification, expiration checks, issuer validation, and audience validation. Ensure `validateIssuer` is set to true to prevent token substitution attacks.

**Conditional Access:** Leverage Azure Entra ID's conditional access policies to enforce additional security requirements such as requiring multi-factor authentication, restricting access by location or device compliance, and blocking legacy authentication protocols.

**Audit Logging:** Implement comprehensive logging for authentication events including successful logins, failed login attempts, logout events, and token refresh operations. Monitor these logs for suspicious patterns that may indicate security incidents.

## Troubleshooting

Common issues and their solutions when implementing Azure Entra ID authentication.

### Redirect URI Mismatch

**Symptom:** Error message "AADSTS50011: The redirect URI specified in the request does not match the redirect URIs configured for the application."

**Solution:** Verify that the redirect URI in Azure app registration exactly matches the callback URL in your application. The URI must include the protocol (https://), domain, port number, and path. Check for trailing slashes or typos.

### Invalid Client Secret

**Symptom:** Error message "AADSTS7000215: Invalid client secret is provided."

**Solution:** The client secret may have expired or been copied incorrectly. Generate a new client secret in Azure Portal, copy the value immediately, and update the `AZURE_CLIENT_SECRET` environment variable. Rebuild and restart the application after updating.

### Insufficient Permissions

**Symptom:** Users see a consent prompt asking for admin approval, or authentication fails with permission errors.

**Solution:** Navigate to API permissions in Azure Portal and click "Grant admin consent" to pre-approve permissions for all users. Ensure all required permissions (User.Read, email, profile, openid) are added and consented.

### Session Not Persisting

**Symptom:** Users are logged out immediately after authentication or on page refresh.

**Solution:** Verify that session middleware is properly configured with a secure secret. Check that cookies are being set correctly by examining the Set-Cookie header in browser developer tools. Ensure the `secure` flag is set to true and the application is accessed via HTTPS.

### CORS Errors

**Symptom:** Browser console shows CORS policy errors when making requests to authentication endpoints.

**Solution:** Configure CORS middleware in Express to allow credentials and specify the correct origin. Ensure `credentials: 'include'` is set in fetch requests from the frontend.

## Migration from Manus OAuth

If you are migrating from the existing Manus OAuth implementation, follow these steps to ensure a smooth transition.

### User Data Migration

The authentication system change affects how users are identified in the database. The current system uses Manus `openId` as the user identifier, while Azure AD uses the `oid` (object ID). To maintain user data continuity, you have two options:

**Option 1: Map Azure AD users to existing Manus users** by email address. Update the user lookup logic to find users by email and update their identifier to the Azure AD object ID.

**Option 2: Create new user records** for Azure AD authenticated users and migrate data manually or through a batch process. This approach is cleaner but requires more planning.

### Environment Variable Cleanup

After successfully implementing Azure Entra ID authentication, remove or comment out the Manus OAuth related environment variables to avoid confusion:

```bash
# Remove these variables from .env.production
# OAUTH_SERVER_URL=
# VITE_OAUTH_PORTAL_URL=
# VITE_APP_ID=
# OWNER_OPEN_ID=
# OWNER_NAME=
```

### Testing Period

Consider running a parallel testing period where both authentication systems are available. This allows you to verify the Azure AD integration works correctly before fully removing the Manus OAuth implementation.

## Additional Resources

For more detailed information about Azure Entra ID authentication and related topics, consult the following Microsoft documentation:

- **Azure AD Authentication Documentation:** https://learn.microsoft.com/en-us/azure/active-directory/develop/
- **Passport Azure AD Strategy:** https://github.com/AzureAD/passport-azure-ad
- **Microsoft Graph API:** https://learn.microsoft.com/en-us/graph/overview
- **OAuth 2.0 Authorization Code Flow:** https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
- **Azure AD Best Practices:** https://learn.microsoft.com/en-us/azure/active-directory/develop/identity-platform-integration-checklist

## Support

For issues related to Azure Entra ID configuration or authentication implementation, contact your organization's Azure administrator or submit a support request through the Azure Portal. For application-specific issues, refer to the main README.md file for support channels.
