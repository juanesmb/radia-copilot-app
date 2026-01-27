'use client';

import { useCallback } from "react";
import { Copy, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type HeaderMode = "home" | "recording";

interface ContentHeaderProps {
  mode: HeaderMode;
  greeting?: string;
  title?: string;
  placeholder?: string;
  copyDisabled?: boolean;
  onCopy?: () => void;
  onTitleChange?: (value: string) => void;
  onTitleCommit?: (value: string) => void;
  onTitleKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function ContentHeader({
  mode,
  greeting,
  title = "",
  placeholder = "Titulo del Informe",
  copyDisabled = true,
  onCopy,
  onTitleChange,
  onTitleCommit,
  onTitleKeyDown,
}: ContentHeaderProps) {
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      onTitleCommit?.(event.target.value);
    },
    [onTitleCommit],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onTitleChange?.(event.target.value);
    },
    [onTitleChange],
  );

  return (
    <div className="hidden lg:flex items-center h-20 min-h-[5rem] px-4 border-b border-border bg-background/80 backdrop-blur-sm">
      {mode === "home" ? (
        <div className="flex-1 flex justify-center">
          <h2 className="text-lg font-semibold text-foreground text-center truncate">
            {greeting}
          </h2>
        </div>
      ) : (
        <div className="flex items-center gap-2 w-full">
          <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <Input
            value={title}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={onTitleKeyDown}
            placeholder={placeholder}
            className={cn(
              "h-10 text-lg md:text-lg lg:text-lg font-semibold leading-tight w-1/2 max-w-xl",
              "bg-background border-transparent hover:border-border focus:border-border transition-colors",
            )}
          />
          <Button
            type="button"
            className="ml-auto gap-2 text-base h-10 px-4 sm:px-6"
            disabled={copyDisabled}
            onClick={onCopy}
            aria-label="Copiar"
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copiar</span>
          </Button>
        </div>
      )}
    </div>
  );
}
