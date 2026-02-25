// Extract OpenAPI provider and context logic for docs reuse. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import React, { useCallback, useEffect, useState } from 'react';
import { DEFAULT_BASE_URL, DEFAULT_SPEC_URL, STORAGE_KEYS } from './constants';
import { readStoredValue, writeStoredValue } from './storage';
import type { OpenApiContextValue, OpenApiSpec } from './types';

const OpenApiContext = React.createContext<OpenApiContextValue | null>(null);

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

  return <OpenApiContext.Provider value={value}>{children}</OpenApiContext.Provider>;
};

export const useOpenApi = () => {
  const ctx = React.useContext(OpenApiContext);
  if (!ctx) {
    throw new Error('OpenApiContext is missing. Wrap the page with <OpenApiProvider>.');
  }
  return ctx;
};
