export type ScheduleCategory = 'Meeting' | 'Presentation' | 'Event Participation' | 'Learning' | 'Other';
export type ScheduleStatus = 'Upcoming' | 'Completed' | 'Rescheduled' | 'Cancelled';
export type BookingStatusType = 'Pending' | 'Accepted' | 'Accepted with Remarks' | 'Rejected' | 'Cancelled' | 'Rescheduled';
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected';

export interface MeetingType {
  name: string;
  duration_mins: number;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  occupation: string | null;
  bio?: string | null;
  timezone?: string | null;
  buffer_time_mins?: number;
  meeting_types?: MeetingType[];
  created_at: string;
}

export interface Connection {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: ConnectionStatus;
  created_at: string;
  // Joined data
  requester?: Profile;
  receiver?: Profile;
}

export interface Schedule {
  id: string;
  owner_id: string;
  title: string;
  category: ScheduleCategory;
  description: string | null;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  status: ScheduleStatus;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  schedule_id: string;
  visitor_name: string;
  visitor_email: string;
  description: string | null;
  booking_status: BookingStatusType;
  owner_remarks: string | null;
  action_timestamp: string | null;
  reschedule_token?: string | null;
  email_reminder_sent?: boolean;
  meeting_type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingMinutes {
  id: string;
  schedule_id: string;
  owner_id: string;
  content: string;
  source: 'manual' | 'voice';
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  owner_id: string;
  report_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  date_from: string;
  date_to: string;
  content: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}
