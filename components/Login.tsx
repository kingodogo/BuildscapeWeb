import React, { useState } from "react";
import { AuthService, AuthError } from "../services/auth";
import { User } from "../types";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";

interface LoginProps {
  onLogin: (user: User) => void;
  onError?: (error: AuthError) => void;
  onNavigateRegister: () => void;
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

  const handleVerifyOtp = async () => {
    if (!otp || !unconfirmedEmail) return;
    setIsVerifying(true);
    try {
        await AuthService.verifyOtp(unconfirmedEmail, otp);
        alert("Email verified successfully! Logging you in...");
        setUnconfirmedEmail(null); 
        // Auto-retry login
        try {
          const user = await AuthService.login(username, password);
          if (user) onLogin(user);
        } catch (e) {
          setError("Verification successful, but login failed. Please enter your password and click Login.");
        }
    } catch (err: any) {
        console.error("Verification failed:", err);
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
        console.error("Resend error:", err);
        setError(err.message || "Failed to resend confirmation email.");
    } finally {
       setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const isEmail = username.includes('@');
    if (!username || !isEmail) {
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
      if (user) {
        onLogin(user);
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err: any) {
      if (err instanceof AuthError && err.code === 'EMAIL_NOT_CONFIRMED') {
          setUnconfirmedEmail(err.message); // message contains the email
          return;
      }

      const errorMsg = err instanceof AuthError ? err.message : (err.message || "Invalid username or password. Please try again.");
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
               Your email address <strong>{unconfirmedEmail}</strong> has not been verified yet.
             </p>
             
             <div className="mb-4">
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-center text-xl font-bold text-white tracking-widest focus:border-yellow-500 outline-none mb-2"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={isVerifying || otp.length !== 6}
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
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Username or Email</label>
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
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Password</label>
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