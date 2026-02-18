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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      const user = await AuthService.login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError("Login failed. Please try again.");
        if (onError) {
          onError(new AuthError("Login failed", 'INVALID_CREDENTIALS'));
        }
      }
    } catch (err: any) {
      const errorMsg = err instanceof AuthError ? err.message : (err.message || "Invalid username or password. Please try again.");
      setError(errorMsg);
      if (onError && err instanceof AuthError) {
        onError(err);
      } else if (onError) {
        onError(new AuthError(errorMsg, 'INVALID_CREDENTIALS'));
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

        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
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
              placeholder="Enter your username"
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
            onClick={() => {
              const event = new CustomEvent('navigate', { detail: 'forgot-password' });
              window.dispatchEvent(event);
            }}
            disabled={isLoading}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium hover:underline disabled:opacity-50 block w-full"
          >
            Forgot Password?
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