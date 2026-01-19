import { FC, useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Skeleton, Typography } from 'antd';
import type { TaskVolumePoint } from '../../api';
import { fetchTaskVolumeByDay } from '../../api';
import { useLocale, useT } from '../../i18n';
import { addDaysUtc, enumerateDaysUtcInclusive, formatDayLabel, utcTodayDay } from '../../utils/dateUtc';

type PresetKey = '7d' | '30d' | '6m' | '1y';

const PRESET_DAYS: Record<PresetKey, number> = {
  '7d': 7,
  '30d': 30,
  '6m': 183,
  '1y': 365
};

export interface RepoTaskVolumeTrendProps {
  repoId: string;
  refreshSeq: number;
}

export const RepoTaskVolumeTrend: FC<RepoTaskVolumeTrendProps> = ({ repoId, refreshSeq }) => {
  const t = useT();
  const locale = useLocale();
  const [preset, setPreset] = useState<PresetKey>('7d');
  const [customRange, setCustomRange] = useState<{ startDay: string; endDay: string } | null>(null);
  const [pickerValue, setPickerValue] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [rawPoints, setRawPoints] = useState<TaskVolumePoint[]>([]);

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
    const points = days.map((day) => ({ day, count: perDay.get(day) ?? 0 }));
    const max = points.reduce((m, p) => Math.max(m, p.count), 0);
    return { points, max };
  }, [rawPoints, resolvedRange.endDay, resolvedRange.startDay]);

  const svg = useMemo(() => {
    const points = series.points;
    const max = series.max || 1;
    if (!points.length) return null;

    const width = 640;
    const height = 150;
    const paddingX = 10;
    const paddingTop = 10;
    const paddingBottom = 22;
    const innerW = width - paddingX * 2;
    const innerH = height - paddingTop - paddingBottom;

    const xy = points.map((p, idx) => {
      const t = points.length <= 1 ? 0 : idx / (points.length - 1);
      const x = paddingX + t * innerW;
      const y = paddingTop + innerH - (p.count / max) * innerH;
      return { ...p, x, y };
    });

    const line = xy.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const area = `M ${xy[0].x.toFixed(2)} ${(height - paddingBottom).toFixed(2)} L ${line.replaceAll(',', ' ')} L ${xy[
      xy.length - 1
    ].x.toFixed(2)} ${(height - paddingBottom).toFixed(2)} Z`;

    const tickTarget = points.length <= 10 ? points.length : 6;
    const tickCount = Math.max(2, Math.min(7, tickTarget));
    const tickStep = Math.max(1, Math.floor((points.length - 1) / (tickCount - 1)));
    const tickIdx = new Set<number>();
    for (let i = 0; i < tickCount - 1; i += 1) tickIdx.add(i * tickStep);
    tickIdx.add(points.length - 1);
    const ticks = Array.from(tickIdx)
      .filter((i) => i >= 0 && i < points.length)
      .sort((a, b) => a - b)
      .map((i) => ({ idx: i, day: points[i].day, x: xy[i].x }));

    const showDots = points.length <= 60;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="hc-repo-activity__trend-svg" aria-hidden>
        <path d={area} className="hc-repo-activity__trend-area" />
        <polyline points={line} className="hc-repo-activity__trend-line" fill="none" />
        {showDots
          ? xy.map((p) => (
              <circle key={p.day} cx={p.x} cy={p.y} r={2.4} className="hc-repo-activity__trend-dot">
                <title>
                  {formatDayLabel(locale, p.day)}: {p.count}
                </title>
              </circle>
            ))
          : null}
        <line
          x1={paddingX}
          x2={width - paddingX}
          y1={height - paddingBottom}
          y2={height - paddingBottom}
          className="hc-repo-activity__trend-axis"
        />
        {ticks.map((tick) => (
          <text
            key={tick.day}
            x={tick.x}
            y={height - 6}
            textAnchor={tick.idx === 0 ? 'start' : tick.idx === points.length - 1 ? 'end' : 'middle'}
            className="hc-repo-activity__trend-tick"
          >
            {formatDayLabel(locale, tick.day)}
          </text>
        ))}
      </svg>
    );
  }, [locale, series.max, series.points]);

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

  if (loading && !rawPoints.length) {
    return <Skeleton active title={false} paragraph={{ rows: 4, width: ['92%', '86%', '94%', '70%'] }} />;
  }

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

      <div className="hc-repo-activity__trend-chart" role="img" aria-label={t('repos.dashboard.activity.tasks.volume')}>
        {svg}
      </div>
    </div>
  );
};
