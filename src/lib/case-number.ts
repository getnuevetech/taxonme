export function formatCaseNumber(n: number): string {
  return `TOM-${String(n).padStart(6, "0")}`;
}
