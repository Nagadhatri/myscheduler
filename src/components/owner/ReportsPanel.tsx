"use client";

import { useState } from "react";
import { FileText, Download, Loader2, Calendar, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import ReactMarkdown from "react-markdown";

export default function ReportsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("weekly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let from = dateFrom;
      let to = dateTo;
      const today = new Date();

      if (reportType === "daily") {
        from = format(today, "yyyy-MM-dd");
        to = format(today, "yyyy-MM-dd");
      } else if (reportType === "weekly") {
        from = format(subDays(today, 7), "yyyy-MM-dd");
        to = format(today, "yyyy-MM-dd");
      } else if (reportType === "monthly") {
        const lastMonth = subMonths(today, 1);
        from = format(startOfMonth(lastMonth), "yyyy-MM-dd");
        to = format(endOfMonth(lastMonth), "yyyy-MM-dd");
      } else {
        if (!from || !to) {
          toast.error("Please select a date range");
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, dateFrom: from, dateTo: to }),
      });

      const data = await res.json();
      if (!res.ok) {
        let errMsg = data.error || "Failed to generate report";
        try {
          const parsed = JSON.parse(errMsg);
          if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
        } catch {}
        throw new Error(errMsg);
      }

      setGeneratedReport(data.report.content);
      toast.success("Report generated successfully!");
    } catch (error: any) {
      let finalMsg = error.message || "Failed to generate report";
      try {
        const parsed = JSON.parse(finalMsg);
        if (parsed.error && parsed.error.message) finalMsg = parsed.error.message;
      } catch {}

      const lowerMsg = finalMsg.toLowerCase();
      if (lowerMsg.includes("quota") || lowerMsg.includes("429") || lowerMsg.includes("rate limit")) {
        toast.error("Report generation is temporarily unavailable. Please try again later.");
        setCooldown(60);
        const timer = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(finalMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (format: "md" | "csv") => {
    if (!generatedReport) return;
    const blob = new Blob([generatedReport], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Report_${reportType}_${new Date().getTime()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    if (!generatedReport) return;
    const element = document.getElementById("report-content");
    if (!element) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0.5,
        filename: `Report_${reportType}_${new Date().getTime()}.pdf`,
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="w-full flex items-center gap-2 justify-start bg-card/50 backdrop-blur-xl border border-white/5 hover:bg-white/5 h-12 px-4 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
        <FileText className="w-4 h-4 text-primary" />
        <span>Generate AI Report</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[450px] p-0 border-white/10 bg-card/95 backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h4 className="font-semibold text-sm">AI Reports</h4>
        </div>
        
        <div className="p-4 space-y-4">
          {!generatedReport ? (
            <>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Report Type</label>
                <Select value={reportType} onValueChange={(val: any) => setReportType(val)}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Summary</SelectItem>
                    <SelectItem value="weekly">Weekly Analysis</SelectItem>
                    <SelectItem value="monthly">Monthly Comprehensive</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reportType === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">From</label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white/5 border-white/10 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">To</label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white/5 border-white/10 text-xs" />
                  </div>
                </div>
              )}

              <Button onClick={handleGenerate} disabled={loading || cooldown > 0} className="w-full glow-primary">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                {cooldown > 0 ? `Try again in ${cooldown}s` : loading ? "Generating Report..." : "Generate AI Report"}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div id="report-content" className="max-h-[300px] overflow-y-auto bg-black/20 p-4 rounded-lg text-sm markdown-body prose prose-invert">
                <ReactMarkdown>{generatedReport}</ReactMarkdown>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-xs" onClick={handleDownloadPDF}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Export PDF
                </Button>
                <Button variant="outline" className="flex-1 text-xs" onClick={() => handleDownload("csv")}>
                  <FileDown className="w-3.5 h-3.5 mr-1" />
                  Export Data
                </Button>
                <Button variant="ghost" className="text-xs" onClick={() => setGeneratedReport(null)}>
                  New
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
