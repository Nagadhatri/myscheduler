"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Square, Save, Loader2, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Schedule } from "@/types";

interface MeetingMinutesDialogProps {
  schedule: Schedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MeetingMinutesDialog({ schedule, open, onOpenChange }: MeetingMinutesDialogProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (open && schedule) {
      fetchMinutes();
    } else {
      setContent("");
      setIsRecording(false);
      setIsTranscribing(false);
    }
  }, [open, schedule]);

  const fetchMinutes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meeting-minutes?scheduleId=${schedule?.id}`);
      const data = await res.json();
      if (data.minutes) {
        setContent(data.minutes.content);
      }
    } catch (error) {
      console.error("Failed to fetch minutes", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      const res = await fetch("/api/meeting-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: schedule.id,
          content,
          source: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Minutes saved successfully!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save minutes");
    } finally {
      setSaving(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscription = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64data = reader.result as string; 
        const base64Audio = base64data.split(',')[1];

        const response = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioData: base64Audio, mimeType: "audio/webm" }),
        });

        if (!response.ok) {
          throw new Error("Failed to transcribe audio.");
        }

        const data = await response.json();
        if (data.transcript) {
          setContent((prev) => prev + (prev ? "\n" : "") + data.transcript);
          toast.success("Transcription added!");
        } else if (data.error) {
          throw new Error(data.error);
        }
        setIsTranscribing(false);
      };
    } catch (error: any) {
      toast.error(error.message || "Transcription failed.");
      setIsTranscribing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Minutes of Meeting
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {schedule?.title} on {schedule?.date}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Textarea
                placeholder="Write your meeting minutes here or use voice dictation..."
                className="min-h-[250px] bg-black/20 border-white/10"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <Button 
                      variant="destructive" 
                      onClick={stopRecording}
                      className="gap-2 animate-pulse-glow"
                    >
                      <Square className="w-4 h-4" />
                      Stop Recording
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={startRecording}
                      disabled={isTranscribing}
                      className="gap-2 border-white/10"
                    >
                      {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                      {isTranscribing ? "Transcribing..." : "Dictate"}
                    </Button>
                  )}
                  {isRecording && (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Listening...
                    </span>
                  )}
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="gap-2 glow-primary"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Minutes
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
