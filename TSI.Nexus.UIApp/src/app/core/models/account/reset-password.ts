export interface ResetPassword {
  email: string;
  newPassword: string;
  /** The token e-mailed by AccountService.forgotUsernameOrPassword - the backend now rejects a
   * reset request with no valid token, so this can no longer be a placeholder. */
  token: string;
}
