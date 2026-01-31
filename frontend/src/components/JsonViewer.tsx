import { FC, useMemo, type ReactNode } from 'react';
import { Tree, Typography } from 'antd';

export interface JsonViewerProps {
  value: unknown;
  emptyFallback?: ReactNode;
  maxDepth?: number;
  defaultExpandDepth?: number;
  className?: string;
}

type JsonTreeNode = {
  key: string;
  title: ReactNode;
  children?: JsonTreeNode[];
  isLeaf?: boolean;
};

type JsonTreeResult = {
  treeData: JsonTreeNode[];
  expandedKeys: string[];
};

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_EXPAND_DEPTH = 1;

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Format primitive values with JSON-like styling for the payload tree UI. docs/en/developer/plans/payloadjsonui20260128/task_plan.md payloadjsonui20260128
const formatPrimitive = (value: unknown): { label: string; className: string } => {
  if (value === null) return { label: 'null', className: 'hc-json-viewer__value--null' };
  if (value === undefined) return { label: 'undefined', className: 'hc-json-viewer__value--undefined' };
  if (typeof value === 'string') return { label: `"${value}"`, className: 'hc-json-viewer__value--string' };
  if (typeof value === 'number') return { label: String(value), className: 'hc-json-viewer__value--number' };
  if (typeof value === 'boolean') return { label: value ? 'true' : 'false', className: 'hc-json-viewer__value--boolean' };
  return { label: String(value), className: 'hc-json-viewer__value--other' };
};

const summarizeContainer = (value: unknown): string => {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isObjectLike(value)) return `Object(${Object.keys(value).length})`;
  return 'Value';
};

const buildJsonTree = (value: unknown, maxDepth: number, defaultExpandDepth: number): JsonTreeResult => {
  // Build a tree-friendly representation with cycle detection for the payload viewer. docs/en/developer/plans/payloadjsonui20260128/task_plan.md payloadjsonui20260128
  const expandedKeys: string[] = [];
  const seen = new WeakSet<object>();

  const buildKey = (path: Array<string | number>) => path.map((part) => String(part).replaceAll('/', '_')).join('/');

  const buildNode = (nodeValue: unknown, label: string, path: Array<string | number>, depth: number): JsonTreeNode => {
    if (nodeValue && typeof nodeValue === 'object') {
      if (seen.has(nodeValue as object)) {
        return {
          key: buildKey(path),
          title: (
            <span className="hc-json-viewer__row">
              <span className="hc-json-viewer__key">{label}</span>
              <span className="hc-json-viewer__separator">: </span>
              <span className="hc-json-viewer__value hc-json-viewer__value--other">[Circular]</span>
            </span>
          ),
          isLeaf: true
        };
      }

      if (depth >= maxDepth) {
        return {
          key: buildKey(path),
          title: (
            <span className="hc-json-viewer__row">
              <span className="hc-json-viewer__key">{label}</span>
              <span className="hc-json-viewer__separator">: </span>
              <span className="hc-json-viewer__summary">{summarizeContainer(nodeValue)}</span>
            </span>
          ),
          isLeaf: true
        };
      }

      seen.add(nodeValue as object);

      const entries = Array.isArray(nodeValue)
        ? nodeValue.map((child, index) => [index, child] as const)
        : Object.entries(nodeValue as Record<string, unknown>);

      const nextPath = [...path];
      const children = entries.map(([childKey, childValue]) => {
        const labelText = Array.isArray(nodeValue) ? `[${childKey}]` : String(childKey);
        return buildNode(childValue, labelText, [...nextPath, childKey], depth + 1);
      });

      if (depth <= defaultExpandDepth) {
        expandedKeys.push(buildKey(path));
      }

      return {
        key: buildKey(path),
        title: (
          <span className="hc-json-viewer__row">
            <span className="hc-json-viewer__key">{label}</span>
            <span className="hc-json-viewer__separator">: </span>
            <span className="hc-json-viewer__summary">{summarizeContainer(nodeValue)}</span>
          </span>
        ),
        children
      };
    }

    const primitive = formatPrimitive(nodeValue);
    return {
      key: buildKey(path),
      title: (
        <span className="hc-json-viewer__row">
          <span className="hc-json-viewer__key">{label}</span>
          <span className="hc-json-viewer__separator">: </span>
          <span className={`hc-json-viewer__value ${primitive.className}`}>{primitive.label}</span>
        </span>
      ),
      isLeaf: true
    };
  };

  if (value === undefined) {
    return { treeData: [], expandedKeys: [] };
  }

  if (value && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.map((child, index) => [index, child] as const) : Object.entries(value);
    if (!entries.length) {
      return {
        treeData: [
          {
            key: 'root',
            title: <span className="hc-json-viewer__summary">{summarizeContainer(value)}</span>,
            isLeaf: true
          }
        ],
        expandedKeys: []
      };
    }

    const treeData = entries.map(([childKey, childValue]) => {
      const labelText = Array.isArray(value) ? `[${childKey}]` : String(childKey);
      return buildNode(childValue, labelText, [childKey], 0);
    });

    return { treeData, expandedKeys };
  }

  const primitiveRoot = formatPrimitive(value);
  return {
    treeData: [
      {
        key: 'value',
        title: (
          <span className="hc-json-viewer__row">
            <span className="hc-json-viewer__key">value</span>
            <span className="hc-json-viewer__separator">: </span>
            <span className={`hc-json-viewer__value ${primitiveRoot.className}`}>{primitiveRoot.label}</span>
          </span>
        ),
        isLeaf: true
      }
    ],
    expandedKeys: []
  };
};

export const JsonViewer: FC<JsonViewerProps> = ({
  value,
  emptyFallback = '-',
  maxDepth = DEFAULT_MAX_DEPTH,
  defaultExpandDepth = DEFAULT_EXPAND_DEPTH,
  className
}) => {
  const { treeData, expandedKeys } = useMemo(
    () => buildJsonTree(value, maxDepth, defaultExpandDepth),
    [defaultExpandDepth, maxDepth, value]
  );

  if (value === undefined) {
    // Preserve the empty-state dash to match the prior payload display behavior. docs/en/developer/plans/payloadjsonui20260128/task_plan.md payloadjsonui20260128
    return <Typography.Text type="secondary">{emptyFallback}</Typography.Text>;
  }

  return (
    <div className={`hc-json-viewer${className ? ` ${className}` : ''}`}>
      <Tree
        blockNode
        selectable={false}
        showLine={{ showLeafIcon: false }}
        treeData={treeData}
        defaultExpandedKeys={expandedKeys}
      />
    </div>
  );
};
