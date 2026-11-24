import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { createVeyraEmbed, formatSignedPct } from './utils/embeds.js';

const VEYRA_API_BASE = (process.env.VEYRA_API_URL || 'https://veyra-global.vercel.app').replace(/\/$/, '');
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('View current cryptocurrency price and 24h change')
    .addStringOption((opt) =>
      opt.setName('symbol').setDescription('Crypto symbol (e.g. BTC, ETH, SOL)').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Convert fiat currencies with live institutional rates')
    .addStringOption((opt) => opt.setName('from').setDescription('Base currency (e.g. USD)').setRequired(true))
    .addStringOption((opt) => opt.setName('to').setDescription('Target currency (e.g. EUR, INR)').setRequired(true))
    .addNumberOption((opt) => opt.setName('amount').setDescription('Amount to convert (defaults to 1)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('top')
    .setDescription('View today’s top market movers')
    .addIntegerOption((opt) =>
      opt.setName('count').setDescription('Number of movers (1-10)').setMinValue(1).setMaxValue(10)
    ),
  new SlashCommandBuilder()
    .setName('sentiment')
    .setDescription('View current Crypto Fear & Greed Index'),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top strongest currencies on the Veyra Strength Leaderboard')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Asset class')
        .addChoices({ name: 'Fiat Currencies', value: 'fiat' }, { name: 'Cryptocurrencies', value: 'crypto' })
    ),
  new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Show your linked Veyra watchlist assets'),
  new SlashCommandBuilder()
    .setName('alert')
    .setDescription('Configure a price alert on your linked Veyra account')
    .addStringOption((opt) => opt.setName('symbol').setDescription('Asset symbol').setRequired(true))
    .addNumberOption((opt) => opt.setName('price').setDescription('Target price').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('direction')
        .setDescription('Trigger condition')
        .setRequired(true)
        .addChoices({ name: 'Above', value: 'above' }, { name: 'Below', value: 'below' })
    ),
  new SlashCommandBuilder()
    .setName('analyze')
    .setDescription('Request Veyra AI institutional market intelligence')
    .addStringOption((opt) => opt.setName('symbol').setDescription('Currency or crypto symbol (e.g. INR, USD, BTC)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your Veyra profile'),
];

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${VEYRA_API_BASE}${path}`, options);
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorJson.error || `Veyra API error (${res.status})`);
  }
  return (await res.json()) as T;
}

function makeProgressBar(value: number, max = 100, length = 12): string {
  const filled = Math.max(0, Math.min(length, Math.round((value / max) * length)));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  try {
    // ── /price <symbol> ───────────────────────────────────────────────────────
    if (interaction.commandName === 'price') {
      const symbol = interaction.options.getString('symbol', true).toUpperCase();
      const data = await fetchJson<{
        coins: Array<{
          symbol: string;
          name: string;
          current_price: number;
          price_change_percentage_24h: number;
          market_cap_rank: number;
          high_24h?: number;
          low_24h?: number;
        }>;
      }>('/api/market/crypto');

      const coin = data.coins.find((c) => c.symbol.toUpperCase() === symbol);
      if (!coin) {
        await interaction.editReply({
          embeds: [createVeyraEmbed('Asset Not Found', `No cached crypto asset matched **${symbol}** in the top tracked catalog.`)],
        });
        return;
      }

      const embed = createVeyraEmbed(`${coin.name} (${coin.symbol.toUpperCase()})`)
        .addFields(
          { name: 'Price (USD)', value: `$${coin.current_price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`, inline: true },
          { name: '24h Change', value: formatSignedPct(coin.price_change_percentage_24h), inline: true },
          { name: 'Market Rank', value: `#${coin.market_cap_rank}`, inline: true }
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Open Terminal')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/currencies/${coin.symbol.toUpperCase()}`),
        new ButtonBuilder()
          .setLabel('Global Heatmap')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/heatmap`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // ── /rate <from> <to> [amount] ────────────────────────────────────────────
    if (interaction.commandName === 'rate') {
      const from = interaction.options.getString('from', true).toUpperCase();
      const to = interaction.options.getString('to', true).toUpperCase();
      const amount = interaction.options.getNumber('amount') ?? 1;

      const data = await fetchJson<{ rates: Record<string, number> }>('/api/market/fiat');
      const fromRate = data.rates[from];
      const toRate = data.rates[to];

      if (!fromRate || !toRate) {
        await interaction.editReply({
          embeds: [createVeyraEmbed('Rate Unavailable', `Unsupported currency pair **${from}/${to}**. Verify symbols against tracked global fiat currencies.`)],
        });
        return;
      }

      const converted = (amount / fromRate) * toRate;
      const unitRate = toRate / fromRate;

      const embed = createVeyraEmbed(`${from} → ${to} Exchange Rate`)
        .addFields(
          { name: 'Input', value: `${amount.toLocaleString()} ${from}`, inline: true },
          { name: 'Converted Amount', value: `**${converted.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${to}**`, inline: true },
          { name: '1 ' + from + ' =', value: `${unitRate.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${to}`, inline: true }
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Currency Converter')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/converter`),
        new ButtonBuilder()
          .setLabel('Live Terminal')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // ── /sentiment ───────────────────────────────────────────────────────────
    if (interaction.commandName === 'sentiment') {
      const data = await fetchJson<{ current: { value: number; classification: string } }>('/api/market/fear-greed');
      const score = data.current.value;
      const bar = makeProgressBar(score, 100, 14);

      const embed = createVeyraEmbed('Crypto Fear & Greed Index')
        .setDescription(`\`[${bar}]\` **${score} / 100**\n\nCurrent Sentiment: **${data.current.classification}**`)
        .addFields(
          { name: 'Score', value: `${score}/100`, inline: true },
          { name: 'Classification', value: data.current.classification, inline: true }
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Open Market Overview')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard`),
        new ButtonBuilder()
          .setLabel('Global Heatmap')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/heatmap`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // ── /leaderboard [type] ───────────────────────────────────────────────────
    if (interaction.commandName === 'leaderboard') {
      const assetType = interaction.options.getString('type') || 'fiat';
      const data = await fetchJson<{
        fiat: Array<{ code: string; name: string; strengthScore: number; change24h: number }>;
        crypto: Array<{ code: string; name: string; strengthScore: number; change24h: number }>;
      }>('/api/market/strength');

      const rows = (assetType === 'crypto' ? data.crypto : data.fiat).slice(0, 8);
      const lines = rows.map(
        (r, i) => `\`#${i + 1}\` **${r.code}** (${r.name}) — Score **${r.strengthScore.toFixed(1)}/100** (${formatSignedPct(r.change24h)})`
      );

      const embed = createVeyraEmbed(
        `Veyra Relative Strength Leaderboard (${assetType === 'crypto' ? 'Crypto' : 'Fiat'})`,
        lines.join('\n')
      );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Full Leaderboard')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/leaderboard`),
        new ButtonBuilder()
          .setLabel('Global Heatmap')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/heatmap`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // ── /top [count] ─────────────────────────────────────────────────────────
    if (interaction.commandName === 'top') {
      const count = interaction.options.getInteger('count') ?? 5;
      const data = await fetchJson<{
        coins: Array<{ symbol: string; name: string; current_price: number; price_change_percentage_24h: number }>;
      }>('/api/market/crypto');

      const sorted = [...data.coins].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, count);
      const lines = sorted.map(
        (c, i) => `\`#${i + 1}\` **${c.symbol.toUpperCase()}** ($${c.current_price.toLocaleString()}) · ${formatSignedPct(c.price_change_percentage_24h)}`
      );

      const embed = createVeyraEmbed(`Top Market Movers (24h)`, lines.join('\n'));

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Cryptocurrency Markets')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/crypto`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // ── /link ─────────────────────────────────────────────────────────────────
    if (interaction.commandName === 'link') {
      const embed = createVeyraEmbed(
        'Link Your Discord Account to Veyra',
        `Connect your Discord ID (\`${interaction.user.id}\`) with your Veyra account to access price alerts and your synced watchlist right inside Discord.\n\nClick the button below to open your settings.`
      );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Connect Discord in Settings')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/settings/discord`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // ── /watchlist ───────────────────────────────────────────────────────────
    if (interaction.commandName === 'watchlist') {
      try {
        const res = await fetchJson<{
          profile: { full_name: string | null; email: string };
          items: Array<{ symbol: string; asset_type: 'fiat' | 'crypto'; created_at: string }>;
        }>(`/api/bot/watchlist/${interaction.user.id}`);

        if (res.items.length === 0) {
          const embed = createVeyraEmbed(
            'Your Veyra Watchlist',
            `Your watchlist is currently empty.\n\nStar currencies or crypto assets in the terminal to see them here.`
          );
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('Explore Assets')
              .setStyle(ButtonStyle.Link)
              .setURL(`${VEYRA_API_BASE}/dashboard`)
          );
          await interaction.editReply({ embeds: [embed], components: [row] });
          return;
        }

        const lines = res.items.map((item, idx) => `\`#${idx + 1}\` **${item.symbol}** (${item.asset_type.toUpperCase()})`);

        const embed = createVeyraEmbed(
          `Your Veyra Watchlist (${res.items.length} assets)`,
          lines.join('\n')
        );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Manage Watchlist')
            .setStyle(ButtonStyle.Link)
            .setURL(`${VEYRA_API_BASE}/dashboard/watchlist`),
          new ButtonBuilder()
            .setLabel('Global Heatmap')
            .setStyle(ButtonStyle.Link)
            .setURL(`${VEYRA_API_BASE}/dashboard/heatmap`)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
        return;
      } catch {
        const embed = createVeyraEmbed(
          'Account Not Linked',
          `Your Discord account is not yet linked to Veyra.\n\nLink your account in **Settings → Discord** to access your watchlist here.`
        );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Link Discord Account')
            .setStyle(ButtonStyle.Link)
            .setURL(`${VEYRA_API_BASE}/dashboard/settings/discord`)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
        return;
      }
    }

    // ── /alert ───────────────────────────────────────────────────────────────
    if (interaction.commandName === 'alert') {
      const symbol = interaction.options.getString('symbol', true).toUpperCase();
      const price = interaction.options.getNumber('price', true);
      const direction = interaction.options.getString('direction', true);

      const embed = createVeyraEmbed(
        `Price Alert — ${symbol}`,
        `To configure alerts triggered via Discord, ensure your Discord ID is connected in your account settings.\n\nTarget: **${symbol} ${direction} ${price}**`
      );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Open Alerts Manager')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/alerts`),
        new ButtonBuilder()
          .setLabel('Link Settings')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/settings/discord`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // ── /analyze <symbol> ─────────────────────────────────────────────────────
    if (interaction.commandName === 'analyze') {
      const symbol = interaction.options.getString('symbol', true).toUpperCase();

      const data = await fetchJson<{
        symbol: string;
        analysis: string;
        asset?: {
          name: string;
          score: number;
          change24h: number;
          change7d: number;
          rate: number;
          isFiat: boolean;
        } | null;
        fearGreed: { value: number; classification: string };
      }>('/api/bot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });

      // Split analysis if it exceeds Discord's 4096 description limit
      const cleanAnalysis = data.analysis.length > 3900 ? data.analysis.slice(0, 3900) + '...' : data.analysis;

      const embed = createVeyraEmbed(`Veyra Market Intelligence — ${symbol}`, cleanAnalysis);

      if (data.asset) {
        embed.addFields(
          { name: 'Strength Score', value: `**${data.asset.score.toFixed(1)} / 100**`, inline: true },
          { name: '24h Momentum', value: formatSignedPct(data.asset.change24h), inline: true },
          { name: data.asset.isFiat ? 'Rate vs USD' : 'USD Price', value: data.asset.isFiat ? `${data.asset.rate}` : `$${data.asset.rate.toLocaleString()}`, inline: true }
        );
      }

      embed.addFields({
        name: 'Macro Fear & Greed',
        value: `${data.fearGreed.value}/100 (${data.fearGreed.classification})`,
        inline: true,
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Open Terminal')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/currencies/${symbol}`),
        new ButtonBuilder()
          .setLabel('Global Heatmap')
          .setStyle(ButtonStyle.Link)
          .setURL(`${VEYRA_API_BASE}/dashboard/heatmap`)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to complete request.';
    await interaction.editReply({
      embeds: [createVeyraEmbed('Service Notice', message)],
    });
  }
}

async function main() {
  if (!BOT_TOKEN || !CLIENT_ID) {
    console.error('Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in environment variables before launching the Veyra Discord bot.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log('Successfully registered Veyra Discord application slash commands.');
  } catch (err) {
    console.warn('Failed to refresh slash commands:', err);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('ready', () => {
    console.log(`Veyra Discord bot logged in as ${client.user?.tag}`);
  });
  client.on('interactionCreate', (interaction) => {
    if (interaction.isChatInputCommand()) {
      void handleCommand(interaction);
    }
  });

  await client.login(BOT_TOKEN);
}

void main();
