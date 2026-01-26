import { FC, useMemo } from 'react';
import { Select, Space, Switch, Typography } from 'antd';
import type { TimeWindow } from '../api';
import { useT } from '../i18n';
import { buildHourOptions } from '../utils/timeWindow';

interface Props {
  value?: TimeWindow | null;
  onChange?: (next: TimeWindow | null) => void;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
  showTimezoneHint?: boolean;
}

const DEFAULT_WINDOW: TimeWindow = { startHour: 9, endHour: 18 };

export const TimeWindowPicker: FC<Props> = ({ value, onChange, disabled, size = 'small', showTimezoneHint = true }) => {
  const t = useT();
  const enabled = Boolean(value);
  const resolved = value ?? DEFAULT_WINDOW;
  const hourOptions = useMemo(() => buildHourOptions(), []);

  const handleToggle = (checked: boolean) => {
    // Toggle hour-level scheduling on/off while preserving defaults. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    onChange?.(checked ? resolved : null);
  };

  const updateWindow = (patch: Partial<TimeWindow>) => {
    onChange?.({ ...resolved, ...patch });
  };

  return (
    <Space size={8} wrap>
      <Switch checked={enabled} onChange={handleToggle} disabled={disabled} size={size === 'large' ? 'default' : 'small'} />
      {enabled ? (
        <>
          <Select
            value={resolved.startHour}
            onChange={(next) => updateWindow({ startHour: next })}
            options={hourOptions}
            disabled={disabled}
            size={size}
            style={{ minWidth: 96 }}
            aria-label={t('timeWindow.start')}
          />
          <Typography.Text type="secondary">{t('timeWindow.to')}</Typography.Text>
          <Select
            value={resolved.endHour}
            onChange={(next) => updateWindow({ endHour: next })}
            options={hourOptions}
            disabled={disabled}
            size={size}
            style={{ minWidth: 96 }}
            aria-label={t('timeWindow.end')}
          />
          {showTimezoneHint ? <Typography.Text type="secondary">{t('timeWindow.serverTimeHint')}</Typography.Text> : null}
        </>
      ) : (
        <Typography.Text type="secondary">{t('timeWindow.disabledHint')}</Typography.Text>
      )}
    </Space>
  );
};
