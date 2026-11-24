import { EmbedBuilder } from 'discord.js';

export const VEYRA_BLUE = 0x3b82f6;

export function createVeyraEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(VEYRA_BLUE)
    .setTitle(title)
    .setFooter({ text: 'Veyra Market Intelligence · Institutional FX & Crypto' })
    .setTimestamp();
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}

export function formatSignedPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  const arrow = value >= 0 ? '▲' : '▼';
  return `${arrow} ${sign}${value.toFixed(2)}%`;
}
