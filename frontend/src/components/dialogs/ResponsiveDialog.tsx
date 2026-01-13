import { Button, Drawer, Modal, Space } from 'antd';
import type { DrawerProps, ModalProps } from 'antd';
import type { CSSProperties, FC, ReactNode } from 'react';
import { useMemo } from 'react';
import { useT } from '../../i18n';

/**
 * ResponsiveDialog:
 * - Business context: shared dialog primitive for `frontend-chat` feature migration.
 * - Purpose: keep modal vs drawer decisions consistent (compact -> Modal, large -> Drawer).
 *
 * Notes:
 * - This `frontend-chat` version intentionally avoids the legacy "mobile full-screen page" implementation
 *   to keep the migration surface minimal.
 *
 * Change record:
 * - 2026-01-12: Introduced for RepoDetail (robot editor, webhook intro, automation rule modal).
 */

type DialogVariant = 'compact' | 'large';

export interface ResponsiveDialogProps {
  open: boolean;
  title?: ReactNode;
  children: ReactNode;
  variant?: DialogVariant;
  /**
   * Desktop drawer width for "large content". Defaults to 900px and is capped at 92vw.
   */
  drawerWidth?: DrawerProps['width'];
  /**
   * Modal width for "compact content".
   */
  modalWidth?: ModalProps['width'];
  onOk?: () => void;
  onCancel?: () => void;
  okText?: ReactNode;
  cancelText?: ReactNode;
  confirmLoading?: boolean;
  footer?: ReactNode | null;
  headerExtra?: ReactNode;
  destroyOnClose?: boolean;
  className?: string;
  bodyStyle?: CSSProperties;
}

export const ResponsiveDialog: FC<ResponsiveDialogProps> = ({
  open,
  title,
  children,
  variant = 'compact',
  drawerWidth = 'min(900px, 92vw)',
  modalWidth,
  onOk,
  onCancel,
  okText,
  cancelText,
  confirmLoading,
  footer,
  headerExtra,
  destroyOnClose = true,
  className,
  bodyStyle
}) => {
  const t = useT();

  const mergedOkText = okText ?? t('common.save');
  const mergedCancelText = cancelText ?? t('common.cancel');

  const footerNode = useMemo(() => {
    if (footer === null) return null;
    if (footer !== undefined) return footer;
    if (!onOk && !onCancel) return null;
    return (
      <Space size={8} wrap>
        {onCancel ? <Button onClick={onCancel}>{mergedCancelText}</Button> : null}
        {onOk ? (
          <Button type="primary" loading={confirmLoading} onClick={onOk}>
            {mergedOkText}
          </Button>
        ) : null}
      </Space>
    );
  }, [confirmLoading, footer, mergedCancelText, mergedOkText, onCancel, onOk]);

  if (variant === 'compact') {
    return (
      <Modal
        centered
        open={open}
        title={title}
        onCancel={onCancel}
        onOk={onOk}
        okText={okText}
        cancelText={cancelText}
        confirmLoading={confirmLoading}
        footer={footerNode}
        width={modalWidth}
        destroyOnHidden={destroyOnClose}
        className={className}
        styles={bodyStyle ? { body: bodyStyle } : undefined}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        {children}
      </Modal>
    );
  }

  return (
    <Drawer
      placement="right"
      open={open}
      title={title}
      width={drawerWidth}
      onClose={onCancel}
      destroyOnClose={destroyOnClose}
      extra={headerExtra}
      footer={footerNode}
      className={className}
      styles={bodyStyle ? { body: bodyStyle } : undefined}
    >
      {children}
    </Drawer>
  );
};

