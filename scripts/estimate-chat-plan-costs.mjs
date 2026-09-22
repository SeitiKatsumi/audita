import assert from 'node:assert/strict';
import { CHAT_PLANS } from '../services/billing-catalog.service.mjs';
import { DEFAULT_API_PRICING, estimateApiUsageCost } from '../services/api-usage.service.mjs';

// Scenarios, not measured usage. No network or provider calls.
const pricing = { ...DEFAULT_API_PRICING, active: true };
const usdBrl = Number(process.env.COST_USD_BRL || 6);
assert(Number.isFinite(usdBrl) && usdBrl > 0);
const cost = (inputUnits, outputUnits) => estimateApiUsageCost({ inputUnits, outputUnits }, pricing) * usdBrl;
assert.equal(estimateApiUsageCost({ inputUnits: 5000, outputUnits: 1000 }, pricing), 0.00325);
for (const [scenario, messageCost, pageCost] of [
  ['illustrative', cost(5000, 1000), cost(3000, 1000)],
  ['stress-not-upper-bound', 6 * cost(24000, 2400), cost(12000, 12000)],
]) {
  console.log(`\n${scenario}; hypothetical full allowance; USD/BRL=${usdBrl}`);
  console.table(CHAT_PLANS.map(plan => {
    const ai = plan.messages * messageCost + plan.pages * pageCost;
    const percent = ai / (plan.price.cents / 100) * 100;
    return { plan: plan.name, aiBRL: ai.toFixed(2), percent: percent.toFixed(1), under25Percent: percent <= 25 };
  }));
}
console.log('Not margin validation: excludes storage, support, tax, payment fees, retries and unmeasured token expansion. Measure representative workloads before sale.');
