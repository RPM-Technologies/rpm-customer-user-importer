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
router.post('/callback',
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
      console.error('[Auth] Logout error:', err);
    }
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

// Get current user endpoint
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router;
