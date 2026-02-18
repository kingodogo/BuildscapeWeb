import React, { useState } from "react";
import { AuthService, AuthError } from "../services/auth";
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2, Lock } from "lucide-react";

interface ForgotPasswordProps {
  onBack: () => void;
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

type Step = 'email' | 'verify' | 'reset';

export default function ForgotPassword({ onBack, onSuccess, onError }: ForgotPasswordProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetCodeId, setResetCodeId] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    
    try {
      await AuthService.requestPasswordReset(email.trim());
      setStep('verify');
      setError("");
    } catch (err: any) {
      const errorMsg = err instanceof AuthError ? err.message : (err.message || "Failed to send verification code");
      setError(errorMsg);
      if (onError && err instanceof AuthError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!code.trim() || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await AuthService.verifyPasswordResetCode(email.trim(), code.trim());
      if (result.resetCodeId) {
        setResetCodeId(result.resetCodeId);
      }
      setStep('reset');
      setError("");
    } catch (err: any) {
      const errorMsg = err instanceof AuthError ? err.message : (err.message || "Invalid verification code");
      setError(errorMsg);
      if (onError && err instanceof AuthError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    
    try {
      await AuthService.resetPassword(email.trim(), code.trim(), newPassword, resetCodeId || undefined);
      if (onSuccess) {
        onSuccess();
      } else {
        // Show success and go back to login
        setError("");
        setTimeout(() => {
          onBack();
        }, 2000);
      }
    } catch (err: any) {
      const errorMsg = err instanceof AuthError ? err.message : (err.message || "Failed to reset password");
      setError(errorMsg);
      if (onError && err instanceof AuthError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-xl border border-gray-800 shadow-2xl mb-8">
        <div className="text-center mb-8">
          <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
            <Lock size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {step === 'email' && 'Reset Password'}
            {step === 'verify' && 'Verify Code'}
            {step === 'reset' && 'New Password'}
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            {step === 'email' && 'Enter your email to receive a verification code'}
            {step === 'verify' && 'Enter the 6-digit code sent to your email'}
            {step === 'reset' && 'Enter your new password'}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleRequestCode} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-green-500 outline-none"
                  placeholder="your.email@example.com"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Send Verification Code"}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                Verification Code
              </label>
              <input 
                type="text" 
                value={code} 
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                className="w-full bg-[#121212] border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-2xl font-mono tracking-widest focus:border-green-500 outline-none"
                placeholder="000000"
                maxLength={6}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Check your email ({email}) for the 6-digit code
              </p>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || code.length !== 6}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Verify Code"}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                New Password
              </label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                className="w-full bg-[#121212] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-green-500 outline-none"
                placeholder="Enter new password"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                Confirm Password
              </label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                className="w-full bg-[#121212] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-green-500 outline-none"
                placeholder="Confirm new password"
                disabled={isLoading}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || !newPassword || !confirmPassword}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Reset Password"}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-800">
          <button 
            onClick={() => {
              if (step === 'email') {
                onBack();
              } else {
                setStep(step === 'reset' ? 'verify' : 'email');
                setError("");
              }
            }}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white font-medium transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            {step === 'email' ? 'Back to Login' : 'Go Back'}
          </button>
        </div>

        {step === 'reset' && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle size={16} />
              <span>Code verified successfully. You can now set a new password.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

