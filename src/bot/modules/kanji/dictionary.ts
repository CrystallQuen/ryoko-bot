import { EmbedBuilder } from 'discord.js';
import { logger } from '../../../utils/logger';

interface KanjiApiData {
  kanji: string;
  grade?: number;
  stroke_count: number;
  meanings: string[];
  kun_readings: string[];
  on_readings: string[];
  jlpt?: number;
}

interface JishoWord {
  japanese: { word?: string; reading: string }[];
  senses: { english_definitions: string[] }[];
}

async function fetchKanjiData(kanji: string): Promise<KanjiApiData | null> {
  try {
    const res = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`, {
      headers: { 'User-Agent': 'RyokoBot/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<KanjiApiData>;
  } catch (err) {
    logger.warn('fetchKanjiData échoué', { kanji, err });
    return null;
  }
}

async function fetchWordExamples(kanji: string): Promise<JishoWord[]> {
  try {
    const res = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(kanji)}`,
      { headers: { 'User-Agent': 'RyokoBot/1.0' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data: JishoWord[] };
    return data.data?.slice(0, 8) ?? [];
  } catch (err) {
    logger.warn('fetchWordExamples échoué', { kanji, err });
    return [];
  }
}

export async function buildDictionaryEmbed(kanji: string): Promise<EmbedBuilder | null> {
  if ([...kanji].length !== 1) return null;

  const [info, words] = await Promise.all([fetchKanjiData(kanji), fetchWordExamples(kanji)]);
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

  const examples = words
    .filter((w) => {
      const jp = w.japanese[0];
      return jp?.word && jp.word.includes(kanji);
    })
    .slice(0, 5)
    .map((w) => {
      const jp = w.japanese[0];
      const word = jp.word!;
      const reading = jp.reading;
      const def = w.senses[0]?.english_definitions.slice(0, 3).join(', ') ?? '';
      return `**${word}**（${reading}）\n${def}`;
    })
    .join('\n\n');

  if (examples) {
    embed.addFields({ name: 'Exemples de mots', value: examples });
  }

  embed.setFooter({ text: 'Source : kanjiapi.dev • jisho.org' }).setTimestamp();

  return embed;
}
