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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="w-full max-w-md bg-[#FBF9F5] border-2 border-stone-900 rounded-lg shadow-[6px_6px_0px_0px_#1C1917] overflow-hidden text-stone-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded border-2 border-stone-900 bg-amber-400 text-stone-950 flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold font-mono text-stone-950 uppercase tracking-tight">
              {isRegister ? 'Create User Ticket' : 'Account Sign In'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded border border-stone-400 hover:border-stone-900 bg-white hover:bg-stone-100 text-stone-900 shadow-[1px_1px_0px_0px_#000] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded text-xs font-mono font-bold text-rose-900 shadow-[2px_2px_0px_0px_#E11D48]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label className="block text-xs font-mono font-bold text-stone-700 uppercase mb-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                <input
                  id="auth-username-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  className="w-full bg-white border-2 border-stone-800 rounded pl-9 pr-3 py-2 text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 shadow-[2px_2px_0px_0px_#1C1917]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-bold text-stone-700 uppercase mb-1">
              {isRegister ? 'Email Address' : 'Email or Username'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
              <input
                id="auth-email-input"
                type={isRegister ? 'email' : 'text'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'you@example.com' : 'you@example.com or username'}
                className="w-full bg-white border-2 border-stone-800 rounded pl-9 pr-3 py-2 text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 shadow-[2px_2px_0px_0px_#1C1917]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-stone-700 uppercase mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
              <input
                id="auth-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border-2 border-stone-800 rounded pl-9 pr-3 py-2 text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-600 shadow-[2px_2px_0px_0px_#1C1917]"
              />
            </div>
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-stone-900 rounded text-xs font-mono font-bold uppercase transition shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? 'AUTHENTICATING...' : isRegister ? 'REGISTER & SIGN IN' : 'SIGN IN'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t-2 border-stone-800 flex flex-col gap-2">
          <button
            type="button"
            id="btn-quick-demo-login"
            onClick={handleQuickDemoAccount}
            disabled={loading}
            className="w-full py-2 bg-white hover:bg-amber-50 text-stone-900 rounded border-2 border-stone-800 text-xs font-mono font-bold uppercase transition shadow-[2px_2px_0px_0px_#1C1917] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
          >
            ⚡ 1-Click Demo Account Login
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs font-mono text-stone-600 hover:text-stone-950 underline transition text-center pt-1 cursor-pointer"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
};
