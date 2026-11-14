"use client";

import { useState } from "react";

/** Preserve valid filters while permanently clearing a removed or renamed choice. */
export function useCategoryFilter(categories: string[]) {
  const signature = JSON.stringify(categories);
  const [selection, setSelection] = useState({ signature, category: "" });
  let current = selection;
  if (selection.signature !== signature) {
    current = { signature, category: categories.includes(selection.category) ? selection.category : "" };
    setSelection(current);
  }
  function select(category: string) {
    setSelection({ signature, category });
  }
  return [current.category, select] as const;
}
