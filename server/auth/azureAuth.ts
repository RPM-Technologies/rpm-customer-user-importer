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
    { 
      key: Buffer.from(ENV.cookieSecret.substring(0, 32).padEnd(32, '0'), 'utf8'),
      iv: Buffer.from(ENV.cookieSecret.substring(0, 12).padEnd(12, '0'), 'utf8')
    }
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
        const openId = profile.oid || profile._json.oid;
        const email = profile._json.email || profile._json.preferred_username || '';
        const name = profile.displayName || '';

        // Check if user exists in database by email or openId
        let user = await getUserByOpenId(openId);
        
        if (!user && email) {
          // Try to find by email (for users added before first login)
          const { getUserByEmail } = await import('../db');
          user = await getUserByEmail(email);
          
          if (user && user.openId.startsWith('pending_')) {
            // Update the placeholder openId with real Azure AD openId
            const azureUser = {
              openId: openId,
              email: email,
              name: name,
              loginMethod: 'azure-ad' as const,
              lastSignedIn: new Date(),
            };
            await upsertUser(azureUser);
            user = await getUserByOpenId(openId);
          }
        }

        // Only allow login if user exists in database
        if (!user) {
          console.warn(`[Azure Auth] Login denied for ${email} - user not found in database`);
          return done(new Error('Access denied. Please contact an administrator to request access.'));
        }

        // Update last sign-in time
        await upsertUser({
          openId: user.openId,
          email: email,
          name: name,
          loginMethod: 'azure-ad',
          lastSignedIn: new Date(),
        });

        return done(null, user);
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
