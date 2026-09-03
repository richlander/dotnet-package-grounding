export function classify(record) {
  if (record.status !== "success" || !record.gradeResult) {
    return "Fails";
  }
  const details = record.gradeResult.details ?? [];
  const satisfies = details.filter((result) => result.name?.startsWith("satisfies/"));
  const delivers = details.filter((result) => result.name?.startsWith("delivers/"));
  if (satisfies.length === 0 || delivers.length === 0) {
    throw new Error(`missing named outcome graders for ${record.trajectory?.id ?? "unknown trajectory"}`);
  }
  const satisfiesPass = satisfies.every((result) => result.passed === true);
  const deliversPass = delivers.every((result) => result.passed === true);
  if (!satisfiesPass) {
    return "Fails";
  }
  return deliversPass ? "Delivers" : "Satisfies";
}

export function iet(record) {
  const usage = record.trajectory?.metrics?.tokenUsage;
  if (!usage) {
    return Number.NaN;
  }
  const input = usage.inputTokens ?? 0;
  const cacheRead = Math.min(input, Math.max(0, usage.cacheReadTokens ?? 0));
  const output = usage.outputTokens ?? 0;
  const model = (record.model ?? record.trajectory?.metadata?.model ?? "").toLowerCase();
  if (model.includes("gpt") || model.includes("openai") || /\bo[134]\b/.test(model)) {
    return (input - cacheRead) + 0.1 * cacheRead + 6 * output;
  }
  return 1.25 * (input - cacheRead) + 0.1 * cacheRead + 5 * output;
}
