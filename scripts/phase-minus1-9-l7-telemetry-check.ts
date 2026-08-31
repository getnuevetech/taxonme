import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HARM_AUTO_STALE_MIN,
  filterServableProductionRows,
  isActivelyServable,
  shouldAutoStaleFromTelemetry,
} from "../src/lib/experience";

assert.equal(shouldAutoStaleFromTelemetry(0, 2), false);
assert.equal(
  shouldAutoStaleFromTelemetry(0, HARM_AUTO_STALE_MIN),
  true,
);
assert.equal(shouldAutoStaleFromTelemetry(5, 9), false);
assert.equal(shouldAutoStaleFromTelemetry(3, 6), true);
assert.equal(
  isActivelyServable({ promotionLevel: 4, staleAt: null }),
  true,
);
assert.equal(
  isActivelyServable({ promotionLevel: 4, staleAt: new Date() }),
  false,
);
assert.equal(
  filterServableProductionRows([
    { promotionLevel: 4, staleAt: null, anonJson: "{}" },
    { promotionLevel: 3, staleAt: null, anonJson: "{}" },
    { promotionLevel: 4, staleAt: new Date(), anonJson: "{}" },
  ]).length,
  1,
);

const migration = readFileSync(
  "prisma/migrations/20260831190000_experience_observation/migration.sql",
  "utf8",
);
assert.match(migration, /helpCount/);
assert.match(migration, /staleAt/);
assert.match(
  readFileSync("src/lib/experience/publish.ts", "utf8"),
  /staleAt: null/,
);

console.log("phase-minus1-9-l7-telemetry-check: ok");
