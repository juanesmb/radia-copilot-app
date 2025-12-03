'use client';

import { X, Upload, Mic } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RecordingInterfaceProps {
  title: string;
  description: string;
  transcription: string;
  placeholder: string;
  label: string;
  uploadLabel: string;
  onChange: (value: string) => void;
  onUpload: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function RecordingInterface({
  title,
  description,
  transcription,
  placeholder,
  label,
  uploadLabel,
  onChange,
  onUpload,
  onCancel,
  disabled,
}: RecordingInterfaceProps) {
  return (
    <Card className="rounded-lg border-2 shadow-2xl bg-card relative p-4 sm:p-6 lg:p-8">
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Close"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
            <Mic className="w-4 h-4" aria-hidden="true" />
            <span>{label}</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{description}</p>
        </div>

        <div className="space-y-4">
          <Textarea
            value={transcription}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="min-h-[240px] text-base leading-relaxed"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button
            type="button"
            className="gap-2 text-base h-12 px-6"
            onClick={onUpload}
            disabled={disabled || !transcription.trim()}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {uploadLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}


