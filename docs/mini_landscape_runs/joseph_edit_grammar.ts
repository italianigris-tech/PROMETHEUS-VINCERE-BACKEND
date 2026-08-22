/**
 * MINI LANDSCAPE RUNS — STAGE 3: JOSEPH EDIT GRAMMAR
 *
 * Turns role-driven sections into a budgeted edit-move allocation, derived from
 * the five-audit synthesis. Every move references its owning section and a
 * causal reason — no move is invented without a section, and no section is
 * left without a move (BUD-04).
 */

import type { EditMove, EditMoveId, LandscapeSection, SectionRole } from "./types.js";

const ROLE_MOVE_CATALOG: Record<SectionRole, EditMoveId[]> = {
  hook: ["emphasize_keyword", "proof_insert"],
  setup: ["return_to_authority", "focus_handoff"],
  explain: ["emphasize_keyword", "explain_workflow", "fatigue_relief"],
  demonstrate: ["explain_workflow", "proof_insert", "return_to_authority"],
  payoff: ["value_contrast", "thesis_punctuation", "cta_pressure"],
  outro: ["cta_pressure", "fatigue_relief"],
};

const ROLE_PRIORITY_MULTIPLIER: Record<SectionRole, number> = {
  hook: 1.1,
  setup: 0.8,
  explain: 0.9,
  demonstrate: 1.0,
  payoff: 1.3,
  outro: 0.9,
};

const MACRO_ASSET_MOVES = new Set<EditMoveId>(["proof_insert", "value_contrast", "explain_workflow", "focus_handoff"]);
const NO_SFX_MOVES = new Set<EditMoveId>(["fatigue_relief", "momentum_death"]);

const REDUCTION_HINTS = /(save|less|lose|lost|cut|drop|reduce|down|cheaper|fewer)/i;
const GROWTH_HINTS = /(earn|more|grow|gain|increase|up|higher|faster|better|win)/i;

const VIEWER_PROBLEM: Record<EditMoveId, string> = {
  emphasize_keyword: "Salience of one phrase",
  return_to_authority: "Re-anchor to the host",
  explain_workflow: "Tutorial clarity",
  value_contrast: "Price/metric comprehension",
  cta_pressure: "Action",
  fatigue_relief: "Pattern break",
  focus_handoff: "Attention transfer",
  proof_insert: "Trust / evidence",
  thesis_punctuation: "Mark rare importance",
  momentum_death: "Reset attention; break the push chain",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function numberDirectionFor(moveId: EditMoveId, text?: string): EditMove["numberDirection"] {
  if (moveId !== "value_contrast") return "none";
  if (text && REDUCTION_HINTS.test(text)) return "down";
  if (text && GROWTH_HINTS.test(text)) return "up";
  return "digit_entry";
}

export function allocateEditMoves(sections: LandscapeSection[]): EditMove[] {
  const moves: EditMove[] = [];

  for (const section of sections) {
    const catalog = ROLE_MOVE_CATALOG[section.role];
    // BUD-01: move count capped by section duration.
    const budget = Math.max(1, Math.min(4, Math.floor(section.durationSec / 8)));
    const count = Math.min(budget, catalog.length);

    for (let k = 0; k < count; k++) {
      const moveId = catalog[k % catalog.length];
      const anchor = section.startSec + ((k + 1) / (count + 1)) * section.durationSec;
      moves.push({
        moveId,
        sectionId: section.sectionId,
        startSec: round2(Math.max(section.startSec, anchor - 0.6)),
        endSec: round2(Math.min(section.endSec, anchor + 0.6)),
        viewerProblem: VIEWER_PROBLEM[moveId],
        priority: round2(section.semanticWeight * ROLE_PRIORITY_MULTIPLIER[section.role] * 10),
        numberDirection: numberDirectionFor(moveId, section.text),
        allowSfx: !NO_SFX_MOVES.has(moveId),
        allowMacroAsset: MACRO_ASSET_MOVES.has(moveId),
        cause: {
          gate: "edit_move",
          reason: `Role ${section.role} allocated ${moveId} (move ${k + 1}/${count}).`,
          sectionId: section.sectionId,
          timeSec: round2(anchor),
        },
      });
    }
  }

  // BUD-05: momentum-death stops at high-fatigue boundaries only.
  for (let i = 0; i < sections.length - 1; i++) {
    const prev = sections[i];
    const next = sections[i + 1];
    if (!(prev.fatigueRisk >= 0.65 && next.semanticWeight <= 0.7)) continue;
    const boundary = prev.endSec;
    const lastMove = moves.filter((m) => m.sectionId === prev.sectionId).pop();
    const firstNext = moves.find((m) => m.sectionId === next.sectionId);
    const gapOk =
      (!lastMove || boundary - lastMove.endSec >= 3.0) && (!firstNext || firstNext.startSec - boundary >= 3.0);
    if (!gapOk) continue;
    moves.push({
      moveId: "momentum_death",
      sectionId: prev.sectionId,
      startSec: round2(boundary - 0.25),
      endSec: round2(boundary + 0.25),
      viewerProblem: VIEWER_PROBLEM.momentum_death,
      priority: 1,
      numberDirection: "none",
      allowSfx: false,
      allowMacroAsset: false,
      cause: {
        gate: "edit_move",
        reason: `High fatigue (${prev.fatigueRisk.toFixed(2)}) at boundary into ${next.role}; momentum death stop.`,
        sectionId: prev.sectionId,
        timeSec: boundary,
      },
    });
  }

  return moves.sort((a, b) => a.startSec - b.startSec);
}
