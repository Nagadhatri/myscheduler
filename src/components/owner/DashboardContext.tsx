"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Schedule, Booking } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

interface DashboardContextType {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  schedules: Schedule[];
  bookings: Booking[];
  loadingSchedules: boolean;
  loadingBookings: boolean;
  fetchSchedules: () => Promise<void>;
  fetchBookings: () => Promise<void>;
  selectedChatDate: string | null;
  setSelectedChatDate: (date: string | null) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedChatDate, setSelectedChatDate] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const supabase = createClient();

  const fetchSchedules = async () => {
    setLoadingSchedules(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingSchedules(false);
      return;
    }

    const { data, error } = await supabase
      .from('schedules')
      .select('*, bookings(booking_status)')
      .eq('owner_id', user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (!error && data) {
      const validSchedules = data.filter((schedule: any) => {
        if (!schedule.bookings || schedule.bookings.length === 0) return true;
        const hasPendingOnly = schedule.bookings.every((b: any) => b.booking_status === "Pending");
        const hasRejectedOnly = schedule.bookings.every((b: any) => b.booking_status === "Rejected");
        if (hasPendingOnly || hasRejectedOnly) return false;
        return true;
      });
      setSchedules(validSchedules as Schedule[]);
    }
    setLoadingSchedules(false);
  };

  const fetchBookings = async () => {
    setLoadingBookings(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingBookings(false);
      return;
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*, schedules!inner(*)')
      .eq('schedules.owner_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // The join fetches schedule data, but we'll map it to match Booking type
      const formatted = data.map((item: any) => {
        const { schedules, ...bookingData } = item;
        return { ...bookingData, schedule: schedules } as Booking & { schedule: Schedule };
      });
      setBookings(formatted);
    }
    setLoadingBookings(false);
  };

  useEffect(() => {
    fetchSchedules();
    fetchBookings();

    const handleBookingUpdate = () => {
      fetchSchedules();
      fetchBookings();
    };

    window.addEventListener("booking-updated", handleBookingUpdate);
    return () => window.removeEventListener("booking-updated", handleBookingUpdate);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        schedules,
        bookings,
        loadingSchedules,
        loadingBookings,
        fetchSchedules,
        fetchBookings,
        selectedChatDate,
        setSelectedChatDate,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
