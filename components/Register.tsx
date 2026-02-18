import React, { useState } from "react";
import { AuthService, AuthError } from "../services/auth";
import { User } from "../types";
import { UserPlus, AlertCircle, Loader2 } from "lucide-react";

interface RegisterProps {
  onLogin: (user: User) => void;
  onError?: (error: AuthError) => void;
  onNavigateLogin: () => void;
}

export default function Register({ onLogin, onError, onNavigateLogin }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      console.error("Full error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code
      });
    } finally {
      setIsLoading(false);
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
      </div>
    </div>
  );
}