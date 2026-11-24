import React, { useEffect, useRef } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { HistoricalPoint } from '../../types/veyra';
import { useVeyra } from '../../context/VeyraContext';

interface TradingViewChartProps {
  data: HistoricalPoint[];
  mode: 'area' | 'candles';
  height?: number;
}

export function TradingViewChart({ data, mode, height = 340 }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { theme } = useVeyra();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;

    const isDark = theme === 'dark';
    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#a1a1aa' : '#52525b',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(9,9,11,0.06)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(9,9,11,0.06)' },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e4e7',
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e4e7',
      },
      crosshair: {
        vertLine: { color: '#3b82f6', width: 1, style: 2 },
        horzLine: { color: '#3b82f6', width: 1, style: 2 },
      },
    });
    chartRef.current = chart;

    if (mode === 'candles') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      candleSeries.setData(
        data.map((pt) => ({
          time: (Math.floor(Date.parse(pt.time) / 1000) as UTCTimestamp),
          open: pt.open,
          high: pt.high,
          low: pt.low,
          close: pt.close,
        }))
      );
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#3b82f6',
        topColor: 'rgba(59, 130, 246, 0.28)',
        bottomColor: 'rgba(59, 130, 246, 0.01)',
        lineWidth: 2,
      });
      areaSeries.setData(
        data.map((pt) => ({
          time: (Math.floor(Date.parse(pt.time) / 1000) as UTCTimestamp),
          value: pt.close,
        }))
      );
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, mode, height, theme]);

  return <div ref={containerRef} data-testid="tradingview-chart" className="w-full" style={{ height }} />;
}
