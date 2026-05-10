/**
 * Convertit une chaîne de durée (ex: "1h30m", "2d", "30s") en secondes.
 */
export function parseDuration(str: string): number | null {
  const regex = /(\d+)\s*(s|sec|m|min|h|hr|d|day|w|week)/gi;
  let total = 0;
  let matched = false;

  for (const match of str.matchAll(regex)) {
    matched = true;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's': case 'sec': total += value; break;
      case 'm': case 'min': total += value * 60; break;
      case 'h': case 'hr': total += value * 3600; break;
      case 'd': case 'day': total += value * 86400; break;
      case 'w': case 'week': total += value * 604800; break;
    }
  }

  return matched ? total : null;
}

/**
 * Formate une durée en secondes en chaîne lisible.
 */
export function formatDuration(seconds: number, lang: 'fr' | 'jp' = 'fr'): string {
  const labels = {
    fr: { w: 'semaine(s)', d: 'jour(s)', h: 'heure(s)', m: 'minute(s)', s: 'seconde(s)' },
    jp: { w: '週間', d: '日', h: '時間', m: '分', s: '秒' },
  };
  const l = labels[lang];
  const parts: string[] = [];

  const weeks = Math.floor(seconds / 604800); seconds %= 604800;
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;

  if (weeks) parts.push(`${weeks} ${l.w}`);
  if (days) parts.push(`${days} ${l.d}`);
  if (hours) parts.push(`${hours} ${l.h}`);
  if (minutes) parts.push(`${minutes} ${l.m}`);
  if (seconds) parts.push(`${seconds} ${l.s}`);

  return parts.join(', ') || `0 ${l.s}`;
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
