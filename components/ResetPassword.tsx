import React, { useState } from "react";
import { AuthService, AuthError } from "../services/auth";
import { Lock, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ResetPasswordProps {
  onSuccess: () => void;
  onCancel: () => void;
  isForced?: boolean;
}

export default function ResetPassword({ onSuccess, onCancel, isForced }: ResetPasswordProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await AuthService.resetPassword(password);
      
      // If it was a forced reset, we should clear the flag in metadata
      const currentUser = AuthService.getCurrentUser();
      if (currentUser) {
        await AuthService.updateProfile({ 
            ...currentUser, 
            forcePasswordReset: false 
        });
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-[#1e1e1e] border border-gray-800 rounded-xl max-w-md w-full mx-auto">
        <div className="bg-green-900/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-green-700/50">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
        <p className="text-gray-400">Your password has been reset successfully. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className={`max-w-md w-full bg-[#1e1e1e] p-8 rounded-xl border border-gray-800 shadow-2xl mx-auto ${isForced ? '' : 'my-12'}`}>
      <div className="text-center mb-8">
        <div className="bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-700/50">
          <Lock size={32} className="text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          {isForced ? "Required Password Reset" : "Set New Password"}
        </h2>
        <p className="text-gray-400 text-sm mt-2">
          {isForced 
            ? "Your account requires a password change to continue." 
            : "Please enter your new password below."}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none"
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none"
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Reset Password"}
        </button>

        {!isForced && (
            <button 
                type="button"
                onClick={onCancel}
                className="w-full text-gray-400 hover:text-white text-sm transition-colors mt-2"
            >
                Cancel
            </button>
        )}
      </form>
    </div>
  );
}
