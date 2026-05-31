"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "@/types/market";

export function AutocompleteInput({
  label,
  field,
  value,
  placeholder,
  onChange
}: {
  label: string;
  field: "card" | "set" | "variant";
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const blurTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ field, q: value });
        const response = await fetch(`/api/search/suggestions?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Suggestion request failed.");
        const payload = await response.json() as { data: SearchSuggestion[] };
        setSuggestions(payload.data);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [field, value]);

  return (
    <label className="autocomplete-field">
      {label}
      <input
        value={value}
        onBlur={() => {
          blurTimeout.current = window.setTimeout(() => setIsOpen(false), 140);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && (suggestions.length || isLoading) ? (
        <div className="suggestion-menu" role="listbox">
          {isLoading ? <span className="suggestion-loading">Searching</span> : null}
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.source}-${suggestion.value}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (blurTimeout.current) window.clearTimeout(blurTimeout.current);
                onChange(suggestion.value);
                setIsOpen(false);
              }}
            >
              <span>{suggestion.value}</span>
              <small>{suggestion.source.replace("-", " ")}</small>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
