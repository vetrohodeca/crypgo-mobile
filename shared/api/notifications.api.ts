import { apiClient } from './api.client';

export const notificationsApi = {
  /**
   * Register an Expo push token with the backend.
   * Call after every login (token is upserted — safe to call again on re-login).
   */
  registerToken: (token: string, platform?: 'ios' | 'android') =>
    apiClient
      .post('/notifications/register', { token, platform })
      .then(() => undefined),

  /**
   * Remove a push token from the backend.
   * Call on logout so the device no longer receives pushes for this account.
   */
  removeToken: (token: string) =>
    apiClient
      .delete('/notifications/token', { params: { token } })
      .then(() => undefined),
};
