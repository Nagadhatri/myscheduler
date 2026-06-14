"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Booking, Schedule } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search } from "lucide-react";

export default function PastBookingLookup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(Booking & { schedule: Schedule })[]>([]);
  const [searched, setSearched] = useState(false);

  const supabase = createClient();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*, schedule:schedules(*)')
      .eq('visitor_email', email)
      .order('created_at', { ascending: false });

    setLoading(false);
    setSearched(true);

    if (error) {
      toast.error("Error looking up bookings");
    } else {
      // Need to type assert because schedule comes as an object array if one-to-many, 
      // but here it's many-to-one so it should be a single object. 
      // Supabase returns it as an object since it's a foreign key.
      setResults(data as any);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted': return 'bg-green-500 text-white';
      case 'Accepted with Remarks': return 'bg-emerald-500 text-white';
      case 'Rejected': return 'bg-red-500 text-white';
      case 'Cancelled': return 'bg-gray-500 text-white';
      case 'Rescheduled': return 'bg-orange-500 text-white';
      default: return 'bg-primary text-primary-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        setEmail("");
        setResults([]);
        setSearched(false);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Search className="w-4 h-4" />
          Lookup Past Bookings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Find Your Bookings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex gap-2 my-2">
          <Input 
            type="email" 
            placeholder="Enter your email address" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>Search</Button>
        </form>
        
        {searched && (
          <ScrollArea className="h-[300px] mt-4 border rounded-md p-4 bg-muted/20">
            {results.length === 0 ? (
              <p className="text-center text-muted-foreground mt-10">No bookings found for this email.</p>
            ) : (
              <div className="space-y-4">
                {results.map(b => (
                  <div key={b.id} className="p-4 border rounded bg-card flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-lg">{b.schedule?.title}</div>
                      <Badge className={`${getStatusColor(b.booking_status)} hover:opacity-80`}>
                        {b.booking_status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {b.schedule?.date} ({b.schedule?.start_time.slice(0,5)} - {b.schedule?.end_time.slice(0,5)})
                    </div>
                    {b.owner_remarks && (
                      <div className="bg-muted p-2 rounded text-sm mt-2">
                        <span className="font-semibold">Owner Remarks:</span> {b.owner_remarks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
