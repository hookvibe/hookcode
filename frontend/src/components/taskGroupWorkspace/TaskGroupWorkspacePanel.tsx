import type { CSSProperties, PointerEventHandler } from 'react';
import { Tabs, type TabsProps } from 'antd';

type TaskGroupWorkspacePanelProps = {
  open: boolean;
  dividerActive: boolean;
  previewPanelMinWidth: number;
  previewPanelMaxWidth: number;
  previewPanelWidth: number | null;
  previewPanelStyle?: CSSProperties;
  onDividerPointerDown: PointerEventHandler<HTMLDivElement>;
  activeKey: string | null;
  items: TabsProps['items'];
  onChange: (key: string) => void;
  onCloseTab: (key: string) => void;
};

export const TaskGroupWorkspacePanel = ({
  open,
  dividerActive,
  previewPanelMinWidth,
  previewPanelMaxWidth,
  previewPanelWidth,
  previewPanelStyle,
  onDividerPointerDown,
  activeKey,
  items,
  onChange,
  onCloseTab
}: TaskGroupWorkspacePanelProps) => {
  if (!open) return null;

  // Wrap the shared right-side workspace chrome so TaskGroupChatPage only wires state into the tab surface. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  return (
    <>
      <div
        className={`hc-preview-divider${dividerActive ? ' hc-preview-divider--active' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={previewPanelMinWidth}
        aria-valuemax={previewPanelMaxWidth || undefined}
        aria-valuenow={previewPanelWidth ?? undefined}
        onPointerDown={onDividerPointerDown}
      >
        <span className="hc-preview-divider-handle" aria-hidden="true" />
      </div>
      <aside className="hc-preview-panel" style={previewPanelStyle}>
        <Tabs
          type="editable-card"
          hideAdd
          activeKey={activeKey ?? undefined}
          items={items}
          className="hc-task-workspace-tabs"
          onChange={onChange}
          onEdit={(targetKey, action) => {
            if (action === 'remove' && typeof targetKey === 'string') {
              onCloseTab(targetKey);
            }
          }}
        />
      </aside>
    </>
  );
};
