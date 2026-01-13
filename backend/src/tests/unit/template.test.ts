import { renderTemplate } from '../../agent/template';

describe('模板渲染 renderTemplate', () => {
  test('支持 {{path.to.value}} 替换', () => {
    const out = renderTemplate('hello {{repo.name}}', { repo: { name: 'demo' } });
    expect(out).toBe('hello demo');
  });

  test('不存在的变量渲染为空字符串', () => {
    const out = renderTemplate('x={{missing.value}}', { repo: { name: 'demo' } });
    expect(out).toBe('x=');
  });

  test('非字符串值会转换为字符串', () => {
    const out = renderTemplate('n={{issue.number}}', { issue: { number: 123 } });
    expect(out).toBe('n=123');
  });
});

