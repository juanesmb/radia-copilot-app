'use client';

import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { useDebouncedTextEditor } from '@/hooks/useDebouncedTextEditor';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface EditableTextareaProps {
  value: string;
  onUpdate: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  debounceMs?: number;
  style?: React.CSSProperties;
}

export const EditableTextarea = forwardRef<HTMLTextAreaElement, EditableTextareaProps>(
  ({ value, onUpdate, className, placeholder, disabled, debounceMs, style }, ref) => {
    const { value: localValue, onChange, onBlur } = useDebouncedTextEditor({
      initialValue: value,
      onUpdate,
      debounceMs,
    });

    const internalRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement, []);

    useEffect(() => {
      const textarea = internalRef.current;
      if (!textarea || document.activeElement === textarea) return;

      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, [localValue]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e);
      
      const textarea = e.target;
      const textareaScrollTop = textarea.scrollTop;
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      
      let scrollContainer: HTMLElement | null = textarea.parentElement;
      while (scrollContainer && !scrollContainer.classList.contains('overflow-y-auto')) {
        scrollContainer = scrollContainer.parentElement;
      }
      const containerScrollTop = scrollContainer?.scrollTop ?? 0;
      
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      
      textarea.scrollTop = textareaScrollTop;
      if (scrollContainer) {
        scrollContainer.scrollTop = containerScrollTop;
      }
      textarea.setSelectionRange(selectionStart, selectionEnd);
    };

    return (
      <Textarea
        ref={internalRef}
        value={localValue}
        onChange={handleChange}
        onBlur={onBlur}
        className={cn('resize-none whitespace-pre-wrap overflow-hidden', className)}
        placeholder={placeholder}
        disabled={disabled}
        style={style}
      />
    );
  }
);

EditableTextarea.displayName = 'EditableTextarea';

