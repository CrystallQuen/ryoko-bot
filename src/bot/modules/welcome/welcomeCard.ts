import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import axios from 'axios';

interface WelcomeCardOptions {
  username: string;
  displayName: string;
  avatarUrl: string;
  guildName: string;
  memberCount: number;
  backgroundUrl?: string | null;
  accentColor?: string;
}

export async function generateWelcomeCard(options: WelcomeCardOptions): Promise<Buffer> {
  const W = 900;
  const H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // --- Background ---
  let backgroundLoaded = false;
  if (options.backgroundUrl) {
    try {
      const res = await axios.get(options.backgroundUrl, { responseType: 'arraybuffer', timeout: 5000 });
      const bg = await loadImage(Buffer.from(res.data as ArrayBuffer));
      // Cover-fit: scale to fill while preserving ratio
      const scale = Math.max(W / bg.width, H / bg.height);
      const bw = bg.width * scale;
      const bh = bg.height * scale;
      ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
      backgroundLoaded = true;
    } catch {
      // fall through to gradient
    }
  }

  if (!backgroundLoaded) {
    // Dark #7b2e2e-to-#d8695b gradient fallback
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2e1a1a');
    grad.addColorStop(0.5, '#3e1616');
    grad.addColorStop(1, '#600f0f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Dark overlay for readability ---
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, W, H);

  // --- Decorative left stripe ---
  const accent = options.accentColor ?? '#f25858';
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 6, H);

  // --- Avatar ---
  const AVATAR_R = 64; // radius
  const AVATAR_CX = 140;
  const AVATAR_CY = H / 2;

  // Glow ring
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R + 5, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();

  // White inner ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Avatar image clipped to circle
  try {
    const avatarRes = await axios.get(`${options.avatarUrl}?size=256`, {
      responseType: 'arraybuffer',
      timeout: 5000,
    });
    const avatarImg = await loadImage(Buffer.from(avatarRes.data as ArrayBuffer));
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, AVATAR_CX - AVATAR_R, AVATAR_CY - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2);
    ctx.restore();
  } catch {
    // Grey fallback circle if avatar fails
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R, 0, Math.PI * 2);
    ctx.fillStyle = '#2f3136';
    ctx.fill();
    ctx.restore();
  }

  // --- Text block ---
  const TX = AVATAR_CX + AVATAR_R + 36;
  const centerY = H / 2;

  // "Bienvenue !" — large white title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText('Bienvenue !', TX, centerY - 38);

  // Display name / username in accent color
  ctx.fillStyle = accent;
  ctx.font = 'bold 30px sans-serif';
  const nameLabel = options.displayName !== options.username
    ? `${options.displayName} (${options.username})`
    : options.username;
  // Clamp text so it doesn't overflow the card
  const maxNameWidth = W - TX - 20;
  ctx.fillText(clampText(ctx, nameLabel, maxNameWidth), TX, centerY + 8);

  // Subtle separator line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TX, centerY + 22);
  ctx.lineTo(W - 30, centerY + 22);
  ctx.stroke();

  // Member count + guild name
  ctx.fillStyle = '#b9bbbe';
  ctx.font = '22px sans-serif';
  ctx.fillText(`Membre #${options.memberCount.toLocaleString('fr-FR')} · ${options.guildName}`, TX, centerY + 52);

  return canvas.toBuffer('image/png');
}

function clampText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}
