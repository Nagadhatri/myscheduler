"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, User, Clock, CheckCircle, XCircle, AlertCircle, FileText, Download } from "lucide-react";

import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReportChart({ data }: { data: any }) {
  if (!data || !data.reportContent) return null;

  const handleDownloadPDF = async () => {
    const element = document.getElementById(`chat-report-${data.reportId || "1"}`);
    if (!element) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0.5,
        filename: `AI_Report_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
      };
      html2pdf().set(opt).from(element).save();
      toast.success("PDF exported successfully!");
    } catch (e: any) {
      toast.error("Failed to export PDF.");
    }
  };

  return (
    <Card className="w-full bg-card/90 border-white/10 mt-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Analytics Report
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDownloadPDF}>
            <Download className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div id={`chat-report-${data.reportId || "1"}`} className="text-sm markdown-body prose prose-invert max-h-60 overflow-y-auto">
          <ReactMarkdown>{data.reportContent}</ReactMarkdown>
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
