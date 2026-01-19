import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { setLocale } from '../i18n';
import { RepoTaskVolumeTrend } from '../components/repos/RepoTaskVolumeTrend';
import * as api from '../api';
import * as echarts from 'echarts/core';

// Verify RepoTaskVolumeTrend updates an ECharts instance using a dense UTC-day series. nn62s3ci1xhpr7ublh51

vi.mock('../api', () => {
  return {
    __esModule: true,
    fetchTaskVolumeByDay: vi.fn(async () => [])
  };
});

vi.mock('../utils/dateUtc', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return { ...actual, utcTodayDay: () => '2026-01-20' };
});

describe('RepoTaskVolumeTrend (ECharts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en-US');
  });

  test('fills missing days and pushes an option into ECharts', async () => {
    vi.mocked(api.fetchTaskVolumeByDay).mockResolvedValueOnce([
      { day: '2026-01-14', count: 1 },
      { day: '2026-01-20', count: 3 }
    ] as any);

    const ui = render(<RepoTaskVolumeTrend repoId="r1" refreshSeq={0} />);

    await waitFor(() =>
      expect(api.fetchTaskVolumeByDay).toHaveBeenCalledWith({
        repoId: 'r1',
        startDay: '2026-01-14',
        endDay: '2026-01-20'
      })
    );

    await waitFor(() => expect(vi.mocked(echarts.init)).toHaveBeenCalledTimes(1));
    const chart = vi.mocked(echarts.init).mock.results[0]?.value as any;

    await waitFor(() => {
      const lastOption = chart.setOption.mock.calls.at(-1)?.[0];
      expect(lastOption?.xAxis?.data).toEqual([
        '2026-01-14',
        '2026-01-15',
        '2026-01-16',
        '2026-01-17',
        '2026-01-18',
        '2026-01-19',
        '2026-01-20'
      ]);
      expect(lastOption?.xAxis?.axisLabel?.alignMinLabel).toBe('left');
      expect(lastOption?.xAxis?.axisLabel?.alignMaxLabel).toBe('right');
      expect(lastOption?.series?.[0]?.data).toEqual([1, 0, 0, 0, 0, 0, 3]);
    });

    ui.unmount();
    expect(chart.dispose).toHaveBeenCalledTimes(1);
  });
});
