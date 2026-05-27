export type VariationGenome = {
  id: string;
  intensity: number;
  visualDensity: number;
  motionEnergy: number;
  editorialNovelty: number;
  fitness: number;
};

export type ArchiveCellKey = `${number}:${number}:${number}:${number}`;

export type MapElitesArchive = {
  cells: Record<ArchiveCellKey, VariationGenome>;
  dimensions: ["intensity", "visualDensity", "motionEnergy", "editorialNovelty"];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const bucket = (value: number): number => Math.min(4, Math.max(0, Math.floor(clamp01(value) * 5)));

const cellKey = (genome: VariationGenome): ArchiveCellKey => {
  return `${bucket(genome.intensity)}:${bucket(genome.visualDensity)}:${bucket(genome.motionEnergy)}:${bucket(genome.editorialNovelty)}`;
};

export const buildMapElitesArchive = (genomes: VariationGenome[]): MapElitesArchive => {
  const cells: Record<string, VariationGenome> = {};

  for (const genome of genomes) {
    const key = cellKey(genome);
    const current = cells[key];
    if (!current || genome.fitness > current.fitness) {
      cells[key] = {
        ...genome,
        intensity: clamp01(genome.intensity),
        visualDensity: clamp01(genome.visualDensity),
        motionEnergy: clamp01(genome.motionEnergy),
        editorialNovelty: clamp01(genome.editorialNovelty),
        fitness: clamp01(genome.fitness)
      };
    }
  }

  return {
    cells: cells as Record<ArchiveCellKey, VariationGenome>,
    dimensions: ["intensity", "visualDensity", "motionEnergy", "editorialNovelty"]
  };
};

export const selectControlledVariations = ({
  archive,
  limit,
  maxChaos = 0.72
}: {
  archive: MapElitesArchive;
  limit: number;
  maxChaos?: number;
}): VariationGenome[] => {
  return Object.values(archive.cells)
    .filter((genome) => genome.editorialNovelty <= maxChaos)
    .sort((left, right) => right.fitness - left.fitness || left.id.localeCompare(right.id))
    .slice(0, limit);
};
