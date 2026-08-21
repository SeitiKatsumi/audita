const MONTH_MS = 2629800000;
const INTEREST_RATE_MONTHLY = 0.01;
const DEFAULT_MORAL_DAMAGES = 2_000;

function parseChargeDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
    ? null
    : date;
}

function chargeMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseIpcaRates(rates = []) {
  return new Map(
    rates.flatMap((entry) => {
      const match = String(entry?.data || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const rate = Number(String(entry?.valor || "").replace(",", "."));
      return match && Number.isFinite(rate) ? [[`${match[3]}-${match[2]}`, rate]] : [];
    }),
  );
}

function latestIpcaMonth(rates) {
  const months = [...rates.keys()].sort();
  const latest = months.at(-1);
  if (!latest) return null;
  const [year, month] = latest.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function buildChargeCalculationSnapshot(caseData = {}, options = {}) {
  const candidates = Array.isArray(caseData.candidates) ? caseData.candidates : [];
  const items = candidates
    .filter((candidate) => candidate.answer === "not_recognized")
    .map((candidate) => ({ ...candidate }))
    .filter((candidate) => Number.isFinite(Number(candidate.amount)) && Number(candidate.amount) > 0);
  const asOf = parseChargeDate(options.asOf) || new Date();
  const ipcaRates = parseIpcaRates(options.ipcaRates);
  const latestPublishedIpca = latestIpcaMonth(ipcaRates);
  const calculatedItems = items.map((candidate) => {
    const amount = Number(candidate.amount);
    const date = parseChargeDate(candidate.date);
    let correctionFactor = 1;
    let interestMonths = 0;
    let expectedIpcaMonths = 0;
    let matchedIpcaMonths = 0;
    if (date && date <= asOf) {
      const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
      const asOfMonth = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
      const end = latestPublishedIpca && latestPublishedIpca < asOfMonth
        ? latestPublishedIpca
        : asOfMonth;
      while (cursor <= end) {
        const rate = ipcaRates.get(chargeMonthKey(cursor));
        expectedIpcaMonths += 1;
        if (Number.isFinite(rate)) {
          correctionFactor *= 1 + rate / 100;
          matchedIpcaMonths += 1;
        }
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      interestMonths = Math.max(0, (asOf.getTime() - date.getTime()) / MONTH_MS);
    }
    const correctedAmount = amount * correctionFactor;
    return {
      ...candidate,
      correction: Number((correctedAmount - amount).toFixed(2)),
      interest: Number((amount * INTEREST_RATE_MONTHLY * interestMonths).toFixed(2)),
      correctionAvailable: Boolean(
        date &&
        ipcaRates.size > 0 &&
        (expectedIpcaMonths === 0 || expectedIpcaMonths === matchedIpcaMonths),
      ),
      interestMonths: Number(interestMonths.toFixed(1)),
    };
  });
  const principal = calculatedItems.reduce((total, candidate) => total + Number(candidate.amount), 0);
  const monetaryAdjustment = calculatedItems.reduce((total, candidate) => total + candidate.correction, 0);
  const estimatedInterest = calculatedItems.reduce((total, candidate) => total + candidate.interest, 0);
  const hypotheticalDouble = principal * 2;
  const estimatedMaterialClaim = hypotheticalDouble + monetaryAdjustment + estimatedInterest;
  const moralDamagesAmount = DEFAULT_MORAL_DAMAGES;
  const estimatedClaimValue = estimatedMaterialClaim + moralDamagesAmount;
  return {
    items: calculatedItems,
    itemCount: calculatedItems.length,
    principal: Number(principal.toFixed(2)),
    hypotheticalDouble: Number(hypotheticalDouble.toFixed(2)),
    monetaryAdjustment: Number(monetaryAdjustment.toFixed(2)),
    estimatedInterest: Number(estimatedInterest.toFixed(2)),
    estimatedMaterialClaim: Number(estimatedMaterialClaim.toFixed(2)),
    moralDamagesAmount,
    estimatedClaimValue: Number(estimatedClaimValue.toFixed(2)),
    calculationAsOf: asOf.toISOString().slice(0, 10),
    correctionAvailable: calculatedItems.length > 0 && calculatedItems.every((item) => item.correctionAvailable),
    missingDateCount: calculatedItems.filter((item) => !parseChargeDate(item.date)).length,
    excludedWithoutAmount: candidates.filter(
      (candidate) =>
        candidate.answer === "not_recognized" &&
        (!Number.isFinite(Number(candidate.amount)) || Number(candidate.amount) <= 0),
    ).length,
  };
}
