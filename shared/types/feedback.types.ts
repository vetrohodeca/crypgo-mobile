// Feedback — messages to the administration

export type FeedbackCategory =
  | 'LOST_ITEM'          // forgotten item
  | 'APP_FEEDBACK'       // feedback about the app
  | 'DRIVER_FEEDBACK'    // passenger -> about the driver
  | 'PASSENGER_FEEDBACK'; // driver -> about the passenger

export type FeedbackStatus = 'NEW' | 'RESOLVED';

export interface Feedback {
  id: string;
  sender_id: string;
  sender_role: 'passenger' | 'driver';
  category: FeedbackCategory;
  title: string;
  body: string;
  order_id: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}

// DTO — payload for POST /feedback
export interface CreateFeedbackDto {
  category: FeedbackCategory;
  title: string;
  body: string;
  /** Optional related order UUID (must belong to the sender) */
  order_id?: string;
}
