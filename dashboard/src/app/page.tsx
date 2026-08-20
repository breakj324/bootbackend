'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate backend auth check
    setTimeout(() => {
      if (email === 'admin@example.com' && password === 'password123') {
        router.push('/dashboard');
      } else {
        setError('Invalid email or password. Use admin@example.com / password123');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="auth-container">
      <main className="auth-card">
        <header className="auth-header">
          <h1 className="auth-title">NextJS Control Center</h1>
          <p className="auth-subtitle">Sign in to manage queues, databases, and telegram bots</p>
        </header>

        <form onSubmit={handleLogin}>
          {error && (
            <div style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email Address</label>
            <input
              id="email-input"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
            style={{ marginTop: '1.75rem' }}
          >
            {isLoading ? 'Authenticating...' : 'Access Dashboard'}
          </button>
        </form>
      </main>
    </div>
  );
}
