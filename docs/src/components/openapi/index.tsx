import React, { useCallback, useEffect, useMemo, useState } from 'react';

// Define OpenAPI data shapes used by the docs renderer. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126

type OpenApiSpec = {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
};

type OpenApiParameter = {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
  example?: unknown;
};

type OpenApiRequestBody = {
  required?: boolean;
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown; examples?: Record<string, any> }>;
};

type OpenApiResponse = {
  description?: string;
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown; examples?: Record<string, any> }>;
};

type OpenApiSchema = {
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  enum?: unknown[];
};

// Provide shared OpenAPI state for API docs pages. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126

type OpenApiContextValue = {
  spec: OpenApiSpec | null;
  specUrl: string;
  baseUrl: string;
  token: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  setSpecUrl: (value: string) => void;
  setBaseUrl: (value: string) => void;
  setToken: (value: string) => void;
  reloadSpec: () => void;
};

const DEFAULT_SPEC_URL = '/api/openapi.json';
const DEFAULT_BASE_URL = '/api';
const STORAGE_KEYS = {
  specUrl: 'hookcode_openapi_spec_url',
  baseUrl: 'hookcode_openapi_base_url',
  token: 'hookcode_openapi_token'
};

// Centralize the OpenAPI context to avoid repeated spec fetches. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const OpenApiContext = React.createContext<OpenApiContextValue | null>(null);

// Load persisted settings with sensible fallbacks for docs usage. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const readStoredValue = (key: string, fallback: string, storage: Storage | null) => {
  if (!storage) return fallback;
  const raw = storage.getItem(key);
  return raw && raw.trim() ? raw : fallback;
};

// Persist settings updates for the OpenAPI explorer inputs. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const writeStoredValue = (key: string, value: string, storage: Storage | null) => {
  if (!storage) return;
  if (!value) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, value);
};

// Resolve relative API paths against the configured base URL. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const buildUrl = (baseUrl: string, path: string) => {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  if (!trimmedBase) return trimmedPath;
  if (trimmedBase.startsWith('http')) {
    return `${trimmedBase}${trimmedPath}`;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const normalizedBase = trimmedBase.startsWith('/') ? trimmedBase : `/${trimmedBase}`;
  return `${origin}${normalizedBase}${trimmedPath}`;
};

// Locate a matching OpenAPI operation by its operationId. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const findOperation = (spec: OpenApiSpec | null, operationId: string) => {
  if (!spec?.paths) return null;
  for (const path of Object.keys(spec.paths)) {
    const methods = spec.paths[path];
    for (const method of Object.keys(methods)) {
      const op = methods[method] as OpenApiOperation;
      if (op?.operationId === operationId) {
        return { path, method: method.toUpperCase(), operation: op };
      }
    }
  }
  return null;
};

// Format JSON previews for request/response examples. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

// Build a minimal example object from an OpenAPI schema. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const buildSchemaExample = (schema?: OpenApiSchema): unknown => {
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === 'object') {
    const result: Record<string, unknown> = {};
    if (schema.properties) {
      for (const key of Object.keys(schema.properties)) {
        result[key] = buildSchemaExample(schema.properties[key]);
      }
    }
    return result;
  }
  if (schema.type === 'array') {
    const item = buildSchemaExample(schema.items);
    return item === undefined ? [] : [item];
  }
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return false;
  return '';
};

// Select a JSON response body when multiple content types exist. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
const pickJsonSchema = (content?: OpenApiRequestBody['content'] | OpenApiResponse['content']) => {
  if (!content) return undefined;
  if (content['application/json']) return content['application/json'];
  const firstKey = Object.keys(content)[0];
  return firstKey ? content[firstKey] : undefined;
};

// Provide OpenAPI settings and spec data to child components. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
export const OpenApiProvider = ({ children }: { children: React.ReactNode }) => {
  const [specUrl, setSpecUrlState] = useState(DEFAULT_SPEC_URL);
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
  const [token, setTokenState] = useState('');
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [status, setStatus] = useState<OpenApiContextValue['status']>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate settings from storage once on the client. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    if (typeof window === 'undefined') return;
    setSpecUrlState(readStoredValue(STORAGE_KEYS.specUrl, DEFAULT_SPEC_URL, window.localStorage));
    setBaseUrlState(readStoredValue(STORAGE_KEYS.baseUrl, DEFAULT_BASE_URL, window.localStorage));
    setTokenState(readStoredValue(STORAGE_KEYS.token, '', window.sessionStorage));
  }, []);

  const loadSpec = useCallback(async () => {
    // Fetch the OpenAPI spec with optional bearer auth. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    if (!specUrl) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(specUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `OpenAPI fetch failed: ${res.status}`);
      }
      const data = (await res.json()) as OpenApiSpec;
      setSpec(data);
      setStatus('ready');
    } catch (err: any) {
      setSpec(null);
      setStatus('error');
      setError(err?.message ? String(err.message) : 'Failed to load OpenAPI spec.');
    }
  }, [specUrl, token]);

  useEffect(() => {
    // Auto-load the spec when the URL changes. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    if (!specUrl) return;
    loadSpec();
  }, [specUrl, loadSpec]);

  const setSpecUrl = (value: string) => {
    // Keep the spec URL synced with local storage. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    setSpecUrlState(value);
    if (typeof window !== 'undefined') {
      writeStoredValue(STORAGE_KEYS.specUrl, value, window.localStorage);
    }
  };

  const setBaseUrl = (value: string) => {
    // Persist the API base URL for Try It requests. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    setBaseUrlState(value);
    if (typeof window !== 'undefined') {
      writeStoredValue(STORAGE_KEYS.baseUrl, value, window.localStorage);
    }
  };

  const setToken = (value: string) => {
    // Store bearer tokens in session storage for safety. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    setTokenState(value);
    if (typeof window !== 'undefined') {
      writeStoredValue(STORAGE_KEYS.token, value, window.sessionStorage);
    }
  };

  const value: OpenApiContextValue = {
    spec,
    specUrl,
    baseUrl,
    token,
    status,
    error,
    setSpecUrl,
    setBaseUrl,
    setToken,
    reloadSpec: loadSpec
  };

  return (
    <OpenApiContext.Provider value={value}>
      {children}
    </OpenApiContext.Provider>
  );
};

// Provide typed access to the OpenAPI context within docs components. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
export const useOpenApi = () => {
  const ctx = React.useContext(OpenApiContext);
  if (!ctx) {
    throw new Error('OpenApiContext is missing. Wrap the page with <OpenApiProvider>.');
  }
  return ctx;
};

// Render the configuration panel for OpenAPI docs usage. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
export const OpenApiSettings = () => {
  const { specUrl, baseUrl, token, status, error, setSpecUrl, setBaseUrl, setToken, reloadSpec } = useOpenApi();

  return (
    <section className="openapi-settings">
      <header className="openapi-settings__header">
        <div>
          <h2 className="openapi-settings__title">OpenAPI Settings</h2>
          <p className="openapi-settings__desc">Configure the spec URL, API base URL, and bearer token.</p>
        </div>
        <button type="button" className="button button--primary" onClick={reloadSpec}>
          Reload Spec
        </button>
      </header>
      <div className="openapi-settings__grid">
        <label className="openapi-field">
          <span className="openapi-label">OpenAPI Spec URL</span>
          <input
            className="openapi-input"
            value={specUrl}
            onChange={(event) => setSpecUrl(event.target.value)}
            placeholder="/api/openapi.json"
          />
          <span className="openapi-help">Use a full URL in local dev (e.g. http://127.0.0.1:4000/api/openapi.json).</span>
        </label>
        <label className="openapi-field">
          <span className="openapi-label">API Base URL</span>
          <input
            className="openapi-input"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="/api"
          />
          <span className="openapi-help">Used by the Try It panel below.</span>
        </label>
        <label className="openapi-field">
          <span className="openapi-label">Bearer Token</span>
          <input
            className="openapi-input"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste a bearer token"
          />
          <span className="openapi-help">Stored in session storage for safety.</span>
        </label>
      </div>
      <div className={`openapi-status openapi-status--${status}`}>
        <span>Status: {status}</span>
        {error ? <span className="openapi-error">{error}</span> : null}
      </div>
    </section>
  );
};

// Render a single OpenAPI operation with docs and Try It controls. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
export const OpenApiOperationCard = ({ operationId }: { operationId: string }) => {
  const { spec, baseUrl, token } = useOpenApi();
  const operationData = useMemo(() => findOperation(spec, operationId), [spec, operationId]);

  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyValue, setBodyValue] = useState('');
  const [responseStatus, setResponseStatus] = useState<string | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parameters = operationData?.operation?.parameters ?? [];
  const requestBody = operationData?.operation?.requestBody;
  const jsonBody = pickJsonSchema(requestBody?.content);
  const jsonBodyExample = useMemo(() => {
    if (!jsonBody) return '';
    const example =
      jsonBody.example ??
      (jsonBody.examples ? Object.values(jsonBody.examples)[0]?.value : undefined) ??
      buildSchemaExample(jsonBody.schema);
    return example === undefined ? '' : formatJson(example);
  }, [jsonBody]);

  useEffect(() => {
    if (!bodyValue && jsonBodyExample) {
      setBodyValue(jsonBodyExample);
    }
  }, [jsonBodyExample, bodyValue]);

  // Show a helpful message when the spec is not loaded. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
  if (!spec) {
    return <div className="openapi-empty">OpenAPI spec not loaded yet. Check the settings above.</div>;
  }

  if (!operationData) {
    return <div className="openapi-empty">OpenAPI operation not found: {operationId}</div>;
  }

  const { path, method, operation } = operationData;
  const pathParams = parameters.filter((param) => param.in === 'path');
  const queryParams = parameters.filter((param) => param.in === 'query');
  const hasBody = Boolean(requestBody);
  // Detect SSE endpoints to avoid hanging Try It requests. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
  const isEventStream = Boolean(
    operation.responses &&
      Object.values(operation.responses).some((response) => response.content && response.content['text/event-stream'])
  );
  const missingPath = pathParams.some((param) => param.required && !paramValues[param.name]);

  const updateParam = (name: string, value: string) => {
    // Keep parameter inputs synchronized with state. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const buildRequestUrl = () => {
    // Build the final request URL with path + query params. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    let resolvedPath = path;
    for (const param of pathParams) {
      const value = paramValues[param.name] ?? '';
      resolvedPath = resolvedPath.replace(`{${param.name}}`, encodeURIComponent(value));
    }
    const url = new URL(buildUrl(baseUrl, resolvedPath));
    for (const param of queryParams) {
      const value = paramValues[param.name];
      if (value) {
        url.searchParams.set(param.name, value);
      }
    }
    return url.toString();
  };

  const sendRequest = async () => {
    if (isEventStream) return;
    // Execute the API request using the configured base URL and token. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    if (submitting || missingPath) return;
    setSubmitting(true);
    setResponseStatus(null);
    setResponseBody(null);
    try {
      const url = buildRequestUrl();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (hasBody && bodyValue) headers['Content-Type'] = 'application/json';
      const res = await fetch(url, {
        method,
        headers,
        body: hasBody && bodyValue ? bodyValue : undefined
      });
      const text = await res.text();
      const formatted = text ? text : '';
      setResponseStatus(`${res.status} ${res.statusText}`);
      setResponseBody(formatted);
    } catch (err: any) {
      setResponseStatus('Request failed');
      setResponseBody(err?.message ? String(err.message) : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="openapi-operation">
      <header className="openapi-operation__header">
        <span className={`openapi-method openapi-method--${method.toLowerCase()}`}>{method}</span>
        <code className="openapi-path">{path}</code>
      </header>
      <div className="openapi-summary">
        <strong>{operation.summary ?? operation.operationId}</strong>
        {operation.description ? <p>{operation.description}</p> : null}
      </div>
      {parameters.length > 0 ? (
        <div className="openapi-params">
          <h4>Parameters</h4>
          <div className="openapi-params__list">
            {parameters.map((param) => (
              <div key={`${param.in}-${param.name}`} className="openapi-param">
                <span className="openapi-param__name">{param.name}</span>
                <span className="openapi-param__meta">
                  {param.in}
                  {param.required ? ' · required' : ' · optional'}
                </span>
                {param.description ? <p>{param.description}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {hasBody ? (
        <div className="openapi-request">
          <h4>Request Body</h4>
          <p>Content type: application/json</p>
        </div>
      ) : null}
      {operation.responses ? (
        <div className="openapi-responses">
          <h4>Responses</h4>
          <div className="openapi-responses__list">
            {Object.entries(operation.responses).map(([code, response]) => {
              const content = pickJsonSchema(response.content);
              // Prefer examples, but fall back to schema-derived previews. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
              const example = content?.example ?? (content?.examples ? Object.values(content.examples)[0]?.value : null);
              const schemaFallback = content?.schema ? buildSchemaExample(content.schema) : null;
              const preview = example ?? schemaFallback;
              return (
                <div key={code} className="openapi-response">
                  <div className="openapi-response__code">{code}</div>
                  <div className="openapi-response__desc">{response.description || 'Response'}</div>
                  {preview ? (
                    <pre>
                      <code>{formatJson(preview)}</code>
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="openapi-try">
        <h4>Try It</h4>
        {pathParams.length > 0 || queryParams.length > 0 ? (
          <div className="openapi-try__params">
            {[...pathParams, ...queryParams].map((param) => (
              <label key={`${param.in}-${param.name}`} className="openapi-field">
                <span className="openapi-label">
                  {param.name} <span className="openapi-param__meta">({param.in})</span>
                </span>
                <input
                  className="openapi-input"
                  value={paramValues[param.name] ?? ''}
                  onChange={(event) => updateParam(param.name, event.target.value)}
                  placeholder={param.required ? 'Required' : 'Optional'}
                />
              </label>
            ))}
          </div>
        ) : null}
        {hasBody ? (
          <label className="openapi-field">
            <span className="openapi-label">JSON Body</span>
            <textarea
              className="openapi-textarea"
              value={bodyValue}
              onChange={(event) => setBodyValue(event.target.value)}
              rows={8}
            />
          </label>
        ) : null}
        {isEventStream ? (
          <div className="openapi-help">SSE endpoints are not supported in Try It. Use EventSource instead.</div>
        ) : null}
        <button
          type="button"
          className="button button--secondary"
          disabled={missingPath || submitting || isEventStream}
          onClick={sendRequest}
        >
          {submitting ? 'Sending...' : 'Send Request'}
        </button>
        {responseStatus ? (
          <div className="openapi-response-box">
            <strong>{responseStatus}</strong>
            <pre>
              <code>{responseBody}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
};

// Provide a concise alias for MDX usage. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
export const OpenApiOperation = OpenApiOperationCard;
