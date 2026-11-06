import React, { useState } from 'react';
import { Card, Title, Button, TextField } from '../../components/ds';
import { useAuth } from './AuthContext';

export interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login, isAuthenticated, user, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="sn-page-auth" id="main" tabIndex={-1}>
      <Title size="title-l" as="h1" className="sn-page-auth__wordmark">
        SongNodes
      </Title>

      <Card className="sn-page-auth__card">
        <div className="sn-card__head">
          <Title size="title-m" as="h2">
            Sign In
          </Title>
        </div>

        {isAuthenticated && user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="sn-banner" data-status="ok">
              <div className="sn-banner__body">
                <div className="sn-banner__content">
                  <span className="sn-banner__title">Signed In:</span> {user.email}
                </div>
              </div>
            </div>
            <Button kind="secondary" onClick={() => void logout()}>
              Sign Out
            </Button>
          </div>
        ) : (
          <>
            {error ? (
              <div className="sn-banner" data-status="bad" role="alert">
                <div className="sn-banner__body">
                  <div className="sn-banner__content">
                    <span className="sn-banner__title">Error:</span> {error}
                  </div>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <TextField
                label="Username or Email"
                value={username}
                onChange={setUsername}
                type="text"
                placeholder="dj@songnodes.local"
              />

              <TextField
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••••"
              />

              <Button
                kind="primary"
                type="submit"
                busy={submitting}
                busyLabel="Signing in..."
                disabled={submitting || !username.trim() || !password}
              >
                Sign In with Duo MFA
              </Button>
            </form>

            <div className="sn-page-auth__foot">
              <span>SongNodes Security</span>
              <span>Cisco Duo Two-Factor Protection</span>
            </div>
          </>
        )}
      </Card>
    </main>
  );
};

export default LoginPage;
