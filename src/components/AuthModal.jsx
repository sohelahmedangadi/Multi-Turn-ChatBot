import React, { useState } from 'react';
import { X, Lock, Mail, User, ArrowRight, Shield } from 'lucide-react';

export const AuthModal = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? { username, email, password }
        : { emailOrUsername: email || username, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication request failed');
      }

      onLoginSuccess(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoAccount = async () => {
    setError(null);
    setLoading(true);
    const demoEmail = 'demo@example.com';
    const demoPassword = 'Password123!';
    const demoUsername = 'DemoTester';

    try {
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: demoEmail, password: demoPassword }),
      });

      if (!res.ok) {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: demoUsername, email: demoEmail, password: demoPassword }),
        });
      }

      const data = await res.json();
      if (res.ok) {
        onLoginSuccess(data.token, data.user);
        onClose();
      } else {
        throw new Error(data.error || 'Demo login failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">
              {isRegister ? 'Create Account' : 'Sign In'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  id="auth-username-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {isRegister ? 'Email Address' : 'Email or Username'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                id="auth-email-input"
                type={isRegister ? 'email' : 'text'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'you@example.com' : 'you@example.com or username'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                id="auth-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Register & Sign In' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
          <button
            type="button"
            id="btn-quick-demo-login"
            onClick={handleQuickDemoAccount}
            disabled={loading}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition border border-slate-700"
          >
            ⚡ 1-Click Test Account (Demo User)
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-slate-400 hover:text-indigo-300 transition text-center pt-1"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
};
