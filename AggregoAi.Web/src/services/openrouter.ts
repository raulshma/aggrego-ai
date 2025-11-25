import type { OpenRouterModel, OpenRouterModelsResponse, GroupedModels } from '../types/openrouter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/models';

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(OPENROUTER_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }
  const data: OpenRouterModelsResponse = await response.json();
  return data.data;
}

export function groupModelsByPricing(models: OpenRouterModel[]): GroupedModels {
  const free: OpenRouterModel[] = [];
  const paid: OpenRouterModel[] = [];

  for (const model of models) {
    const promptPrice = parseFloat(model.pricing.prompt);
    const completionPrice = parseFloat(model.pricing.completion);
    
    if (promptPrice === 0 && completionPrice === 0) {
      free.push(model);
    } else {
      paid.push(model);
    }
  }

  // Sort alphabetically by name within each group
  free.sort((a, b) => a.name.localeCompare(b.name));
  paid.sort((a, b) => a.name.localeCompare(b.name));

  return { free, paid };
}

export function formatPrice(pricePerToken: string): string {
  const price = parseFloat(pricePerToken);
  if (price === 0) return 'Free';
  // Price is per token, convert to per 1M tokens for readability
  const perMillion = price * 1_000_000;
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/1M`;
  return `$${perMillion.toFixed(2)}/1M`;
}

export function formatContextLength(length: number): string {
  if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(1)}M`;
  if (length >= 1_000) return `${(length / 1_000).toFixed(0)}K`;
  return String(length);
}
