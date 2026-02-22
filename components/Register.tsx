import React, { useState } from "react";
import { AuthService, AuthError } from "../services/auth";
import { User } from "../types";
import { UserPlus, AlertCircle, Loader2 } from "lucide-react";

interface RegisterProps {
  onLogin: (user: User) => void;
  onError?: (error: AuthError) => void;
  onNavigateLogin: () => void;
}

/**
 * Render a user registration UI that handles signup, optional email confirmation (OTP), verification, and resend flows.
 *
 * @param onLogin - Callback invoked with the created `User` after a successful registration (when no confirmation is required).
 * @param onError - Optional callback invoked with an `AuthError` when registration fails with an auth-specific error.
 * @param onNavigateLogin - Callback to navigate the user to the login view (used after successful verification or when the user chooses to go back).
 * @returns The registration UI as a React element.
 */
export default function Register({ onLogin, onError, onNavigateLogin }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);



  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyOtp = async () => {
      setIsVerifying(true);
      setError("");
      try {
          await AuthService.verifyOtp(email, otp);
          alert("Account verified! You can now log in.");
          onNavigateLogin();
      } catch (err: any) {
          console.error("Verification failed:", err);
          setError(err.message || "Invalid or expired code.");
      } finally {
          setIsVerifying(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    
    setIsLoading(true);
    try {
      const user = await AuthService.register(username, email, password);
      onLogin(user); 
    } catch (err: any) {
      // Check for confirmation required "error" (which is actually a success state for signup)
      if (err instanceof AuthError && err.code === 'CONFIRMATION_REQUIRED') {
         setSuccess(true);
         return;
      }

      console.error("Registration error in component:", err);
      let errorMsg = "Registration failed.";
      
      if (err instanceof AuthError) {
        errorMsg = err.message;
        if (onError) {
          onError(err);
        }
      } else {
        errorMsg = err.message || "Registration failed. Check browser console (F12) for details.";
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setResendSuccess(false);
    try {
       await AuthService.resendConfirmationEmail(email);
       setResendSuccess(true);
    } catch (err: any) {
       console.error("Failed to resend:", err);
       alert("Failed to resend email: " + (err.message || "Unknown error"));
    } finally {
       setIsResending(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-xl border border-gray-800 shadow-2xl mb-8">
        <div className="text-center mb-8">
          <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
            <UserPlus size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Create Account</h2>
          <p className="text-gray-500 text-sm mt-2">Join the Buildscape community.</p>
        </div>

        {success ? (
           <div className="text-center">
             <div className="bg-green-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-700/50">
               <div className="text-green-500 font-bold text-2xl">✓</div>
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Check Your Email</h3>
             <p className="text-gray-400 mb-6 text-sm">
               We've sent an 8-digit verification code to <strong>{email}</strong>.<br/>
               Enter the code below to verify your account.
             </p>
             
             <div className="mb-6">
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                  placeholder="12345678"
                  className="w-72 bg-[#121212] border border-gray-700 rounded-lg p-3 text-center text-2xl font-bold text-white tracking-[0.3em] focus:border-green-500 outline-none mx-auto block mb-3"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={isVerifying || otp.length !== 8}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? "Verifying..." : "Verify Code"}
                </button>
             </div>

             <div className="text-xs text-gray-500 mb-4">OR</div>

             <button 
               onClick={handleResend}
               disabled={isResending}
               className="text-green-500 hover:text-green-400 text-sm font-medium hover:underline mb-4 block mx-auto disabled:opacity-50"
             >
               {isResending ? "Resending..." : (resendSuccess ? "Email Sent!" : "Resend Email")}
             </button>

             <button 
               onClick={onNavigateLogin}
               className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-lg transition-colors border border-gray-700"
             >
               Back to Login
             </button>
           </div>
        ) : (
          <>
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} />
              <span className="font-bold">Registration Failed</span>
            </div>
            <div className="text-xs text-red-300 mt-1">{error}</div>
            <div className="text-xs text-red-400 mt-2 opacity-75">
              💡 Open browser console (F12) → Console tab to see detailed error logs
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
              placeholder="Choose a username"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
              placeholder="yourname@example.com"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
              placeholder="Choose a password"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
              placeholder="Confirm your password"
              required
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Sign Up"}
          </button>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-gray-800">
          <p className="text-gray-400 text-sm mb-2">Already have an account?</p>
          <button 
            onClick={onNavigateLogin}
            disabled={isLoading}
            className="text-green-500 hover:text-green-400 font-medium hover:underline disabled:opacity-50"
          >
            Back to Login
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}