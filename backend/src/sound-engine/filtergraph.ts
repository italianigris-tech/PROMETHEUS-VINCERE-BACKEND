import {compilePresetFilters, mergePresetSettings} from "./presets";
import type {
  SoundDesignFilterGraphCompilation,
  SoundDesignPlan,
  SoundDesignPresetName,
  SoundDesignPresetSettings
} from "./types";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const toSeconds = (value: number): string => Number(value.toFixed(3)).toString();

const wrap = (value: string): string => `[${value}]`;

const stream = (index: number): string => `[${index}:a]`;

const cueLabel = (kind: "music" | "sfx", index: number): string => `${kind}_cue_${index}`;

const dialogueLabel = (index: number): string => `dialogue_span_${index}`;

const mixLabel = (name: string): string => `${name}_bus_raw`;

const buildTempoStretchFilters = ({
  ratio,
  capabilities
}: {
  ratio: number | undefined;
  capabilities: SoundDesignPlan["capabilities"];
}): {filters: string[]; note: string | null} => {
  if (!ratio || Math.abs(ratio - 1) < 0.001) {
    return {filters: [], note: null};
  }

  if (capabilities.rubberband) {
    return {
      filters: [`rubberband=tempo=${toSeconds(ratio)}`],
      note: `Applied rubberband tempo stretch ${ratio.toFixed(3)}.`
    };
  }

  const filters: string[] = [];
  let remaining = ratio;
  while (remaining > 2) {
    filters.push("atempo=2.0");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining *= 2;
  }
  filters.push(`atempo=${toSeconds(clamp(remaining, 0.5, 2))}`);

  return {
    filters,
    note: `Applied fallback atempo stretch ${ratio.toFixed(3)} because rubberband was unavailable.`
  };
};

const buildCueChain = ({
  plan,
  cueIndex,
  cueType,
  placementMode
}: {
  plan: SoundDesignPlan;
  cueIndex: number;
  cueType: "music" | "sfx";
  placementMode: "timeline" | "sequence";
}): {label: string; lines: string[]; notes: string[]} => {
  const cue = cueType === "music" ? plan.musicCues[cueIndex] : plan.sfxCues[cueIndex];
  const lines: string[] = [];
  const notes: string[] = [];
  const base = cueLabel(cueType, cueIndex);
  const trimLabel = `${base}_trim`;

  lines.push(
    `${stream(cue.inputIndex)}atrim=start=${toSeconds(cue.sourceStartSeconds)}:end=${toSeconds(cue.sourceEndSeconds)},asetpts=PTS-STARTPTS[${trimLabel}]`
  );

  let currentLabel = trimLabel;

  // Normalize source assets before bus mixing. Catalog files vary by more than
  // 20 dB; cue gain alone cannot provide predictable music/SFX audibility.
  const normalizedLabel = `${base}_normalized`;
  if (cueType === "sfx") {
    lines.push(`[${currentLabel}]loudnorm=I=-18:TP=-4:LRA=7:linear=true[${normalizedLabel}]`);
    currentLabel = normalizedLabel;
    notes.push(`Normalized ${cue.id} to the MAUL audible-SFX target.`);
  } else {
    lines.push(`[${currentLabel}]loudnorm=I=-23:TP=-6:LRA=11:linear=true[${normalizedLabel}]`);
    currentLabel = normalizedLabel;
    notes.push(`Normalized ${cue.id} to the dialogue-safe music target.`);
  }
  const gainedLabel = `${base}_gain`;
  lines.push(`[${currentLabel}]volume=${toSeconds(cue.gainDb)}dB[${gainedLabel}]`);
  currentLabel = gainedLabel;

  const tempoStretch = buildTempoStretchFilters({
    ratio: cue.tempoStretchRatio,
    capabilities: plan.capabilities
  });
  if (tempoStretch.filters.length > 0) {
    const nextLabel = `${base}_tempo`;
    lines.push(`[${currentLabel}]${tempoStretch.filters.join(",")}[${nextLabel}]`);
    currentLabel = nextLabel;
    if (tempoStretch.note) {
      notes.push(tempoStretch.note);
    }
  }

  if (cue.transitionIn) {
    const transitionSettings = mergePresetSettings(
      cue.transitionIn.preset,
      cue.transitionIn.settings as Partial<SoundDesignPresetSettings>
    );
    const compiled = compilePresetFilters(cue.transitionIn.preset, {
      cueId: cue.id,
      cueDurationSeconds: cue.durationSeconds,
      phase: "in",
      settings: transitionSettings,
      transition: cue.transitionIn,
      capabilities: plan.capabilities
    });
    const nextLabel = `${base}_in`;
    lines.push(`[${currentLabel}]${compiled.filters.join(",")}[${nextLabel}]`);
    currentLabel = nextLabel;
    notes.push(...compiled.notes);
  }

  if (cue.transitionOut?.settings.impulseResponse && plan.capabilities.afir) {
    const impulse = plan.resolvedInputs.find((entry) => entry.path === cue.transitionOut?.settings.impulseResponse);
    if (impulse) {
      const nextLabel = `${base}_afir`;
      lines.push(`[${currentLabel}][${impulse.index}:a]afir[${nextLabel}]`);
      currentLabel = nextLabel;
      notes.push(`Applied impulse-response convolution tail for ${cue.id}.`);
    }
  }

  if (cue.transitionOut) {
    const transitionSettings = mergePresetSettings(
      cue.transitionOut.preset,
      cue.transitionOut.settings as Partial<SoundDesignPresetSettings>
    );
    const compiled = compilePresetFilters(cue.transitionOut.preset, {
      cueId: cue.id,
      cueDurationSeconds: cue.durationSeconds,
      phase: "out",
      settings: transitionSettings,
      transition: cue.transitionOut,
      capabilities: plan.capabilities
    });
    const nextLabel = `${base}_out`;
    lines.push(`[${currentLabel}]${compiled.filters.join(",")}[${nextLabel}]`);
    currentLabel = nextLabel;
    notes.push(...compiled.notes);
  }

  if (placementMode === "timeline") {
    const delayMs = Math.max(0, Math.round(cue.startSeconds * 1000));
    const delayedLabel = `${base}_timeline`;
    lines.push(`[${currentLabel}]adelay=${delayMs}:all=1[${delayedLabel}]`);
    currentLabel = delayedLabel;
  }

  notes.push(`Prepared ${cue.sourcePath} for ${cue.id}.`);

  return {
    label: currentLabel,
    lines,
    notes
  };
};

const buildTimelineBus = ({
  plan,
  cueType
}: {
  plan: SoundDesignPlan;
  cueType: "music" | "sfx";
}): {label: string | null; lines: string[]; notes: string[]} => {
  const cues = cueType === "music" ? plan.musicCues : plan.sfxCues;
  if (cues.length === 0) {
    return {label: null, lines: [], notes: []};
  }

  const lines: string[] = [];
  const notes: string[] = [];
  const overlapEligible =
    cueType === "music" &&
    cues.length > 1 &&
    cues.every((cue, index) => index === 0 || cue.startSeconds <= cues[index - 1].endSeconds);

  const compiled = cues.map((_, index) =>
    buildCueChain({
      plan,
      cueIndex: index,
      cueType,
      placementMode: overlapEligible ? "sequence" : "timeline"
    })
  );

  compiled.forEach((entry) => {
    lines.push(...entry.lines);
    notes.push(...entry.notes);
  });

  if (overlapEligible && compiled.length > 1) {
    let currentLabel = compiled[0].label;
    for (let index = 1; index < cues.length; index += 1) {
      const previous = cues[index - 1];
      const current = cues[index];
      const overlapSeconds = clamp(
        previous.endSeconds - current.startSeconds,
        0.12,
        Math.min(previous.durationSeconds * 0.45, current.durationSeconds * 0.45)
      );
      const nextLabel = `${cueType}_cross_${index}`;
      lines.push(`[${currentLabel}][${compiled[index].label}]acrossfade=d=${toSeconds(overlapSeconds)}:c1=tri:c2=tri[${nextLabel}]`);
      currentLabel = nextLabel;
    }

    const startDelayMs = Math.max(0, Math.round(cues[0].startSeconds * 1000));
    const delayedLabel = mixLabel(cueType);
    lines.push(`[${currentLabel}]adelay=${startDelayMs}:all=1[${delayedLabel}]`);
    notes.push("Music cues were chained with acrossfade because the windows overlap cleanly.");
    return {label: delayedLabel, lines, notes};
  }

  if (compiled.length === 1) {
    return {label: compiled[0].label, lines, notes};
  }

  const delayedLabels = compiled.map((entry) => wrap(entry.label)).join("");
  const busLabel = mixLabel(cueType);
  lines.push(`${delayedLabels}amix=inputs=${compiled.length}:normalize=0:dropout_transition=0[${busLabel}]`);
  notes.push(`${cueType === "music" ? "Music" : "SFX"} cues were mixed with timeline placement and per-cue delays.`);

  return {
    label: busLabel,
    lines,
    notes
  };
};

const buildDialogueBus = (
  plan: SoundDesignPlan
): {label: string | null; lines: string[]; notes: string[]} => {
  if (!plan.manifest.dialogueSource || plan.dialogueSpans.length === 0) {
    return {label: null, lines: [], notes: []};
  }

  const source = plan.resolvedInputs.find((entry) => entry.role === "dialogue");
  if (!source) {
    return {label: null, lines: [], notes: []};
  }

  const lines: string[] = [];
  const notes: string[] = [];
  const spanLabels = plan.dialogueSpans.map((span) => {
    const trimmedLabel = dialogueLabel(span.index);
    const delayedLabel = `${trimmedLabel}_delay`;
    lines.push(
      `${stream(source.index)}atrim=start=${toSeconds(span.startSeconds)}:end=${toSeconds(span.endSeconds)},asetpts=PTS-STARTPTS,volume=${toSeconds(span.gainDb)}dB[${trimmedLabel}]`
    );
    lines.push(`[${trimmedLabel}]adelay=${Math.round(span.startSeconds * 1000)}:all=1[${delayedLabel}]`);
    return delayedLabel;
  });

  const busLabel = mixLabel("dialogue");
  if (spanLabels.length === 1) {
    lines.push(`[${spanLabels[0]}]anull[${busLabel}]`);
  } else {
    lines.push(`${spanLabels.map(wrap).join("")}amix=inputs=${spanLabels.length}:normalize=0:dropout_transition=0[${busLabel}]`);
  }

  notes.push("Dialogue spans were isolated into a dedicated bus for ducking and stem export.");

  return {
    label: busLabel,
    lines,
    notes
  };
};

const buildDuckedMusic = ({
  plan,
  musicLabel,
  dialogueLabel,
  previewMode
}: {
  plan: SoundDesignPlan;
  musicLabel: string | null;
  dialogueLabel: string | null;
  previewMode: boolean;
}): {script: string; label: string | null; notes: string[]} => {
  if (!musicLabel) {
    return {script: "", label: null, notes: []};
  }

  const lines: string[] = [];
  const notes: string[] = [];
  const outputLabel = previewMode ? "music_ducked_preview" : "music_ducked";

  if (dialogueLabel && plan.capabilities.sidechaincompress) {
    lines.push(`[${musicLabel}][${dialogueLabel}]sidechaincompress=threshold=0.045:ratio=6:attack=40:release=220[${outputLabel}]`);
    notes.push("Applied sidechain compression to keep music under the dialogue bus.");
    return {
      script: lines.join(";\n"),
      label: outputLabel,
      notes
    };
  }

  if (plan.dialogueSpans.length > 0) {
    const duckedLevel = 0.42;
    const probes = plan.dialogueSpans.map(
      (span) => `between(t,${toSeconds(span.startSeconds)},${toSeconds(span.endSeconds)})`
    );
    const expression = `'if(gte(${probes.join("+")},1),${toSeconds(duckedLevel)},1)'`;
    lines.push(`[${musicLabel}]volume=${expression}[${outputLabel}]`);
    notes.push("Applied timeline-envelope ducking because sidechain compression was unavailable.");
    return {
      script: lines.join(";\n"),
      label: outputLabel,
      notes
    };
  }

  lines.push(`[${musicLabel}]anull[${outputLabel}]`);
  return {
    script: lines.join(";\n"),
    label: outputLabel,
    notes
  };
};

const buildFinalMix = ({
  plan,
  musicLabel,
  dialogueLabel,
  sfxLabel,
  previewMode
}: {
  plan: SoundDesignPlan;
  musicLabel: string | null;
  dialogueLabel: string | null;
  sfxLabel: string | null;
  previewMode: boolean;
}): {script: string; masterLabel: string; stemLabels: {dialogue: string | null; music: string | null; sfx: string | null}} => {
  const lines: string[] = [];
  const inputs: string[] = [];

  if (dialogueLabel) {
    inputs.push(wrap(dialogueLabel));
  }
  if (musicLabel) {
    inputs.push(wrap(musicLabel));
  }
  if (sfxLabel) {
    inputs.push(wrap(sfxLabel));
  }

  const preMaster = "master_pre";
  if (inputs.length === 0) {
    lines.push(`anullsrc=channel_layout=stereo:sample_rate=${plan.manifest.master.sampleRate}[${preMaster}]`);
  } else if (inputs.length === 1) {
    lines.push(`${inputs[0]}anull[${preMaster}]`);
  } else {
    lines.push(`${inputs.join("")}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0[${preMaster}]`);
  }

  const masterLabel = previewMode ? "preview_master" : "master";
  if (previewMode) {
    if (plan.capabilities.alimiter) {
      lines.push(`[${preMaster}]alimiter=limit=0.97[${masterLabel}]`);
    } else {
      lines.push(`[${preMaster}]volume=0.97[${masterLabel}]`);
    }
  } else if (plan.capabilities.loudnorm) {
    lines.push(
      `[${preMaster}]loudnorm=I=${plan.manifest.master.targetI}:TP=${plan.manifest.master.truePeak}:LRA=${plan.manifest.master.lra}:linear=true:print_format=summary,aresample=${plan.manifest.master.sampleRate}[${masterLabel}]`
    );
  } else if (plan.capabilities.alimiter) {
    lines.push(`[${preMaster}]alimiter=limit=0.99[${masterLabel}]`);
  } else {
    lines.push(`[${preMaster}]volume=0.99[${masterLabel}]`);
  }

  return {
    script: lines.join(";\n"),
    masterLabel,
    stemLabels: {
      dialogue: dialogueLabel,
      music: musicLabel,
      sfx: sfxLabel
    }
  };
};

export const compileFilterGraph = (
  plan: SoundDesignPlan,
  options: {mode?: "master" | "preview" | "stems"} = {}
): SoundDesignFilterGraphCompilation => {
  const mode = options.mode ?? "master";
  const musicBus = buildTimelineBus({
    plan,
    cueType: "music"
  });
  const dialogueBus = buildDialogueBus(plan);
  const sfxBus = buildTimelineBus({
    plan,
    cueType: "sfx"
  });

  const masterGraphPieces: string[] = [...musicBus.lines, ...dialogueBus.lines, ...sfxBus.lines];
  const previewGraphPieces: string[] = [...musicBus.lines, ...dialogueBus.lines, ...sfxBus.lines];
  let dialogueMixLabel = dialogueBus.label;
  let dialogueFinalLabel = dialogueBus.label;
  let dialogueStemLabel = dialogueBus.label;
  if (dialogueBus.label) {
    dialogueMixLabel = `${dialogueBus.label}_mix`;
    if (mode === "stems") {
      dialogueStemLabel = `${dialogueBus.label}_stem`;
      masterGraphPieces.push(`[${dialogueBus.label}]asplit=2[${dialogueMixLabel}][${dialogueStemLabel}]`);
    } else {
      dialogueFinalLabel = `${dialogueBus.label}_final`;
      masterGraphPieces.push(`[${dialogueBus.label}]asplit=2[${dialogueMixLabel}][${dialogueFinalLabel}]`);
      previewGraphPieces.push(`[${dialogueBus.label}]asplit=2[${dialogueMixLabel}][${dialogueFinalLabel}]`);
    }
  }

  const duckedMusic = buildDuckedMusic({
    plan,
    musicLabel: musicBus.label,
    dialogueLabel: dialogueMixLabel,
    previewMode: false
  });
  const previewDuckedMusic = buildDuckedMusic({
    plan,
    musicLabel: musicBus.label,
    dialogueLabel: dialogueMixLabel,
    previewMode: true
  });

  if (duckedMusic.script) {
    masterGraphPieces.push(duckedMusic.script);
  }
  if (previewDuckedMusic.script) {
    previewGraphPieces.push(previewDuckedMusic.script);
  }

  const musicMixLabel =
    mode === "preview" ? previewDuckedMusic.label ?? musicBus.label : duckedMusic.label ?? musicBus.label;
  const sfxMixLabel = sfxBus.label;

  const masterMix =
    mode === "stems"
      ? {
          script: "",
          masterLabel: "stems_only",
          stemLabels: {
            dialogue: dialogueStemLabel,
            music: musicMixLabel,
            sfx: sfxMixLabel
          }
        }
      : buildFinalMix({
          plan,
          musicLabel: musicMixLabel,
          dialogueLabel: dialogueFinalLabel,
          sfxLabel: sfxMixLabel,
          previewMode: false
        });
  const previewMix =
    mode === "stems"
      ? {
          script: "",
          masterLabel: "stems_only_preview",
          stemLabels: {
            dialogue: dialogueStemLabel,
            music: musicMixLabel,
            sfx: sfxMixLabel
          }
        }
      : buildFinalMix({
          plan,
          musicLabel: musicMixLabel,
          dialogueLabel: dialogueFinalLabel,
          sfxLabel: sfxMixLabel,
          previewMode: true
        });

  if (mode !== "stems") {
    masterGraphPieces.push(masterMix.script);
    previewGraphPieces.push(previewMix.script);
  }

  const appliedPresets = [
    ...plan.musicCues.flatMap((cue) => [
      ...(cue.transitionIn ? [{cueId: cue.id, preset: cue.transitionIn.preset, phase: "in" as const}] : []),
      ...(cue.transitionOut ? [{cueId: cue.id, preset: cue.transitionOut.preset, phase: "out" as const}] : [])
    ]),
    ...plan.sfxCues.flatMap((cue) => [
      ...(cue.transitionIn ? [{cueId: cue.id, preset: cue.transitionIn.preset, phase: "in" as const}] : []),
      ...(cue.transitionOut ? [{cueId: cue.id, preset: cue.transitionOut.preset, phase: "out" as const}] : [])
    ])
  ];

  return {
    filterComplexScript: masterGraphPieces.join(";\n"),
    previewFilterComplexScript: previewGraphPieces.join(";\n"),
    inputFiles: plan.resolvedInputs.map((input) => input.path),
    masterLabel: masterMix.masterLabel,
    previewLabel: previewMix.masterLabel,
    stemLabels: {
      dialogue: dialogueStemLabel,
      music: musicMixLabel,
      sfx: sfxMixLabel
    },
    appliedPresets,
    debug: {
      cueCount: plan.musicCues.length + plan.sfxCues.length,
      dialogueSpanCount: plan.dialogueSpans.length,
      musicMode: musicBus.notes.some((note) => note.includes("acrossfade")) ? "acrossfade" : "amix",
      notes: [...musicBus.notes, ...dialogueBus.notes, ...sfxBus.notes, ...duckedMusic.notes, ...previewDuckedMusic.notes],
      inputFiles: plan.resolvedInputs.map((input) => ({
        index: input.index,
        role: input.role,
        path: input.path
      }))
    }
  };
};
