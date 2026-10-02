// Plain-language rule titles, read at build time from the engine's rules-meta/<ID>.json files.
const metas = import.meta.glob<{ id?: string; title?: string }>('../../../engine/rules-meta/*.json', {
  eager: true,
  import: 'default',
});

export const RULE_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(metas)
    .filter((m): m is { id: string; title: string } => typeof m?.id === 'string' && typeof m.title === 'string')
    .map((m) => [m.id, m.title]),
);

export function ruleTitle(id: string): string {
  return RULE_TITLES[id] ?? id;
}
