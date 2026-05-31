import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readObservationStore } from "@/lib/observations";
import { searchPokemonCardNames, searchPokemonSetNames } from "@/lib/providers/pokemonTcg";
import { readAllSnapshots } from "@/lib/snapshots";
import type { SearchSuggestion } from "@/types/market";

type SuggestionField = "card" | "set" | "variant";

interface SuggestionCache {
  entries: Record<string, { fetchedAt: string; values: string[] }>;
}

const dataDirectory = path.join(process.cwd(), ".local-data");
const suggestionFile = path.join(dataDirectory, "search-suggestions.json");
const cacheTtlMs = 24 * 60 * 60 * 1000;

const variantSuggestions = [
  "holo",
  "reverse holo",
  "raw",
  "near mint",
  "1st edition",
  "unlimited",
  "shadowless",
  "PSA 9",
  "PSA 10",
  "CGC 9",
  "BGS 9"
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function cacheKey(field: SuggestionField, q: string) {
  return `${field}:${normalize(q)}`;
}

async function readCache(): Promise<SuggestionCache> {
  try {
    const parsed = JSON.parse(await readFile(suggestionFile, "utf8")) as Partial<SuggestionCache>;
    return { entries: parsed.entries ?? {} };
  } catch {
    return { entries: {} };
  }
}

async function writeCache(cache: SuggestionCache) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(suggestionFile, JSON.stringify(cache, null, 2), "utf8");
}

function matches(value: string, q: string) {
  return normalize(value).includes(normalize(q));
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function recentSuggestions(field: SuggestionField, q: string): Promise<SearchSuggestion[]> {
  const snapshots = await readAllSnapshots();
  const captures = (await readObservationStore()).captures;
  const values = field === "card"
    ? [
      ...snapshots.map((snapshot) => snapshot.cardName),
      ...captures.map((capture) => capture.query.q)
    ]
    : field === "set"
      ? [
        ...snapshots.map((snapshot) => snapshot.setName),
        ...captures.map((capture) => capture.query.set ?? "")
      ]
      : [
        ...captures.map((capture) => capture.query.variant ?? ""),
        ...captures.map((capture) => capture.query.condition ?? ""),
        ...captures.map((capture) => capture.query.grade ?? "")
      ];

  return unique(values)
    .filter((value) => matches(value, q))
    .slice(0, 8)
    .map((value) => ({ value, source: "recent-search" as const }));
}

async function providerValues(field: SuggestionField, q: string) {
  if (field === "variant") return variantSuggestions.filter((value) => matches(value, q));

  const cache = await readCache();
  const key = cacheKey(field, q);
  const cached = cache.entries[key];
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < cacheTtlMs) {
    return cached.values;
  }

  const values = field === "card"
    ? await searchPokemonCardNames(q)
    : await searchPokemonSetNames(q);
  cache.entries[key] = { fetchedAt: new Date().toISOString(), values };
  await writeCache(cache);
  return values;
}

export async function getSearchSuggestions(field: SuggestionField, q: string): Promise<SearchSuggestion[]> {
  const trimmed = q.trim();
  const [recent, provider] = await Promise.all([
    recentSuggestions(field, trimmed),
    providerValues(field, trimmed)
  ]);

  const providerSource = field === "variant" ? "variant" : "pokemon-tcg";
  const suggestions = [
    ...recent,
    ...provider.map((value) => ({ value, source: providerSource as SearchSuggestion["source"] }))
  ];

  const seen = new Set<string>();
  return suggestions
    .filter((suggestion) => {
      const key = normalize(suggestion.value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}
