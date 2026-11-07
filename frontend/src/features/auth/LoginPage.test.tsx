/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LoginPage } from './LoginPage';
import { AuthProvider, AuthContext, type AuthContextValue } from './AuthContext';
import { route as loginRoute } from './route';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the registered route with its required auth provider', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ authenticated: false, user: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    render(<MemoryRouter>{loginRoute.element}</MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Sign in', level: 2 })).toBeDefined();
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'), expect.objectContaining({ method: 'GET' }),
    ));
  });

  it('renders login form elements with design system components', () => {
    const mockContext: AuthContextValue = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn<(username: string, password?: string) => Promise<void>>().mockResolvedValue(),
      logout: vi.fn<() => Promise<void>>().mockResolvedValue(),
      checkAuth: vi.fn<() => Promise<void>>().mockResolvedValue(),
    };

    render(
      <AuthContext.Provider value={mockContext}>
        <LoginPage />
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: 'SongNodes', level: 1 })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Sign in', level: 2 })).toBeDefined();
    expect(screen.getByLabelText(/username or email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();

    const submitBtn = screen.getByRole('button', { name: /sign in with duo mfa/i });
    expect(submitBtn).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('updates input fields and enables submit button when filled', () => {
    const mockContext: AuthContextValue = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn<(username: string, password?: string) => Promise<void>>().mockResolvedValue(),
      logout: vi.fn<() => Promise<void>>().mockResolvedValue(),
      checkAuth: vi.fn<() => Promise<void>>().mockResolvedValue(),
    };

    render(
      <AuthContext.Provider value={mockContext}>
        <LoginPage />
      </AuthContext.Provider>
    );

    const usernameInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    if (!(usernameInput instanceof HTMLInputElement) || !(passwordInput instanceof HTMLInputElement)) {
      throw new Error('Expected HTMLInputElement');
    }

    const submitBtn = screen.getByRole('button', { name: /sign in with duo mfa/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(usernameInput, { target: { value: 'markus@songnodes.local' } });
    expect(usernameInput.value).toBe('markus@songnodes.local');
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(passwordInput, { target: { value: 'super-secret-password' } });
    expect(passwordInput.value).toBe('super-secret-password');
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('submits credentials and calls login on form submission', async () => {
    const mockLogin = vi.fn<(username: string, password?: string) => Promise<void>>().mockResolvedValue();
    const mockSuccess = vi.fn<() => void>();
    const mockContext: AuthContextValue = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn<() => Promise<void>>().mockResolvedValue(),
      checkAuth: vi.fn<() => Promise<void>>().mockResolvedValue(),
    };

    render(
      <AuthContext.Provider value={mockContext}>
        <LoginPage onSuccess={mockSuccess} />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'markus@songnodes.local' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });

    const submitBtn = screen.getByRole('button', { name: /sign in with duo mfa/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('markus@songnodes.local', 'secret');
      expect(mockSuccess).toHaveBeenCalled();
    });
  });

  it('displays error banner when login rejects with an error message', async () => {
    const mockLogin = vi.fn<(username: string, password?: string) => Promise<void>>()
      .mockRejectedValue(new Error('Invalid username or password'));

    const mockContext: AuthContextValue = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: vi.fn<() => Promise<void>>().mockResolvedValue(),
      checkAuth: vi.fn<() => Promise<void>>().mockResolvedValue(),
    };

    render(
      <AuthContext.Provider value={mockContext}>
        <LoginPage />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong-pass' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in with duo mfa/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeDefined();
      expect(alert.textContent).toContain('Invalid username or password');
    });
  });

  it('renders authenticated state and sign out button when logged in', () => {
    const mockLogout = vi.fn<() => Promise<void>>().mockResolvedValue();
    const mockContext: AuthContextValue = {
      user: { email: 'admin@songnodes.local', name: 'Admin' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn<(username: string, password?: string) => Promise<void>>().mockResolvedValue(),
      logout: mockLogout,
      checkAuth: vi.fn<() => Promise<void>>().mockResolvedValue(),
    };

    render(
      <AuthContext.Provider value={mockContext}>
        <LoginPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText(/admin@songnodes.local/i)).toBeDefined();
    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    expect(signOutBtn).toBeDefined();

    fireEvent.click(signOutBtn);
    expect(mockLogout).toHaveBeenCalled();
  });
});

describe('AuthProvider & useAuth Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('checks /api/v1/auth/me on mount and populates user when session exists', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ email: 'cloudflare-user@aiwfe.com', name: 'Cloudflare User' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/me'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(screen.getByText(/cloudflare-user@aiwfe.com/i)).toBeDefined();
    });
  });

  it('redirects to duo_auth_url on successful login', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ duo_auth_url: 'https://api-123.duosecurity.com/oauth/v1/authorize?state=abc' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const originalLocation = window.location;
    let redirectedUrl = '';
    const locationMock = Object.create(originalLocation) as Location;
    Object.defineProperty(locationMock, 'href', {
      configurable: true,
      set: (val: string) => {
        redirectedUrl = val;
      },
      get: () => redirectedUrl,
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationMock,
    });

    try {
      render(
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/username or email/i)).toBeDefined();
      });

      fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'dj@songnodes.local' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } });

      fireEvent.click(screen.getByRole('button', { name: /sign in with duo mfa/i }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/auth/login'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ username: 'dj@songnodes.local', password: 'mypassword' }),
          })
        );
        expect(redirectedUrl).toBe('https://api-123.duosecurity.com/oauth/v1/authorize?state=abc');
      });
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
