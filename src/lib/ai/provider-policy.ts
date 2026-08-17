import "server-only";
import type { AiProvider } from "@prisma/client";

export function providerAllowedForTaxData(provider: AiProvider): boolean {
  return (
    provider.isEnabled &&
    provider.apiKey.length > 0 &&
    provider.dataRetentionProfile.startsWith("approved") &&
    provider.regionProfile.startsWith("approved")
  );
}
