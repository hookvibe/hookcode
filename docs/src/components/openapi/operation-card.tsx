// Extract the OpenAPI operation card to isolate rendering and Try It logic. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import React, { useEffect, useMemo, useState } from 'react';
import { useOpenApi } from './context';
import { buildSchemaExample, buildUrl, findOperation, formatJson, pickJsonSchema } from './utils';

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

export const OpenApiOperation = OpenApiOperationCard;
