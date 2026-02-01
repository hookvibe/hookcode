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

  const payload = { selector };
  if (mode) payload.mode = mode;
  if (color) payload.color = color;
  if (padding !== undefined) payload.padding = padding;
  if (scrollIntoView !== undefined) payload.scrollIntoView = scrollIntoView;
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
