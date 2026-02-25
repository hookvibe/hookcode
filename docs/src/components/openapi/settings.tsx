// Extract the OpenAPI settings panel into its own component. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import React from 'react';
import { useOpenApi } from './context';

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
