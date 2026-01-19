import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Button, DatePicker, Skeleton, Typography } from 'antd';
import type { TaskVolumePoint } from '../../api';
import { fetchTaskVolumeByDay } from '../../api';
import { useLocale, useT } from '../../i18n';
import { addDaysUtc, enumerateDaysUtcInclusive, formatDayLabel, utcTodayDay } from '../../utils/dateUtc';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

type PresetKey = '7d' | '30d' | '6m' | '1y';

const PRESET_DAYS: Record<PresetKey, number> = {
  '7d': 7,
  '30d': 30,
  '6m': 183,
  '1y': 365
};

// Register the minimal ECharts modules used by the repo task volume trend chart. nn62s3ci1xhpr7ublh51
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

type TrendThemeTokens = {
  accent: string;
  accentBorder: string;
  border: string;
  muted: string;
  surface: string;
  text: string;
};

// Read CSS variables for theme-aware chart styling without hardcoded colors. nn62s3ci1xhpr7ublh51
const readThemeTokens = (el: HTMLElement): TrendThemeTokens => {
  const read = (name: string, fallback: string): string => {
    try {
      const local = getComputedStyle(el).getPropertyValue(name).trim();
      if (local) return local;
      const root = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return root || fallback;
    } catch {
      return fallback;
    }
  };

  return {
    accent: read('--accent', '#2563eb'),
    accentBorder: read('--hc-accent-border', 'rgba(37, 99, 235, 0.34)'),
    border: read('--hc-border', '#e2e8f0'),
    muted: read('--muted', '#475569'),
    surface: read('--hc-surface', 'rgba(255, 255, 255, 0.92)'),
    text: read('--text', '#0f172a')
  };
};

export interface RepoTaskVolumeTrendProps {
  repoId: string;
  refreshSeq: number;
}

export const RepoTaskVolumeTrend: FC<RepoTaskVolumeTrendProps> = ({ repoId, refreshSeq }) => {
  const t = useT();
  const locale = useLocale();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  // Store theme tokens derived from CSS variables for ECharts rendering. nn62s3ci1xhpr7ublh51
  const [themeTokens, setThemeTokens] = useState<TrendThemeTokens>(() => ({
    accent: '#2563eb',
    accentBorder: 'rgba(37, 99, 235, 0.34)',
    border: '#e2e8f0',
    muted: '#475569',
    surface: 'rgba(255, 255, 255, 0.92)',
    text: '#0f172a'
  }));
  const [preset, setPreset] = useState<PresetKey>('7d');
  const [customRange, setCustomRange] = useState<{ startDay: string; endDay: string } | null>(null);
  const [pickerValue, setPickerValue] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rawPoints, setRawPoints] = useState<TaskVolumePoint[]>([]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof window === 'undefined') return;

    // Keep ECharts colors in sync with CSS variables (light/dark + configurable accent). nn62s3ci1xhpr7ublh51
    const syncTheme = () => setThemeTokens(readThemeTokens(el));
    syncTheme();

    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(() => syncTheme());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof window === 'undefined') return;

    // Initialize and dispose the ECharts instance tied to the chart container. nn62s3ci1xhpr7ublh51
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    chartInstanceRef.current = chart;

    const handleResize = () => {
      try {
        chart.resize();
      } catch {
        // ignore
      }
    };

    handleResize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        chartInstanceRef.current = null;
        chart.dispose();
      };
    }

    const ro = new ResizeObserver(() => handleResize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chartInstanceRef.current = null;
      chart.dispose();
    };
  }, []);

  const resolvedRange = useMemo(() => {
    if (customRange) return customRange;
    const endDay = utcTodayDay();
    const days = PRESET_DAYS[preset];
    return { startDay: addDaysUtc(endDay, -(days - 1)), endDay };
  }, [customRange, preset]);

  useEffect(() => {
    const { startDay, endDay } = resolvedRange;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setLoadFailed(false);
      try {
        const points = await fetchTaskVolumeByDay({ repoId, startDay, endDay });
        if (cancelled) return;
        setRawPoints(Array.isArray(points) ? points : []);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setLoadFailed(true);
        setRawPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [repoId, resolvedRange.endDay, resolvedRange.startDay, refreshSeq]);

  const series = useMemo(() => {
    // Fill missing days on the frontend to keep the chart stable and anchor the right edge to today. dashtrendline20260119m9v2
    const days = enumerateDaysUtcInclusive(resolvedRange.startDay, resolvedRange.endDay);
    const perDay = new Map<string, number>();
    for (const p of rawPoints) {
      const day = String((p as any)?.day ?? '').trim();
      if (!day) continue;
      perDay.set(day, Number((p as any)?.count ?? 0) || 0);
    }
    // Provide a dense UTC-day series for ECharts even when the API returns sparse points. nn62s3ci1xhpr7ublh51
    return days.map((day) => ({ day, count: perDay.get(day) ?? 0 }));
  }, [rawPoints, resolvedRange.endDay, resolvedRange.startDay]);

  const option = useMemo(() => {
    // Translate the UTC-day series into an ECharts line+area option with locale-aware labels. nn62s3ci1xhpr7ublh51
    const points = series;
    if (!points.length) return null;

    const showDots = points.length <= 60;
    const days = points.map((p) => p.day);
    const counts = points.map((p) => p.count);

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: { left: 10, right: 10, top: 10, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: themeTokens.surface,
        borderColor: themeTokens.border,
        borderWidth: 1,
        textStyle: { color: themeTokens.text, fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: themeTokens.border, width: 1 } },
        formatter: (params: any) => {
          const first = Array.isArray(params) ? params[0] : params;
          const day = String(first?.axisValue ?? '').trim();
          const count = Number(first?.data ?? 0) || 0;
          return `${formatDayLabel(locale, day)}: ${count}`;
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: days,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: themeTokens.border } },
        axisLabel: {
          color: themeTokens.muted,
          fontSize: 11,
          // Prevent the first/last tick labels from being clipped by anchoring them inward. nn62s3ci1xhpr7ublh51
          showMinLabel: true,
          showMaxLabel: true,
          alignMinLabel: 'left',
          alignMaxLabel: 'right',
          hideOverlap: true,
          formatter: (value: string) => formatDayLabel(locale, String(value))
        }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false }
      },
      series: [
        {
          type: 'line',
          data: counts,
          showSymbol: showDots,
          symbol: showDots ? 'circle' : 'none',
          symbolSize: 6,
          lineStyle: { color: themeTokens.accent, width: 2.25 },
          itemStyle: { color: themeTokens.accent, borderColor: themeTokens.accentBorder, borderWidth: 1 },
          areaStyle: { color: themeTokens.accent, opacity: 0.14 }
        }
      ]
    } as any;
  }, [locale, series, themeTokens]);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    // Keep the ECharts option in sync with fetched points and UI locale. nn62s3ci1xhpr7ublh51
    if (!option) {
      chart.clear();
      return;
    }

    chart.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  const handlePreset = (key: PresetKey) => {
    setPreset(key);
    setCustomRange(null);
    setPickerValue(null);
  };

  const handleCustom = (value: any, dateStrings: any) => {
    if (!value) {
      setCustomRange(null);
      setPickerValue(null);
      return;
    }
    const start = String(dateStrings?.[0] ?? '').trim();
    const end = String(dateStrings?.[1] ?? '').trim();
    if (!start || !end) {
      setPickerValue(value);
      return;
    }
    setPickerValue(value);
    setCustomRange({ startDay: start, endDay: end });
  };

  const presetButtons: Array<{ key: PresetKey; label: string }> = [
    { key: '7d', label: t('repos.dashboard.activity.tasks.range.7d') },
    { key: '30d', label: t('repos.dashboard.activity.tasks.range.30d') },
    { key: '6m', label: t('repos.dashboard.activity.tasks.range.6m') },
    { key: '1y', label: t('repos.dashboard.activity.tasks.range.1y') }
  ];

  // Keep the chart container mounted during the initial fetch to avoid reinitializing ECharts. nn62s3ci1xhpr7ublh51
  const showInitialSkeleton = loading && !rawPoints.length;

  return (
    <div className="hc-repo-activity__trend">
      <div className="hc-repo-activity__trend-controls">
        {presetButtons.map((btn) => (
          <Button
            key={btn.key}
            size="small"
            type={!customRange && preset === btn.key ? 'primary' : 'default'}
            onClick={() => handlePreset(btn.key)}
          >
            {btn.label}
          </Button>
        ))}
        <DatePicker.RangePicker
          size="small"
          value={pickerValue}
          allowClear
          format="YYYY-MM-DD"
          onChange={handleCustom}
          placeholder={[t('repos.dashboard.activity.tasks.range.start'), t('repos.dashboard.activity.tasks.range.end')]}
        />
      </div>

      <Typography.Text type="secondary" className="hc-repo-activity__trend-range">
        {formatDayLabel(locale, resolvedRange.startDay)} — {formatDayLabel(locale, resolvedRange.endDay)}
      </Typography.Text>

      {loadFailed ? <Typography.Text type="danger">{t('repos.dashboard.activity.tasks.volumeLoadFailed')}</Typography.Text> : null}

      <div ref={chartRef} className="hc-repo-activity__trend-chart" role="img" aria-label={t('repos.dashboard.activity.tasks.volume')}>
        {showInitialSkeleton ? (
          <div className="hc-repo-activity__trend-skeleton">
            <Skeleton active title={false} paragraph={{ rows: 3, width: ['92%', '86%', '70%'] }} />
          </div>
        ) : null}
        {/* ECharts renders into this container div. nn62s3ci1xhpr7ublh51 */}
      </div>
    </div>
  );
};
