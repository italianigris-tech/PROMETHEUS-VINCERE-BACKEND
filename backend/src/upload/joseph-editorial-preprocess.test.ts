import {describe, expect, it} from "vitest";
import {
  buildEditorialFfmpegArgs,
  buildJosephEditorialPlan,
  remapJosephTranscript,
  type JosephEditorialTranscript,
} from "./joseph-editorial-preprocess";

const word = (text: string, startMs: number, endMs: number) => ({text, startMs, endMs, confidence: 0.99});

const rawTranscript = (): JosephEditorialTranscript => {
  const words = [
    word("Over", 800, 1000),
    word("12,000", 1000, 1800),
    word("products", 1800, 3000),
    word("for", 3000, 5200),
    word("six", 5200, 7000),
    word("figures", 7000, 9000),
    word("in", 9000, 9800),
    word("profit", 9800, 10_520),
    word("And", 10_520, 10_800),
    word("the", 10_800, 11_100),
    word("best", 11_100, 11_500),
    word("part", 11_500, 11_900),
    word("is", 11_900, 12_100),
    word("from", 12_100, 12_600),
    word("home", 12_600, 13_280),
    word("Sometimes", 13_280, 14_000),
    word("pajamas", 14_000, 16_880),
    word("The", 16_960, 17_200),
    word("point", 17_200, 18_000),
    word("is", 18_000, 19_500),
    word("choice", 19_500, 21_000),
    word("was", 21_000, 22_000),
    word("mine", 22_000, 24_000),
    word("sunshine", 24_000, 25_500),
    word("and", 25_500, 26_000),
    word("rainbows", 26_000, 28_320),
    word("While", 28_710, 29_200),
    word("business", 29_200, 31_000),
    word("was", 31_000, 32_000),
    word("gratifying", 32_000, 34_000),
    word("and", 34_000, 36_000),
    word("driving", 36_000, 38_000),
    word("me", 38_000, 39_000),
    word("nuts", 39_000, 40_550),
    word("And", 46_710, 47_000),
    word("guess", 47_000, 47_500),
    word("what", 47_500, 48_000),
    word("fault", 48_000, 49_000),
    word("no", 49_000, 50_000),
    word("system", 50_000, 51_000),
    word("for", 51_000, 52_000),
    word("this", 52_000, 53_000),
    word("model", 53_000, 55_430),
  ];
  return {
    words,
    phrases: [],
    beats: Array.from({length: 123}, (_, index) => index * 500),
    onsets: words.map((item) => item.startMs),
    energyCurve: [0.42, 0.68, 0.78, 0.55, 0.74, 0.62],
    durationMs: 61_172,
    source: "assemblyai",
    warnings: [],
    trainableForIrl: true,
  };
};

describe("Joseph editorial preprocessing", () => {
  it("selects a narrative arc and remaps speech into the derived timeline", () => {
    const transcript = rawTranscript();
    const plan = buildJosephEditorialPlan(transcript);
    const remapped = remapJosephTranscript(transcript, plan);

    expect(plan.version).toBe("joseph-editorial-v1");
    expect(plan.segments.map((segment) => segment.role)).toEqual([
      "hook",
      "benefit",
      "reversal",
      "pain",
      "payoff",
    ]);
    expect(plan.segments.length).toBe(5);
    expect(plan.outputDurationMs).toBe(44_400);
    expect(remapped.durationMs).toBe(plan.outputDurationMs);
    expect(remapped.words.some((item) => item.text.toLowerCase() === "pajamas")).toBe(false);
    expect(remapped.words.every((item) => item.endMs <= remapped.durationMs)).toBe(true);
    expect(remapped.words.some((item) => item.text.toLowerCase() === "guess")).toBe(true);
  });

  it("builds an explicit video-and-audio concat graph without a shell command", () => {
    const plan = buildJosephEditorialPlan(rawTranscript());
    const args = buildEditorialFfmpegArgs("C:/raw input.mp4", "C:/derived output.mp4", plan);

    expect(args).toContain("-filter_complex");
    expect(args.join(" ")).toContain("concat=n=5:v=1:a=1");
    expect(args.filter((arg) => arg === "-i")).toHaveLength(1);
    expect(args).toContain("C:/raw input.mp4");
    expect(args).toContain("C:/derived output.mp4");
  });
});
