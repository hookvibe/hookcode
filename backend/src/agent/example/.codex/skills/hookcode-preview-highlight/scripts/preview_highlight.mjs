import {
  buildAuthHeaders,
  buildUrl,
  getEnv,
  loadEnv,
  parseArgs,
  parseBoolean,
  parseNumber,
  sendRequest
} from './_shared.mjs';

// Send DOM highlight commands to the preview highlight API. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
// Keep help text aligned with CLI-only highlight flags. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
// Extend CLI help to document bubble payload options. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
const HELP_TEXT = `Hookcode Preview Highlight

Usage:
  node scripts/preview_highlight.mjs --task-group <id> --selector ".page-kicker"

Options:
  --task-group <id>   Task group id (env: HOOKCODE_TASK_GROUP_ID)
  --instance <name>   Preview instance name (env: HOOKCODE_PREVIEW_INSTANCE, default: app)
  --selector <css>    CSS selector to highlight
  --mode <mode>       Highlight mode: outline|mask
  --color <css>       Highlight color
  --padding <number>  Padding in px
  --scroll <bool>     Scroll into view
  --bubble-text <txt> Bubble text to render near the highlight
  --bubble-placement  Bubble placement: top|right|bottom|left|auto
  --bubble-align      Bubble alignment: start|center|end
  --bubble-offset     Bubble offset in px from highlight
  --bubble-max-width  Bubble max width in px
  --bubble-theme      Bubble theme: dark|light
  --bubble-background Bubble background color (CSS)
  --bubble-text-color Bubble text color (CSS)
  --bubble-border     Bubble border color (CSS)
  --bubble-radius     Bubble corner radius in px
  --bubble-arrow      Bubble arrow enabled (true/false)
  --request-id <id>   Optional request id
  --base-url <url>    Override HOOKCODE_API_BASE_URL
  --pat <token>       Override HOOKCODE_PAT
  --dry-run           Print request without sending
  --help              Show this help
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const env = await loadEnv();
  const baseUrl = (args['base-url'] || getEnv(env, 'HOOKCODE_API_BASE_URL') || '').trim();
  const pat = (args.pat || getEnv(env, 'HOOKCODE_PAT') || '').trim();
  const taskGroupId = args['task-group'] || args.id || getEnv(env, 'HOOKCODE_TASK_GROUP_ID');
  const instanceName = args.instance || args['instance-name'] || getEnv(env, 'HOOKCODE_PREVIEW_INSTANCE') || 'app';
  // Require highlight-specific inputs from CLI flags, not environment defaults. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const selector = args.selector;
  const modeRaw = args.mode;
  const color = args.color;
  const paddingRaw = args.padding;
  const scrollRaw = args.scroll;
  const bubbleText = args['bubble-text'];
  const bubblePlacement = args['bubble-placement'];
  const bubbleAlign = args['bubble-align'];
  const bubbleOffsetRaw = args['bubble-offset'];
  const bubbleMaxWidthRaw = args['bubble-max-width'];
  const bubbleTheme = args['bubble-theme'];
  const bubbleBackground = args['bubble-background'];
  const bubbleTextColor = args['bubble-text-color'];
  const bubbleBorderColor = args['bubble-border'];
  const bubbleRadiusRaw = args['bubble-radius'];
  const bubbleArrowRaw = args['bubble-arrow'];
  const requestId = args['request-id'];

  if (!baseUrl) {
    throw new Error('HOOKCODE_API_BASE_URL is required.');
  }
  if (!pat) {
    throw new Error('HOOKCODE_PAT is required.');
  }
  if (!taskGroupId) {
    throw new Error('Task group id is required (use --task-group or HOOKCODE_TASK_GROUP_ID).');
  }
  if (!selector) {
    throw new Error('selector is required (use --selector).');
  }

  let mode;
  if (modeRaw) {
    const normalizedMode = String(modeRaw).trim();
    if (!['outline', 'mask'].includes(normalizedMode)) {
      throw new Error('mode must be "outline" or "mask".');
    }
    mode = normalizedMode;
  }

  const padding = paddingRaw !== undefined ? parseNumber(paddingRaw) : undefined;
  if (paddingRaw !== undefined && padding === undefined) {
    throw new Error('padding must be a number.');
  }

  const scrollIntoView = scrollRaw !== undefined ? parseBoolean(scrollRaw) : undefined;
  if (scrollRaw !== undefined && scrollIntoView === undefined) {
    throw new Error('scroll must be a boolean (true/false).');
  }

  const bubbleFlags = [
    bubbleText,
    bubblePlacement,
    bubbleAlign,
    bubbleOffsetRaw,
    bubbleMaxWidthRaw,
    bubbleTheme,
    bubbleBackground,
    bubbleTextColor,
    bubbleBorderColor,
    bubbleRadiusRaw,
    bubbleArrowRaw
  ];
  // Require bubble text when any bubble flag is provided. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  if (!bubbleText && bubbleFlags.some((value) => value !== undefined)) {
    throw new Error('bubble-text is required when using bubble options.');
  }

  let bubble;
  if (bubbleText) {
    bubble = { text: bubbleText };
    if (bubblePlacement) {
      const placement = String(bubblePlacement).trim();
      if (!['top', 'right', 'bottom', 'left', 'auto'].includes(placement)) {
        throw new Error('bubble-placement must be one of top|right|bottom|left|auto.');
      }
      bubble.placement = placement;
    }
    if (bubbleAlign) {
      const align = String(bubbleAlign).trim();
      if (!['start', 'center', 'end'].includes(align)) {
        throw new Error('bubble-align must be one of start|center|end.');
      }
      bubble.align = align;
    }
    if (bubbleTheme) {
      const theme = String(bubbleTheme).trim();
      if (!['dark', 'light'].includes(theme)) {
        throw new Error('bubble-theme must be dark or light.');
      }
      bubble.theme = theme;
    }
    const bubbleOffset = bubbleOffsetRaw !== undefined ? parseNumber(bubbleOffsetRaw) : undefined;
    if (bubbleOffsetRaw !== undefined && bubbleOffset === undefined) {
      throw new Error('bubble-offset must be a number.');
    }
    if (bubbleOffset !== undefined) bubble.offset = bubbleOffset;

    const bubbleMaxWidth = bubbleMaxWidthRaw !== undefined ? parseNumber(bubbleMaxWidthRaw) : undefined;
    if (bubbleMaxWidthRaw !== undefined && bubbleMaxWidth === undefined) {
      throw new Error('bubble-max-width must be a number.');
    }
    if (bubbleMaxWidth !== undefined) bubble.maxWidth = bubbleMaxWidth;

    const bubbleRadius = bubbleRadiusRaw !== undefined ? parseNumber(bubbleRadiusRaw) : undefined;
    if (bubbleRadiusRaw !== undefined && bubbleRadius === undefined) {
      throw new Error('bubble-radius must be a number.');
    }
    if (bubbleRadius !== undefined) bubble.radius = bubbleRadius;

    const bubbleArrow = bubbleArrowRaw !== undefined ? parseBoolean(bubbleArrowRaw) : undefined;
    if (bubbleArrowRaw !== undefined && bubbleArrow === undefined) {
      throw new Error('bubble-arrow must be a boolean (true/false).');
    }
    if (bubbleArrow !== undefined) bubble.arrow = bubbleArrow;

    if (bubbleBackground) bubble.background = bubbleBackground;
    if (bubbleTextColor) bubble.textColor = bubbleTextColor;
    if (bubbleBorderColor) bubble.borderColor = bubbleBorderColor;
  }

  const payload = { selector };
  if (mode) payload.mode = mode;
  if (color) payload.color = color;
  if (padding !== undefined) payload.padding = padding;
  if (scrollIntoView !== undefined) payload.scrollIntoView = scrollIntoView;
  if (bubble) payload.bubble = bubble;
  if (requestId) payload.requestId = requestId;

  const url = buildUrl(baseUrl, `/api/task-groups/${taskGroupId}/preview/${instanceName}/highlight`);
  const headers = buildAuthHeaders(pat, 'application/json');
  await sendRequest({
    url,
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    dryRun: Boolean(args['dry-run'])
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
