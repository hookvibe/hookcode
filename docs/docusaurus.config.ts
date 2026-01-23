// Configure the docs site to use Docusaurus instead of Mintlify docs.json. docs/en/developer/plans/dsim8xybp9oa18nz1gfq/task_plan.md dsim8xybp9oa18nz1gfq
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';

const config: Config = {
  title: 'HookCode Docs',
  tagline: 'Documentation for HookCode',
  favicon: 'assets/logo.svg',

  url: 'https://example.com',
  baseUrl: '/',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'en',
          routeBasePath: 'docs',
          sidebarPath: require.resolve('./sidebars.ts'),
          exclude: ['**/AGENTS.md', '**/_template.md'],
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'HookCode',
      logo: {
        alt: 'HookCode Logo',
        src: 'assets/logo.svg',
      },
      items: [
        // Expose 4 doc sidebars as a navbar section switcher. docs/en/developer/plans/z91bv632ewan7oocdkb4/task_plan.md z91bv632ewan7oocdkb4
        {
          type: 'docSidebar',
          sidebarId: 'userDocs',
          position: 'left',
          label: 'User Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiReference',
          position: 'left',
          label: 'API Reference',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developerDocs',
          position: 'left',
          label: 'Developer Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'changeLog',
          position: 'left',
          label: 'Change Log',
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
};

export default config;
