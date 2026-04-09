import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ExportPage from '@/pages/ExportPage';

describe('ExportPage', () => {
  it('redirects export routes into settings data export by default', () => {
    render(
      <MemoryRouter initialEntries={['/export']}>
        <Routes>
          <Route path="/export" element={<ExportPage />} />
          <Route path="/settings" element={<div>Settings Data Hub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Settings Data Hub')).toBeInTheDocument();
  });

  it('preserves import tab requests when redirecting', () => {
    render(
      <MemoryRouter initialEntries={['/export?tab=import']}>
        <Routes>
          <Route path="/export" element={<ExportPage />} />
          <Route path="/settings" element={<div>Settings Data Hub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Settings Data Hub')).toBeInTheDocument();
  });
});
