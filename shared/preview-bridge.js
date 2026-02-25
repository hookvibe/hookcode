// HookCode preview bridge for cross-origin highlight commands. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
(function () {
  const BRIDGE_EVENT_PREFIX = 'hookcode:preview:';
  const STYLE_ID = 'hookcode-preview-style';
  const OVERLAY_ID = 'hookcode-preview-highlight';
  const MASK_ID = 'hookcode-preview-mask';
  const BUBBLE_ID = 'hookcode-preview-bubble';
  const BUBBLE_ARROW_ID = 'hookcode-preview-bubble-arrow';
  const BUBBLE_TEXT_ID = 'hookcode-preview-bubble-text';
  const DEFAULT_COLOR = '#ff4d4f';
  const DEFAULT_PADDING = 4;
  const DEFAULT_BUBBLE_MAX_WIDTH = 320;
  const DEFAULT_BUBBLE_OFFSET = 10;
  const DEFAULT_BUBBLE_RADIUS = 12;
  const DEFAULT_BUBBLE_THEME = 'dark';
  // Limit highlight pulse loops and set glass blur defaults. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  const HIGHLIGHT_PULSE_ITERATIONS = 2;
  const HIGHLIGHT_PULSE_DURATION_MS = 1200;
  const BUBBLE_GLASS_BLUR = 'blur(12px) saturate(160%)';
  // Define default bubble theme colors for tooltip rendering. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  const DEFAULT_BUBBLE = {
    dark: {
      background: 'rgba(15, 23, 42, 0.92)',
      text: '#f8fafc',
      border: 'rgba(148, 163, 184, 0.35)'
    },
    light: {
      background: '#ffffff',
      text: '#0f172a',
      border: 'rgba(148, 163, 184, 0.45)'
    }
  };

  let allowedOrigin = null;
  let trackedElement = null;
  let cleanupFn = null;

  const prefersReducedMotion = () => {
    // Respect reduced motion preferences for highlight/tooltip animations. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
    if (!window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const ensureStyles = () => {
    // Inject highlight/bubble keyframes once for smooth visuals. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes hookcode-highlight-pulse {
        0% { box-shadow: 0 0 0 2px var(--hookcode-highlight-glow, rgba(255, 255, 255, 0.3)), 0 0 0 0 var(--hookcode-highlight-pulse, rgba(255, 255, 255, 0)); }
        70% { box-shadow: 0 0 0 2px var(--hookcode-highlight-glow, rgba(255, 255, 255, 0.3)), 0 0 26px 8px var(--hookcode-highlight-pulse, rgba(255, 255, 255, 0.25)); }
        100% { box-shadow: 0 0 0 2px var(--hookcode-highlight-glow, rgba(255, 255, 255, 0.3)), 0 0 0 0 var(--hookcode-highlight-pulse, rgba(255, 255, 255, 0)); }
      }
      @keyframes hookcode-bubble-pop {
        0% { opacity: 0; transform: translateY(6px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureOverlay = () => {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.position = 'fixed';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2147483647';
      overlay.style.borderRadius = '6px';
      overlay.style.transition = 'all 140ms ease-out';
      document.body.appendChild(overlay);
    }
    return overlay;
  };

  const ensureMask = () => {
    let mask = document.getElementById(MASK_ID);
    if (!mask) {
      mask = document.createElement('div');
      mask.id = MASK_ID;
      mask.style.position = 'fixed';
      mask.style.inset = '0';
      mask.style.pointerEvents = 'none';
      mask.style.zIndex = '2147483646';
      mask.style.background = 'rgba(0, 0, 0, 0.35)';
      mask.style.transition = 'opacity 120ms ease-out';
      document.body.appendChild(mask);
    }
    return mask;
  };

  const ensureBubble = (reducedMotion) => {
    // Build the tooltip bubble DOM used by highlight commands. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
    let bubble = document.getElementById(BUBBLE_ID);
    const isNew = !bubble;
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = BUBBLE_ID;
      bubble.style.position = 'fixed';
      bubble.style.pointerEvents = 'none';
      bubble.style.zIndex = '2147483648';
      bubble.style.display = 'block';
      bubble.style.boxSizing = 'border-box';
      bubble.style.maxWidth = `${DEFAULT_BUBBLE_MAX_WIDTH}px`;
      bubble.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
      bubble.style.fontSize = '12px';
      bubble.style.lineHeight = '1.4';
      bubble.style.opacity = reducedMotion ? '1' : '0';
      bubble.style.transform = reducedMotion ? 'translateY(0)' : 'translateY(6px)';
      bubble.style.animation = reducedMotion ? 'none' : 'hookcode-bubble-pop 160ms ease-out forwards';
      bubble.style.transition = reducedMotion ? 'none' : 'opacity 160ms ease-out, transform 160ms ease-out';
      bubble.style.backdropFilter = BUBBLE_GLASS_BLUR;
      bubble.style.webkitBackdropFilter = BUBBLE_GLASS_BLUR;

      const text = document.createElement('div');
      text.id = BUBBLE_TEXT_ID;
      text.style.wordBreak = 'break-word';
      bubble.appendChild(text);

      const arrow = document.createElement('div');
      arrow.id = BUBBLE_ARROW_ID;
      arrow.style.position = 'absolute';
      arrow.style.width = '10px';
      arrow.style.height = '10px';
      arrow.style.transform = 'rotate(45deg)';
      arrow.style.borderRadius = '2px';
      bubble.appendChild(arrow);

      document.body.appendChild(bubble);
    }
    if (!isNew) {
      bubble.style.transition = reducedMotion ? 'none' : 'opacity 160ms ease-out, transform 160ms ease-out';
      bubble.style.backdropFilter = BUBBLE_GLASS_BLUR;
      bubble.style.webkitBackdropFilter = BUBBLE_GLASS_BLUR;
      if (reducedMotion) {
        bubble.style.animation = 'none';
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';
      }
    }
    const arrow = bubble.querySelector(`#${BUBBLE_ARROW_ID}`);
    const text = bubble.querySelector(`#${BUBBLE_TEXT_ID}`);
    return { bubble, arrow, text };
  };

  const clearBubble = () => {
    // Remove bubble nodes when clearing highlights. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
    const bubble = document.getElementById(BUBBLE_ID);
    if (bubble) bubble.remove();
  };

  const clearHighlight = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    const mask = document.getElementById(MASK_ID);
    if (mask) mask.remove();
    clearBubble();
    if (cleanupFn) cleanupFn();
    cleanupFn = null;
    trackedElement = null;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const parseNumber = (value, fallback) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const normalizeBubble = (bubble) => {
    // Normalize bubble config defaults for consistent layout. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
    if (!bubble || typeof bubble.text !== 'string') return null;
    const text = bubble.text.trim();
    if (!text) return null;
    return {
      text,
      placement: ['top', 'right', 'bottom', 'left', 'auto'].includes(bubble.placement)
        ? bubble.placement
        : 'auto',
      align: ['start', 'center', 'end'].includes(bubble.align) ? bubble.align : 'center',
      offset: clamp(parseNumber(bubble.offset, DEFAULT_BUBBLE_OFFSET), 0, 64),
      maxWidth: clamp(parseNumber(bubble.maxWidth, DEFAULT_BUBBLE_MAX_WIDTH), 120, 640),
      theme: bubble.theme === 'light' ? 'light' : DEFAULT_BUBBLE_THEME,
      background: typeof bubble.background === 'string' ? bubble.background.trim() : '',
      textColor: typeof bubble.textColor === 'string' ? bubble.textColor.trim() : '',
      borderColor: typeof bubble.borderColor === 'string' ? bubble.borderColor.trim() : '',
      radius: clamp(parseNumber(bubble.radius, DEFAULT_BUBBLE_RADIUS), 0, 24),
      arrow: typeof bubble.arrow === 'boolean' ? bubble.arrow : true
    };
  };

  // Preview bridge selector resolution uses layered fallbacks to keep highlight commands working across hidden and shadow DOM nodes. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  // Key steps: score visibility, prefer the best visible match, then try simple id/class/tag lookup and deep shadow-root scans. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  // Assumption: if all matches are invisible, the first match is still returned to preserve deterministic behavior. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const safeQuerySelector = (root, selector) => {
    if (!root || typeof root.querySelector !== 'function') return null;
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  };

  const safeQuerySelectorAll = (root, selector) => {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const collectRoots = () => {
    // Collect document + open shadow roots so text/attribute rules can search beyond the light DOM. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const roots = [];
    const visited = new Set();
    const queue = [document];
    while (queue.length) {
      const root = queue.shift();
      if (!root || visited.has(root)) continue;
      visited.add(root);
      roots.push(root);
      const elements = safeQuerySelectorAll(root, '*');
      for (const element of elements) {
        if (element && element.shadowRoot) queue.push(element.shadowRoot);
      }
    }
    return roots;
  };

  const stripQuotes = (value) => {
    // Normalize matcher values like text:"Save" or attr:data-testid='cta'. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length < 2) return trimmed;
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  // Define attribute operator tokens used by selector matcher parsing. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const ATTRIBUTE_OPERATORS = ['^=', '$=', '*=', '~=', '='];

  // Parse attribute expressions like data-testid=cta or data-testid for presence checks. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const parseAttributeExpression = (expression) => {
    const trimmed = expression.trim();
    if (!trimmed) return null;
    for (const operator of ATTRIBUTE_OPERATORS) {
      const index = trimmed.indexOf(operator);
      if (index > 0) {
        const name = trimmed.slice(0, index).trim();
        const value = stripQuotes(trimmed.slice(index + operator.length));
        if (!name || !value) return null;
        return { name, operator, value };
      }
    }
    return { name: trimmed, operator: null, value: null };
  };

  // Parse text matcher selectors like text:Save or text="Save". docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const parseTextMatcher = (selector) => {
    const match = selector.match(/^text\s*[:=]\s*(.+)$/i);
    if (!match) return null;
    const value = stripQuotes(match[1]);
    return value ? value : null;
  };

  // Parse attribute matcher selectors like attr:data-testid=cta or role:button. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const parseAttributeMatcher = (selector) => {
    const prefixMatch = selector.match(/^([a-zA-Z]+)\s*[:=]\s*(.+)$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1].toLowerCase();
      const rest = prefixMatch[2];
      if (prefix === 'text') return null;
      if (prefix === 'testid') {
        const value = stripQuotes(rest);
        return value ? { name: 'data-testid', operator: '=', value } : null;
      }
      if (['role', 'title', 'placeholder', 'alt', 'name', 'value'].includes(prefix)) {
        const value = stripQuotes(rest);
        return value ? { name: prefix, operator: '=', value } : null;
      }
      if (prefix === 'attr') {
        return parseAttributeExpression(rest);
      }
      if (prefix === 'data' || prefix === 'aria') {
        const parsed = parseAttributeExpression(rest);
        if (!parsed) return null;
        return { ...parsed, name: `${prefix}-${parsed.name}` };
      }
    }

    if (/[\s>+~,[\]]/.test(selector)) return null;
    if (selector.startsWith('.') || selector.startsWith('#')) return null;
    if (!ATTRIBUTE_OPERATORS.some((operator) => selector.includes(operator))) return null;
    return parseAttributeExpression(selector);
  };

  // Compare attribute values using the supported operators for selector rules. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const matchAttributeValue = (actualValue, expectedValue, operator) => {
    if (expectedValue == null) return true;
    const actual = actualValue ?? '';
    const expected = expectedValue ?? '';
    if (operator === '^=') return actual.startsWith(expected);
    if (operator === '$=') return actual.endsWith(expected);
    if (operator === '*=') return actual.includes(expected);
    if (operator === '~=') return actual.split(/\s+/).includes(expected);
    return actual === expected;
  };

  // Build a safe attribute selector for querySelectorAll or fall back to manual scans. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const buildAttributeSelector = (name) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return `[${window.CSS.escape(name)}]`;
    }
    if (/^[A-Za-z_][A-Za-z0-9_:-]*$/.test(name)) {
      return `[${name}]`;
    }
    return null;
  };

  // Resolve attribute-based selectors across all roots with visibility scoring. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const findByAttribute = (match) => {
    if (!match || !match.name) return null;
    const roots = collectRoots();
    const selector = buildAttributeSelector(match.name);
    const matches = [];
    for (const root of roots) {
      const candidates = selector ? safeQuerySelectorAll(root, selector) : safeQuerySelectorAll(root, '*');
      for (const element of candidates) {
        if (!element || typeof element.getAttribute !== 'function') continue;
        if (match.operator === null) {
          if (!element.hasAttribute(match.name)) continue;
          matches.push(element);
          continue;
        }
        const actual = element.getAttribute(match.name);
        if (actual == null) continue;
        if (matchAttributeValue(actual, match.value, match.operator)) matches.push(element);
      }
    }
    return pickBestCandidate(matches);
  };

  // Resolve text-based selectors and pick the most visible matching element. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const findByText = (value) => {
    if (!value) return null;
    const needle = value.toLowerCase();
    const roots = collectRoots();
    let best = null;
    let bestScore = -1;
    let bestRank = -1;
    let fallback = null;
    for (const root of roots) {
      const elements = safeQuerySelectorAll(root, '*');
      for (const element of elements) {
        const text = element && typeof element.textContent === 'string' ? element.textContent.trim() : '';
        if (!text) continue;
        const normalized = text.toLowerCase();
        let rank = 0;
        if (normalized === needle) rank = 2;
        else if (normalized.includes(needle)) rank = 1;
        else continue;
        if (!fallback) fallback = element;
        const score = scoreElement(element);
        if (score <= 0) continue;
        if (rank > bestRank || (rank === bestRank && score > bestScore)) {
          best = element;
          bestScore = score;
          bestRank = rank;
        }
      }
    }
    return best || fallback;
  };

  const scoreElement = (element) => {
    if (!element || typeof element.getBoundingClientRect !== 'function') return 0;
    const rect = element.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    if (!area) return 0;
    const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    // Treat opacity as zero only when it parses to a finite number to avoid false negatives. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const opacityToken = style && typeof style.opacity === 'string' ? style.opacity.trim() : '';
    const opacity = opacityToken ? Number(opacityToken) : NaN;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || (Number.isFinite(opacity) && opacity === 0))) {
      return 0;
    }
    if (typeof element.getClientRects === 'function' && element.getClientRects().length === 0) return 0;
    return area;
  };

  const pickBestCandidate = (elements) => {
    const list = elements.filter((element) => element && element.nodeType === 1);
    if (!list.length) return null;
    let best = list[0];
    let bestScore = scoreElement(best);
    for (let index = 1; index < list.length; index += 1) {
      const current = list[index];
      const currentScore = scoreElement(current);
      if (currentScore > bestScore) {
        best = current;
        bestScore = currentScore;
      }
    }
    return bestScore > 0 ? best : list[0];
  };

  const resolveSimpleSelector = (selector) => {
    const trimmed = selector.trim();
    if (!trimmed) return null;
    if (/[\s>+~,[\]]/.test(trimmed)) return null;
    if (trimmed.startsWith('#')) {
      const id = trimmed.slice(1);
      return id ? document.getElementById(id) : null;
    }
    if (trimmed.startsWith('.')) {
      const classTokens = trimmed.split('.').filter(Boolean);
      if (!classTokens.length) return null;
      return pickBestCandidate(Array.from(document.getElementsByClassName(classTokens.join(' '))));
    }
    if (/^[A-Za-z][A-Za-z0-9-]*$/.test(trimmed)) {
      return pickBestCandidate(Array.from(document.getElementsByTagName(trimmed)));
    }
    return null;
  };

  // Reuse collected roots to query selectors across open shadow roots. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const querySelectorAllDeep = (selector, roots) => {
    const results = [];
    const rootList = roots || collectRoots();
    for (const root of rootList) {
      results.push(...safeQuerySelectorAll(root, selector));
    }
    return results;
  };

  // Resolve highlight targets with text/attribute rules before CSS fallbacks. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  const resolveHighlightTarget = (selector) => {
    const trimmed = selector.trim();
    const textMatch = parseTextMatcher(trimmed);
    if (textMatch) {
      const textTarget = findByText(textMatch);
      if (textTarget) return textTarget;
    }

    const attributeMatch = parseAttributeMatcher(trimmed);
    if (attributeMatch) {
      const attributeTarget = findByAttribute(attributeMatch);
      if (attributeTarget) return attributeTarget;
    }

    const roots = collectRoots();
    let target = safeQuerySelector(document, trimmed);
    let targetScore = target ? scoreElement(target) : -1;

    if (targetScore <= 0) {
      const matches = safeQuerySelectorAll(document, trimmed);
      const bestMatch = pickBestCandidate(matches);
      if (bestMatch) {
        const bestScore = scoreElement(bestMatch);
        if (bestScore > targetScore) {
          target = bestMatch;
          targetScore = bestScore;
        }
      }
    }

    if (!target) {
      target = resolveSimpleSelector(trimmed);
      targetScore = target ? scoreElement(target) : targetScore;
    }

    if (targetScore <= 0) {
      const deepMatch = pickBestCandidate(querySelectorAllDeep(trimmed, roots));
      if (deepMatch) target = deepMatch;
    }

    return target;
  };

  const applyHighlight = (payload) => {
    if (!payload || typeof payload.selector !== 'string') {
      return { ok: false, error: 'selector_required' };
    }
    const selector = payload.selector.trim();
    if (!selector) return { ok: false, error: 'selector_required' };

    // Prefer a visible match or safe fallback for selectors that fail in querySelector. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
    const target = resolveHighlightTarget(selector);
    if (!target) return { ok: false, error: 'selector_not_found' };

    // Validate and normalize bubble payload before rendering. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
    const bubble = normalizeBubble(payload.bubble);
    if (payload.bubble && !bubble) {
      return { ok: false, error: 'bubble_text_required' };
    }

    const padding = Number.isFinite(payload.padding) ? Math.max(0, payload.padding) : DEFAULT_PADDING;
    const color = typeof payload.color === 'string' && payload.color.trim() ? payload.color.trim() : DEFAULT_COLOR;
    const mode = payload.mode === 'mask' ? 'mask' : 'outline';

    const reducedMotion = prefersReducedMotion();
    if (payload.scrollIntoView) {
      try {
        if (reducedMotion) {
          target.scrollIntoView({ block: 'center', inline: 'center' });
        } else {
          target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        }
      } catch {
        target.scrollIntoView();
      }
    }

    clearHighlight();
    ensureStyles();
    const overlay = ensureOverlay();
    overlay.style.transition = reducedMotion ? 'none' : 'all 140ms ease-out';
    // Apply richer highlight styling and glow animation. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
    const highlightBorder = `2px solid ${color}`;
    overlay.style.border = highlightBorder;
    overlay.style.setProperty('--hookcode-highlight-glow', `${color}66`);
    overlay.style.setProperty('--hookcode-highlight-pulse', `${color}44`);
    overlay.style.background = `linear-gradient(135deg, ${color}20, transparent 60%)`;
    overlay.style.boxShadow = `0 0 0 2px ${color}55, 0 10px 24px ${color}33`;
    overlay.style.animation = reducedMotion
      ? 'none'
      : `hookcode-highlight-pulse ${HIGHLIGHT_PULSE_DURATION_MS}ms ease-out ${HIGHLIGHT_PULSE_ITERATIONS}`;
    overlay.style.animationFillMode = 'none';

    if (mode === 'mask') {
      const mask = ensureMask();
      mask.style.opacity = '1';
      mask.style.transition = reducedMotion ? 'none' : 'opacity 160ms ease-out';
      mask.style.background = 'rgba(10, 12, 20, 0.5)';
    } else {
      const mask = document.getElementById(MASK_ID);
      if (mask) mask.remove();
    }

    const bubbleNodes = bubble ? ensureBubble(reducedMotion) : null;

    const update = () => {
      const rect = target.getBoundingClientRect();
      const highlightRect = {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      };
      highlightRect.right = highlightRect.left + highlightRect.width;
      highlightRect.bottom = highlightRect.top + highlightRect.height;

      overlay.style.top = `${highlightRect.top}px`;
      overlay.style.left = `${highlightRect.left}px`;
      overlay.style.width = `${highlightRect.width}px`;
      overlay.style.height = `${highlightRect.height}px`;

      if (bubble && bubbleNodes) {
        const bubbleNode = bubbleNodes.bubble;
        const bubbleText = bubbleNodes.text;
        const bubbleArrow = bubbleNodes.arrow;
        if (!bubbleText || !bubbleArrow) return;

        const themeColors = DEFAULT_BUBBLE[bubble.theme];
        const background = bubble.background || themeColors.background;
        const textColor = bubble.textColor || themeColors.text;
        const borderColor = bubble.borderColor || themeColors.border;

        bubbleNode.style.maxWidth = `${bubble.maxWidth}px`;
        bubbleNode.style.padding = '10px 12px';
        bubbleNode.style.borderRadius = `${bubble.radius}px`;
        bubbleNode.style.background = background;
        bubbleNode.style.color = textColor;
        bubbleNode.style.border = `1px solid ${borderColor}`;
        bubbleNode.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.18)';
        bubbleNode.style.opacity = '1';

        bubbleText.textContent = bubble.text;

        // Position bubble relative to highlight and clamp to viewport. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
        const bubbleRect = bubbleNode.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const offset = bubble.offset;

        const anchor = {
          top: highlightRect.top,
          left: highlightRect.left,
          right: highlightRect.right,
          bottom: highlightRect.bottom,
          width: highlightRect.width,
          height: highlightRect.height,
          centerX: highlightRect.left + highlightRect.width / 2,
          centerY: highlightRect.top + highlightRect.height / 2
        };

        const spaceTop = anchor.top;
        const spaceBottom = viewportHeight - anchor.bottom;
        const spaceLeft = anchor.left;
        const spaceRight = viewportWidth - anchor.right;
        const margin = 8;
        const requiredVertical = bubbleRect.height + offset + margin;
        const requiredHorizontal = bubbleRect.width + offset + margin;
        const fitsTop = spaceTop >= requiredVertical;
        const fitsBottom = spaceBottom >= requiredVertical;
        const fitsLeft = spaceLeft >= requiredHorizontal;
        const fitsRight = spaceRight >= requiredHorizontal;

        // Prefer vertical placement and flip when space is insufficient to keep the bubble visible. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
        const pickAutoPlacement = () => {
          if (fitsBottom) return 'bottom';
          if (fitsTop) return 'top';
          if (fitsRight) return 'right';
          if (fitsLeft) return 'left';
          const candidates = [
            { side: 'bottom', space: spaceBottom },
            { side: 'top', space: spaceTop },
            { side: 'right', space: spaceRight },
            { side: 'left', space: spaceLeft }
          ];
          candidates.sort((a, b) => b.space - a.space);
          return candidates[0].side;
        };

        const resolvePlacement = (preferred) => {
          if (preferred === 'auto') return pickAutoPlacement();
          if (preferred === 'top' && fitsTop) return 'top';
          if (preferred === 'bottom' && fitsBottom) return 'bottom';
          if (preferred === 'left' && fitsLeft) return 'left';
          if (preferred === 'right' && fitsRight) return 'right';
          if (preferred === 'top' && fitsBottom) return 'bottom';
          if (preferred === 'bottom' && fitsTop) return 'top';
          if (preferred === 'left' && fitsRight) return 'right';
          if (preferred === 'right' && fitsLeft) return 'left';
          return pickAutoPlacement();
        };

        const placement = resolvePlacement(bubble.placement);

        let top = 0;
        let left = 0;
        if (placement === 'top') {
          top = anchor.top - offset - bubbleRect.height;
          if (bubble.align === 'start') {
            left = anchor.left;
          } else if (bubble.align === 'end') {
            left = anchor.right - bubbleRect.width;
          } else {
            left = anchor.centerX - bubbleRect.width / 2;
          }
        } else if (placement === 'bottom') {
          top = anchor.bottom + offset;
          if (bubble.align === 'start') {
            left = anchor.left;
          } else if (bubble.align === 'end') {
            left = anchor.right - bubbleRect.width;
          } else {
            left = anchor.centerX - bubbleRect.width / 2;
          }
        } else if (placement === 'left') {
          left = anchor.left - offset - bubbleRect.width;
          if (bubble.align === 'start') {
            top = anchor.top;
          } else if (bubble.align === 'end') {
            top = anchor.bottom - bubbleRect.height;
          } else {
            top = anchor.centerY - bubbleRect.height / 2;
          }
        } else {
          left = anchor.right + offset;
          if (bubble.align === 'start') {
            top = anchor.top;
          } else if (bubble.align === 'end') {
            top = anchor.bottom - bubbleRect.height;
          } else {
            top = anchor.centerY - bubbleRect.height / 2;
          }
        }

        top = clamp(top, margin, viewportHeight - bubbleRect.height - margin);
        left = clamp(left, margin, viewportWidth - bubbleRect.width - margin);

        bubbleNode.style.top = `${top}px`;
        bubbleNode.style.left = `${left}px`;

        if (bubble.arrow === false) {
          bubbleArrow.style.display = 'none';
        } else {
          bubbleArrow.style.display = 'block';
          bubbleArrow.style.background = background;
          bubbleArrow.style.border = `1px solid ${borderColor}`;
          const arrowSize = 10;
          const arrowOffset = 6;
          if (placement === 'top') {
            bubbleArrow.style.top = `${bubbleRect.height - arrowSize / 2}px`;
            bubbleArrow.style.left = `${clamp(anchor.centerX - left - arrowSize / 2, arrowOffset, bubbleRect.width - arrowOffset - arrowSize)}px`;
          } else if (placement === 'bottom') {
            bubbleArrow.style.top = `${-arrowSize / 2}px`;
            bubbleArrow.style.left = `${clamp(anchor.centerX - left - arrowSize / 2, arrowOffset, bubbleRect.width - arrowOffset - arrowSize)}px`;
          } else if (placement === 'left') {
            bubbleArrow.style.left = `${bubbleRect.width - arrowSize / 2}px`;
            bubbleArrow.style.top = `${clamp(anchor.centerY - top - arrowSize / 2, arrowOffset, bubbleRect.height - arrowOffset - arrowSize)}px`;
          } else {
            bubbleArrow.style.left = `${-arrowSize / 2}px`;
            bubbleArrow.style.top = `${clamp(anchor.centerY - top - arrowSize / 2, arrowOffset, bubbleRect.height - arrowOffset - arrowSize)}px`;
          }
        }
      } else {
        clearBubble();
      }
    };

    update();
    trackedElement = target;

    const handle = () => {
      if (!trackedElement) return;
      update();
    };

    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handle) : null;
    if (observer) observer.observe(target);
    cleanupFn = () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
      if (observer) observer.disconnect();
    };

    return { ok: true };
  };

  const sendMessage = (target, origin, payload) => {
    if (!target || !origin) return;
    try {
      target.postMessage(payload, origin);
    } catch {
      // ignore
    }
  };

  const handleMessage = (event) => {
    const data = event && event.data ? event.data : null;
    if (!data || typeof data.type !== 'string') return;
    if (!data.type.startsWith(BRIDGE_EVENT_PREFIX)) return;

    if (data.type === `${BRIDGE_EVENT_PREFIX}ping`) {
      if (!allowedOrigin) allowedOrigin = event.origin;
      sendMessage(event.source, event.origin, { type: `${BRIDGE_EVENT_PREFIX}pong` });
      return;
    }

    if (!allowedOrigin) return;
    if (event.origin !== allowedOrigin) return;

    if (data.type === `${BRIDGE_EVENT_PREFIX}clear`) {
      clearHighlight();
      sendMessage(event.source, event.origin, { type: `${BRIDGE_EVENT_PREFIX}response`, requestId: data.requestId, ok: true });
      return;
    }

    if (data.type === `${BRIDGE_EVENT_PREFIX}highlight`) {
      const result = applyHighlight(data);
      sendMessage(event.source, event.origin, {
        type: `${BRIDGE_EVENT_PREFIX}response`,
        requestId: data.requestId,
        ok: result.ok,
        error: result.error
      });
    }
  };

  window.addEventListener('message', handleMessage);
  window.__HOOKCODE_PREVIEW_BRIDGE__ = {
    clear: clearHighlight
  };
})();
