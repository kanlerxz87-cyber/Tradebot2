import type { TopicId } from '../types/kalshi';

export interface TopicDefinition {
  id: TopicId;
  label: string;
  shortLabel: string;
  description: string;
  eyebrow: string;
  accent: string;
  categoryTerms: string[];
  titleTerms: RegExp;
}

export const TOPICS: TopicDefinition[] = [
  {
    id: 'gas-prices',
    label: 'Gas prices',
    shortLabel: 'Gas',
    eyebrow: 'Energy watch',
    description: 'Gasoline, diesel, crude oil, and energy-price contracts.',
    accent: '#f4b860',
    categoryTerms: ['economics', 'financials', 'climate and weather', 'energy'],
    titleTerms: /\b(gas|gasoline|diesel|crude|oil|petroleum|brent|wti|fuel|energy price)\b/i,
  },
  {
    id: 'elections',
    label: 'Elections',
    shortLabel: 'Elections',
    eyebrow: 'Civic watch',
    description: 'Election, ballot, office, candidate, and voting contracts.',
    accent: '#7bc8f6',
    categoryTerms: ['elections'],
    titleTerms: /\b(election|electoral|ballot|vote|voting|president|presidential|senate|senator|congress|governor|mayor|primary|nominee|nomination)\b/i,
  },
  {
    id: 'culture',
    label: 'Culture',
    shortLabel: 'Culture',
    eyebrow: 'Culture watch',
    description: 'Film, music, awards, media, and popular-culture contracts.',
    accent: '#eaa8ff',
    categoryTerms: ['culture', 'entertainment'],
    titleTerms: /\b(oscar|academy awards?|grammys?|emmys?|film|movie|music|album|song|box office|television|tv show|celebrity|culture|awards?|best picture)\b/i,
  },
  {
    id: 'crypto',
    label: 'Crypto',
    shortLabel: 'Crypto',
    eyebrow: 'Digital assets',
    description: 'Bitcoin, Ether, digital-asset, and crypto-policy contracts.',
    accent: '#a8f04f',
    categoryTerms: ['crypto'],
    titleTerms: /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|ether|eth|solana|sol|dogecoin|blockchain|stablecoin)\b/i,
  },
  {
    id: 'golf',
    label: 'Golf',
    shortLabel: 'Golf',
    eyebrow: 'Course watch',
    description: 'Professional golf tournaments, players, and tour contracts.',
    accent: '#63d7a1',
    categoryTerms: ['sports'],
    titleTerms: /\b(golf|golfer|pga|lpga|masters|ryder cup|presidents cup|fedex cup|open championship|u\.s\. open)\b/i,
  },
];

export const TOPIC_BY_ID = Object.fromEntries(
  TOPICS.map((topic) => [topic.id, topic]),
) as Record<TopicId, TopicDefinition>;

/**
 * Dashboard classification is intentionally rule-based and auditable. Kalshi's
 * API-provided category is checked first, but broad categories (for example,
 * Sports) must also match the title so unrelated markets are not included.
 */
export function classifyTopic(title: string, category?: string): TopicId | null {
  const normalizedCategory = (category ?? '').trim().toLowerCase();
  const normalizedTitle = title.trim();

  for (const topic of TOPICS) {
    const titleMatches = topic.titleTerms.test(normalizedTitle);
    const categoryMatches = topic.categoryTerms.includes(normalizedCategory);

    // Economics and Sports are broad official categories, so gas and golf
    // require title evidence. The other configured categories are specific.
    if (topic.id === 'golf' || topic.id === 'gas-prices') {
      if (titleMatches) return topic.id;
      continue;
    }

    if (categoryMatches || titleMatches) return topic.id;
  }

  return null;
}

export function isTopicId(value: string): value is TopicId {
  return TOPICS.some((topic) => topic.id === value);
}
