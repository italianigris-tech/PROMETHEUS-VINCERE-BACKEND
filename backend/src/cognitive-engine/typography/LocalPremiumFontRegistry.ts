export type LocalPremiumFontRecord = {
  familyId: string;
  familyName: string;
  publicUrls: string[];
  tags: string[];
  role: "display" | "support" | "accent";
};

export class LocalPremiumFontRegistry {
  constructor(private readonly records: LocalPremiumFontRecord[]) {}

  findByIntent(intentTags: string[], role: LocalPremiumFontRecord["role"]): LocalPremiumFontRecord | null {
    const requestedTags = new Set(intentTags.map((tag) => tag.toLowerCase()));

    return [...this.records]
      .filter((record) => record.role === role && record.publicUrls.length > 0)
      .sort((left, right) => {
        const leftScore = left.tags.filter((tag) => requestedTags.has(tag.toLowerCase())).length;
        const rightScore = right.tags.filter((tag) => requestedTags.has(tag.toLowerCase())).length;
        return rightScore - leftScore || left.familyName.localeCompare(right.familyName);
      })[0] ?? null;
  }
}

export const createDefaultLocalPremiumFontRegistry = (): LocalPremiumFontRegistry =>
  new LocalPremiumFontRegistry([
    {
      familyId: "local_aesthetic",
      familyName: "Aesthetic",
      publicUrls: ["/fonts/library/aesthetic/aesthetic-regular-b3500383bd34.woff2"],
      tags: ["cinematic", "editorial", "premium"],
      role: "display"
    },
    {
      familyId: "local_blaak",
      familyName: "Blaak Regular PERSONAL USE",
      publicUrls: ["/fonts/library/blaak-regular-personal-use/blaakregularpersonaluse_340f521592a87.woff2"],
      tags: ["editorial", "luxury", "serif"],
      role: "display"
    },
    {
      familyId: "local_ageya",
      familyName: "Ageya",
      publicUrls: ["/fonts/library/ageya/ageya-regular_a3a8589923f6.woff2"],
      tags: ["cinematic", "support", "readable"],
      role: "support"
    }
  ]);
