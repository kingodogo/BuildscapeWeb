import React, { useState } from "react";
import { AuthService, AuthError } from "../services/auth";
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2, Lock } from "lucide-react";

interface ForgotPasswordProps {
  onBack: () => void;
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

type Step = 'email' | 'verify' | 'reset';



/**
 * Render a password-reset UI that sends a reset link to the provided email and shows a confirmation on success.
 *
 * The component validates the entered email, calls AuthService.requestPasswordReset, displays inline errors,
 * shows a loading state during the request, and renders a success screen when the request completes.
 *
 * @param onBack - Callback invoked to navigate back to the login view
 * @param onSuccess - Optional callback invoked after a successful reset request
 * @param onError - Optional callback invoked with an `AuthError` when the reset request fails
 * @returns A React element representing the Forgot Password form and its success confirmation
 */
export default function ForgotPassword({ onBack, onSuccess, onError }: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
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
      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const errorMsg = err instanceof AuthError ? err.message : (err.message || "Failed to send reset link");
      setError(errorMsg);
      if (onError && err instanceof AuthError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-xl border border-gray-800 shadow-2xl mb-8 text-center">
            <div className="bg-green-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-700/50">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
            <p className="text-gray-400 mb-6">
              If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
            </p>
            <button 
              onClick={onBack}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Back to Login
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-xl border border-gray-800 shadow-2xl mb-8">
        <div className="text-center mb-8">
          <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
            <Lock size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Reset Password</h2>
          <p className="text-gray-500 text-sm mt-2">
            Enter your email to receive a password reset link
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleRequestReset} className="space-y-5">
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
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-800">
          <button 
            onClick={onBack}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white font-medium transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
