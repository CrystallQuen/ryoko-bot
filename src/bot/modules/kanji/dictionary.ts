import { EmbedBuilder } from 'discord.js';
import { logger } from '../../../utils/logger';

// ── kanjiapi.dev ─────────────────────────────────────────────────────────────

interface KanjiApiData {
  kanji: string;
  stroke_count: number;
  meanings: string[];
  kun_readings: string[];
  on_readings: string[];
  jlpt?: number;
  grade?: number;
}

interface KanjiApiWord {
  meanings: { glosses: string[] }[];
  variants: { written: string; pronounced: string; priorities: string[] }[];
}

// ── Jotoba ───────────────────────────────────────────────────────────────────

interface JotobaSense {
  glosses: string[];
  language: string;
}

interface JotobaWord {
  reading: { kana: string; kanji?: string };
  senses: JotobaSense[];
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchKanjiInfo(kanji: string): Promise<KanjiApiData | null> {
  try {
    const res = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<KanjiApiData>;
  } catch (err) {
    logger.warn('fetchKanjiInfo échoué', { kanji, err });
    return null;
  }
}

async function fetchWordList(kanji: string): Promise<KanjiApiWord[]> {
  try {
    const res = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(kanji)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return res.json() as Promise<KanjiApiWord[]>;
  } catch (err) {
    logger.warn('fetchWordList échoué', { kanji, err });
    return [];
  }
}

async function fetchJotobaFrench(word: string): Promise<string | null> {
  try {
    const res = await fetch('https://jotoba.de/api/search/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: word, language: 'French', no_english: false }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { words: JotobaWord[] };
    const match = data.words?.find(
      (w) => w.reading.kanji === word || w.reading.kana === word
    );
    if (!match) return null;
    const frSense = match.senses.find((s) => s.language === 'French');
    return frSense?.glosses.slice(0, 3).join(', ') ?? null;
  } catch {
    return null;
  }
}

// ── Embed builder ─────────────────────────────────────────────────────────────

export async function buildDictionaryEmbed(kanji: string): Promise<EmbedBuilder | null> {
  if ([...kanji].length !== 1) return null;

  const [info, wordList] = await Promise.all([fetchKanjiInfo(kanji), fetchWordList(kanji)]);
  if (!info) return null;

  const kun = info.kun_readings.length ? info.kun_readings.join('、') : '—';
  const on = info.on_readings.length ? info.on_readings.join('、') : '—';
  const meaning = info.meanings.length ? info.meanings.join(', ') : '—';
  const jlpt = info.jlpt ? `N${info.jlpt}` : '—';

  const embed = new EmbedBuilder()
    .setColor('#4a90d9')
    .setTitle(`KANJI — ${kanji}`)
    .addFields(
      { name: 'Kunyomi', value: kun, inline: true },
      { name: 'Onyomi', value: on, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Nombre de traits', value: `${info.stroke_count}`, inline: true },
      { name: 'Niveau JLPT', value: jlpt, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Signification', value: meaning },
    );

  // Sélectionne les mots les plus courants contenant le kanji
  const topWords = wordList
    .filter((w) => w.variants.some((v) => v.written.includes(kanji) && v.priorities.length > 0))
    .slice(0, 5);

  if (topWords.length > 0) {
    // Récupère les traductions françaises en parallèle via Jotoba
    const translations = await Promise.all(
      topWords.map(async (w) => {
        const variant = w.variants.find((v) => v.written.includes(kanji) && v.priorities.length > 0)!;
        const frGloss = await fetchJotobaFrench(variant.written);
        // Fallback sur la définition anglaise de kanjiapi.dev si Jotoba n'a pas de traduction FR
        const gloss = frGloss ?? w.meanings[0]?.glosses.slice(0, 3).join(', ') ?? '';
        return `**${variant.written}**（${variant.pronounced}）\n${gloss}`;
      })
    );

    embed.addFields({ name: 'Mots exemples', value: translations.join('\n\n') });
  }

  embed.setFooter({ text: 'Source : kanjiapi.dev • jotoba.de' }).setTimestamp();
  return embed;
}
