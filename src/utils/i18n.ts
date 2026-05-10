type Lang = 'fr' | 'jp';

const translations: Record<string, Record<Lang, string>> = {
  // Modération
  'mod.ban.success': {
    fr: '🔨 **{user}** a été banni. Raison : {reason}',
    jp: '🔨 **{user}** がBANされました。理由：{reason}',
  },
  'mod.ban.dm': {
    fr: 'Vous avez été banni de **{guild}**. Raison : {reason}',
    jp: '**{guild}** からBANされました。理由：{reason}',
  },
  'mod.tempban.success': {
    fr: '⏳ **{user}** a été banni temporairement pour {duration}. Raison : {reason}',
    jp: '⏳ **{user}** が{duration}間一時BANされました。理由：{reason}',
  },
  'mod.kick.success': {
    fr: '👢 **{user}** a été expulsé. Raison : {reason}',
    jp: '👢 **{user}** がキックされました。理由：{reason}',
  },
  'mod.mute.success': {
    fr: '🔇 **{user}** a été mis en sourdine pour {duration}. Raison : {reason}',
    jp: '🔇 **{user}** が{duration}間ミュートされました。理由：{reason}',
  },
  'mod.unmute.success': {
    fr: '🔊 **{user}** a été démute.',
    jp: '🔊 **{user}** のミュートが解除されました。',
  },
  'mod.warn.success': {
    fr: '⚠️ **{user}** a reçu un avertissement. Raison : {reason}',
    jp: '⚠️ **{user}** に警告が与えられました。理由：{reason}',
  },
  'mod.no_permission': {
    fr: '❌ Vous n\'avez pas la permission d\'effectuer cette action.',
    jp: '❌ この操作を行う権限がありません。',
  },
  'mod.user_not_found': {
    fr: '❌ Utilisateur introuvable.',
    jp: '❌ ユーザーが見つかりません。',
  },
  'mod.higher_role': {
    fr: '❌ Vous ne pouvez pas sanctionner un membre avec un rôle supérieur ou égal au vôtre.',
    jp: '❌ 自分と同等以上のロールを持つメンバーを制裁することはできません。',
  },

  // Bienvenue
  'welcome.default': {
    fr: 'Bienvenue sur **{guild}**, {user} ! 🎉',
    jp: '**{guild}** へようこそ、{user} ！🎉',
  },

  // Événements
  'event.reminder': {
    fr: '⏰ L\'animation **{title}** commence dans 10 minutes !',
    jp: '⏰ イベント **{title}** が10分後に始まります！',
  },
  'event.created': {
    fr: '✅ Animation **{title}** créée pour le {date}.',
    jp: '✅ イベント **{title}** が{date}に作成されました。',
  },
  'event.not_found': {
    fr: '❌ Événement introuvable.',
    jp: '❌ イベントが見つかりません。',
  },

  // Jeux
  'game.shiritori.start': {
    fr: '🎮 Partie de Shiritori lancée ! Je commence : **{word}**\nVotre tour !',
    jp: '🎮 しりとり開始！私から：**{word}**\nあなたの番！',
  },
  'game.shiritori.invalid': {
    fr: '❌ Mot invalide ! Le mot doit commencer par **{char}**.',
    jp: '❌ 無効な言葉！**{char}**から始まる言葉を入力してください。',
  },
  'game.shiritori.repeated': {
    fr: '❌ Ce mot a déjà été utilisé !',
    jp: '❌ その言葉はすでに使われました！',
  },
  'game.shiritori.n_end': {
    fr: '💀 Le mot se termine par ん ! Vous perdez !',
    jp: '💀 「ん」で終わりました！あなたの負けです！',
  },
  'game.shiritori.end': {
    fr: '🏁 Partie terminée !',
    jp: '🏁 ゲーム終了！',
  },

  // Général
  'error.generic': {
    fr: '❌ Une erreur est survenue. Veuillez réessayer.',
    jp: '❌ エラーが発生しました。もう一度お試しください。',
  },
  'error.bot_missing_perms': {
    fr: '❌ Je n\'ai pas les permissions nécessaires pour effectuer cette action.',
    jp: '❌ この操作を実行するための権限がありません。',
  },
};

export function t(key: string, lang: Lang = 'fr', vars: Record<string, string> = {}): string {
  const translation = translations[key]?.[lang] ?? translations[key]?.['fr'] ?? key;
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    translation
  );
}

export type { Lang };
