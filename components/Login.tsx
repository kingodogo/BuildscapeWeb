import React, { useState } from "react";
import { AuthService, AuthError } from "../services/auth";
import { User } from "../types";
import { LogIn, AlertCircle, Loader2, ShieldCheck, KeyRound } from "lucide-react";

interface LoginProps {
  onLogin: (user: User) => void;
  onError?: (error: AuthError) => void;
  onNavigateRegister: () => void;
}

type MigrationStep = 'otp' | 'password';

interface LegacyState {
  username: string;
  maskedEmail: string;
  realEmail: string;    // needed for supabase.auth.verifyOtp()
  step: MigrationStep;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export default function Login({ onLogin, onError, onNavigateRegister }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Legacy migration state
  const [legacy, setLegacy] = useState<LegacyState | null>(null);
  const [migrationError, setMigrationError] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);

  // ── Normal OTP / email confirm handlers ──────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!otp || !unconfirmedEmail) return;
    setIsVerifying(true);
    try {
      await AuthService.verifyOtp(unconfirmedEmail, otp);
      setUnconfirmedEmail(null);
      try {
        const user = await AuthService.login(username, password);
        if (user) onLogin(user);
      } catch {
        setError("Verification successful, but login failed. Please enter your password and click Login.");
      }
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!unconfirmedEmail) return;
    setIsLoading(true);
    setResendSuccess(false);
    try {
      await AuthService.resendConfirmationEmail(unconfirmedEmail);
      setResendSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to resend confirmation email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!username.includes('@')) {
      alert("Please enter your email address in the 'Username or Email' field to reset your password.");
      return;
    }
    setIsResetting(true);
    try {
      await AuthService.requestPasswordReset(username);
      alert("Password reset link sent to " + username);
    } catch (err: any) {
      alert("Failed to send reset link: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setUnconfirmedEmail(null);
    setIsLoading(true);

    try {
      const user = await AuthService.login(username, password);
      if (user) onLogin(user);
      else setError("Login failed. Please try again.");
    } catch (err: any) {
      if (err instanceof AuthError && err.code === 'EMAIL_NOT_CONFIRMED') {
        setUnconfirmedEmail(err.message);
        return;
      }
      if (err instanceof AuthError && err.code === 'LEGACY_USER') {
        // Kick off migration — sends OTP to old email automatically
        try {
          const result = await AuthService.initiateLegacyMigration(username);
          setLegacy({
            username: result.username,
            maskedEmail: result.maskedEmail,
            realEmail: result.email,
            step: 'otp',
            otp: '',
            newPassword: '',
            confirmPassword: '',
          });
        } catch (initErr: any) {
          setError(initErr.message || "Migration failed. Please contact support.");
        }
        return;
      }
      const errorMsg = err instanceof AuthError ? err.message : (err.message || "Invalid username or password.");
      setError(errorMsg);
      if (onError && err instanceof AuthError) onError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Migration OTP verify ─────────────────────────────────────────────────
  const handleMigrationOtp = async () => {
    if (!legacy) return;
    if (legacy.otp.length !== 8) { setMigrationError("Please enter the 8-digit code."); return; }
    setIsMigrating(true);
    setMigrationError("");
    try {
      // Supabase verifies the OTP and logs the user in
      await AuthService.verifyLegacyOtp(legacy.realEmail, legacy.otp);
      setLegacy({ ...legacy, step: 'password' });
    } catch (err: any) {
      setMigrationError(err.message || "Invalid code. Please try again.");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleMigrationComplete = async () => {
    if (!legacy) return;
    if (legacy.newPassword.length < 8) { setMigrationError("Password must be at least 8 characters."); return; }
    if (legacy.newPassword !== legacy.confirmPassword) { setMigrationError("Passwords do not match."); return; }

    setIsMigrating(true);
    setMigrationError("");
    try {
      // Set new password + restore old profile (role, Minecraft, etc.) in one call
      const user = await AuthService.finalizeLegacyProfile(legacy.newPassword);
      onLogin(user);
    } catch (err: any) {
      setMigrationError(err.message || "Migration failed. Please try again.");
    } finally {
      setIsMigrating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Migration Wizard UI
  // ─────────────────────────────────────────────────────────────────────────
  if (legacy) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-xl border border-gray-800 shadow-2xl mb-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-700">
              {legacy.step === 'otp'
                ? <ShieldCheck size={30} className="text-blue-400" />
                : <KeyRound size={30} className="text-blue-400" />}
            </div>
            <h2 className="text-2xl font-bold text-white">Account Migration</h2>
            <p className="text-gray-400 text-sm mt-1">
              Welcome back, <span className="text-blue-400 font-semibold">{legacy.username}</span>!
            </p>
          </div>

          {/* Step bar */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-1 rounded-full bg-blue-500" />
            <div className={`flex-1 h-1 rounded-full ${legacy.step === 'password' ? 'bg-blue-500' : 'bg-gray-700'}`} />
          </div>

          {migrationError && (
            <div className="mb-4 bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {migrationError}
            </div>
          )}

          {legacy.step === 'otp' ? (
            <>
              <div className="bg-blue-900/10 border border-blue-900/40 rounded-lg p-4 mb-5 text-sm text-blue-300">
                Due to our database upgrade, we need to verify your identity.<br />
                A <strong>8-digit code</strong> has been sent to <strong>{legacy.maskedEmail}</strong>.
              </div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={legacy.otp}
                onChange={e => setLegacy({ ...legacy, otp: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                placeholder="12345678"
                className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-center text-2xl font-bold text-white tracking-[0.3em] focus:border-blue-500 outline-none mb-4"
              />
              <button
                onClick={handleMigrationOtp}
                disabled={isMigrating || legacy.otp.length !== 8}
                className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isMigrating
                  ? <><Loader2 size={18} className="animate-spin" /> Verifying...</>
                  : 'Verify Code →'}
              </button>
            </>
          ) : (
            <>
              <div className="bg-blue-900/10 border border-blue-900/40 rounded-lg p-4 mb-5 text-sm text-blue-300">
                Great! Now set a <strong>new password</strong> for your account.
                Once done, you'll be logged in automatically with all your data restored.
              </div>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={legacy.newPassword}
                    onChange={e => setLegacy({ ...legacy, newPassword: e.target.value })}
                    placeholder="Min. 8 characters"
                    className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={legacy.confirmPassword}
                    onChange={e => setLegacy({ ...legacy, confirmPassword: e.target.value })}
                    placeholder="Repeat your password"
                    className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleMigrationComplete}
                disabled={isMigrating || !legacy.newPassword || !legacy.confirmPassword}
                className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isMigrating
                  ? <><Loader2 size={18} className="animate-spin" /> Restoring account...</>
                  : 'Complete Migration & Login'}
              </button>
            </>
          )}

          <button
            onClick={() => { setLegacy(null); setMigrationError(""); }}
            className="mt-4 text-gray-600 hover:text-gray-400 text-xs hover:underline w-full text-center"
          >
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Normal Login UI
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto custom-scrollbar flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-xl border border-gray-800 shadow-2xl mb-8">
        <div className="text-center mb-8">
          <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
            <LogIn size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Sign In</h2>
          <p className="text-gray-500 text-sm mt-2">Welcome back to Buildscape Tracker</p>
        </div>

        {unconfirmedEmail ? (
          <div className="mb-6 bg-yellow-900/20 border border-yellow-900 text-yellow-400 px-4 py-3 rounded-lg text-sm text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle size={20} />
              <span className="font-bold text-lg">Verification Required</span>
            </div>
            <p className="mb-4">
              Your email <strong>{unconfirmedEmail}</strong> has not been verified yet.
            </p>
            <div className="mb-4">
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="12345678"
                className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-center text-xl font-bold text-white tracking-[0.2em] focus:border-yellow-500 outline-none mb-2"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={isVerifying || otp.length !== 8}
                className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded transition-colors w-full disabled:opacity-50"
              >
                {isVerifying ? "Verifying..." : "Verify Code"}
              </button>
            </div>
            <div className="text-xs text-yellow-600 mb-2">OR</div>
            <button
              onClick={handleResend}
              disabled={isLoading}
              className="bg-yellow-700 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition-colors w-full mb-2 disabled:opacity-50"
            >
              {isLoading ? "Resending..." : (resendSuccess ? "Email Sent!" : "Resend Email & Code")}
            </button>
            <button
              onClick={() => setUnconfirmedEmail(null)}
              className="text-yellow-500 hover:text-yellow-400 text-xs hover:underline"
            >
              Use a different account
            </button>
          </div>
        ) : error && (
          <div className="mb-6 bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
              placeholder="Enter your username or email"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-gray-800 space-y-3">
          <button
            onClick={handleForgotPassword}
            disabled={isLoading || isResetting}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium hover:underline disabled:opacity-50 block w-full"
          >
            {isResetting ? "Sending Link..." : "Forgot Password?"}
          </button>
          <div>
            <p className="text-gray-400 text-sm mb-2">New here?</p>
            <button
              onClick={onNavigateRegister}
              disabled={isLoading}
              className="text-green-500 hover:text-green-400 font-medium hover:underline disabled:opacity-50"
            >
              Create an Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}