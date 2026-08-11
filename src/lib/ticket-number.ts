export function formatTicketNumber(n: number): string {
  return `TKT-${String(n).padStart(6, "0")}`;
}

export function formatTransactionNumber(n: number): string {
  return `TXN-${String(n).padStart(6, "0")}`;
}
