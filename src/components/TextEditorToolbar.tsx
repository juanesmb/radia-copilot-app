'use client';

import { Bold, Italic, Underline, List } from "lucide-react";

interface TextEditorToolbarProps {
  onCommand: (command: string, value?: string) => void;
  editorRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function TextEditorToolbar({
  onCommand,
  editorRef,
  className = "",
}: TextEditorToolbarProps) {
  const handleCommand = (command: string, value?: string) => {
    editorRef?.current?.focus();
    onCommand(command, value);
  };

  return (
    <div
      className={`flex items-center gap-0.5 sm:gap-1 border rounded-md p-0.5 sm:p-1 bg-background ${className}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleCommand("bold");
        }}
        className="p-1 sm:p-1.5 hover:bg-muted rounded transition-colors"
        title="Bold"
        aria-label="Bold"
      >
        <Bold className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleCommand("italic");
        }}
        className="p-1 sm:p-1.5 hover:bg-muted rounded transition-colors"
        title="Italic"
        aria-label="Italic"
      >
        <Italic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleCommand("underline");
        }}
        className="p-1 sm:p-1.5 hover:bg-muted rounded transition-colors"
        title="Underline"
        aria-label="Underline"
      >
        <Underline className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
      <div className="w-px h-3 sm:h-4 bg-border mx-0.5 sm:mx-1" />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleCommand("insertUnorderedList");
        }}
        className="p-1 sm:p-1.5 hover:bg-muted rounded transition-colors"
        title="Bullet List"
        aria-label="Bullet List"
      >
        <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}

