'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface TranscriptionInputProps {
  value: string;
  label: string;
  placeholder: string;
  hint: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function TranscriptionInput({
  value,
  label,
  placeholder,
  hint,
  disabled,
  onChange,
}: TranscriptionInputProps) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-semibold">{label}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label}
          className="min-h-[220px] text-base"
        />
      </CardContent>
    </Card>
  );
}

