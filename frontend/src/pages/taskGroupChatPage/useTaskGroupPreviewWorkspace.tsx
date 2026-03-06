import { App, type TabsProps } from 'antd';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type PointerEventHandler,
  type ReactNode,
  type SetStateAction
} from 'react';
import {
  API_BASE_URL,
  fetchTaskGroupPreviewStatus,
  installTaskGroupPreviewDependencies,
  setTaskGroupPreviewVisibility,
  startTaskGroupPreview,
  stopTaskGroupPreview,
  type PreviewHighlightCommand,
  type PreviewHighlightEvent,
  type PreviewInstanceStatus,
  type PreviewInstanceSummary,
  type PreviewLogEntry,
  type PreviewStatusResponse
} from '../../api';
import { getToken } from '../../auth';
import { TaskGroupPreviewLogTab, TaskGroupPreviewWorkspace } from '../../components/taskGroupWorkspace/TaskGroupPreviewWorkspace';
import { createAuthedEventSource } from '../../utils/sse';
import { matchPreviewTargetUrl, splitPreviewTargetUrlCandidates } from '../../utils/previewRouteMatch';

const PREVIEW_LOG_TAIL = 200;
const PREVIEW_LOG_MAX = 500;
const PREVIEW_PANEL_MIN_WIDTH = 320;
const PREVIEW_PANEL_MIN_CHAT_WIDTH = 420;
const PREVIEW_PANEL_DEFAULT_RATIO = 0.5;
const PREVIEW_PANEL_STACK_BREAKPOINT = 1024;

type TranslateFn = (key: string, values?: Record<string, unknown>) => string;
type MessageApi = ReturnType<typeof App.useApp>['message'];

type UseTaskGroupPreviewWorkspaceParams = {
  taskGroupId?: string;
  locale: string;
  t: TranslateFn;
  message: MessageApi;
  activeWorkspaceTabKey: string | null;
  setActiveWorkspaceTabKey: Dispatch<SetStateAction<string | null>>;
};

type UseTaskGroupPreviewWorkspaceResult = {
  layoutRef: MutableRefObject<HTMLDivElement | null>;
  previewDragActive: boolean;
  previewPanelOpen: boolean;
  previewPanelMinWidth: number;
  previewPanelMaxWidth: number;
  previewPanelWidth: number | null;
  previewPanelStyle?: CSSProperties;
  handlePreviewDividerPointerDown: PointerEventHandler<HTMLDivElement>;
  previewLoading: boolean;
  previewActionLoading: boolean;
  previewStartModalOpen: boolean;
  previewInstallLoading: boolean;
  previewLogTabOpen: boolean;
  previewStartDisabled: boolean;
  previewAggregateStatus: PreviewInstanceStatus;
  previewAggregateStatusLabel: string;
  previewToggleIcon: ReactNode;
  previewTabItem: NonNullable<TabsProps['items']>[number] | null;
  previewLogTabItem: NonNullable<TabsProps['items']>[number] | null;
  handlePreviewToggle: () => Promise<void>;
  handlePreviewStart: () => Promise<void>;
  handlePreviewReinstall: () => Promise<void>;
  handleComposerPreviewStart: () => void;
  closePreviewStartModal: () => void;
  closePreviewLogTab: (fallbackKey?: string | null) => void;
};

const buildUnavailablePreviewState = (
  reason?: PreviewStatusResponse['reason']
): PreviewStatusResponse => ({
  available: false,
  instances: [],
  ...(reason ? { reason } : {})
});

const getPreviewStatusLabel = (
  t: TranslateFn,
  status: PreviewInstanceStatus,
  available: boolean,
  hasSnapshot: boolean
): string => {
  // Normalize preview status copy inside the hook so the page no longer duplicates status switch blocks. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  if (!hasSnapshot) return t('preview.status.idle');
  if (!available) return t('preview.status.unavailable');
  switch (status) {
    case 'starting':
      return t('preview.status.starting');
    case 'running':
      return t('preview.status.running');
    case 'failed':
      return t('preview.status.failed');
    case 'timeout':
      return t('preview.status.timeout');
    default:
      return t('preview.status.stopped');
  }
};

export const useTaskGroupPreviewWorkspace = ({
  taskGroupId,
  locale,
  t,
  message,
  activeWorkspaceTabKey,
  setActiveWorkspaceTabKey
}: UseTaskGroupPreviewWorkspaceParams): UseTaskGroupPreviewWorkspaceResult => {
  const [previewState, setPreviewState] = useState<PreviewStatusResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewActionLoading, setPreviewActionLoading] = useState(false);
  const [previewStartModalOpen, setPreviewStartModalOpen] = useState(false);
  const [previewInstallLoading, setPreviewInstallLoading] = useState(false);
  const [previewLogTabOpen, setPreviewLogTabOpen] = useState(false);
  const [activePreviewName, setActivePreviewName] = useState<string | null>(null);
  const [previewLogsLoading, setPreviewLogsLoading] = useState(false);
  const [previewLogs, setPreviewLogs] = useState<PreviewLogEntry[]>([]);
  const previewLogStreamRef = useRef<EventSource | null>(null);
  const previewTerminalBodyRef = useRef<HTMLDivElement | null>(null);
  const previewTerminalAutoScrollRef = useRef(true);
  const previewBridgeReadyRef = useRef(false);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewHighlightStreamRef = useRef<EventSource | null>(null);
  const [previewIframeOverrideSrc, setPreviewIframeOverrideSrc] = useState<string | null>(null);
  const [previewAddress, setPreviewAddress] = useState('');
  const [previewAddressInput, setPreviewAddressInput] = useState('');
  const [previewAddressEditing, setPreviewAddressEditing] = useState(false);
  const [previewAutoNavigateLocked, setPreviewAutoNavigateLocked] = useState(false);
  const pendingPreviewHighlightRef = useRef<PreviewHighlightCommand | null>(null);
  const [previewPanelWidth, setPreviewPanelWidth] = useState<number | null>(null);
  const [previewDragActive, setPreviewDragActive] = useState(false);
  const [previewLayoutWidth, setPreviewLayoutWidth] = useState(0);
  const previewDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);

  const previewInstances = previewState?.instances ?? [];
  const previewAvailable = previewState?.available ?? false;
  const previewPanelMaxWidth = useMemo(() => {
    if (!previewLayoutWidth) return 0;
    return Math.max(PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
  }, [previewLayoutWidth]);

  useLayoutEffect(() => {
    // Measure the chat+preview layout inside the dedicated hook so resize math no longer clutters the page component. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    if (!taskGroupId) return;
    const layout = layoutRef.current;
    if (!layout) return;
    const updateLayoutWidth = () => setPreviewLayoutWidth(layout.getBoundingClientRect().width);
    updateLayoutWidth();
    window.addEventListener('resize', updateLayoutWidth);
    return () => window.removeEventListener('resize', updateLayoutWidth);
  }, [taskGroupId]);

  useEffect(() => {
    // Reset the workspace split when switching task groups so wide-screen preview/log panels reopen at the default 50% width. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    setPreviewPanelWidth(null);
    previewDragRef.current = null;
  }, [taskGroupId]);

  useLayoutEffect(() => {
    if (!taskGroupId || !previewLayoutWidth || previewPanelWidth !== null) return;
    const fallback = Math.round(previewLayoutWidth * PREVIEW_PANEL_DEFAULT_RATIO);
    const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
    const nextWidth = Math.min(Math.max(fallback, PREVIEW_PANEL_MIN_WIDTH), maxWidth);
    setPreviewPanelWidth(nextWidth);
  }, [previewLayoutWidth, previewPanelWidth, taskGroupId]);

  useEffect(() => {
    if (!previewLayoutWidth || previewPanelWidth === null) return;
    const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
    const clamped = Math.min(Math.max(previewPanelWidth, PREVIEW_PANEL_MIN_WIDTH), maxWidth);
    if (clamped !== previewPanelWidth) setPreviewPanelWidth(clamped);
  }, [previewLayoutWidth, previewPanelWidth]);

  const handlePreviewDividerPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (!layoutRef.current || window.matchMedia(`(max-width: ${PREVIEW_PANEL_STACK_BREAKPOINT}px)`).matches) return;
      const layoutWidth = layoutRef.current.getBoundingClientRect().width;
      if (!layoutWidth) return;
      const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, layoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
      const fallbackWidth = Math.round(layoutWidth * PREVIEW_PANEL_DEFAULT_RATIO);
      const startWidth = Math.min(Math.max(previewPanelWidth ?? fallbackWidth, PREVIEW_PANEL_MIN_WIDTH), maxWidth);
      previewDragRef.current = { startX: event.clientX, startWidth };
      setPreviewDragActive(true);
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [previewPanelWidth]
  );

  useEffect(() => {
    if (!previewDragActive) return;
    const handleMove = (event: PointerEvent) => {
      const drag = previewDragRef.current;
      const layout = layoutRef.current;
      if (!drag || !layout) return;
      const layoutWidth = layout.getBoundingClientRect().width;
      if (!layoutWidth) return;
      const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, layoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
      const deltaX = event.clientX - drag.startX;
      const nextWidth = Math.min(Math.max(drag.startWidth - deltaX, PREVIEW_PANEL_MIN_WIDTH), maxWidth);
      setPreviewPanelWidth(nextWidth);
    };
    const handleUp = () => {
      setPreviewDragActive(false);
      previewDragRef.current = null;
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [previewDragActive]);

  useEffect(() => {
    if (previewInstances.length === 0) {
      setActivePreviewName(null);
      return;
    }
    if (!activePreviewName || !previewInstances.some((instance) => instance.name === activePreviewName)) {
      setActivePreviewName(previewInstances[0].name);
    }
  }, [activePreviewName, previewInstances]);

  const activePreviewInstance = useMemo<PreviewInstanceSummary | null>(
    () => previewInstances.find((instance) => instance.name === activePreviewName) ?? previewInstances[0] ?? null,
    [activePreviewName, previewInstances]
  );
  const activePreviewDisplay = activePreviewInstance?.display ?? 'webview';
  const activePreviewIsTerminal = activePreviewDisplay === 'terminal';

  const previewAggregateStatus = useMemo<PreviewInstanceStatus>(() => {
    if (!previewState || !previewAvailable) return 'stopped';
    const statuses = previewInstances.map((instance) => instance.status);
    if (statuses.includes('running')) return 'running';
    if (statuses.includes('starting')) return 'starting';
    if (statuses.includes('failed')) return 'failed';
    if (statuses.includes('timeout')) return 'timeout';
    return 'stopped';
  }, [previewAvailable, previewInstances, previewState]);

  const previewStartDisabled = !taskGroupId || previewAggregateStatus === 'running' || previewAggregateStatus === 'starting';
  const previewPanelOpen = previewAvailable && (previewAggregateStatus !== 'stopped' || previewActionLoading);

  useEffect(() => {
    if (previewPanelOpen) return;
    setPreviewDragActive(false);
    previewDragRef.current = null;
  }, [previewPanelOpen]);

  const previewAggregateStatusLabel = useMemo(
    () => getPreviewStatusLabel(t, previewAggregateStatus, previewAvailable, Boolean(previewState)),
    [previewAggregateStatus, previewAvailable, previewState, t]
  );

  const previewToggleIcon = useMemo<ReactNode>(
    () => (
      <span className={`hc-preview-status-dot hc-preview-status-dot--${previewAggregateStatus}`} aria-hidden="true" />
    ),
    [previewAggregateStatus]
  );

  const activePreviewStatus = activePreviewInstance?.status ?? 'stopped';
  const activePreviewStatusLabel = useMemo(
    () => getPreviewStatusLabel(t, activePreviewStatus, previewAvailable, Boolean(previewState)),
    [activePreviewStatus, previewAvailable, previewState, t]
  );

  const previewPlaceholderText = useMemo(() => {
    if (!previewAvailable) return t('preview.empty.unavailable');
    if (activePreviewStatus === 'starting') return t('preview.empty.starting');
    if (activePreviewStatus === 'running') return t('preview.empty.running');
    if (activePreviewStatus === 'failed') return t('preview.empty.failed');
    if (activePreviewStatus === 'timeout') return t('preview.empty.timeout');
    return t('preview.empty.stopped');
  }, [activePreviewStatus, previewAvailable, t]);

  const previewDiagnostics = activePreviewInstance?.diagnostics;
  const previewDiagnosticsLogs = useMemo(() => previewDiagnostics?.logs?.slice(-6) ?? [], [previewDiagnostics?.logs]);
  const previewPanelSideBySide = previewLayoutWidth > PREVIEW_PANEL_STACK_BREAKPOINT;
  const previewPanelStyle = useMemo<CSSProperties | undefined>(
    () => (previewPanelWidth === null || !previewPanelSideBySide ? undefined : { width: previewPanelWidth }),
    [previewPanelSideBySide, previewPanelWidth]
  );

  const previewIframeSrc = useMemo(() => {
    if (activePreviewIsTerminal) return '';
    if (!activePreviewInstance || (activePreviewStatus !== 'running' && activePreviewStatus !== 'starting')) return '';
    const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
    const isUiLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    let isApiLocal = false;
    if (typeof window !== 'undefined') {
      try {
        const apiUrl = new URL(API_BASE_URL, window.location.origin);
        isApiLocal = apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1' || apiUrl.hostname === '::1';
      } catch {
        isApiLocal = false;
      }
    }
    if (isUiLocal && isApiLocal && activePreviewInstance.port) {
      return `http://127.0.0.1:${activePreviewInstance.port}/`;
    }
    const base = API_BASE_URL.replace(/\/$/, '');
    const baseUrl = activePreviewInstance.publicUrl ?? (activePreviewInstance.path ? `${base}${activePreviewInstance.path}` : '');
    if (!baseUrl) return '';
    const token = getToken();
    if (!token) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
  }, [activePreviewInstance, activePreviewIsTerminal, activePreviewStatus]);

  const currentPreviewIframeSrc = useMemo(() => previewIframeOverrideSrc ?? previewIframeSrc, [previewIframeOverrideSrc, previewIframeSrc]);
  const shouldStreamInlineTerminalLogs = activePreviewIsTerminal && activePreviewStatus !== 'stopped';
  const shouldStreamPreviewLogs =
    (activeWorkspaceTabKey === 'preview' && previewPanelOpen && shouldStreamInlineTerminalLogs) || activeWorkspaceTabKey === 'preview-log';
  const showInlineTerminalLogs = activePreviewIsTerminal && (shouldStreamInlineTerminalLogs || previewLogsLoading || previewLogs.length > 0);
  const previewTerminalOutput = useMemo(() => previewLogs.map((entry) => entry.message).join('\n'), [previewLogs]);

  const handlePreviewTerminalScroll = useCallback(() => {
    const panel = previewTerminalBodyRef.current;
    if (!panel) return;
    const remaining = panel.scrollHeight - panel.clientHeight - panel.scrollTop;
    previewTerminalAutoScrollRef.current = remaining <= 24;
  }, []);

  useEffect(() => {
    if (!showInlineTerminalLogs) {
      previewTerminalAutoScrollRef.current = true;
      return;
    }
    const panel = previewTerminalBodyRef.current;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
    previewTerminalAutoScrollRef.current = true;
  }, [activePreviewInstance?.name, showInlineTerminalLogs]);

  useEffect(() => {
    if (!showInlineTerminalLogs || !previewTerminalAutoScrollRef.current) return;
    const panel = previewTerminalBodyRef.current;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
  }, [previewTerminalOutput, showInlineTerminalLogs]);

  const previewIframeOrigin = useMemo(() => {
    if (!currentPreviewIframeSrc) return '';
    try {
      return new URL(currentPreviewIframeSrc).origin;
    } catch {
      return '';
    }
  }, [currentPreviewIframeSrc]);

  const previewAddressMeta = useMemo(() => {
    // Keep only the browser chrome fields that the preview header actually renders after the workspace shell cleanup. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const value = (previewAddressEditing ? previewAddressInput : previewAddress).trim();
    if (!value) return { isSecure: false };
    try {
      const url = new URL(value);
      return { isSecure: url.protocol === 'https:' };
    } catch {
      return { isSecure: false };
    }
  }, [previewAddress, previewAddressEditing, previewAddressInput]);

  useEffect(() => {
    if (!previewIframeSrc) {
      setPreviewIframeOverrideSrc(null);
      setPreviewAddress('');
      if (!previewAddressEditing) setPreviewAddressInput('');
      return;
    }
    setPreviewIframeOverrideSrc(null);
    setPreviewAddress(previewIframeSrc);
    if (!previewAddressEditing) setPreviewAddressInput(previewIframeSrc);
  }, [previewAddressEditing, previewIframeSrc]);

  const postPreviewBridgeMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (!previewIframeOrigin) return;
      const target = previewIframeRef.current?.contentWindow;
      if (!target) return;
      target.postMessage(payload, previewIframeOrigin);
    },
    [previewIframeOrigin]
  );

  const normalizePreviewUrl = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return '';
      if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
        try {
          return new URL(trimmed).toString();
        } catch {
          return '';
        }
      }
      const base = currentPreviewIframeSrc || (typeof window === 'undefined' ? '' : window.location.origin);
      if (trimmed.startsWith('/') && base) {
        try {
          return new URL(trimmed, base).toString();
        } catch {
          return '';
        }
      }
      const looksLocal = /^(localhost|127\.0\.0\.1|::1)(:|$)/.test(trimmed);
      const withScheme = looksLocal || trimmed.includes(':') ? `http://${trimmed}` : `https://${trimmed}`;
      try {
        return new URL(withScheme).toString();
      } catch {
        return '';
      }
    },
    [currentPreviewIframeSrc]
  );

  const isPreviewUrlEquivalent = useCallback((currentUrl: string, targetUrl: string) => matchPreviewTargetUrl(currentUrl, targetUrl), []);
  const resolvePreviewTargetUrl = useCallback((rawTargetUrl: string) => splitPreviewTargetUrlCandidates(rawTargetUrl)[0] ?? rawTargetUrl, []);

  const applyPreviewNavigation = useCallback((nextUrl: string, options: { updateInput: boolean }) => {
    setPreviewIframeOverrideSrc(nextUrl);
    setPreviewAddress(nextUrl);
    if (options.updateInput) setPreviewAddressInput(nextUrl);
  }, []);

  const syncPreviewAddress = useCallback(() => {
    const frame = previewIframeRef.current;
    if (!frame) return;
    let nextAddress = '';
    try {
      nextAddress = frame.contentWindow?.location?.href ?? '';
    } catch {
      nextAddress = '';
    }
    if (!nextAddress) {
      nextAddress = frame.getAttribute('src') || frame.src || currentPreviewIframeSrc || '';
    }
    if (!nextAddress) return;
    setPreviewAddress(nextAddress);
    if (!previewAddressEditing) setPreviewAddressInput(nextAddress);
    if (nextAddress !== currentPreviewIframeSrc) setPreviewIframeOverrideSrc(nextAddress);
  }, [currentPreviewIframeSrc, previewAddressEditing]);

  const handlePreviewNavigate = useCallback(
    (value?: string) => {
      const nextUrl = normalizePreviewUrl(value ?? previewAddressInput);
      if (!nextUrl) return;
      applyPreviewNavigation(nextUrl, { updateInput: true });
      setPreviewAddressEditing(false);
    },
    [applyPreviewNavigation, normalizePreviewUrl, previewAddressInput]
  );

  const maybeAutoNavigatePreview = useCallback(
    (rawTargetUrl?: string) => {
      if (!rawTargetUrl || previewAutoNavigateLocked || previewAddressEditing) return { didNavigate: false };
      const currentUrl = previewAddress || currentPreviewIframeSrc;
      if (currentUrl && isPreviewUrlEquivalent(currentUrl, rawTargetUrl)) return { didNavigate: false };
      const primaryTargetUrl = resolvePreviewTargetUrl(rawTargetUrl);
      const nextUrl = normalizePreviewUrl(primaryTargetUrl);
      if (!nextUrl) return { didNavigate: false };
      applyPreviewNavigation(nextUrl, { updateInput: !previewAddressEditing });
      return { didNavigate: true, url: nextUrl };
    },
    [applyPreviewNavigation, currentPreviewIframeSrc, isPreviewUrlEquivalent, normalizePreviewUrl, previewAddress, previewAddressEditing, previewAutoNavigateLocked, resolvePreviewTargetUrl]
  );

  const maybeAutoNavigatePreviewRef = useRef(maybeAutoNavigatePreview);
  useEffect(() => {
    maybeAutoNavigatePreviewRef.current = maybeAutoNavigatePreview;
  }, [maybeAutoNavigatePreview]);

  const flushPendingHighlight = useCallback(() => {
    const pending = pendingPreviewHighlightRef.current;
    if (!pending) return;
    pendingPreviewHighlightRef.current = null;
    postPreviewBridgeMessage({ type: 'hookcode:preview:highlight', ...pending });
  }, [postPreviewBridgeMessage]);

  const handlePreviewBack = useCallback(() => {
    const target = previewIframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.history.back();
    } catch {
      // ignore
    }
  }, []);

  const handlePreviewForward = useCallback(() => {
    const target = previewIframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.history.forward();
    } catch {
      // ignore
    }
  }, []);

  const handlePreviewReload = useCallback(() => {
    const frame = previewIframeRef.current;
    if (!frame) return;
    try {
      frame.contentWindow?.location.reload();
      return;
    } catch {
      // ignore
    }
    if (currentPreviewIframeSrc) frame.src = currentPreviewIframeSrc;
  }, [currentPreviewIframeSrc]);

  const handlePreviewIframeLoad = useCallback(() => {
    syncPreviewAddress();
    if (!previewIframeOrigin) return;
    postPreviewBridgeMessage({ type: 'hookcode:preview:ping' });
  }, [postPreviewBridgeMessage, previewIframeOrigin, syncPreviewAddress]);

  useEffect(() => {
    // Track preview bridge readiness in a ref so highlight retries do not force extra renders in the workspace hook. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    previewBridgeReadyRef.current = false;
  }, [previewIframeOrigin]);

  useEffect(() => {
    if (!previewIframeOrigin) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== previewIframeOrigin) return;
      const payload = event.data as { type?: string } | null;
      if (!payload || payload.type !== 'hookcode:preview:pong') return;
      previewBridgeReadyRef.current = true;
      flushPendingHighlight();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [flushPendingHighlight, previewIframeOrigin]);

  const formatPreviewLogTime = useCallback(
    (value: string) => {
      try {
        return new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date(value));
      } catch {
        return value;
      }
    },
    [locale]
  );

  const refreshPreviewStatus = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!taskGroupId) {
        setPreviewState(null);
        return;
      }
      const silent = options?.silent ?? false;
      if (!silent) setPreviewLoading(true);
      try {
        const data = await fetchTaskGroupPreviewStatus(taskGroupId);
        setPreviewState(data);
      } catch (err: any) {
        const status = err?.response?.status as number | undefined;
        const code = err?.response?.data?.code as PreviewStatusResponse['reason'] | undefined;
        if (status === 404 || status === 409) {
          setPreviewState(buildUnavailablePreviewState(code ?? 'config_missing'));
        } else {
          console.error(err);
          if (!silent) message.error(t('preview.statusFailed'));
          setPreviewState(buildUnavailablePreviewState());
        }
      } finally {
        if (!silent) setPreviewLoading(false);
      }
    },
    [message, t, taskGroupId]
  );

  const startPreview = useCallback(
    async ({ closeModal }: { closeModal?: boolean } = {}) => {
      if (!taskGroupId) return false;
      setPreviewActionLoading(true);
      try {
        await startTaskGroupPreview(taskGroupId);
        await refreshPreviewStatus({ silent: true });
        if (closeModal) setPreviewStartModalOpen(false);
        return true;
      } catch (err) {
        console.error(err);
        message.error(t('preview.toggleFailed'));
        return false;
      } finally {
        setPreviewActionLoading(false);
      }
    },
    [message, refreshPreviewStatus, t, taskGroupId]
  );

  const handlePreviewToggle = useCallback(async () => {
    if (!taskGroupId) return;
    const isActive = previewAggregateStatus === 'running' || previewAggregateStatus === 'starting';
    if (!isActive) {
      setPreviewStartModalOpen(true);
      return;
    }
    setPreviewActionLoading(true);
    try {
      await stopTaskGroupPreview(taskGroupId);
      await refreshPreviewStatus({ silent: true });
    } catch (err) {
      console.error(err);
      message.error(t('preview.toggleFailed'));
    } finally {
      setPreviewActionLoading(false);
    }
  }, [message, previewAggregateStatus, refreshPreviewStatus, t, taskGroupId]);

  const handlePreviewStart = useCallback(async () => {
    await startPreview({ closeModal: true });
  }, [startPreview]);

  const handlePreviewReinstall = useCallback(async () => {
    if (!taskGroupId) return;
    setPreviewInstallLoading(true);
    try {
      const result = await installTaskGroupPreviewDependencies(taskGroupId);
      if (result.result.status === 'skipped') {
        message.warning(t('preview.deps.reinstallSkipped'));
      } else {
        message.success(t('preview.deps.reinstallSuccess'));
      }
      await refreshPreviewStatus({ silent: true });
      await startPreview({ closeModal: true });
    } catch (err) {
      console.error(err);
      message.error(t('preview.deps.reinstallFailed'));
    } finally {
      setPreviewInstallLoading(false);
    }
  }, [message, refreshPreviewStatus, startPreview, t, taskGroupId]);

  const handleOpenPreviewWindow = useCallback(() => {
    if (!currentPreviewIframeSrc) return;
    window.open(currentPreviewIframeSrc, '_blank', 'noopener,noreferrer');
  }, [currentPreviewIframeSrc]);

  const handleCopyPreviewLink = useCallback(async () => {
    if (!currentPreviewIframeSrc) return;
    try {
      await navigator.clipboard.writeText(currentPreviewIframeSrc);
      message.success(t('preview.copyLinkSuccess'));
    } catch (err) {
      console.error(err);
      message.error(t('preview.copyLinkFailed'));
    }
  }, [currentPreviewIframeSrc, message, t]);

  useEffect(() => {
    if (!taskGroupId || !previewPanelOpen) return;
    let disposed = false;
    const report = (visible: boolean) => {
      if (disposed) return;
      void setTaskGroupPreviewVisibility(taskGroupId, visible);
    };
    const handleVisibility = () => report(document.visibilityState === 'visible');
    const handleHidden = () => report(false);
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);
    window.addEventListener('blur', handleHidden);
    window.addEventListener('pagehide', handleHidden);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
      window.removeEventListener('blur', handleHidden);
      window.removeEventListener('pagehide', handleHidden);
      report(false);
    };
  }, [previewPanelOpen, taskGroupId]);

  const handleComposerPreviewStart = useCallback(() => {
    // Open the preview start modal directly from the dedicated hook so the page no longer reaches into composer-local popover state. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    if (!taskGroupId) return;
    setPreviewStartModalOpen(true);
  }, [taskGroupId]);

  useEffect(() => {
    if (!shouldStreamPreviewLogs) {
      previewLogStreamRef.current?.close();
      previewLogStreamRef.current = null;
      setPreviewLogs([]);
      setPreviewLogsLoading(false);
      return;
    }
    if (!taskGroupId || !activePreviewInstance?.name) return;

    const base = API_BASE_URL.replace(/\/$/, '');
    const token = getToken();
    const params = new URLSearchParams();
    params.set('tail', String(PREVIEW_LOG_TAIL));
    if (token) params.set('token', token);
    const url = `${base}/task-groups/${taskGroupId}/preview/${activePreviewInstance.name}/logs?${params.toString()}`;

    setPreviewLogsLoading(true);
    setPreviewLogs([]);
    const source = new EventSource(url);
    previewLogStreamRef.current = source;

    const handleInit = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const nextLogs = Array.isArray(payload.logs) ? (payload.logs as PreviewLogEntry[]) : [];
        setPreviewLogs(nextLogs.slice(-PREVIEW_LOG_MAX));
      } catch (err) {
        console.error(err);
      } finally {
        setPreviewLogsLoading(false);
      }
    };

    const handleLog = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}') as PreviewLogEntry;
        if (!payload?.message) return;
        setPreviewLogs((prev) => {
          const next = [...prev, payload];
          return next.length > PREVIEW_LOG_MAX ? next.slice(-PREVIEW_LOG_MAX) : next;
        });
      } catch (err) {
        console.error(err);
      }
    };

    source.addEventListener('init', handleInit);
    source.addEventListener('log', handleLog);
    source.onerror = () => setPreviewLogsLoading(false);

    return () => {
      source.removeEventListener('init', handleInit);
      source.removeEventListener('log', handleLog);
      source.close();
      previewLogStreamRef.current = null;
    };
  }, [activePreviewInstance?.name, shouldStreamPreviewLogs, taskGroupId]);

  useEffect(() => {
    if (!taskGroupId || !previewPanelOpen || activePreviewIsTerminal) {
      previewHighlightStreamRef.current?.close();
      previewHighlightStreamRef.current = null;
      return;
    }
    const topic = `preview-highlight:${taskGroupId}`;
    const source = createAuthedEventSource('/events/stream', { topics: topic });
    previewHighlightStreamRef.current = source;

    const handleHighlight = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}') as PreviewHighlightEvent;
        if (!payload?.command || !payload.instanceName) return;
        if (activePreviewInstance?.name && payload.instanceName !== activePreviewInstance.name) return;
        const navigation = maybeAutoNavigatePreviewRef.current(payload.command.targetUrl);
        if (navigation.didNavigate) {
          pendingPreviewHighlightRef.current = payload.command;
          return;
        }
        if (!previewBridgeReadyRef.current) {
          pendingPreviewHighlightRef.current = payload.command;
          postPreviewBridgeMessage({ type: 'hookcode:preview:ping' });
          return;
        }
        postPreviewBridgeMessage({ type: 'hookcode:preview:highlight', ...payload.command });
      } catch (err) {
        console.error(err);
      }
    };

    source.addEventListener('preview.highlight', handleHighlight);
    source.onerror = () => {
      // Keep the current bridge state while the authenticated SSE reconnects. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    };

    return () => {
      source.removeEventListener('preview.highlight', handleHighlight);
      source.close();
      previewHighlightStreamRef.current = null;
    };
  }, [activePreviewInstance?.name, activePreviewIsTerminal, postPreviewBridgeMessage, previewPanelOpen, taskGroupId]);

  useEffect(() => {
    // Reset preview-only workspace state when switching task groups so stale tabs and iframe state do not bleed across routes. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    setPreviewLogTabOpen(false);
    setPreviewStartModalOpen(false);
    setPreviewInstallLoading(false);
    setPreviewState(null);
    setActivePreviewName(null);
    setPreviewLogs([]);
    setPreviewLogsLoading(false);
    setPreviewIframeOverrideSrc(null);
    setPreviewAddress('');
    setPreviewAddressInput('');
    setPreviewAddressEditing(false);
    setPreviewAutoNavigateLocked(false);
  }, [taskGroupId]);

  useEffect(() => {
    if (!taskGroupId) return;
    void refreshPreviewStatus({ silent: true });
  }, [refreshPreviewStatus, taskGroupId]);

  const previewNeedsPolling = previewState?.instances?.some((instance) => instance.status === 'starting') ?? false;
  useEffect(() => {
    if (!taskGroupId || !previewNeedsPolling) return;
    const timer = window.setInterval(() => refreshPreviewStatus({ silent: true }), 2000);
    return () => window.clearInterval(timer);
  }, [previewNeedsPolling, refreshPreviewStatus, taskGroupId]);

  const openPreviewLogs = useCallback(() => {
    setPreviewLogTabOpen(true);
    setActiveWorkspaceTabKey('preview-log');
  }, [setActiveWorkspaceTabKey]);

  const closePreviewLogTab = useCallback(
    (fallbackKey?: string | null) => {
      setPreviewLogTabOpen(false);
      setActiveWorkspaceTabKey((prev) => (prev === 'preview-log' ? fallbackKey ?? null : prev));
    },
    [setActiveWorkspaceTabKey]
  );

  const previewTabItem = previewPanelOpen
    ? {
        key: 'preview',
        label: t('taskGroup.workspace.previewTab'),
        closable: false,
        children: (
          <TaskGroupPreviewWorkspace
            previewInstances={previewInstances}
            activePreviewName={activePreviewName}
            onSelectPreview={setActivePreviewName}
            previewAggregateStatus={previewAggregateStatus}
            activePreviewInstance={activePreviewInstance}
            activePreviewIsTerminal={activePreviewIsTerminal}
            currentPreviewIframeSrc={currentPreviewIframeSrc}
            previewAddressInput={previewAddressInput}
            previewAddress={previewAddress}
            previewAddressMeta={previewAddressMeta}
            previewAutoNavigateLocked={previewAutoNavigateLocked}
            showInlineTerminalLogs={showInlineTerminalLogs}
            previewLogsLoading={previewLogsLoading}
            previewLogs={previewLogs}
            previewTerminalOutput={previewTerminalOutput}
            activePreviewStatus={activePreviewStatus}
            previewPlaceholderText={previewPlaceholderText}
            previewDiagnostics={previewDiagnostics}
            previewDiagnosticsLogs={previewDiagnosticsLogs}
            previewTerminalBodyRef={previewTerminalBodyRef}
            previewIframeRef={previewIframeRef}
            onOpenLogs={openPreviewLogs}
            onOpenWindow={handleOpenPreviewWindow}
            onCopyLink={handleCopyPreviewLink}
            onBack={handlePreviewBack}
            onForward={handlePreviewForward}
            onReload={handlePreviewReload}
            onToggleAutoNavigateLock={() => setPreviewAutoNavigateLocked((prev) => !prev)}
            onAddressInputChange={setPreviewAddressInput}
            onAddressFocus={() => setPreviewAddressEditing(true)}
            onAddressBlur={() => {
              setPreviewAddressEditing(false);
              setPreviewAddressInput(previewAddress || currentPreviewIframeSrc);
            }}
            onNavigate={handlePreviewNavigate}
            onTerminalScroll={handlePreviewTerminalScroll}
            onIframeLoad={handlePreviewIframeLoad}
          />
        )
      }
    : null;

  const previewLogTabItem = previewLogTabOpen
    ? {
        key: 'preview-log',
        label: t('taskGroup.workspace.previewLogsTab'),
        closable: true,
        children: (
          <TaskGroupPreviewLogTab
            statusLabel={activePreviewStatusLabel}
            previewLogsLoading={previewLogsLoading}
            previewLogs={previewLogs}
            formatPreviewLogTime={formatPreviewLogTime}
          />
        )
      }
    : null;

  return {
    layoutRef,
    previewDragActive,
    previewPanelOpen,
    previewPanelMinWidth: PREVIEW_PANEL_MIN_WIDTH,
    previewPanelMaxWidth,
    previewPanelWidth,
    previewPanelStyle,
    handlePreviewDividerPointerDown,
    previewLoading,
    previewActionLoading,
    previewStartModalOpen,
    previewInstallLoading,
    previewLogTabOpen,
    previewStartDisabled,
    previewAggregateStatus,
    previewAggregateStatusLabel,
    previewToggleIcon,
    previewTabItem,
    previewLogTabItem,
    handlePreviewToggle,
    handlePreviewStart,
    handlePreviewReinstall,
    handleComposerPreviewStart,
    closePreviewStartModal: () => setPreviewStartModalOpen(false),
    closePreviewLogTab
  };
};
