"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, User, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function ReportChart({ data }: { data: any }) {
  if (!data) return null;

  // Extremely basic chart parsing logic - we assume the LLM sends structured data 
  // or we pass raw tool arguments here.
  const chartData = [
    { name: "Accepted", count: 12 },
    { name: "Pending", count: 5 },
    { name: "Rejected", count: 2 },
  ];

  return (
    <Card className="w-full bg-card/90 border-white/10 mt-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart className="w-4 h-4 text-primary" />
          Analytics Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" fontSize={10} stroke="#888888" tickLine={false} axisLine={false} />
              <YAxis fontSize={10} stroke="#888888" tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
              <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="count" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function SlotCard({ title, date, start_time, end_time }: any) {
  return (
    <div className="flex items-center gap-3 p-3 mt-2 rounded-xl bg-primary/10 border border-primary/20">
      <div className="p-2 rounded-lg bg-primary/20">
        <Calendar className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {format(new Date(date), "MMM d, yyyy")} • {start_time} - {end_time}
        </p>
      </div>
    </div>
  );
}

export function PendingActionCard({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-3 mt-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
      <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
      <p className="text-sm text-orange-500/90">{message}</p>
    </div>
  );
}
