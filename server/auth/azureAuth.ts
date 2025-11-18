import passport from 'passport';
import { OIDCStrategy, IProfile, VerifyCallback } from 'passport-azure-ad';
import { ENV } from '../_core/env';
import { upsertUser, getUserByOpenId } from '../db';

// Azure AD configuration
const azureConfig = {
  identityMetadata: `https://login.microsoftonline.com/${ENV.azureTenantId}/v2.0/.well-known/openid-configuration`,
  clientID: ENV.azureClientId,
  clientSecret: ENV.azureClientSecret,
  responseType: 'code id_token',
  responseMode: 'form_post',
  redirectUrl: `${ENV.appBaseUrl}/api/auth/callback`,
  allowHttpForRedirectUrl: false,
  validateIssuer: true,
  passReqToCallback: false,
  scope: ['profile', 'email', 'openid'],
  loggingLevel: 'info' as const,
  nonceLifetime: 3600, // 1 hour
  nonceMaxAmount: 10,
  useCookieInsteadOfSession: true, // Use cookies for state management (more reliable)
  cookieEncryptionKeys: [
    { key: ENV.cookieSecret.substring(0, 32), iv: ENV.cookieSecret.substring(0, 12) }
  ],
  cookieSameSite: true, // Enable SameSite cookie attribute
};

// Configure Passport Azure AD strategy
passport.use(
  new OIDCStrategy(
    azureConfig,
    async (profile: IProfile, done: VerifyCallback) => {
      try {
        // Extract user information from Azure AD profile
        const azureUser = {
          openId: profile.oid || profile._json.oid, // Azure AD object ID
          email: profile._json.email || profile._json.preferred_username || '',
          name: profile.displayName || '',
          loginMethod: 'azure-ad',
        };

        // Upsert user in database
        await upsertUser(azureUser);

        // Get full user record
        const user = await getUserByOpenId(azureUser.openId);

        return done(null, user || azureUser);
      } catch (error) {
        console.error('[Azure Auth] Error processing user:', error);
        return done(error as Error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.openId || user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await getUserByOpenId(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
