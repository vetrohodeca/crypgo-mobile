import { apiClient } from './api.client';
import type { Feedback, CreateFeedbackDto } from '../types';

export const feedbackApi = {
  /** POST /feedback — submit feedback to the administration */
  submit: (dto: CreateFeedbackDto): Promise<Feedback> =>
    apiClient.post<Feedback>('/feedback', dto).then((r) => r.data),
};
