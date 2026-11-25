import React from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, Info } from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { FearGreedGauge } from '../../components/ui/Primitives';

const SENTIMENT_BANDS = [
  { range: '0 – 24', label: 'Extreme Fear', tone: 'text-[#ef4444]', desc: 'Heightened risk aversion and heavy market stress; often reflects sharp sell-offs or defensive positioning.' },
  { range: '25 – 44', label: 'Fear', tone: 'text-amber-500', desc: 'Cautious investor mood with below-average momentum and elevated volatility.' },
  { range: '45 – 55', label: 'Neutral', tone: 'text-[#71717a] dark:text-[#a1a1aa]', desc: 'Balanced market participation without strong directional panic or euphoria.' },
  { range: '56 – 74', label: 'Greed', tone: 'text-[#3b82f6]', desc: 'Rising risk appetite, stronger inflows, and expanding upward momentum.' },
  { range: '75 – 100', label: 'Extreme Greed', tone: 'text-[#22c55e]', desc: 'Euphoric sentiment with stretched momentum and high speculative activity.' },
];

const METHODOLOGY_WEIGHTS = [
  { factor: 'Volatility', weight: '25%', detail: 'Compares current market volatility and maximum drawdowns against their 30-day and 90-day averages. Unusually high volatility pushes the score toward Fear.' },
  { factor: 'Market Momentum & Volume', weight: '25%', detail: 'Measures current trading volume and price momentum relative to 30-day and 90-day averages. Sustained buying volume pushes the score toward Greed.' },
  { factor: 'Social Discussion Velocity', weight: '15%', detail: 'Tracks the rate and tone of market-related social activity compared against historical baselines.' },
  { factor: 'Investor Surveys', weight: '15%', detail: 'Aggregates weekly sentiment polling across active market participants.' },
  { factor: 'Bitcoin Dominance', weight: '10%', detail: 'Monitors Bitcoin’s share of total crypto capitalization. Rising dominance often signals defensive rotation (Fear); falling dominance signals risk-on appetite (Greed).' },
  { factor: 'Search Trends', weight: '10%', detail: 'Analyzes changes in search query volume for market stress and buying-interest terms.' },
];

export function SentimentDetailPage() {
  const { fearGreed, theme } = useVeyra();
  const historyData = [...(fearGreed?.history || [])].reverse();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-2">
        <Link
          to="/dashboard/home"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525b] dark:text-[#a1a1aa] hover:text-[#3b82f6] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#09090b] dark:text-white">
          Market Sentiment Index
        </h1>
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">
          Daily 0–100 gauge summarizing risk appetite across digital asset markets, plus how the score is computed.
        </p>
      </div>

      {/* Current Reading + Scale */}
      <div className="grid md:grid-cols-12 gap-5">
        <div className="md:col-span-5 glass-surface p-6 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">Current Reading</p>
            {fearGreed ? (
              <div className="pt-2">
                <FearGreedGauge
                  value={fearGreed.current.value}
                  classification={fearGreed.current.classification}
                />
              </div>
            ) : (
              <p className="text-xs text-[#71717a]">Loading sentiment reading...</p>
            )}
          </div>
          {fearGreed?.current.timestamp && (
            <p className="text-[11px] font-mono-num text-[#71717a] dark:text-[#a1a1aa] border-t border-[#e4e4e7] dark:border-white/8 pt-3">
              Last updated: {new Date(fearGreed.current.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        <div className="md:col-span-7 glass-surface p-6 space-y-3">
          <h2 className="font-display text-base font-semibold text-[#09090b] dark:text-white">
            How to Read the 0–100 Score
          </h2>
          <div className="space-y-2">
            {SENTIMENT_BANDS.map((band) => (
              <div
                key={band.range}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-xs border-b last:border-b-0 border-[#e4e4e7]/70 dark:border-white/8 pb-2 last:pb-0"
              >
                <span className="font-mono-num font-semibold text-[#09090b] dark:text-white w-16 shrink-0">
                  {band.range}
                </span>
                <span className={`font-semibold w-28 shrink-0 ${band.tone}`}>{band.label}</span>
                <span className="text-[#52525b] dark:text-[#a1a1aa]">{band.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Historical Trend */}
      {historyData.length > 0 && (
        <div className="glass-surface p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#09090b] dark:text-white">
              Recent Sentiment Trend ({historyData.length} Days)
            </h2>
            <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
              Daily historical readings showing shifts between Fear and Greed.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e4e4e7'}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#52525b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#52525b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.12)' : '#e4e4e7',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: theme === 'dark' ? '#fafafa' : '#09090b',
                  }}
                  labelStyle={{ color: theme === 'dark' ? '#fafafa' : '#09090b', fontWeight: 600 }}
                  itemStyle={{ color: theme === 'dark' ? '#d4d4d8' : '#3f3f46' }}
                  formatter={(value: unknown, _name, props) => {
                    const cls = (props?.payload as { classification?: string } | undefined)?.classification;
                    return [`${Number(value)} / 100${cls ? ` (${cls})` : ''}`, 'Sentiment'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="#3b82f6"
                  fillOpacity={0.14}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* How the Number Is Calculated */}
      <div className="glass-surface p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-[#09090b] dark:text-white flex items-center gap-2">
            <Info className="h-4 w-4 text-[#3b82f6]" />
            <span>How the Number Comes Together</span>
          </h2>
          <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
            The index combines six market signals into a single weighted 0–100 reading updated daily:
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {METHODOLOGY_WEIGHTS.map((item) => (
            <div
              key={item.factor}
              className="rounded-xl border border-[#e4e4e7] dark:border-white/8 bg-[#fafafa] dark:bg-white/[0.03] p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#09090b] dark:text-white">{item.factor}</span>
                <span className="font-mono-num text-xs font-semibold text-[#3b82f6]">{item.weight}</span>
              </div>
              <p className="text-xs text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-[#71717a] dark:text-[#a1a1aa] pt-1">
          Informational benchmark only. Veyra is strictly view-only and does not provide trading or financial advice.
        </p>
      </div>
    </div>
  );
}
