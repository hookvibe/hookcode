import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageNav } from '../components/nav/PageNav';

// Validate PageNav mobile nav toggle behavior. docs/en/developer/plans/dhbg1plvf7lvamcpt546/task_plan.md dhbg1plvf7lvamcpt546
describe('PageNav', () => {
  test('renders a nav toggle when provided and no back action exists', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<PageNav title="Title" navToggle={{ ariaLabel: 'Open menu', onClick: onToggle }} />);

    const toggle = screen.getByLabelText('Open menu');
    await user.click(toggle);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('hides the nav toggle when back is present', () => {
    render(
      <PageNav
        title="Title"
        back={{ ariaLabel: 'Back', onClick: () => undefined }}
        navToggle={{ ariaLabel: 'Open menu', onClick: () => undefined }}
      />
    );

    expect(screen.queryByLabelText('Open menu')).toBeNull();
    expect(screen.getByLabelText('Back')).toBeInTheDocument();
  });
});
