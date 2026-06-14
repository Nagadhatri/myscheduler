export type ScheduleCategory = 'Meeting' | 'Presentation' | 'Event Participation' | 'Learning' | 'Other';
export type ScheduleStatus = 'Upcoming' | 'Completed' | 'Rescheduled' | 'Cancelled';
export type BookingStatusType = 'Pending' | 'Accepted' | 'Accepted with Remarks' | 'Rejected' | 'Cancelled' | 'Rescheduled';

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
