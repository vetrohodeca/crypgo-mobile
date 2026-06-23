import { apiClient } from './api.client';
import type { User, UpdateUserNameDto, UpdateLnNodeDto } from '../types';

export const usersApi = {
  /** GET /users/me — current passenger's profile */
  getProfile: (): Promise<User> =>
    apiClient.get<User>('/users/me').then((r) => r.data),

  /** PATCH /users/me/name — update display name */
  updateName: (dto: UpdateUserNameDto): Promise<User> =>
    apiClient.patch<User>('/users/me/name', dto).then((r) => r.data),

  /** PATCH /users/me/ln-node — update Lightning Node ID */
  updateLnNode: (dto: UpdateLnNodeDto): Promise<User> =>
    apiClient.patch<User>('/users/me/ln-node', dto).then((r) => r.data),
};
