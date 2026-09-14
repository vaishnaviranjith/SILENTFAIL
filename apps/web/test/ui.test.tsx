import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App, classForStatus, scoreLabel } from '../src/App';

describe('developer-tool presentation model', () => {
  it('formats the score used in dashboard and before/after views', () => {
    expect(scoreLabel(77.777)).toBe('77.8%');
    expect(scoreLabel(100)).toBe('100.0%');
  });

  it('maps machine statuses to stable CSS state names', () => {
    expect(classForStatus('NO_COVERAGE')).toBe('no-coverage');
    expect(classForStatus('SURVIVED')).toBe('survived');
    expect(classForStatus('CAUGHT')).toBe('caught');
  });

  it('loads the demo into the analyzer from the landing CTA', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Demo', isDemo: true, files: [{ path: 'discount.js', content: 'x', kind: 'source' }, { path: 'discount.test.js', content: 'x', kind: 'test' }] }),
    }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /try the live demo/i }));
    await waitFor(() => expect(screen.getByText('Ready to analyze')).toBeTruthy());
    expect(screen.getByRole('button', { name: /run mutation analysis/i })).toBeTruthy();
  });
});
