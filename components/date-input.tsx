"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { CalendarDays } from "lucide-react";
import { dateInputError, formatDate, parseDateInput } from "@/lib/dates";
import "./date-input.css";

export type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  value: string;
  onChange: (event: { target: { value: string } }) => void;
};

const displayValue = (value: string) => (value ? formatDate(value) : "");

export function DateInput({
  value,
  onChange,
  onBlur,
  required,
  min,
  max,
  disabled,
  readOnly,
  className = "",
  id,
  ...props
}: DateInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const input = useRef<HTMLInputElement>(null);
  const calendar = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => displayValue(value));
  const error = dateInputError(text, { required, min, max });

  // External changes (reset, switching records, parent date-range updates) stay
  // controlled. Incomplete edits remain local while the parent value is stable.
  useEffect(() => {
    setText(displayValue(value));
  }, [value]);
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);

  function edit(next: string, field: HTMLInputElement) {
    const iso = parseDateInput(next);
    field.setCustomValidity(dateInputError(next, { required, min, max }));
    setText(iso ? formatDate(iso) : next);
    if (iso && !dateInputError(next, { required, min, max }))
      onChange({ target: { value: iso } });
    else if (!next.trim()) onChange({ target: { value: "" } });
  }

  function openCalendar() {
    try {
      if (calendar.current?.showPicker) {
        calendar.current.showPicker();
        return;
      }
    } catch {
      /* Embedded or unsupported browsers can use the text field. */
    }
    input.current?.focus();
  }

  return (
    <span className="date-input-control">
      <input
        {...props}
        ref={input}
        id={inputId}
        type="text"
        value={text}
        className={`date-input-field ${className}`.trim()}
        placeholder={props.placeholder || "dd/mm/yyyy"}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={props.autoComplete || "off"}
        aria-invalid={
          props["aria-invalid"] ?? (text && error ? true : undefined)
        }
        onChange={(event) => edit(event.target.value, event.currentTarget)}
        onBlur={(event) => {
          const iso = parseDateInput(text);
          if (iso) setText(formatDate(iso));
          event.currentTarget.setCustomValidity(
            dateInputError(text, { required, min, max }),
          );
          onBlur?.(event);
        }}
      />
      <button
        type="button"
        className="date-input-calendar-button"
        aria-label="Kalender öffnen"
        aria-controls={`${inputId}-calendar`}
        disabled={disabled || readOnly}
        onClick={openCalendar}
      >
        <CalendarDays size={17} aria-hidden="true" />
      </button>
      <input
        ref={calendar}
        id={`${inputId}-calendar`}
        className="date-input-native-picker"
        type="date"
        value={parseDateInput(value) || ""}
        min={
          min === undefined
            ? undefined
            : parseDateInput(String(min)) || undefined
        }
        max={
          max === undefined
            ? undefined
            : parseDateInput(String(max)) || undefined
        }
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || readOnly}
        onChange={(event) => {
          const iso = parseDateInput(event.target.value);
          const next = iso ? formatDate(iso) : "";
          setText(next);
          input.current?.setCustomValidity(
            dateInputError(next, { required, min, max }),
          );
          onChange({ target: { value: iso || "" } });
        }}
      />
    </span>
  );
}

export default DateInput;
