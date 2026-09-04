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
  if (satisfies.some((result) => result.passed !== true)) {
    return "Fails";
  }
  return delivers.every((result) => result.passed === true) ? "Delivers" : "Satisfies";
}
