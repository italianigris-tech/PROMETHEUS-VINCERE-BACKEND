import type {MaulKineticTreatmentReceipt} from "@prometheus/shared-types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const resolveMaulKineticTokenText = ({
  sourceText,
  receipt,
  outputFrame,
  entryStartFrame,
  entryEndFrame,
}: {
  sourceText: string;
  receipt: MaulKineticTreatmentReceipt | undefined;
  outputFrame: number | undefined;
  entryStartFrame: number;
  entryEndFrame: number;
}): string => {
  if (
    !receipt ||
    receipt.traitId !== "trait_number_count_up" ||
    outputFrame === undefined ||
    entryEndFrame <= entryStartFrame
  ) {
    return sourceText;
  }
  const linearProgress = clamp01(
    (outputFrame - entryStartFrame) / (entryEndFrame - entryStartFrame),
  );
  const progress = 1 - Math.pow(1 - linearProgress, 4);
  const value = Math.round(
    receipt.renderContract.startValue +
      (receipt.renderContract.endValue - receipt.renderContract.startValue) * progress,
  );
  if (receipt.renderContract.format === "currency_usd") {
    return `$${value.toLocaleString("en-US")}`;
  }
  if (receipt.renderContract.format === "percentage") {
    return `${value.toLocaleString("en-US")}%`;
  }
  return value.toLocaleString("en-US", {useGrouping: receipt.renderContract.format !== "year"});
};
