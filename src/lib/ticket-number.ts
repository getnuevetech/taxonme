export function formatTicketNumber(n: number): string {
  return `TKT-${String(n).padStart(6, "0")}`;
}
