export type ScheduleCategory = 'Meeting' | 'Presentation' | 'Event Participation' | 'Learning' | 'Other';
export type ScheduleStatus = 'Upcoming' | 'Completed' | 'Rescheduled' | 'Cancelled';
export type BookingStatusType = 'Pending' | 'Accepted' | 'Accepted with Remarks' | 'Rejected' | 'Cancelled' | 'Rescheduled';
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected';

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  occupation: string | null;
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
  created_at: string;
  updated_at: string;
}
