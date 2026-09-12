export const environment = {
  tokenRefreshIntervalSeconds: 300,
  production: false,
  // Relative on purpose: ng serve's proxy.conf.json forwards /api/* to the real backend
  // (https://localhost:7181) server-side, so the browser only ever talks to its own origin -
  // no cross-origin request at all, which is what lets the httpOnly auth cookie (Secure in
  // production, relaxed in Development - see AccountController) work locally without a trusted
  // HTTPS cert for the SPA itself.
  appUrl: '',
  userKey: 'nexusAppUser',
};
