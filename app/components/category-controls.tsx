"use client";

import type { ChangeEvent } from "react";
import { MAX_CATEGORY_LENGTH } from "@/app/lib/workspace";

export function CategoryInput({
  id,
  label = "Category",
  value,
  categories,
  onChange,
  className = "",
}: {
  id: string;
  label?: string;
  value: string;
  categories: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  function update(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  const optionsId = `${id}-category-options`;

  return (
    <label className={`category-input ${className}`.trim()} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        value={value}
        onChange={update}
        list={optionsId}
        maxLength={MAX_CATEGORY_LENGTH}
        placeholder="Choose or add"
        autoComplete="off"
      />
      <datalist id={optionsId}>
        {categories.map((category) => <option key={category} value={category} />)}
      </datalist>
    </label>
  );
}

export function CategoryFilter({
  id,
  value,
  categories,
  onChange,
}: {
  id: string;
  value: string;
  categories: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="category-filter" htmlFor={id}>
      <span>Category</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All categories</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
    </label>
  );
}

export function CategoryBadge({ category }: { category?: string }) {
  return category ? <span className="category-badge">{category}</span> : null;
}
