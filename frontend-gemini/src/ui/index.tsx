import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactElement,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { clsx } from 'clsx';

export type Size = 'small' | 'middle' | 'large';

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  type?: 'default' | 'primary' | 'text' | 'link';
  size?: Size;
  shape?: 'round' | 'circle';
  icon?: ReactNode;
  loading?: boolean;
  danger?: boolean;
  block?: boolean;
  htmlType?: React.ButtonHTMLAttributes<HTMLButtonElement>['type'];
};

// Render a lightweight button that reuses local legacy UI-like classes for consistent styling. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    type = 'default',
    size = 'middle',
    shape,
    icon,
    loading,
    danger,
    block,
    className,
    disabled,
    htmlType,
    children,
    ...rest
  },
  ref) => {
    const classNames = clsx(
      'hc-ui-btn',
      type === 'primary' && 'hc-ui-btn-primary',
      (type === 'text' || type === 'link') && `hc-ui-btn-${type}`,
      size === 'small' && 'hc-ui-btn-sm',
      size === 'large' && 'hc-ui-btn-lg',
      shape === 'round' && 'hc-ui-btn-round',
      shape === 'circle' && 'hc-ui-btn-circle',
      danger && 'hc-ui-btn-dangerous',
      block && 'hc-ui-btn-block',
      className
    );

    return (
      <button
        ref={ref}
        type={htmlType || 'button'}
        className={classNames}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <span className="hc-ui-btn-spinner" aria-hidden="true" /> : null}
        {icon ? <span className="hc-ui-btn-icon">{icon}</span> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export type CardProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onClick' | 'className'> & {
  title?: ReactNode;
  extra?: ReactNode;
  size?: Size;
  hoverable?: boolean;
  className?: string;
  styles?: { body?: CSSProperties };
  onClick?: () => void;
  children?: ReactNode;
};

// Provide a card surface with optional header/extra slots to match the console layout. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
// Forward data/aria attributes on cards so test hooks and accessibility markers stay attached. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Card = ({ title, extra, size = 'middle', hoverable, className, styles, onClick, children, ...rest }: CardProps) => {
  const classNames = clsx('hc-ui-card', size === 'small' && 'hc-ui-card-small', hoverable && 'hc-ui-card-hoverable', className);
  return (
    <div
      className={classNames}
      {...rest}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {title || extra ? (
        <div className="hc-ui-card-head">
          <div className="hc-ui-card-head-title">{title}</div>
          {extra ? <div className="hc-ui-card-extra">{extra}</div> : null}
        </div>
      ) : null}
      <div className="hc-ui-card-body" style={styles?.body}>
        {children}
      </div>
    </div>
  );
};

export type TypographyTextProps = {
  type?: 'secondary' | 'danger' | 'success';
  strong?: boolean;
  code?: boolean;
  delete?: boolean;
  ellipsis?: boolean | { tooltip?: ReactNode };
  copyable?: boolean | { text?: string };
  className?: string;
  style?: CSSProperties;
  title?: string;
  children?: ReactNode;
};

const extractPlainText = (node: ReactNode): string => {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join('');
  return '';
};

// Standardize text styles (secondary/danger/strong) to keep parity with legacy typography. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const TypographyText = ({
  type,
  strong,
  code,
  delete: del,
  ellipsis,
  copyable,
  className,
  style,
  title,
  children
}: TypographyTextProps) => {
  const ellipsisEnabled = Boolean(ellipsis);
  const ellipsisTitle =
    typeof ellipsis === 'object' && ellipsis?.tooltip !== undefined
      ? ellipsis.tooltip
      : title;
  const classNames = clsx(
    'hc-ui-typography',
    type === 'secondary' && 'hc-ui-typography-secondary',
    type === 'danger' && 'hc-ui-typography-danger',
    strong && 'hc-ui-typography-strong',
    code && 'hc-ui-typography-code',
    del && 'hc-ui-typography-delete',
    ellipsisEnabled && 'hc-ui-typography-ellipsis',
    className
  );
  const Component: any = code ? 'code' : 'span';
  const copyText =
    typeof copyable === 'object' && copyable?.text !== undefined
      ? String(copyable.text)
      : extractPlainText(children) || (typeof title === 'string' ? title : '');

  const contentNode = (
    <Component className={classNames} style={style} title={typeof ellipsisTitle === 'string' ? ellipsisTitle : title}>
      {children}
    </Component>
  );

  if (!copyable) return contentNode;

  return (
    <span className="hc-ui-typography-copyable">
      {contentNode}
      <button
        type="button"
        className="hc-ui-typography-copy"
        aria-label="Copy"
        onClick={() => {
          if (!copyText) return;
          if (navigator?.clipboard?.writeText) {
            void navigator.clipboard.writeText(copyText);
          } else if (typeof document !== 'undefined') {
            const textarea = document.createElement('textarea');
            textarea.value = copyText;
            textarea.setAttribute('readonly', 'true');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
          }
        }}
      >
        Copy
      </button>
    </span>
  );
};

export type TypographyTitleProps = {
  level?: 1 | 2 | 3 | 4 | 5;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

// Provide simple heading styles aligned with the console card layout. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const TypographyTitle = ({ level = 4, className, style, children }: TypographyTitleProps) => {
  const Tag = (`h${level}` as keyof JSX.IntrinsicElements) || 'h4';
  return (
    <Tag className={clsx('hc-ui-typography-title', className)} style={style}>
      {children}
    </Tag>
  );
};

export type TypographyParagraphProps = Omit<TypographyTextProps, 'code' | 'delete' | 'copyable'>;

// Render paragraphs with shared typography styling for descriptions and tips. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const TypographyParagraph = ({ type, strong, ellipsis, className, style, title, children }: TypographyParagraphProps) => {
  const classNames = clsx(
    'hc-ui-typography',
    'hc-ui-typography-paragraph',
    type === 'secondary' && 'hc-ui-typography-secondary',
    type === 'danger' && 'hc-ui-typography-danger',
    strong && 'hc-ui-typography-strong',
    ellipsis && 'hc-ui-typography-ellipsis',
    className
  );
  return (
    <p className={classNames} style={style} title={title}>
      {children}
    </p>
  );
};

export type TypographyLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  type?: 'secondary' | 'danger' | 'success';
};

// Provide link-styled typography for inline navigation and references. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const TypographyLink = ({ type, className, style, children, ...rest }: TypographyLinkProps) => (
  <a
    {...rest}
    className={clsx(
      'hc-ui-typography',
      'hc-ui-typography-link',
      type === 'secondary' && 'hc-ui-typography-secondary',
      type === 'danger' && 'hc-ui-typography-danger',
      className
    )}
    style={style}
  >
    {children}
  </a>
);

export const Typography = {
  Text: TypographyText,
  Title: TypographyTitle,
  Paragraph: TypographyParagraph,
  Link: TypographyLink
};

export type SpaceProps = {
  direction?: 'horizontal' | 'vertical';
  orientation?: 'horizontal' | 'vertical';
  size?: number | 'small' | 'middle' | 'large';
  wrap?: boolean;
  align?: 'start' | 'center' | 'end' | 'baseline';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

const resolveSpaceSize = (size: SpaceProps['size']): number => {
  if (typeof size === 'number') return size;
  if (size === 'small') return 6;
  if (size === 'large') return 16;
  return 10;
};

// Use a flex-based spacing wrapper to replace legacy UI's Space for layout consistency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Space = ({ direction = 'horizontal', orientation, size = 'middle', wrap, align, className, style, children }: SpaceProps) => {
  const gap = resolveSpaceSize(size);
  const resolvedDirection = orientation ?? direction;
  return (
    <div
      className={clsx('hc-ui-space', className)}
      style={{
        display: 'flex',
        flexDirection: resolvedDirection === 'vertical' ? 'column' : 'row',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: align,
        gap,
        ...style
      }}
    >
      {children}
    </div>
  );
};

export type TagProps = {
  color?: string;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

// Render tags with compact pills and optional icons to match status badges. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Tag = ({ color, icon, className, style, children }: TagProps) => {
  const colorClass = color ? `hc-ui-tag-${color}` : undefined;
  return (
    <span className={clsx('hc-ui-tag', colorClass, className)} style={style}>
      {icon ? <span className="hc-ui-tag-icon">{icon}</span> : null}
      {children}
    </span>
  );
};

export type EmptyProps = {
  description?: ReactNode;
  image?: ReactNode;
  className?: string;
  children?: ReactNode;
};

// Provide a minimalist empty state placeholder for list/grid gaps. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Empty = ({ description, image, className, children }: EmptyProps) => (
  <div className={clsx('hc-ui-empty', className)}>
    {image ? <div className="hc-ui-empty-image">{image}</div> : null}
    {description ? <div className="hc-ui-empty-description">{description}</div> : null}
    {children ? <div className="hc-ui-empty-footer">{children}</div> : null}
  </div>
);

export type SkeletonProps = {
  active?: boolean;
  title?: boolean | { width?: number | string };
  paragraph?: boolean | { rows?: number; width?: Array<number | string> };
  className?: string;
};

// Create lightweight skeleton placeholders for loading states without external dependencies. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Skeleton = ({ active, title = true, paragraph = true, className }: SkeletonProps) => {
  const rows = typeof paragraph === 'object' ? paragraph.rows ?? 3 : paragraph ? 3 : 0;
  const widths = typeof paragraph === 'object' ? paragraph.width ?? [] : [];
  return (
    <div className={clsx('hc-ui-skeleton', active && 'hc-ui-skeleton-active', className)}>
      {title ? <div className="hc-ui-skeleton-title" /> : null}
      {rows ? (
        <ul className="hc-ui-skeleton-paragraph">
          {Array.from({ length: rows }).map((_, index) => (
            <li key={index} style={{ width: widths[index] ?? '100%' }} />
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export type SkeletonElementProps = {
  active?: boolean;
  size?: Size | 'default';
  className?: string;
  style?: CSSProperties;
};

// Provide Skeleton.Input and Skeleton.Button shims for existing placeholder layouts. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const SkeletonInput = ({ active, size = 'default', className, style }: SkeletonElementProps) => (
  <div
    className={clsx(
      'hc-ui-skeleton-input',
      active && 'hc-ui-skeleton-active',
      size === 'small' && 'hc-ui-skeleton-input-sm',
      size === 'large' && 'hc-ui-skeleton-input-lg',
      className
    )}
    style={style}
  />
);

// Provide Skeleton.Button for list/status placeholders that rely on button sizing. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const SkeletonButton = ({ active, size = 'default', className, style }: SkeletonElementProps) => (
  <div
    className={clsx(
      'hc-ui-skeleton-button',
      active && 'hc-ui-skeleton-active',
      size === 'small' && 'hc-ui-skeleton-button-sm',
      size === 'large' && 'hc-ui-skeleton-button-lg',
      className
    )}
    style={style}
  />
);

Skeleton.Input = SkeletonInput as any;
Skeleton.Button = SkeletonButton as any;

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  allowClear?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  variant?: 'outlined' | 'borderless';
};

// Render a styled text input with optional prefix/suffix and clear affordance. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Input = ({ allowClear, prefix, suffix, className, value, onChange, variant, ...rest }: InputProps) => {
  const [focused, setFocused] = useState(false);
  const showAffix = Boolean(prefix || suffix || allowClear);
  const showClear = allowClear && value !== undefined && value !== '';
  const wrapperClass = clsx(
    'hc-ui-input-affix-wrapper',
    focused && 'hc-ui-input-affix-wrapper-focused',
    variant === 'borderless' && 'hc-ui-input-borderless',
    className
  );
  const inputClass = clsx('hc-ui-input', variant === 'borderless' && 'hc-ui-input-borderless');

  const handleClear = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!onChange) return;
    const target = event.target as HTMLButtonElement;
    if (!target) return;
    const synthetic = { target: { value: '' } } as any;
    onChange(synthetic);
  };

  const inputNode = (
    <input
      {...rest}
      className={inputClass}
      value={value as any}
      onChange={onChange}
      onFocus={(event) => {
        setFocused(true);
        rest.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        rest.onBlur?.(event);
      }}
    />
  );

  if (!showAffix) return inputNode;

  return (
    <span className={wrapperClass}>
      {prefix ? <span className="hc-ui-input-prefix">{prefix}</span> : null}
      {inputNode}
      {showClear ? (
        <button type="button" className="hc-ui-input-clear-icon" onClick={handleClear} aria-label="Clear">
          ×
        </button>
      ) : null}
      {suffix ? <span className="hc-ui-input-suffix">{suffix}</span> : null}
    </span>
  );
};

export type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  variant?: 'outlined' | 'borderless';
};

// Provide a controlled textarea that supports auto-resize for the chat composer. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(({ autoSize, className, variant, style, ...rest }, ref) => {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

  useEffect(() => {
    if (!autoSize || !localRef.current) return;
    const el = localRef.current;
    el.style.height = 'auto';
    const minRows = typeof autoSize === 'object' ? autoSize.minRows ?? 1 : 1;
    const maxRows = typeof autoSize === 'object' ? autoSize.maxRows ?? 12 : 12;
    const lineHeight = 20;
    const nextHeight = Math.min(maxRows * lineHeight, Math.max(minRows * lineHeight, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
  }, [autoSize, rest.value]);

  return (
    <textarea
      ref={localRef}
      {...rest}
      className={clsx('hc-ui-input', 'hc-ui-input-textarea', variant === 'borderless' && 'hc-ui-input-borderless', className)}
      style={style}
    />
  );
});
TextArea.displayName = 'TextArea';

export type PasswordProps = Omit<InputProps, 'type'>;

// Offer a password input with a visibility toggle so credential forms stay usable. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const Password = ({ className, ...rest }: PasswordProps) => {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...rest}
      className={clsx('hc-ui-input-password', className)}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className="hc-ui-input-password-icon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
};

Input.TextArea = TextArea as any;
Input.Password = Password as any;

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectProps = {
  value?: string | string[];
  defaultValue?: string | string[];
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: Size;
  mode?: 'multiple';
  showSearch?: boolean;
  optionFilterProp?: 'label' | 'value';
  className?: string;
  style?: CSSProperties;
  variant?: 'borderless' | 'outlined';
  popupMatchSelectWidth?: boolean;
  onChange?: (value: any) => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'className' | 'style'>;

// Implement a custom select with optional search/multiple support to replace legacy UI. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
// Forward aria/data attributes to the interactive selector for accessibility and tests. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Select = ({
  value,
  defaultValue,
  options = [],
  placeholder,
  disabled,
  loading,
  size = 'middle',
  mode,
  showSearch,
  optionFilterProp = 'label',
  className,
  style,
  variant,
  onChange,
  ...rest
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMultiple = mode === 'multiple';
  const [internalValue, setInternalValue] = useState<string | string[] | undefined>(defaultValue);
  const mergedValue = value !== undefined ? value : internalValue;

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedValues = useMemo(() => {
    if (isMultiple) return Array.isArray(mergedValue) ? mergedValue : [];
    return mergedValue ? [String(mergedValue)] : [];
  }, [isMultiple, mergedValue]);

  const filteredOptions = useMemo(() => {
    if (!showSearch || !search.trim()) return options;
    const query = search.trim().toLowerCase();
    return options.filter((option) => {
      const label = optionFilterProp === 'value' ? option.value : String(option.label ?? '');
      return label.toLowerCase().includes(query);
    });
  }, [optionFilterProp, options, search, showSearch]);

  const selectValue = (next: string) => {
    if (disabled) return;
    if (isMultiple) {
      const current = new Set(selectedValues);
      if (current.has(next)) {
        current.delete(next);
      } else {
        current.add(next);
      }
      const arr = Array.from(current);
      setInternalValue(arr);
      onChange?.(arr);
    } else {
      setInternalValue(next);
      onChange?.(next);
      setOpen(false);
    }
  };

  const removeValue = (next: string) => {
    if (!isMultiple) return;
    const current = new Set(selectedValues);
    current.delete(next);
    const arr = Array.from(current);
    setInternalValue(arr);
    onChange?.(arr);
  };

  const displayLabel = !isMultiple
    ? options.find((option) => option.value === selectedValues[0])?.label
    : null;

  const { onClick: onSelectorClick, onKeyDown: onSelectorKeyDown, ...selectorProps } = rest;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'hc-ui-select',
        isMultiple && 'hc-ui-select-multiple',
        open && 'hc-ui-select-open',
        open && 'hc-ui-select-focused',
        disabled && 'hc-ui-select-disabled',
        variant === 'borderless' && 'hc-ui-select-borderless',
        size === 'small' && 'hc-ui-select-sm',
        className
      )}
      style={style}
    >
      <div
        className="hc-ui-select-selector"
        role="button"
        tabIndex={0}
        {...selectorProps}
        onClick={(event) => {
          onSelectorClick?.(event);
          if (!disabled) setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          onSelectorKeyDown?.(event);
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!disabled) setOpen((v) => !v);
          }
        }}
      >
        {isMultiple ? (
          selectedValues.length ? (
            selectedValues.map((item) => {
              const option = options.find((opt) => opt.value === item);
              return (
                <span key={item} className="hc-ui-select-selection-item">
                  {option?.label ?? item}
                  <button
                    type="button"
                    className="hc-ui-select-selection-item-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeValue(item);
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })
          ) : (
            <span className="hc-ui-select-selection-placeholder">{placeholder}</span>
          )
        ) : (
          <span className="hc-ui-select-selection-item">
            {displayLabel ?? <span className="hc-ui-select-selection-placeholder">{placeholder}</span>}
          </span>
        )}
        {showSearch ? (
          <input
            className="hc-ui-select-selection-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={selectedValues.length ? undefined : placeholder}
            onFocus={() => setOpen(true)}
            disabled={disabled}
          />
        ) : null}
      </div>

      {open ? (
        <div className="hc-ui-select-dropdown">
          {loading ? <div className="hc-ui-select-dropdown-empty">Loading…</div> : null}
          {!loading && !filteredOptions.length ? <div className="hc-ui-select-dropdown-empty">No options</div> : null}
          {!loading && filteredOptions.length ? (
            <div className="hc-ui-select-dropdown-list">
              {filteredOptions.map((option) => {
                const active = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={clsx('hc-ui-select-dropdown-item', active && 'is-selected')}
                    disabled={option.disabled}
                    onClick={() => {
                      if (!option.disabled) selectValue(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type'> & {
  checked?: boolean;
  disabled?: boolean;
  size?: 'small' | 'default';
  onChange?: (checked: boolean) => void;
};

// Forward aria/data attributes on switches so labeled controls are discoverable in tests. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Switch = ({ checked, disabled, size = 'default', onChange, onClick, ...rest }: SwitchProps) => (
  <button
    type="button"
    className={clsx('hc-ui-switch', checked && 'hc-ui-switch-checked', size === 'small' && 'hc-ui-switch-small')}
    aria-checked={checked}
    role="switch"
    disabled={disabled}
    onClick={(event) => {
      onClick?.(event);
      if (!disabled) onChange?.(!checked);
    }}
    {...rest}
  >
    <span className="hc-ui-switch-handle" />
  </button>
);

export type TooltipProps = {
  title?: ReactNode;
  children: ReactElement;
};

// Offer a hover tooltip built on the shared popover styles. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Tooltip = ({ title, children }: TooltipProps) => {
  return (
    <Popover content={title} trigger="hover">
      {children}
    </Popover>
  );
};

export type PopoverProps = {
  content?: ReactNode;
  children: ReactElement;
  trigger?: 'hover' | 'click' | Array<'hover' | 'click'>;
  placement?: 'bottom' | 'bottomLeft' | 'top' | 'topLeft';
};

// Provide a basic popover wrapper for inline overlays like time window pickers. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Popover = ({ content, children, trigger = 'click', placement = 'bottom' }: PopoverProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const triggers = Array.isArray(trigger) ? trigger : [trigger];
  const placementClass = placement.startsWith('top') ? 'top' : 'bottom';

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const childProps: Record<string, any> = {};
  if (triggers.includes('click')) {
    childProps.onClick = (event: React.MouseEvent) => {
      children.props.onClick?.(event);
      setOpen((v) => !v);
    };
  }
  if (triggers.includes('hover')) {
    childProps.onMouseEnter = (event: React.MouseEvent) => {
      children.props.onMouseEnter?.(event);
      setOpen(true);
    };
    childProps.onMouseLeave = (event: React.MouseEvent) => {
      children.props.onMouseLeave?.(event);
      setOpen(false);
    };
  }

  return (
    <span className="hc-ui-popover-wrapper" ref={wrapperRef}>
      {React.cloneElement(children, childProps)}
      {open ? (
        <div className={clsx('hc-ui-popover', `hc-ui-popover-${placementClass}`)}>
          <div className="hc-ui-popover-inner">{content}</div>
        </div>
      ) : null}
    </span>
  );
};

export type TabsProps = {
  items: Array<{ key: string; label: ReactNode; children?: ReactNode; disabled?: boolean }>;
  activeKey?: string;
  onChange?: (key: string) => void;
};

// Use simple tab navigation for archive and automation panels without external UI deps. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Tabs = ({ items, activeKey, onChange }: TabsProps) => {
  const resolvedKey = activeKey ?? items[0]?.key;
  const activeItem = items.find((item) => item.key === resolvedKey) ?? items[0];
  return (
    <div className="hc-ui-tabs">
      <div className="hc-ui-tabs-nav">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={clsx('hc-ui-tabs-tab', item.key === resolvedKey && 'hc-ui-tabs-tab-active')}
            disabled={item.disabled}
            onClick={() => onChange?.(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="hc-ui-tabs-content">{activeItem?.children}</div>
    </div>
  );
};

export type AlertProps = {
  type?: 'info' | 'warning' | 'error' | 'success';
  message?: ReactNode;
  description?: ReactNode;
  showIcon?: boolean;
  className?: string;
  style?: CSSProperties;
};

// Render inline alerts for warnings/errors with a compact layout. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Alert = ({ type = 'info', message, description, showIcon, className, style }: AlertProps) => {
  return (
    <div className={clsx('hc-ui-alert', `hc-ui-alert-${type}`, className)} style={style}>
      {showIcon ? <span className="hc-ui-alert-icon" aria-hidden="true" /> : null}
      <div>
        {message ? <div className="hc-ui-alert-message">{message}</div> : null}
        {description ? <div className="hc-ui-alert-description">{description}</div> : null}
      </div>
    </div>
  );
};

export type ListProps<T> = {
  dataSource?: T[];
  renderItem?: (item: T, index: number) => ReactNode;
  className?: string;
  bordered?: boolean;
  size?: 'small' | 'middle' | 'large';
  style?: CSSProperties;
};

// Provide a minimal list wrapper for model catalogs and basic lists. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const List = <T,>({ dataSource = [], renderItem, className, style }: ListProps<T>) => (
  <div className={clsx('hc-ui-list', className)} style={style}>
    {dataSource.map((item, index) => (
      <div key={index} className="hc-ui-list-item">
        {renderItem ? renderItem(item, index) : null}
      </div>
    ))}
  </div>
);

export type DividerProps = {
  className?: string;
  style?: CSSProperties;
};

// Insert a subtle divider between stacked sections in settings panels. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Divider = ({ className, style }: DividerProps) => <div className={clsx('hc-ui-divider', className)} style={style} />;

export type AvatarProps = {
  src?: string;
  size?: number;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

// Show user avatars with initials as fallback. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Avatar = ({ src, size = 32, icon, className, children }: AvatarProps) => (
  <span className={clsx('hc-ui-avatar', className)} style={{ width: size, height: size }}>
    {src ? <img src={src} alt="" /> : icon ?? children}
  </span>
);

export type BadgeProps = {
  color?: string;
  text?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

// Provide compact status badges for automation status lists. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Badge = ({ color, text, className, style }: BadgeProps) => (
  <span className={clsx('hc-ui-badge', color && `hc-ui-badge-${color}`, className)} style={style}>
    {text}
  </span>
);

export type ProgressProps = {
  percent?: number;
  size?: number;
  type?: 'line' | 'dashboard';
  strokeColor?: string;
  trailColor?: string;
  format?: (percent?: number) => ReactNode;
};

// Render a simple progress indicator for dashboard metrics (line + dashboard). docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Progress = ({ percent = 0, size = 80, type = 'line', strokeColor, trailColor, format }: ProgressProps) => {
  const safePercent = Math.max(0, Math.min(100, percent));
  if (type === 'dashboard') {
    const radius = size / 2 - 6;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (safePercent / 100) * circumference;
    return (
      <div className="hc-ui-progress hc-ui-progress-dashboard" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trailColor || 'rgba(148,163,184,0.25)'}
            strokeWidth={6}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor || 'var(--accent)'}
            strokeWidth={6}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="hc-ui-progress-text">{format ? format(safePercent) : `${safePercent}%`}</span>
      </div>
    );
  }

  return (
    <div className="hc-ui-progress">
      <div className="hc-ui-progress-inner" style={{ background: trailColor }}>
        <div className="hc-ui-progress-bg" style={{ width: `${safePercent}%`, background: strokeColor }} />
      </div>
      <span className="hc-ui-progress-text">{format ? format(safePercent) : `${safePercent}%`}</span>
    </div>
  );
};

export type StepsItem = { title: ReactNode; description?: ReactNode };
export type StepsProps = {
  current?: number;
  items: StepsItem[];
  size?: Size;
  responsive?: boolean;
  className?: string;
  onChange?: (current: number) => void;
};

// Make steps clickable so workflow panels can be switched without legacy UI dependencies. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Steps = ({ current = 0, items, size = 'middle', className, onChange }: StepsProps) => (
  <div className={clsx('hc-ui-steps', size === 'small' && 'hc-ui-steps-sm', className)}>
    {items.map((item, index) => {
      const isActive = index === current;
      return (
        <button
          key={index}
          type="button"
          className={clsx('hc-ui-steps-item', isActive && 'hc-ui-steps-item-active')}
          aria-current={isActive ? 'step' : undefined}
          onClick={() => onChange?.(index)}
        >
          <div className="hc-ui-steps-item-title">{item.title}</div>
          {item.description ? <div className="hc-ui-steps-item-description">{item.description}</div> : null}
        </button>
      );
    })}
  </div>
);

export type RadioProps = {
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const RadioGroupContext = createContext<{
  value?: any;
  onChange?: (value: any) => void;
  optionType?: 'button';
} | null>(null);

// Provide a radio control that works standalone and inside Radio.Group. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Radio = ({ value, checked, disabled, children, onChange }: RadioProps) => {
  const group = useContext(RadioGroupContext);
  const isChecked = group ? group.value === value : checked;
  const isButton = group?.optionType === 'button';
  return (
    <label className={clsx(isButton ? 'hc-ui-radio-button' : 'hc-ui-radio')}>
      <input
        type="radio"
        value={value}
        checked={Boolean(isChecked)}
        disabled={disabled}
        onChange={(event) => {
          group?.onChange?.(value);
          onChange?.(event);
        }}
      />
      <span className={clsx(isButton && isChecked && 'hc-ui-radio-button-checked')}>{children}</span>
    </label>
  );
};

export type RadioGroupProps = {
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  optionType?: 'button';
  buttonStyle?: 'solid' | 'outline';
  options?: Array<{ label: ReactNode; value: string; disabled?: boolean }>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>;

// Support option-based radio groups and data attributes for task filter tooling. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
Radio.Group = ({ value, onChange, optionType, buttonStyle: _buttonStyle, options, children, className, style, ...rest }: RadioGroupProps) => (
  <div className={clsx(optionType === 'button' && 'hc-ui-radio-group-button', className)} style={style} {...rest}>
    <RadioGroupContext.Provider
      value={{
        value,
        optionType,
        onChange: (next) => onChange?.({ target: { value: next } })
      }}
    >
      {options?.length
        ? options.map((option) => (
            <Radio key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </Radio>
          ))
        : children}
    </RadioGroupContext.Provider>
  </div>
);

// Provide Radio.Button via the same component for button-styled groups. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
Radio.Button = ({ value, children }: RadioProps) => <Radio value={value}>{children}</Radio>;

export type RowProps = {
  gutter?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

// Offer a basic row/col grid for form layouts without CSS frameworks. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Row = ({ gutter = 0, className, style, children }: RowProps) => (
  <div className={clsx('hc-ui-row', className)} style={{ gap: gutter, ...style }}>
    {children}
  </div>
);

export type ColProps = {
  span?: number;
  xs?: number;
  md?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

// Provide responsive column widths to match existing form grids. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Col = ({ span, xs, md, className, style, children }: ColProps) => {
  const width = span ? `${(span / 24) * 100}%` : undefined;
  const xsWidth = xs ? `${(xs / 24) * 100}%` : undefined;
  const mdWidth = md ? `${(md / 24) * 100}%` : undefined;
  return (
    <div
      className={clsx('hc-ui-col', className)}
      style={{
        '--col-xs': xsWidth ?? width,
        '--col-md': mdWidth,
        ...style
      } as CSSProperties}
    >
      {children}
    </div>
  );
};

export type DescriptionsProps = {
  column?: number;
  size?: Size;
  styles?: { label?: CSSProperties };
  children?: ReactNode;
};

// Render definition lists with label/value rows for task metadata. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Descriptions = ({ column = 1, styles, children }: DescriptionsProps) => (
  <div className="hc-ui-descriptions">
    <div className="hc-ui-descriptions-view" style={{ gridTemplateColumns: `repeat(${column}, minmax(0, 1fr))` }}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as ReactElement, { labelStyle: styles?.label })
          : child
      )}
    </div>
  </div>
);

export type DescriptionsItemProps = {
  label?: ReactNode;
  children?: ReactNode;
  labelStyle?: CSSProperties;
};

// Keep description items aligned and compact in detail panels. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const DescriptionsItem = ({ label, children, labelStyle }: DescriptionsItemProps) => (
  <div className="hc-ui-descriptions-row">
    <div className="hc-ui-descriptions-item-label" style={labelStyle}>
      {label}
    </div>
    <div className="hc-ui-descriptions-item-content">{children}</div>
  </div>
);

Descriptions.Item = DescriptionsItem as any;

export type MenuItem = {
  key: string;
  label?: ReactNode;
  icon?: ReactNode;
};

export type MenuProps = {
  items?: MenuItem[];
  selectedKeys?: string[];
  onClick?: (info: { key: string }) => void;
  className?: string;
};

// Provide a vertical menu list for sidebar task groups. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Menu = ({ items = [], selectedKeys = [], onClick, className }: MenuProps) => (
  <ul className={clsx('hc-ui-menu', className)}>
    {items.map((item) => (
      <li key={item.key} className="hc-ui-menu-item-wrapper">
        <button
          type="button"
          className={clsx('hc-ui-menu-item', selectedKeys.includes(item.key) && 'hc-ui-menu-item-selected')}
          onClick={() => onClick?.({ key: item.key })}
        >
          {item.icon ? <span className="hc-ui-menu-item-icon">{item.icon}</span> : null}
          <span>{item.label}</span>
        </button>
      </li>
    ))}
  </ul>
);

export type LayoutProps = { className?: string; children?: ReactNode };

// Render a simple layout wrapper to host the sidebar + content shell. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Layout = ({ className, children }: LayoutProps) => <div className={clsx('hc-ui-layout', className)}>{children}</div>;

export type SiderProps = {
  collapsed?: boolean;
  width?: number | string;
  collapsedWidth?: number | string;
  trigger?: ReactNode | null;
  className?: string;
  children?: ReactNode;
};

// Provide a sider container compatible with the existing hc-sider styles. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const Sider = ({ collapsed, width, collapsedWidth, className, children }: SiderProps) => {
  const resolvedWidth = collapsed ? collapsedWidth ?? width : width;
  return (
    <aside
      className={clsx('hc-ui-layout-sider', collapsed && 'hc-ui-layout-sider-collapsed', className)}
      style={resolvedWidth ? { width: resolvedWidth } : undefined}
    >
      <div className="hc-ui-layout-sider-children">{children}</div>
    </aside>
  );
};

export type ContentProps = { className?: string; children?: ReactNode };

// Provide the main content container for app routes. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const Content = ({ className, children }: ContentProps) => <main className={clsx('hc-ui-layout-content', className)}>{children}</main>;

Layout.Sider = Sider as any;
Layout.Content = Content as any;

export type DropdownMenuItem = { key: string; label: ReactNode };
export type DropdownProps = {
  menu: { items: DropdownMenuItem[]; onClick?: (info: { key: string }) => void };
  trigger?: Array<'click' | 'hover'>;
  children: ReactElement;
};

// Build a dropdown menu using the popover overlay for compact action lists. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Dropdown = ({ menu, trigger = ['hover'], children }: DropdownProps) => {
  return (
    <Popover
      trigger={trigger}
      content={
        <div className="hc-ui-dropdown-menu">
          {menu.items.map((item) => (
            <button
              key={item.key}
              type="button"
              className="hc-ui-dropdown-menu-item"
              onClick={() => menu.onClick?.({ key: item.key })}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      {children}
    </Popover>
  );
};

export type ModalProps = {
  open?: boolean;
  title?: ReactNode;
  onCancel?: () => void;
  onOk?: () => void;
  confirmLoading?: boolean;
  footer?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  width?: number | string;
  centered?: boolean;
  destroyOnHidden?: boolean;
  destroyOnClose?: boolean;
  className?: string;
  style?: CSSProperties;
  styles?: { body?: CSSProperties };
  children?: ReactNode;
};

type ConfirmConfig = ModalProps & { content?: ReactNode };

const activeConfirmDestroyers = new Set<() => void>();

// Provide a modal dialog with header/body/footer plus a global confirm helper. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Modal = ({
  open,
  title,
  onCancel,
  onOk,
  confirmLoading,
  footer,
  okText,
  cancelText,
  okButtonProps,
  cancelButtonProps,
  width,
  centered,
  destroyOnHidden,
  destroyOnClose,
  className,
  style,
  styles,
  children
}: ModalProps) => {
  if (!open || typeof document === 'undefined') return null;

  const modalNode = (
    <div className="hc-ui-modal-root">
      <div className="hc-ui-modal-mask" onClick={onCancel} />
      <div className={clsx('hc-ui-modal-wrap', centered && 'hc-ui-modal-centered')}>
        <div className={clsx('hc-ui-modal', className)} style={{ width, ...style }} role="dialog" aria-modal="true">
          <div className="hc-ui-modal-content">
            {title ? <div className="hc-ui-modal-header">{title}</div> : null}
            <div className="hc-ui-modal-body" style={styles?.body}>{children}</div>
            {footer !== undefined ? (
              <div className="hc-ui-modal-footer">{footer}</div>
            ) : (
              <div className="hc-ui-modal-footer">
                {onCancel ? (
                  <Button onClick={onCancel} {...cancelButtonProps}>
                    {cancelText ?? 'Cancel'}
                  </Button>
                ) : null}
                {onOk ? (
                  <Button type="primary" loading={confirmLoading} onClick={onOk} {...okButtonProps}>
                    {okText ?? 'OK'}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};

// Provide modal.confirm API compatible with existing callsites. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
Modal.confirm = (config: ConfirmConfig) => {
  if (typeof document === 'undefined') return { destroy: () => undefined } as any;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const destroy = () => {
    root.unmount();
    container.remove();
    activeConfirmDestroyers.delete(destroy);
  };

  const handleOk = () => {
    config.onOk?.();
    destroy();
  };

  const handleCancel = () => {
    config.onCancel?.();
    destroy();
  };

  root.render(
    <Modal
      open
      title={config.title}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={config.okText}
      cancelText={config.cancelText}
      okButtonProps={config.okButtonProps}
      cancelButtonProps={config.cancelButtonProps}
      width={config.width}
      centered
    >
      {config.content}
    </Modal>
  );

  activeConfirmDestroyers.add(destroy);
  return { destroy } as any;
};

// Allow tests to clear all confirm dialogs. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
Modal.destroyAll = () => {
  activeConfirmDestroyers.forEach((destroy) => destroy());
  activeConfirmDestroyers.clear();
};

export type DrawerProps = {
  open?: boolean;
  title?: ReactNode;
  onClose?: () => void;
  placement?: 'right' | 'bottom';
  width?: number | string;
  destroyOnClose?: boolean;
  footer?: ReactNode;
  extra?: ReactNode;
  className?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  children?: ReactNode;
};

// Implement a minimal drawer overlay for small-screen dialogs. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Drawer = ({ open, title, onClose, placement = 'right', width, footer, extra, className, style, bodyStyle, children }: DrawerProps) => {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="hc-ui-drawer-root">
      <div className="hc-ui-drawer-mask" onClick={onClose} />
      <div className={clsx('hc-ui-drawer', placement === 'bottom' && 'hc-ui-drawer-bottom', className)} style={{ width, ...style }}>
        {title ? (
          <div className="hc-ui-drawer-header">
            <div className="hc-ui-drawer-title">{title}</div>
            {extra ? <div className="hc-ui-drawer-extra">{extra}</div> : null}
          </div>
        ) : null}
        <div className="hc-ui-drawer-body" style={bodyStyle}>{children}</div>
        {footer ? <div className="hc-ui-drawer-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
};

export type PopconfirmProps = {
  title?: ReactNode;
  onConfirm?: () => void;
  okText?: ReactNode;
  cancelText?: ReactNode;
  children: ReactElement;
};

// Provide a confirmation popover for destructive actions like archive/unarchive. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Popconfirm = ({ title, onConfirm, okText, cancelText, children }: PopconfirmProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  // Normalize Popconfirm handlers and markup after escaping artifacts. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <span ref={wrapperRef} className="hc-ui-popover-wrapper">
      {React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          setOpen((v) => !v);
        }
      })}
      {open ? (
        <div className={clsx('hc-ui-popover', 'hc-ui-popover-bottom')}>
          <div className="hc-ui-popover-inner hc-ui-popconfirm">
            <div className="hc-ui-popconfirm-message">{title}</div>
            <div className="hc-ui-popconfirm-actions">
              <Button
                size="small"
                onClick={() => {
                  onConfirm?.();
                  setOpen(false);
                }}
              >
                {okText ?? 'OK'}
              </Button>
              <Button size="small" type="text" onClick={() => setOpen(false)}>
                {cancelText ?? 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
};

export type PaginationConfig = {
  current?: number;
  pageSize?: number;
  total?: number;
  showSizeChanger?: boolean;
  pageSizeOptions?: string[];
  hideOnSinglePage?: boolean;
  onChange?: (page: number, pageSize: number) => void;
};

export type PaginationProps = PaginationConfig & {
  size?: Size;
};

// Render a compact pagination control for credential/profile lists. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Pagination = ({
  current = 1,
  pageSize = 10,
  total = 0,
  showSizeChanger,
  pageSizeOptions,
  hideOnSinglePage,
  onChange,
  size = 'middle'
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (hideOnSinglePage && totalPages <= 1) return null;
  const nextPage = (page: number, nextSize = pageSize) => onChange?.(page, nextSize);
  const buttonSize: Size = size === 'small' ? 'small' : 'middle';

  return (
    <div className={clsx('hc-ui-pagination', size === 'small' && 'hc-ui-pagination-sm')}>
      <Button size={buttonSize} onClick={() => nextPage(Math.max(1, current - 1))} disabled={current <= 1}>
        Prev
      </Button>
      <span className="hc-ui-pagination-info">
        {current} / {totalPages}
      </span>
      <Button size={buttonSize} onClick={() => nextPage(Math.min(totalPages, current + 1))} disabled={current >= totalPages}>
        Next
      </Button>
      {showSizeChanger ? (
        <select
          className="hc-ui-pagination-size"
          value={String(pageSize)}
          onChange={(event) => nextPage(1, Number(event.target.value))}
        >
          {(pageSizeOptions ?? ['10', '20', '50']).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
};

export type ColumnType<T> = {
  title?: ReactNode;
  dataIndex?: string | string[];
  key?: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, record: T, index: number) => ReactNode;
};

// Preserve table prop parity (including scroll) for the migrated repo views. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export type TableProps<T> = {
  dataSource?: T[];
  columns?: ColumnType<T>[];
  rowKey?: string | ((record: T) => string);
  pagination?: false | PaginationConfig;
  loading?: boolean | { spinning?: boolean };
  size?: Size;
  scroll?: { x?: string | number; y?: string | number };
};

// Provide a simple table with optional pagination to replace legacy UI tables. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Table = <T,>({ dataSource = [], columns = [], rowKey, pagination, loading, scroll }: TableProps<T>) => {
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(pagination && pagination.pageSize ? pagination.pageSize : 10);
  const page = pagination && pagination.current ? pagination.current : internalPage;
  const pageSize = pagination && pagination.pageSize ? pagination.pageSize : internalPageSize;
  // Apply scroll sizing to match wrapper expectations for wide tables. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
  const scrollX = scroll?.x;
  const scrollY = scroll?.y;
  const contentStyle: CSSProperties = {};
  const tableStyle: CSSProperties = {};
  if (scrollX) {
    contentStyle.overflowX = 'auto';
    tableStyle.minWidth = scrollX === 'max-content' ? 'max-content' : scrollX;
  }
  if (scrollY) {
    contentStyle.maxHeight = scrollY;
    contentStyle.overflowY = 'auto';
  }

  const total = pagination && pagination.total !== undefined ? pagination.total : dataSource.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pagedData = pagination === false ? dataSource : dataSource.slice((page - 1) * pageSize, page * pageSize);

  const handleChange = (nextPage: number, nextPageSize: number) => {
    setInternalPage(nextPage);
    setInternalPageSize(nextPageSize);
    pagination && pagination.onChange?.(nextPage, nextPageSize);
  };

  const resolveRowKey = (record: T, index: number) => {
    if (typeof rowKey === 'function') return rowKey(record);
    if (typeof rowKey === 'string') return (record as any)?.[rowKey] ?? index;
    return (record as any)?.id ?? index;
  };

  const tableNode = (
    <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key ?? String(col.dataIndex)} style={{ width: col.width, textAlign: col.align }}>
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <Skeleton active title={false} paragraph={{ rows: 6 }} />
              </td>
            </tr>
          ) : pagedData.length ? (
            pagedData.map((record, index) => (
              <tr key={resolveRowKey(record, index)}>
                {columns.map((col, colIndex) => {
                  const value = Array.isArray(col.dataIndex)
                    ? col.dataIndex.reduce((acc, key) => (acc ? acc[key] : undefined), record as any)
                    : col.dataIndex
                      ? (record as any)?.[col.dataIndex]
                      : undefined;
                  return (
                    <td key={col.key ?? colIndex} style={{ textAlign: col.align }}>
                      {col.render ? col.render(value, record, index) : value}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <Empty description="No data" />
              </td>
            </tr>
          )}
        </tbody>
    </table>
  );

  return (
    <div className="hc-ui-table">
      {scrollX || scrollY ? (
        <div className={clsx('hc-ui-table-content', scrollY && 'hc-ui-table-body')} style={contentStyle}>
          {tableNode}
        </div>
      ) : (
        tableNode
      )}

      {pagination !== false && !(pagination?.hideOnSinglePage && totalPages <= 1) ? (
        <div className="hc-ui-pagination">
          <Button size="small" onClick={() => handleChange(Math.max(1, page - 1), pageSize)} disabled={page <= 1}>
            Prev
          </Button>
          <span>{page}</span>
          <Button size="small" onClick={() => handleChange(Math.min(totalPages, page + 1), pageSize)} disabled={page >= totalPages}>
            Next
          </Button>
          {pagination?.showSizeChanger ? (
            <select
              value={String(pageSize)}
              onChange={(event) => handleChange(1, Number(event.target.value))}
            >
              {(pagination.pageSizeOptions ?? ['10', '20', '50']).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export type DatePickerRangeProps = {
  value?: [string, string] | null;
  onChange?: (value: [string, string] | null, dateStrings: [string, string]) => void;
  allowClear?: boolean;
  placeholder?: [string, string];
  size?: Size;
  format?: string;
};

// Provide a lightweight date range picker using native date inputs. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const RangePicker = ({ value, onChange, allowClear, placeholder }: DatePickerRangeProps) => {
  const [start, end] = value ?? ['', ''];
  return (
    <div className="hc-ui-date-picker-range">
      <input
        type="date"
        value={start}
        placeholder={placeholder?.[0]}
        onChange={(event) => onChange?.([event.target.value, end], [event.target.value, end])}
      />
      <span className="hc-ui-date-picker-separator">—</span>
      <input
        type="date"
        value={end}
        placeholder={placeholder?.[1]}
        onChange={(event) => onChange?.([start, event.target.value], [start, event.target.value])}
      />
      {allowClear ? (
        <button type="button" onClick={() => onChange?.(null, ['', ''])}>
          ×
        </button>
      ) : null}
    </div>
  );
};

export const DatePicker = {
  RangePicker
};

export type ConfigProviderProps = {
  children?: ReactNode;
};

// Keep a placeholder ConfigProvider so existing app code can wrap UI uniformly. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const ConfigProvider = ({ children }: ConfigProviderProps) => <>{children}</>;

type Message = { key: string; type: 'success' | 'error' | 'warning' | 'info'; content: ReactNode; duration: number };

export type MessageApi = {
  open: (config: { type: Message['type']; content: ReactNode; key?: string; duration?: number }) => void;
  success: (content: ReactNode) => void;
  error: (content: ReactNode) => void;
  warning: (content: ReactNode) => void;
  info: (content: ReactNode) => void;
};

const MessageContext = createContext<MessageApi | null>(null);
let currentMessageApi: MessageApi | null = null;

// Provide a toast host for non-blocking feedback messages. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const MessageHost = ({ onReady }: { onReady?: (api: MessageApi) => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const remove = useCallback((key: string) => {
    setMessages((prev) => prev.filter((msg) => msg.key !== key));
  }, []);

  const api = useMemo<MessageApi>(() => {
    const push = (type: Message['type'], content: ReactNode, key?: string, duration = 3) => {
      const messageKey = key || `${Date.now()}-${Math.random()}`;
      setMessages((prev) => {
        const next = prev.filter((msg) => msg.key !== messageKey);
        return [...next, { key: messageKey, type, content, duration }];
      });
      if (duration > 0) {
        window.setTimeout(() => remove(messageKey), duration * 1000);
      }
    };
    return {
      open: ({ type, content, key, duration }) => push(type, content, key, duration),
      success: (content) => push('success', content),
      error: (content) => push('error', content),
      warning: (content) => push('warning', content),
      info: (content) => push('info', content)
    };
  }, [remove]);

  useEffect(() => {
    currentMessageApi = api;
    onReady?.(api);
  }, [api, onReady]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="hc-message-host" role="status" aria-live="polite">
      {messages.map((msg) => (
        <div key={msg.key} className={clsx('hc-message', `hc-message-${msg.type}`)}>
          {msg.content}
        </div>
      ))}
    </div>,
    document.body
  );
};

// Provide an App wrapper that wires up the toast provider for message APIs. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const App = ({ children }: { children?: ReactNode }) => {
  const [api, setApi] = useState<MessageApi | null>(null);
  const value = api || currentMessageApi || {
    open: () => undefined,
    success: () => undefined,
    error: () => undefined,
    warning: () => undefined,
    info: () => undefined
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
      <MessageHost onReady={setApi} />
    </MessageContext.Provider>
  );
};

// Provide App.useApp for compatibility with legacy code. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
App.useApp = () => {
  const contextApi = useContext(MessageContext);
  return {
    message: contextApi || currentMessageApi || {
      open: () => undefined,
      success: () => undefined,
      error: () => undefined,
      warning: () => undefined,
      info: () => undefined
    }
  };
};

// Provide message APIs similar to legacy UI's message singleton. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const message = {
  open: (config: { type: Message['type']; content: ReactNode; key?: string; duration?: number }) =>
    currentMessageApi?.open(config),
  success: (content: ReactNode) => currentMessageApi?.success(content),
  error: (content: ReactNode) => currentMessageApi?.error(content),
  warning: (content: ReactNode) => currentMessageApi?.warning(content),
  info: (content: ReactNode) => currentMessageApi?.info(content),
  useMessage: () => {
    const api =
      useContext(MessageContext) ||
      currentMessageApi || {
        open: () => undefined,
        success: () => undefined,
        error: () => undefined,
        warning: () => undefined,
        info: () => undefined
      };
    return [api, null] as [MessageApi, ReactNode];
  }
};

const FormContext = createContext<{
  form: FormInstance;
  disabled?: boolean;
} | null>(null);

export type Rule = { required?: boolean; whitespace?: boolean; message?: string };
export type NamePath = string | string[];

export type FormInstance = {
  getFieldValue: (name: NamePath) => any;
  setFieldValue: (name: NamePath, value: any) => void;
  setFieldsValue: (values: Record<string, any>) => void;
  resetFields: () => void;
  validateFields: () => Promise<Record<string, any>>;
  submit: () => void;
  _registerField: (name: NamePath, rules?: Rule[]) => () => void;
  _setCallbacks: (callbacks: { onFinish?: (values: any) => void; onFinishFailed?: (error: any) => void }) => void;
  _setInitialValues: (values?: Record<string, any>) => void;
  _subscribe: (listener: () => void) => () => void;
};

const toKey = (name: NamePath): string => (Array.isArray(name) ? name.join('.') : name);
const toPath = (name: NamePath): string[] => (Array.isArray(name) ? name : String(name).split('.').filter(Boolean));

const getByPath = (obj: Record<string, any>, path: string[]): any => {
  return path.reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
};

const setByPath = (obj: Record<string, any>, path: string[], value: any): Record<string, any> => {
  const next = { ...obj };
  let cursor: any = next;
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      cursor[segment] = value;
      return;
    }
    if (!cursor[segment] || typeof cursor[segment] !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  });
  return next;
};

const mergeDeep = (target: Record<string, any>, source: Record<string, any>): Record<string, any> => {
  const next = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = mergeDeep((target[key] as Record<string, any>) || {}, value as Record<string, any>);
    } else {
      next[key] = value;
    }
  });
  return next;
};

// Implement a tiny form store to manage values + validation without legacy UI. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const createFormStore = (): FormInstance & { _getError: (name: NamePath) => string | undefined } => {
  let values: Record<string, any> = {};
  let initialValues: Record<string, any> = {};
  let rulesMap: Record<string, Rule[]> = {};
  let errors: Record<string, string> = {};
  const listeners = new Set<() => void>();
  let callbacks: { onFinish?: (values: any) => void; onFinishFailed?: (error: any) => void } = {};

  const notify = () => listeners.forEach((fn) => fn());

  const store: FormInstance & { _getError: (name: NamePath) => string | undefined } = {
    getFieldValue: (name) => {
      return getByPath(values, toPath(name));
    },
    setFieldValue: (name, value) => {
      values = setByPath(values, toPath(name), value);
      delete errors[toKey(name)];
      notify();
    },
    setFieldsValue: (next) => {
      values = mergeDeep(values, next);
      errors = {};
      notify();
    },
    resetFields: () => {
      values = { ...initialValues };
      errors = {};
      notify();
    },
    validateFields: async () => {
      const errorFields: Array<{ name: NamePath; errors: string[] }> = [];
      errors = {};
      Object.entries(rulesMap).forEach(([field, rules]) => {
        const value = getByPath(values, toPath(field));
        rules.forEach((rule) => {
          if (rule.required) {
            const isEmpty = value === undefined || value === null || (typeof value === 'string' && (!value || (rule.whitespace && !value.trim())));
            if (isEmpty) {
              const message = rule.message || 'Required';
              errors[field] = message;
              errorFields.push({ name: field, errors: [message] });
            }
          }
        });
      });
      notify();
      if (errorFields.length) {
        const error = { errorFields };
        return Promise.reject(error);
      }
      return values;
    },
    submit: () => {
      void (async () => {
        try {
          const resolved = await store.validateFields();
          callbacks.onFinish?.(resolved);
        } catch (error) {
          callbacks.onFinishFailed?.(error);
        }
      })();
    },
    _registerField: (name, rules) => {
      const key = toKey(name);
      if (rules) rulesMap[key] = rules;
      return () => {
        delete rulesMap[key];
      };
    },
    _setCallbacks: (next) => {
      callbacks = next;
    },
    _setInitialValues: (next) => {
      if (!next) return;
      initialValues = { ...next };
      values = { ...values, ...next };
    },
    _subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    _getError: (name) => errors[toKey(name)]
  };
  return store;
};

export type FormProps = {
  form: FormInstance;
  onFinish?: (values: any) => void;
  onFinishFailed?: (error: any) => void;
  initialValues?: Record<string, any>;
  disabled?: boolean;
  layout?: 'vertical' | 'horizontal';
  requiredMark?: boolean;
  size?: Size;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

// Provide a minimal Form wrapper that binds inputs to a local store. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const Form = ({
  form,
  onFinish,
  onFinishFailed,
  initialValues,
  disabled,
  layout = 'vertical',
  className,
  style,
  children
}: FormProps) => {
  const [, forceUpdate] = useState(0);

  useEffect(() => form._subscribe(() => forceUpdate((v) => v + 1)), [form]);
  useEffect(() => form._setCallbacks({ onFinish, onFinishFailed }), [form, onFinish, onFinishFailed]);
  useEffect(() => form._setInitialValues(initialValues), [form, initialValues]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    form.submit();
  };

  return (
    <form
      className={clsx(
        'hc-ui-form',
        layout === 'vertical' && 'hc-ui-form-vertical',
        layout === 'horizontal' && 'hc-ui-form-horizontal',
        className
      )}
      style={style}
      onSubmit={handleSubmit}
    >
      <FormContext.Provider value={{ form, disabled }}>{children}</FormContext.Provider>
    </form>
  );
};

// Provide useForm helper for building controlled form instances. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
Form.useForm = () => [createFormStore()] as [FormInstance];

// Provide a simple watch hook for controlled forms. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
Form.useWatch = (name: NamePath, form?: FormInstance) => {
  const [, forceUpdate] = useState(0);
  useEffect(() => form?._subscribe(() => forceUpdate((v) => v + 1)), [form]);
  return form?.getFieldValue(name);
};

export type FormItemProps = {
  name?: NamePath;
  label?: ReactNode;
  rules?: Rule[];
  valuePropName?: string;
  shouldUpdate?: boolean;
  noStyle?: boolean;
  extra?: ReactNode;
  children?: ReactNode | ((helpers: { getFieldValue: (name: NamePath) => any }) => ReactNode);
};

// Bind form fields to inputs and show inline validation errors. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
Form.Item = ({ name, label, rules, valuePropName, noStyle, children, extra }: FormItemProps) => {
  const context = useContext(FormContext);
  const form = context?.form;

  useEffect(() => {
    if (!form || !name) return;
    return form._registerField(name, rules);
  }, [form, name, rules]);

  if (typeof children === 'function') {
    const node = children({ getFieldValue: form?.getFieldValue ?? (() => undefined) });
    return noStyle ? <>{node}</> : <div className="hc-ui-form-item">{node}</div>;
  }

  const fieldValue = name && form ? form.getFieldValue(name) : undefined;
  const fieldError = name && (form as any)?._getError ? (form as any)._getError(name) : undefined;
  const child = React.Children.only(children) as ReactElement | undefined;
  const fieldId = name ? `hc-ui-field-${toKey(name)}` : undefined;

  const controlProps: Record<string, any> = {};
  const valueKey = valuePropName || 'value';

  if (child && name && form) {
    controlProps[valueKey] = fieldValue ?? (valueKey === 'checked' ? false : undefined);
    controlProps.disabled = context?.disabled || child.props.disabled;
    // Bind the label to its control for accessibility and test queries. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
    if (fieldId && !child.props.id) {
      controlProps.id = fieldId;
    }
    controlProps.onChange = (event: any) => {
      const nextValue =
        valueKey === 'checked'
          ? event?.target?.checked ?? event
          : event?.target?.value ?? event;
      form.setFieldValue(name, nextValue);
      child.props.onChange?.(event);
    };
  }

  if (noStyle && child) {
    return React.cloneElement(child, controlProps);
  }

  return (
    <div className={clsx('hc-ui-form-item', noStyle && 'hc-ui-form-item-no-style')}>
      {label ? (
        <label className="hc-ui-form-item-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <div className="hc-ui-form-item-control">
        {child ? React.cloneElement(child, controlProps) : null}
        {fieldError ? <div className="hc-ui-form-item-explain">{fieldError}</div> : null}
        {extra ? <div className="hc-ui-form-item-extra">{extra}</div> : null}
      </div>
    </div>
  );
};

export type GridBreakpoint = {
  xs: boolean;
  sm: boolean;
  md: boolean;
  lg: boolean;
  xl: boolean;
  xxl: boolean;
};

// Provide a breakpoint hook compatible with Grid.useBreakpoint. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
const useBreakpoint = (): GridBreakpoint => {
  const getState = () => {
    if (typeof window === 'undefined') {
      return { xs: true, sm: false, md: false, lg: false, xl: false, xxl: false };
    }
    const width = window.innerWidth;
    return {
      xs: width < 576,
      sm: width >= 576,
      md: width >= 768,
      lg: width >= 992,
      xl: width >= 1200,
      xxl: width >= 1600
    };
  };
  const [state, setState] = useState<GridBreakpoint>(getState);

  useEffect(() => {
    const handle = () => setState(getState());
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  return state;
};

export const Grid = {
  useBreakpoint
};
