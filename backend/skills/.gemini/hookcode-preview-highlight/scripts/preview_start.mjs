import { buildAuthHeaders, buildUrl, getEnv, loadEnv, parseArgs, sendRequest } from './_shared.mjs';

// Start preview instances before sending highlight commands. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
const HELP_TEXT = `Hookcode Preview Start

Usage:
  node scripts/preview_start.mjs --task-group <id>

Options:
  --task-group <id>   Task group id (env: HOOKCODE_TASK_GROUP_ID)
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

  if (!baseUrl) {
    throw new Error('HOOKCODE_API_BASE_URL is required.');
  }
  if (!pat) {
    throw new Error('HOOKCODE_PAT is required.');
  }
  if (!taskGroupId) {
    throw new Error('Task group id is required (use --task-group or HOOKCODE_TASK_GROUP_ID).');
  }

  const url = buildUrl(baseUrl, `/api/task-groups/${taskGroupId}/preview/start`);
  const headers = buildAuthHeaders(pat);
  await sendRequest({ url, method: 'POST', headers, dryRun: Boolean(args['dry-run']) });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
