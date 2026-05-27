export function commandName(line: string): string | null {
  return line.trim().match(/^\*([a-z_]+)/i)?.[1].toLowerCase() ?? null;
}

export function commandValue(line: string, command: string): string {
  return line.trim().replace(command, "").trim();
}

export function stripCommandPrefix(value: string, command: string): string {
  return value.replace(command, "").replace(/^[-\s]+/, "").trim();
}

export function gosubTarget(value: string): string {
  return stripCommandPrefix(value, "*gosub").split(/\s+/)[0] ?? "";
}

export function generatedNodeLabel(id: string): string {
  return `cf_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}
