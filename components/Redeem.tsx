import React, { useState } from "react";
import { User, KofiRewardItem } from "../types";
import { Gift, CheckCircle, AlertCircle, X, Download, Gamepad2, Lock, ExternalLink } from "lucide-react";
import { AuthService } from "../services/auth";

interface RedeemProps {
  currentUser: User | null;
  onNavigateLogin: () => void;
  onNavigate?: (view: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function Redeem({ currentUser, onNavigateLogin, onNavigate, onNotify }: RedeemProps) {
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemedRewards, setRedeemedRewards] = useState<KofiRewardItem[] | null>(null);

  const handleRedeem = async () => {
    if (!currentUser) {
      onNotify("Please sign in to redeem codes", "error");
      onNavigateLogin();
      return;
    }

    if (!currentUser.minecraftUuid) {
      onNotify("Please link your Minecraft account in your profile to redeem codes", "error");
      return;
    }

    if (!code.trim()) {
      onNotify("Please enter a code", "error");
      return;
    }

    setIsRedeeming(true);
    setRedeemedRewards(null);

    try {
      const data = await AuthService.fetchWithAuth('/api/redeem', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase()
        })
      });

      setRedeemedRewards(data.rewards || []);
      onNotify(data.message || "Code redeemed successfully!", "success");
      setCode("");
    } catch (error: any) {
      onNotify(error.message || "Failed to redeem code", "error");
    } finally {
      setIsRedeeming(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-lg p-8 text-center">
            <Lock className="mx-auto text-gray-500 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
            <p className="text-gray-400 mb-6">Please sign in to redeem codes</p>
            <button
              onClick={onNavigateLogin}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser.minecraftUuid) {
    return (
      <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <Gamepad2 className="text-amber-500" size={24} />
              <h2 className="text-2xl font-bold text-white">Minecraft Account Required</h2>
            </div>
            <p className="text-gray-400 mb-6">
              You need to link your Minecraft account to redeem codes. Rewards will be added to your linked Minecraft UUID.
            </p>
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('profile');
                } else {
                  // Fallback to hash navigation
                  window.location.hash = '#profile';
                  // Trigger hashchange event for SPA navigation
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }
              }}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Link Minecraft Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Gift className="text-green-400" size={32} />
            <h1 className="text-4xl font-bold text-white">Redeem Code</h1>
          </div>
          <p className="text-gray-400">Enter your reward code to claim your rewards</p>
        </div>

        <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-lg p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enter Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleRedeem();
                    }
                  }}
                  placeholder="KINGO-DROPED-CODE"
                  className="flex-1 bg-[#121212] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors font-mono text-lg"
                  disabled={isRedeeming}
                />
                <button
                  onClick={handleRedeem}
                  disabled={isRedeeming || !code.trim()}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    isRedeeming || !code.trim()
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isRedeeming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <Gift size={18} />
                      Redeem
                    </>
                  )}
                </button>
              </div>
            </div>

            {redeemedRewards && redeemedRewards.length > 0 && (
              <div className="mt-6 p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="text-green-400" size={20} />
                  <h3 className="text-lg font-semibold text-green-400">Code Redeemed Successfully!</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-300 mb-3">You received:</p>
                  {redeemedRewards.map((reward, index) => (
                    <div key={index} className="bg-[#121212] rounded-lg p-3 border border-gray-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-white">{reward.displayName}</div>
                          {reward.description && (
                            <div className="text-sm text-gray-400 mt-1">{reward.description}</div>
                          )}
                          {reward.type === 'downloadable' && reward.downloadUrl && (
                            <a
                              href={reward.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                            >
                              <Download size={14} />
                              Download
                            </a>
                          )}
                          {reward.type === 'cosmetic' && (
                            <div className="text-xs text-purple-400 mt-1">
                              Cosmetic reward - Available in-game
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 mt-3">
                    {redeemedRewards.some(r => r.type === 'downloadable')
                      ? 'Downloadable rewards can be accessed above. In-game rewards will be available when you play.'
                      : 'Rewards have been added to your account and will be available in-game.'}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">How it works</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Enter your reward code above</li>
                <li>• Rewards will be added to your linked Minecraft account</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

