export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";

export const APP_LOGO = "/rpm-logo.jpg";

// Generate Azure AD login URL
export const getLoginUrl = () => {
  return `${window.location.origin}/api/auth/login`;
};

// Generate logout URL
export const getLogoutUrl = () => {
  return `${window.location.origin}/api/auth/logout`;
};
