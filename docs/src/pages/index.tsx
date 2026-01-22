// Link the homepage to the 4 top-level docs sections. docs/en/developer/plans/z91bv632ewan7oocdkb4/task_plan.md z91bv632ewan7oocdkb4
import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';

import styles from './index.module.css';

export default function Home(): JSX.Element {
  return (
    <Layout title="HookCode Docs" description="Documentation for HookCode">
      <main className={styles.main}>
        <div className={styles.hero}>
          <Heading as="h1">HookCode Docs</Heading>
          <p className={styles.tagline}>Documentation for HookCode.</p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/user-docs">
              User Docs
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/api-reference">
              API Reference
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/developer">
              Developer Docs
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/change-log">
              Change Log
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
