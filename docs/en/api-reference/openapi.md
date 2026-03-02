# OpenAPI Spec
{/* Document OpenAPI access for Mintlify without local spec file. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

<Callout type="note" title="Source of Truth">
  The live OpenAPI JSON is served by the backend at `GET /api/openapi.json`.
</Callout>

## Authentication
The endpoint requires a PAT with system scope. You can provide the token via:
- `Authorization: Bearer <token>`
- `x-hookcode-token: <token>`
- `?token=<token>` query param

## Locales
The spec supports localized summaries:
- `?lang=en-US`
- `?lang=zh-CN`

You can also rely on `Accept-Language` headers if your client sets them.

## Example
```bash
curl -H "Authorization: Bearer $HOOKCODE_PAT" \
  "https://<your-host>/api/openapi.json?lang=en-US"
```
