import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as UIApp, ConfigProvider } from '@/ui';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Wrap the app with custom UI providers (no legacy UI dependency). docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 */}
    <ConfigProvider>
      <UIApp>
        <App />
      </UIApp>
    </ConfigProvider>
  </React.StrictMode>
);
