'use client';

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface InputPanelCollapseToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  ariaLabelExpand?: string;
  ariaLabelCollapse?: string;
  disabled?: boolean;
}

export function InputPanelCollapseToggle({
  collapsed,
  onToggle,
  ariaLabelExpand = "Expand input panel",
  ariaLabelCollapse = "Collapse input panel",
  disabled = false,
}: InputPanelCollapseToggleProps) {
  const label = collapsed ? ariaLabelExpand : ariaLabelCollapse;
  const Icon = collapsed ? ChevronRight : ChevronLeft;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      disabled={disabled}
      className={cn(
        "hidden lg:flex h-full w-4 shrink-0 items-center justify-center",
        "rounded-lg border border-border bg-muted/40 text-muted-foreground hover:bg-muted/70",
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
