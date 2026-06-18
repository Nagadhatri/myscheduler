"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChatErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ChatPanel:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center space-y-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Chat Unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-[250px]">
              The AI assistant encountered an unexpected error.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 border-white/10 hover:bg-white/5 gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Restart Chat
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
