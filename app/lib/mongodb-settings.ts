/** Accept a URI value or an accidentally pasted, quoted .env assignment. */
export function normalizeMongoSetting(value: string | undefined, key: "MONGODB_URI" | "MONGODB_DB") {
  if (!value) return undefined;

  const unwrap = (input: string) => {
    const trimmed = input.trim();
    const quote = trimmed[0];
    return (quote === '"' || quote === "'") && trimmed.endsWith(quote)
      ? trimmed.slice(1, -1).trim() : trimmed;
  };

  const setting = unwrap(value).replace(new RegExp(`^${key}\\s*=\\s*`), "");
  return unwrap(setting) || undefined;
}
