import type {
  MaulNormalizedBox,
  MaulProfileTypographyRealization,
  MaulTypographyProfileTransform,
} from "@prometheus/shared-types";

const OUTPUT = {width: 1080, height: 1920} as const;
const MINIMUM_PROFILE_WIDTH_PERCENT = 50;
const SAFE_REGION: MaulNormalizedBox = {
  x: 0.04,
  y: 0.04,
  width: 0.92,
  height: 0.88,
};

type Anchor = {
  id: string;
  x: number;
  y: number;
  horizontalAlignment: "left" | "center" | "right";
};

const ANCHORS: readonly Anchor[] = [
  {id: "upper_left", x: 0.08, y: 0.16, horizontalAlignment: "left"},
  {id: "upper_center", x: 0.5, y: 0.16, horizontalAlignment: "center"},
  {id: "upper_right", x: 0.92, y: 0.16, horizontalAlignment: "right"},
  {id: "center_left", x: 0.08, y: 0.46, horizontalAlignment: "left"},
  {id: "center", x: 0.5, y: 0.46, horizontalAlignment: "center"},
  {id: "center_right", x: 0.92, y: 0.46, horizontalAlignment: "right"},
  {id: "lower_left", x: 0.08, y: 0.68, horizontalAlignment: "left"},
  {id: "lower_center", x: 0.5, y: 0.68, horizontalAlignment: "center"},
  {id: "lower_right", x: 0.92, y: 0.68, horizontalAlignment: "right"},
];

const boxesOverlap = (first: MaulNormalizedBox, second: MaulNormalizedBox) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

const overlapArea = (first: MaulNormalizedBox, second: MaulNormalizedBox) => {
  if (!boxesOverlap(first, second)) return 0;
  const width = Math.min(first.x + first.width, second.x + second.width) -
    Math.max(first.x, second.x);
  const height = Math.min(first.y + first.height, second.y + second.height) -
    Math.max(first.y, second.y);
  return Math.max(0, width) * Math.max(0, height);
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const boxForAnchor = ({
  anchor,
  width,
  height,
}: {
  anchor: Anchor;
  width: number;
  height: number;
}): MaulNormalizedBox => {
  const rawX =
    anchor.horizontalAlignment === "left"
      ? anchor.x
      : anchor.horizontalAlignment === "right"
        ? anchor.x - width
        : anchor.x - width / 2;
  return {
    x: clamp(rawX, SAFE_REGION.x, SAFE_REGION.x + SAFE_REGION.width - width),
    y: clamp(anchor.y, SAFE_REGION.y, SAFE_REGION.y + SAFE_REGION.height - height),
    width,
    height,
  };
};

const alignmentPenalty = (
  requested: MaulProfileTypographyRealization["horizontalAlignment"],
  selected: Anchor["horizontalAlignment"],
): number => (requested === selected ? 0 : 0.12);

export const selectTypographyProfilePlacement = ({
  realization,
  subjectBox,
  existingTextRegions,
  intent,
}: {
  realization: MaulProfileTypographyRealization;
  subjectBox: MaulNormalizedBox | null;
  existingTextRegions: readonly MaulNormalizedBox[];
  intent?: {
    preferredBox: MaulNormalizedBox;
    overlapPolicy: "avoid_subject" | "controlled_overlap";
  };
}): {
  box: MaulNormalizedBox;
  maximumEnvelope: MaulNormalizedBox;
  alignment: "left" | "center" | "right";
  transform: MaulTypographyProfileTransform;
  anchorId: string;
} => {
  const maximumWidthPx =
    (OUTPUT.width * realization.maxWidthPercent) / 100;
  const maximumHeightPx = OUTPUT.height * SAFE_REGION.height;
  const maximumScale = Math.min(
    maximumWidthPx / realization.intrinsicSizePx.width,
    maximumHeightPx / realization.intrinsicSizePx.height,
  );
  const minimumPresenceWidthPx = Math.min(
    maximumWidthPx,
    (OUTPUT.width * MINIMUM_PROFILE_WIDTH_PERCENT) / 100,
  );
  const uniformScale = Math.min(
    maximumScale,
    Math.max(
      1,
      minimumPresenceWidthPx / realization.intrinsicSizePx.width,
    ),
  );
  if (!Number.isFinite(uniformScale) || uniformScale <= 0) {
    throw new Error("Typography profile has no positive 9:16 placement scale.");
  }
  const finalWidthPx = realization.intrinsicSizePx.width * uniformScale;
  const finalHeightPx = realization.intrinsicSizePx.height * uniformScale;
  const normalizedWidth = finalWidthPx / OUTPUT.width;
  const normalizedHeight = finalHeightPx / OUTPUT.height;

  const ranked = ANCHORS.map((anchor) => {
    const box = boxForAnchor({
      anchor,
      width: normalizedWidth,
      height: normalizedHeight,
    });
    const subjectOverlap = subjectBox
      ? overlapArea(box, subjectBox) / Math.max(0.0001, box.width * box.height)
      : 0;
    const existingOverlap = existingTextRegions.reduce(
      (total, region) =>
        total + overlapArea(box, region) / Math.max(0.0001, box.width * box.height),
      0,
    );
    const preferredCenterDistance = intent
      ? Math.hypot(
          box.x + box.width / 2 -
            (intent.preferredBox.x + intent.preferredBox.width / 2),
          box.y + box.height / 2 -
            (intent.preferredBox.y + intent.preferredBox.height / 2),
        )
      : 0;
    const intentScore = intent
      ? Math.max(0, 1 - preferredCenterDistance / Math.SQRT2) * 3
      : 0;
    const subjectOverlapWeight =
      intent?.overlapPolicy === "controlled_overlap" ? -0.2 : -5;
    const score =
      subjectOverlap * subjectOverlapWeight +
      existingOverlap * -4 -
      alignmentPenalty(realization.horizontalAlignment, anchor.horizontalAlignment) -
      0 +
      intentScore;
    return {anchor, box, score};
  }).sort(
    (left, right) =>
      right.score - left.score || left.anchor.id.localeCompare(right.anchor.id),
  );
  const selected = ranked[0];
  if (!selected) throw new Error("Typography profile produced no placement anchors.");

  const transform: MaulTypographyProfileTransform = {
    uniformScale,
    intrinsicWidthPx: realization.intrinsicSizePx.width,
    intrinsicHeightPx: realization.intrinsicSizePx.height,
    finalWidthPx,
    finalHeightPx,
  };
  return {
    box: selected.box,
    maximumEnvelope: selected.box,
    alignment: selected.anchor.horizontalAlignment,
    transform,
    anchorId: selected.anchor.id,
  };
};
