// Ollama models suggested in setup. Sizes are the downloads listed on
// ollama.com (October 2026). minMemoryGB keeps the download to about a third
// of the computer's memory, leaving room for the system, Chrome and the app.
// Llama and Gemma answer directly; Qwen 3.5 can reason first, which Tenwise
// turns off (think: false), since reasoning makes summaries slow.
export const RECOMMENDED_MODELS = [
  { name: 'llama3.2:3b', label: 'Llama 3.2 3B', size: '2.0 GB', minMemoryGB: 8, note: 'Fastest' },
  { name: 'gemma3:4b', label: 'Gemma 3 4B', size: '3.4 GB', minMemoryGB: 16, note: 'Balanced' },
  { name: 'qwen3.5:4b', label: 'Qwen 3.5 4B', size: '4.0 GB', minMemoryGB: 16, note: 'Newest small model' },
  { name: 'gemma3:12b', label: 'Gemma 3 12B', size: '8.2 GB', minMemoryGB: 32, note: 'Best quality' },
];

/** Whether a suggested model suits a computer with `memoryGB` (unknown: yes). */
export const fitsMemory = (model, memoryGB) => !memoryGB || memoryGB >= model.minMemoryGB;

/**
 * The suggestion for this computer: the first model of the largest size that
 * fits its memory; the smallest when memory is unknown or below every size.
 */
export function recommendedModel(memoryGB, models = RECOMMENDED_MODELS) {
  if (!memoryGB) return models[0];
  const fitting = models.filter((m) => fitsMemory(m, memoryGB));
  if (fitting.length === 0) return models[0];
  const top = Math.max(...fitting.map((m) => m.minMemoryGB));
  return fitting.find((m) => m.minMemoryGB === top);
}
