import React, { useState, useEffect, useRef } from "react";
import { User, UserReward, KofiRewardItem } from "../types";
import { User as UserIcon, Save, X, CheckCircle, AlertCircle, Lock, UserCircle, Upload, Image as ImageIcon, Crop, Maximize2, Minimize2, Link as LinkIcon, Unlink, Gamepad2, Coffee, Crown, Mail, Settings, ExternalLink, Gift, Download, Package, LogOut } from "lucide-react";
import { AuthService } from "../services/auth";
import { formatUuid } from "../services/minecraft";

interface ProfileProps {
  currentUser: User;
  onUpdate: (user: User) => void;
  onCancel: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  kofiUrl?: string; // Ko-fi page URL (e.g., https://ko-fi.com/username)
  onNavigate?: (view: string) => void; // Navigation callback
}

export default function Profile({ currentUser, onUpdate, onCancel, onNotify, kofiUrl, onNavigate }: ProfileProps) {
  // --- POPUP CALLBACK HANDLER ---
  const isPopup = typeof window !== 'undefined' && !!window.opener;
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const oauthCodeInUrl = urlParams.get('code');
  const oauthErrorInUrl = urlParams.get('error');

  useEffect(() => {
    if (isPopup && (oauthCodeInUrl || oauthErrorInUrl)) {
      if (oauthCodeInUrl) {
        window.opener.postMessage({ type: 'MS_OAUTH_CODE', code: oauthCodeInUrl }, window.location.origin);
        setTimeout(() => window.close(), 1500); // Give user time to see success
      } else if (oauthErrorInUrl) {
        window.opener.postMessage({ type: 'MS_OAUTH_ERROR', error: oauthErrorInUrl }, window.location.origin);
        setTimeout(() => window.close(), 2000);
      }
    }
  }, [isPopup, oauthCodeInUrl, oauthErrorInUrl]);

  if (isPopup && (oauthCodeInUrl || oauthErrorInUrl)) {
    return (
      <div className="h-screen bg-[#121212] flex items-center justify-center p-8 text-center">
        <div className="space-y-6 max-w-sm">
          <div className="relative w-16 h-16 mx-auto">
             <div className="absolute inset-0 border-4 border-green-500/20 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {oauthCodeInUrl ? "Authorized!" : "Auth Failed"}
            </h2>
            <p className="text-gray-400">
              {oauthCodeInUrl 
                ? "Linking your account to Buildscape. This window will close automatically." 
                : oauthErrorInUrl}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [username, setUsername] = useState(currentUser.username);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [profileIcon, setProfileIcon] = useState<string | undefined>(currentUser.profileIcon);
  const [profileIconPreview, setProfileIconPreview] = useState<string | undefined>(currentUser.profileIcon);
  const [originalImage, setOriginalImage] = useState<string | undefined>(currentUser.profileIcon);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [streamerMode, setStreamerMode] = useState<boolean>(!!currentUser.streamerMode);

  const maskUsername = (value?: string) => (value && value.length > 0 ? `${value[0]}****` : '****');
  const maskId = (value?: string) => (value ? 'f734****' : 'f734****');
  
  // Minecraft account linking state
  const [minecraftUsername, setMinecraftUsername] = useState("");
  const [isLinkingMinecraft, setIsLinkingMinecraft] = useState(false);
  const [minecraftError, setMinecraftError] = useState("");
  const [isUnlinkingMinecraft, setIsUnlinkingMinecraft] = useState(false);
  const [linkingStep, setLinkingStep] = useState<'request' | 'verify'>('request');
  const [linkingCode, setLinkingCode] = useState("");
  const [linkingMojangName, setLinkingMojangName] = useState("");
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'edit' | 'accounts' | 'rewards'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') ? 'accounts' : 'edit';
  });
  
  // Rewards state
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  
  // Email editing state
  const [email, setEmail] = useState(currentUser.email || "");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  
  // Ko-fi username linking state
  const [kofiUsername, setKofiUsername] = useState(currentUser.kofiUsername || "");
  const [isUpdatingKofiUsername, setIsUpdatingKofiUsername] = useState(false);
  const [kofiUsernameError, setKofiUsernameError] = useState("");
  const [isOAuthLinking, setIsOAuthLinking] = useState(false);
  const oauthProcessed = useRef(false);

  useEffect(() => {
    const checkUsername = async () => {
      if (username === currentUser.username) {
        setUsernameAvailable(null);
        setUsernameError("");
        return;
      }

      if (username.length < 3) {
        setUsernameAvailable(false);
        setUsernameError("Username must be at least 3 characters");
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setUsernameAvailable(false);
        setUsernameError("Username can only contain letters, numbers, and underscores");
        return;
      }

      setIsCheckingUsername(true);
      setUsernameError("");
      
      try {
        const available = await AuthService.checkUsernameAvailability(username);
        setUsernameAvailable(available);
        if (!available) {
          setUsernameError("Username is already taken");
        }
      } catch (error: any) {
        setUsernameAvailable(false);
        setUsernameError(error.message || "Error checking username");
      } finally {
        setIsCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username, currentUser.username]);

  useEffect(() => {
    setProfileIcon(currentUser.profileIcon);
    setProfileIconPreview(currentUser.profileIcon);

    if (currentUser.profileIcon) {
      setOriginalImage(currentUser.profileIcon);
    }
  }, [currentUser.profileIcon]);

  useEffect(() => {
    setEmail(currentUser.email || "");
  }, [currentUser.email]);

  useEffect(() => {
    setKofiUsername(currentUser.kofiUsername || "");
  }, [currentUser.kofiUsername]);

  useEffect(() => {
    setStreamerMode(!!currentUser.streamerMode);
  }, [currentUser.streamerMode]);

  useEffect(() => {
    if (activeTab === 'rewards' && currentUser) {
      loadRewards();
    }
    
    // Check for Microsoft OAuth code in URL when on accounts tab (Fallback for non-popup)
    if (activeTab === 'accounts' && !isPopup) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code && !currentUser.minecraftUuid && !isOAuthLinking && !oauthProcessed.current) {
        oauthProcessed.current = true;
        handleCompleteMicrosoftOAuth(code);
      }
    }

    // Listener for popup messages
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'MS_OAUTH_CODE' && event.data.code) {
        if (!oauthProcessed.current) {
           oauthProcessed.current = true;
           handleCompleteMicrosoftOAuth(event.data.code);
        }
      } else if (event.data?.type === 'MS_OAUTH_ERROR') {
         setMinecraftError(event.data.error || "Microsoft login failed");
         onNotify(event.data.error || "Login Failed", "error");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeTab, currentUser, isPopup]);

  const handleCompleteMicrosoftOAuth = async (code: string) => {
    onNotify("Verifying Minecraft link...", "success");
    setIsOAuthLinking(true);
    setIsLinkingMinecraft(true);
    setMinecraftError("");
    try {
      // Use the registered redirect URI (Likely ending in /profile)
      const redirectUri = window.location.origin + '/profile';
      const updatedUser = await AuthService.linkMinecraftOAuth(code, redirectUri);
      onUpdate(updatedUser);
      onNotify("Minecraft account linked via Microsoft successfully!", "success");
      // Clean URL (remove ?code=...)
      window.history.replaceState({}, '', '/profile');
    } catch (error: any) {
      setMinecraftError(error.message || "Microsoft authentication failed");
      onNotify(error.message || "Failed to link via Microsoft", "error");
    } finally {
      setIsOAuthLinking(false);
      setIsLinkingMinecraft(false);
    }
  };

  const handleMicrosoftOAuthRedirect = async () => {
    setIsLinkingMinecraft(true);
    setMinecraftError("");
    try {
      const redirectUri = window.location.origin + '/profile';
      const loginUrl = await AuthService.getMinecraftLoginUrl(redirectUri);
      
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        loginUrl,
        'Microsoft Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        // Fallback to current window if popup blocked
        window.location.href = loginUrl;
      } else {
        // Check if closed without success
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            setTimeout(() => {
              if (!oauthProcessed.current) {
                setIsLinkingMinecraft(false);
              }
            }, 1000);
          }
        }, 1000);
      }
    } catch (error: any) {
      setMinecraftError(error.message || "Could not start Microsoft login");
      onNotify(error.message || "Failed to connect to Microsoft", "error");
      setIsLinkingMinecraft(false);
    }
  };

  const loadRewards = async () => {
    if (!currentUser) return;
    
    setIsLoadingRewards(true);
    try {
      const data = await AuthService.fetchWithAuth(`/api/rewards`);
      setRewards(data.rewards || []);
    } catch (error: any) {
      console.error("Rewards load error:", error);
      onNotify("Failed to load rewards", "error");
    } finally {
      setIsLoadingRewards(false);
    }
  };

  const handleDownloadAsset = async (rewardId: string, downloadUrl?: string) => {
    if (!downloadUrl) {
      onNotify("No download URL available", "error");
      return;
    }

    try {
      // Mark as downloaded
      await AuthService.fetchWithAuth('/api/rewards', {
        method: 'POST',
        body: JSON.stringify({
          rewardId: rewardId,
          action: 'markDownloaded'
        })
      });

      // Open download link
      window.open(downloadUrl, '_blank');
      // Update local state
      setRewards(prev => prev.map(r => 
        r.id === rewardId ? { ...r, downloaded: true } : r
      ));
    } catch (error: any) {
      onNotify("Failed to mark as downloaded", "error");
    }
  };

  const compressImage = (base64: string, maxWidth: number = 400, maxHeight: number = 400, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(base64);
        }
      };
      img.src = base64;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {

      if (!file.type.startsWith('image/')) {
        onNotify("Please select an image file", "error");
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 50); // First 50% for reading
          setUploadProgress(progress);
        }
      };

      reader.onloadend = async () => {
        if (reader.result) {
          setUploadProgress(50);
          let base64 = reader.result as string;

          setOriginalImage(base64);

          if (file.size > 500 * 1024) {
            setUploadProgress(60);
            base64 = await compressImage(base64, 400, 400, 0.8);
            setOriginalImage(base64);
            setUploadProgress(80);
          } else {
            setUploadProgress(80);
          }
          
          setUploadProgress(100);

          setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);

            setImageToEdit(base64);
            setShowImageEditor(true);
            setCropScale(1);
            setCropPosition({ x: 0, y: 0 });
          }, 300);
        } else {
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

      reader.onerror = () => {
        setIsUploading(false);
        setUploadProgress(0);
        onNotify("Error reading file", "error");
      };

      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEditIcon = () => {

    const imageToCrop = originalImage || profileIcon;
    if (imageToCrop) {

      if (!originalImage && profileIcon) {
        setOriginalImage(profileIcon);
      }
      setImageToEdit(imageToCrop);
      setShowImageEditor(true);
      setCropScale(1);
      setCropPosition({ x: 0, y: 0 });
    }
  };

  const handleCropAndSave = () => {
    if (!canvasRef.current || !imageToEdit || !imageRef.current) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;


    canvas.width = 128;
    canvas.height = 128;

    const container = img.parentElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const cropSize = Math.min(containerWidth, containerHeight) / cropScale;
    const cropX = (containerWidth - cropSize) / 2 - cropPosition.x;
    const cropY = (containerHeight - cropSize) / 2 - cropPosition.y;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayedWidth, displayedHeight, offsetX, offsetY;

    if (imgAspect > containerAspect) {

      displayedHeight = containerHeight;
      displayedWidth = displayedHeight * imgAspect;
      offsetX = (containerWidth - displayedWidth) / 2;
      offsetY = 0;
    } else {

      displayedWidth = containerWidth;
      displayedHeight = displayedWidth / imgAspect;
      offsetX = 0;
      offsetY = (containerHeight - displayedHeight) / 2;
    }

    const sourceX = ((cropX - offsetX) / displayedWidth) * img.naturalWidth;
    const sourceY = ((cropY - offsetY) / displayedHeight) * img.naturalHeight;
    const sourceSize = (cropSize / displayedWidth) * img.naturalWidth;

    ctx.drawImage(
      img,
      Math.max(0, sourceX), Math.max(0, sourceY),
      Math.min(sourceSize, img.naturalWidth - Math.max(0, sourceX)),
      Math.min(sourceSize, img.naturalHeight - Math.max(0, sourceY)),
      0, 0, 128, 128
    );


    const finalImage = canvas.toDataURL('image/jpeg', 0.75);
    setProfileIcon(finalImage);
    setProfileIconPreview(finalImage);
    setShowImageEditor(false);
    setImageToEdit(null);
    setCropScale(1);
    setCropPosition({ x: 0, y: 0 });
  };

  const handleRemoveIcon = () => {
    setProfileIcon(undefined);
    setProfileIconPreview(undefined);

    setUsernameError("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setUsernameError("");

    try {

      if (newPassword) {
        if (newPassword.length < 6) {
          setUsernameError("Password must be at least 6 characters");
          setIsSaving(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setUsernameError("Passwords do not match");
          setIsSaving(false);
          return;
        }
        if (!currentPassword) {
          setUsernameError("Please enter your current password to change it");
          setIsSaving(false);
          return;
        }
      }

      if (username !== currentUser.username) {
        if (usernameAvailable === false) {
          setUsernameError("Username is not available");
          setIsSaving(false);
          return;
        }
        if (usernameAvailable === null && username !== currentUser.username) {
          setUsernameError("Please wait for username check to complete");
          setIsSaving(false);
          return;
        }
      }

      let profileIconUpdate: string | null | undefined = undefined;
      if (profileIcon !== currentUser.profileIcon) {

        if (profileIcon === undefined && currentUser.profileIcon) {
          profileIconUpdate = null; // Explicitly set to null to remove
        } else if (profileIcon !== undefined) {
          profileIconUpdate = profileIcon; // Setting a new icon
        }
      }

      if (profileIconUpdate !== undefined) {
        setIsUploading(true);
        setUploadProgress(0);
      }

      const updatedUser = await AuthService.updateProfile({
        userId: currentUser.id,
        username: username !== currentUser.username ? username : undefined,
        newPassword: newPassword || undefined,
        currentPassword: newPassword ? currentPassword : undefined,
        profileIcon: profileIconUpdate,
      });

      if (profileIconUpdate !== undefined) {
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 500);
      }

      onUpdate(updatedUser);
      onNotify("Profile updated successfully!", "success");

      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");

      if (profileIconUpdate !== undefined) {
        if (profileIconUpdate === null) {
          setOriginalImage(undefined);
        } else {
          setOriginalImage(profileIconUpdate);
        }
      }
    } catch (error: any) {
      setUsernameError(error.message || "Failed to update profile");
      onNotify(error.message || "Failed to update profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = username !== currentUser.username || newPassword.length > 0 || profileIcon !== currentUser.profileIcon;
  const canSave = hasChanges && 
    (username === currentUser.username || usernameAvailable === true) &&
    (!newPassword || (newPassword === confirmPassword && currentPassword.length > 0));

  const hasIconChanges = profileIcon !== currentUser.profileIcon;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#121212] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-lg overflow-hidden">
          
          <div className="bg-[#1a1a1a] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
                <UserCircle size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Profile Settings</h1>
                <p className="text-sm text-gray-400">Manage your account information</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const next = !streamerMode;
                    const updatedUser = await AuthService.updateProfile({
                      userId: currentUser.id,
                      streamerMode: next
                    });
                    setStreamerMode(next);
                    onUpdate(updatedUser);
                    onNotify(next ? "Streamer Mode enabled" : "Streamer Mode disabled", "success");
                  } catch (error: any) {
                    onNotify(error.message || "Failed to toggle streamer mode", "error");
                  }
                }}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  streamerMode
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 hover:bg-amber-500/30'
                    : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                }`}
              >
                {streamerMode ? 'Streamer: On' : 'Streamer: Off'}
              </button>
              <button
                onClick={onCancel}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-800 px-6 bg-[#1a1a1a]">
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeTab === 'edit'
                  ? 'text-white border-green-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings size={16} />
                Edit Profile
              </div>
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeTab === 'accounts'
                  ? 'text-white border-green-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <LinkIcon size={16} />
                Link Accounts
              </div>
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeTab === 'rewards'
                  ? 'text-white border-green-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Gift size={16} />
                Rewards
              </div>
            </button>
          </div>

          
          <div className="p-6 space-y-6">
            {/* Edit Profile Tab */}
            {activeTab === 'edit' && (
              <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <ImageIcon size={16} />
                Profile Icon
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profileIconPreview ? (
                    <img 
                      src={profileIconPreview} 
                      alt="Profile" 
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-700"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center border-2 border-gray-700">
                      <UserCircle size={32} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                    disabled={isUploading}
                  />
                  
                  {isUploading && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Uploading...</span>
                        <span className="text-xs text-gray-400">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-green-500 h-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Upload size={16} />
                      {profileIconPreview ? 'Change Icon' : 'Upload Icon'}
                    </button>
                    {profileIconPreview && (
                      <>
                        {hasIconChanges && (
                          <button
                            onClick={handleEditIcon}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                          >
                            <Crop size={16} />
                            Crop
                          </button>
                        )}
                        <button
                          onClick={handleRemoveIcon}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          <X size={16} />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Max size: 2MB. Recommended: Square image (e.g., 200x200px)</p>
                </div>
              </div>
            </div>

            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <UserIcon size={16} />
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={streamerMode ? maskUsername(username) : username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full bg-[#121212] border ${
                    usernameError || usernameAvailable === false
                      ? 'border-red-500'
                      : usernameAvailable === true
                      ? 'border-green-500'
                      : 'border-gray-700'
                  } rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors`}
                  placeholder="Enter username"
                  disabled={streamerMode}
                />
                {isCheckingUsername && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {!isCheckingUsername && username !== currentUser.username && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameAvailable === true && (
                      <CheckCircle size={20} className="text-green-500" />
                    )}
                    {usernameAvailable === false && (
                      <AlertCircle size={20} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {usernameError && (
                <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {usernameError}
                </p>
              )}
              {usernameAvailable === true && username !== currentUser.username && (
                <p className="mt-1.5 text-sm text-green-400 flex items-center gap-1">
                  <CheckCircle size={14} />
                  Username is available
                </p>
              )}
            </div>

            {/* Email Editing */}
            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Mail size={16} />
                Email Address
              </label>
              
              <div className="bg-[#121212] rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={streamerMode ? maskUsername(email) : email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    className={`w-full bg-[#1a1a1a] border ${
                      emailError ? 'border-red-500' : 'border-gray-700'
                    } rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors`}
                    placeholder="Enter your email address"
                    disabled={isUpdatingEmail || streamerMode}
                  />
                  {emailError && (
                    <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {emailError}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Your email address for account notifications and account recovery.
                  </p>
                </div>
                
                <button
                  onClick={async () => {
                    if (!email.trim()) {
                      setEmailError("Email cannot be empty");
                      return;
                    }
                    
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email.trim())) {
                      setEmailError("Please enter a valid email address");
                      return;
                    }
                    
                    if (email.trim() === currentUser.email) {
                      setEmailError("");
                      onNotify("Email unchanged", "success");
                      return;
                    }
                    
                    setIsUpdatingEmail(true);
                    setEmailError("");
                    
                    try {
                      const updatedUser = await AuthService.updateProfile({
                        userId: currentUser.id,
                        email: email.trim(),
                      });
                      
                      onUpdate(updatedUser);
                      onNotify("Email updated successfully!", "success");
                    } catch (error: any) {
                      const errorMsg = error.message || "Failed to update email";
                      setEmailError(errorMsg);
                      onNotify(errorMsg, "error");
                    } finally {
                      setIsUpdatingEmail(false);
                    }
                  }}
                  disabled={streamerMode || isUpdatingEmail || !email.trim() || email.trim() === currentUser.email}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingEmail ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Update Email
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Lock size={16} />
                Change Password
              </label>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#121212] border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#121212] border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors"
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-[#121212] border ${
                      newPassword && newPassword !== confirmPassword
                        ? 'border-red-500'
                        : newPassword && newPassword === confirmPassword
                        ? 'border-green-500'
                        : 'border-gray-700'
                    } rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors`}
                    placeholder="Confirm new password"
                  />
                  {newPassword && newPassword !== confirmPassword && (
                    <p className="mt-1.5 text-sm text-red-400">Passwords do not match</p>
                  )}
                  {newPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                    <p className="mt-1.5 text-sm text-green-400">Passwords match</p>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button for Edit Profile */}
            <div className="flex gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || isSaving}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  canSave && !isSaving
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
              </>
            )}

            {/* Link Accounts Tab */}
            {activeTab === 'accounts' && (
              <>
            {/* Minecraft Account Linking */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Gamepad2 size={16} />
                Minecraft Account
              </label>
              
              {currentUser.minecraftUsername && currentUser.minecraftUuid ? (
                <div className="bg-[#121212] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Linked Account</div>
                      <div className="text-base font-medium text-white">
                        {streamerMode ? maskUsername(currentUser.minecraftUsername) : currentUser.minecraftUsername}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">
                        {streamerMode ? maskId(currentUser.minecraftUuid) : formatUuid(currentUser.minecraftUuid)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={20} className="text-green-500" />
                      <span className="text-xs text-green-400">Linked</span>
                    </div>
                  </div>
                  
                    <button
                      onClick={async () => {
                        if (!confirm('Disconnect your Minecraft account?')) return;
                        
                        setIsUnlinkingMinecraft(true);
                        setMinecraftError("");
                        
                        try {
                          const updatedUser = await AuthService.unlinkMinecraftAccount(currentUser.id);
                          onUpdate(updatedUser);
                          onNotify("Minecraft account disconnected", "success");
                        } catch (error: any) {
                          const errorMsg = error.message || "Failed to disconnect account";
                          setMinecraftError(errorMsg);
                          onNotify(errorMsg, "error");
                        } finally {
                          setIsUnlinkingMinecraft(false);
                        }
                      }}
                      disabled={isUnlinkingMinecraft}
                      className="w-full px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/50 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUnlinkingMinecraft ? (
                        <>
                          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <Unlink size={16} />
                          Disconnect Character
                        </>
                      )}
                    </button>
                </div>
              ) : (
                <div className="bg-[#121212] rounded-lg p-5 space-y-4">
                  <div className="flex flex-col gap-3">
                    <div className="text-sm text-gray-400">
                      Sign in with your Microsoft account to instantly verify and link your Minecraft account. This is the most secure and direct method.
                    </div>
                    
                    <button
                      onClick={handleMicrosoftOAuthRedirect}
                      disabled={isLinkingMinecraft}
                      className="w-full px-5 py-3 bg-white hover:bg-gray-100 text-black rounded-lg font-bold transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 shadow-lg"
                    >
                      {isLinkingMinecraft ? (
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <svg viewBox="0 0 23 23" className="w-5 h-5">
                            <path fill="#f3f3f3" d="M0 0h11v11H0z"/><path fill="#f3f3f3" d="M12 0h11v11H12z"/><path fill="#f3f3f3" d="M0 12h11v11H0z"/><path fill="#f3f3f3" d="M12 12h11v11H12z"/>
                            <path fill="#f25022" d="M11 11H0V0h11v11z"/><path fill="#7fbb00" d="M23 11H12V0h11v11z"/><path fill="#00a1f1" d="M11 23H0V12h11v23z" opacity=".03"/><path fill="#00a1f1" d="M11 23H0V12h11v11z"/><path fill="#ffb900" d="M23 23H12V12h11v11z"/>
                          </svg>
                          Sign in with Microsoft
                        </>
                      )}
                    </button>
                  </div>

                  {minecraftError && (
                    <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle size={16} />
                      {minecraftError}
                    </div>
                  )}

                  <div className="relative pt-4 text-center">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-800"></div>
                    </div>
                    <span className="relative px-2 bg-[#121212] text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                      Or manual method (requires server join)
                    </span>
                  </div>

                  <div className="pt-2">
                    {linkingStep === 'request' ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={minecraftUsername}
                            onChange={(e) => setMinecraftUsername(e.target.value)}
                            placeholder="Enter username"
                            className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 text-white text-sm"
                            disabled={isLinkingMinecraft}
                          />
                          <button
                            onClick={async () => {
                              if (!minecraftUsername.trim()) return;
                              setIsLinkingMinecraft(true);
                              try {
                                const result = await AuthService.requestMinecraftLinkingCode(currentUser.id, minecraftUsername.trim());
                                setLinkingCode(result.code);
                                setLinkingMojangName(result.mojangName);
                                setLinkingStep('verify');
                              } catch (e: any) {
                                setMinecraftError(e.message);
                              } finally {
                                setIsLinkingMinecraft(false);
                              }
                            }}
                            disabled={isLinkingMinecraft || !minecraftUsername.trim()}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            Manual Link
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                         <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                           <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Server Command</div>
                           <code className="text-green-400 font-mono text-xs">/bs link {linkingCode}</code>
                         </div>
                         <button onClick={() => setLinkingStep('request')} className="text-[10px] text-gray-500 hover:text-gray-300 underline">Cancel manual link</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ko-fi Account Linking */}
            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Coffee size={16} />
                Ko-fi Account Linking
              </label>
              
              <div className="bg-[#121212] rounded-lg p-4 space-y-3">
                {currentUser.kofiUsername ? (
                  <>
                    <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                      <div className="text-xs text-green-300 flex items-center gap-2 mb-2">
                        <CheckCircle size={14} />
                        <span className="font-medium">Ko-fi Account Linked</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Linked username: <span className="font-mono text-gray-300">{streamerMode ? maskUsername(currentUser.kofiUsername) : currentUser.kofiUsername}</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Unlink your Ko-fi account? You will need to link it again to receive subscription rewards.')) return;
                        
                        setIsUpdatingKofiUsername(true);
                        setKofiUsernameError("");
                        
                        try {
                          const updatedUser = await AuthService.updateKofiUsername(
                            currentUser.id,
                            ""
                          );
                          
                          onUpdate(updatedUser);
                          setKofiUsername("");
                          onNotify("Ko-fi account unlinked", "success");
                        } catch (error: any) {
                          const errorMsg = error.message || "Failed to unlink Ko-fi account";
                          setKofiUsernameError(errorMsg);
                          onNotify(errorMsg, "error");
                        } finally {
                          setIsUpdatingKofiUsername(false);
                        }
                      }}
                      disabled={isUpdatingKofiUsername}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Unlink size={16} />
                      Unlink Ko-fi Account
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 mb-3">
                      <p className="text-xs text-blue-300">
                        <strong>New Account?</strong> If you bought a membership before creating this account, simply link your Ko-fi name below to claim your rewards instantly.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Ko-fi Display Name</label>
                      <input
                        type="text"
                        value={kofiUsername}
                        onChange={(e) => {
                          setKofiUsername(e.target.value);
                          setKofiUsernameError("");
                        }}
                        className={`w-full bg-[#1a1a1a] border ${
                          kofiUsernameError ? 'border-red-500' : 'border-gray-700'
                        } rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors`}
                        placeholder="Enter your Ko-fi name"
                        disabled={isUpdatingKofiUsername}
                      />
                      {kofiUsernameError && (
                        <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle size={14} />
                          {kofiUsernameError}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Must match your <strong>"From"</strong> name on Ko-fi exactly (case-insensitive).
                      </p>
                    </div>
                    
                    <button
                      onClick={async () => {
                        if (!kofiUsername.trim()) {
                          setKofiUsernameError("Name cannot be empty");
                          return;
                        }
                        
                        setIsUpdatingKofiUsername(true);
                        setKofiUsernameError("");
                        
                        try {
                          const updatedUser = await AuthService.updateKofiUsername(
                            currentUser.id,
                            kofiUsername.trim()
                          );
                          
                          onUpdate(updatedUser);
                          onNotify("Ko-fi account linked! Any past rewards have been claimed.", "success");
                        } catch (error: any) {
                          const errorMsg = error.message || "Failed to link Ko-fi name";
                          setKofiUsernameError(errorMsg);
                          onNotify(errorMsg, "error");
                        } finally {
                          setIsUpdatingKofiUsername(false);
                        }
                      }}
                      disabled={isUpdatingKofiUsername || !kofiUsername.trim()}
                      className="w-full mt-3 px-4 py-2 bg-[#FF5E5B] hover:bg-[#ff4d49] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdatingKofiUsername ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Claiming Rewards...
                        </>
                      ) : (
                        <>
                          <Coffee size={16} />
                          Link Name & Claim Rewards
                        </>
                      )}
                    </button>
                    
                    {kofiUrl && kofiUrl !== "#" && kofiUrl.trim() !== "" && (
                      <a
                        href={kofiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={16} />
                        Visit Ko-fi Page
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Ko-fi Subscription Status */}
            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Crown size={16} />
                Subscription Status
              </label>
              
              {currentUser.kofiSubscription?.isActive ? (
                <div className="bg-[#121212] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Active Subscription</div>
                      {currentUser.kofiSubscription.tierName && (
                        <div className="text-base font-medium text-amber-400 flex items-center gap-2">
                          <Crown size={16} />
                          {currentUser.kofiSubscription.tierName}
                        </div>
                      )}
                      {currentUser.kofiSubscription.amount && currentUser.kofiSubscription.currency && (
                        <div className="text-sm text-gray-300 mt-1">
                          {currentUser.kofiSubscription.amount} {currentUser.kofiSubscription.currency}
                          {currentUser.kofiSubscription.nextPaymentDate && ' / month'}
                        </div>
                      )}
                      {currentUser.kofiSubscription.lastPaymentDate && (
                        <div className="text-xs text-gray-500 mt-1">
                          Last payment: {new Date(currentUser.kofiSubscription.lastPaymentDate).toLocaleDateString()}
                        </div>
                      )}
                      {currentUser.kofiSubscription.nextPaymentDate && (
                        <div className="text-xs text-gray-500 mt-1">
                          Next payment: {new Date(currentUser.kofiSubscription.nextPaymentDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={20} className="text-green-500" />
                      <span className="text-xs text-green-400">Active</span>
                    </div>
                  </div>
                  
                  <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                    <p className="text-xs text-green-300">
                      ✓ Your subscription is active! You will receive in-game rewards when playing with the mod installed.
                    </p>
                  </div>
                  
                  {kofiUrl && kofiUrl !== "#" && kofiUrl.trim() !== "" && (
                    <a
                      href={kofiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2 bg-[#FF5E5B] hover:bg-[#ff4d49] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-2"
                    >
                      <Coffee size={16} />
                      Manage Subscription
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ) : (
                <div className="bg-[#121212] rounded-lg p-4 space-y-3">
                  <div className="text-sm text-gray-400">
                    No active subscription found
                  </div>
                  <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                    <p className="text-xs text-amber-300 mb-2">
                      {currentUser.kofiUsername 
                        ? `Make a payment using your linked Ko-fi username (${currentUser.kofiUsername}) to activate your subscription.`
                        : "Link your Ko-fi username above, then make a payment. Your subscription will be automatically linked based on your username."
                      }
                    </p>
                  </div>
                  {kofiUrl && kofiUrl !== "#" && kofiUrl.trim() !== "" ? (
                    <a
                      href={kofiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-3 bg-[#FF5E5B] hover:bg-[#ff4d49] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Coffee size={18} />
                      Subscribe on Ko-fi
                      <ExternalLink size={16} />
                    </a>
                  ) : (
                    <>
                      <button
                        disabled
                        className="w-full px-4 py-3 bg-gray-700 text-gray-400 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Coffee size={18} />
                        Subscribe on Ko-fi
                        <ExternalLink size={16} />
                      </button>
                      <div className="bg-gray-800/50 rounded-lg p-2">
                        <div className="text-xs text-gray-400">
                          ⚠️ Ko-fi URL not configured. Please contact the administrator to set up the Ko-fi link in the admin panel.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Account Info */}
            <div className="border-t border-gray-800 pt-6">
              <div className="bg-[#121212] rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Role</span>
                  <span className={`text-sm font-medium ${
                    currentUser.role === 'owner' ? 'text-purple-400' :
                    currentUser.role === 'admin' ? 'text-blue-400' :
                    'text-gray-300'
                  }`}>
                    {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

            {/* Rewards Tab */}
            {activeTab === 'rewards' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                    <Gift size={16} />
                    Your Rewards
                  </label>
                  
                  {isLoadingRewards ? (
                    <div className="bg-[#121212] rounded-lg p-8 text-center">
                      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-400">Loading rewards...</p>
          </div>
                  ) : rewards.length === 0 ? (
                    <div className="bg-[#121212] rounded-lg p-8 text-center">
                      <Package className="mx-auto text-gray-500 mb-4" size={48} />
                      <h3 className="text-lg font-semibold text-gray-400 mb-2">No Rewards Yet</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Redeem codes or subscribe to receive rewards
                      </p>
                      <button
                        onClick={() => {
                          if (onNavigate) {
                            onNavigate('redeem');
                          } else {
                            // Fallback: use hash navigation without full page reload
                            window.location.hash = '#redeem';
                            window.dispatchEvent(new HashChangeEvent('hashchange'));
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        <Gift size={16} />
                        Redeem Code
                      </button>
        </div>
                  ) : (
                    <div className="space-y-3">
                      {rewards.map((reward) => (
                        <div key={reward.id} className="bg-[#121212] rounded-lg p-4 border border-gray-700">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  reward.source === 'code' ? 'bg-blue-900/30 text-blue-400 border border-blue-700' :
                                  reward.source === 'kofi' ? 'bg-[#FF5E5B]/20 text-[#FF5E5B] border border-[#FF5E5B]/50' :
                                  reward.source === 'membership' ? 'bg-purple-900/30 text-purple-400 border border-purple-700' :
                                  'bg-gray-700/50 text-gray-300 border border-gray-600'
                                }`}>
                                  {reward.source === 'code' ? 'Code' :
                                   reward.source === 'kofi' ? 'Ko-fi' :
                                   reward.source === 'membership' ? 'Membership' : 'Manual'}
                                </span>
      </div>
                              <div className="space-y-2">
                                {reward.rewards.map((item, index) => (
                                  <div key={index} className="bg-[#1a1a1a] rounded p-3">
                                    <div className="font-medium text-white">{item.displayName}</div>
                                    {item.description && (
                                      <div className="text-sm text-gray-400 mt-1">{item.description}</div>
                                    )}
                                    {(item.type === 'custom' && item.customData) || reward.downloadUrl ? (
                                      <div className="mt-2">
                                        {(() => {
                                          let downloadUrl = reward.downloadUrl;
                                          if (!downloadUrl && item.customData) {
                                            try {
                                              const customData = JSON.parse(item.customData);
                                              downloadUrl = customData.downloadUrl;
                                            } catch (e) {
                                              // Invalid JSON, ignore
                                            }
                                          }
                                          
                                          if (downloadUrl) {
                                            return (
                                              <button
                                                onClick={() => handleDownloadAsset(reward.id, downloadUrl)}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-2"
                                              >
                                                <Download size={14} />
                                                {reward.downloaded ? 'Download Again' : 'Download'}
                                              </button>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
                            Granted: {new Date(reward.grantedAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      
      {showImageEditor && imageToEdit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Crop size={20} />
                  Edit Profile Icon
                </h2>
                <button
                  onClick={() => {
                    setShowImageEditor(false);
                    setImageToEdit(null);
                    setCropScale(1);
                    setCropPosition({ x: 0, y: 0 });
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                
                <div className="relative bg-black rounded-lg overflow-hidden border border-gray-700" style={{ aspectRatio: '1/1', maxHeight: '400px' }}>
                  <img
                    ref={imageRef}
                    src={imageToEdit}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    style={{
                      transform: `scale(${cropScale}) translate(${cropPosition.x}px, ${cropPosition.y}px)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.1s ease-out'
                    }}
                    onLoad={(e) => {
                      imageRef.current = e.currentTarget;
                    }}
                  />
                  
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/50" style={{
                      clipPath: `inset(${(100 - 100 / cropScale) / 2}% ${(100 - 100 / cropScale) / 2}% ${(100 - 100 / cropScale) / 2}% ${(100 - 100 / cropScale) / 2}%)`
                    }}></div>
                    <div className="absolute inset-0 border-2 border-white" style={{
                      top: `${(100 - 100 / cropScale) / 2}%`,
                      left: `${(100 - 100 / cropScale) / 2}%`,
                      width: `${100 / cropScale}%`,
                      height: `${100 / cropScale}%`
                    }}></div>
                  </div>
                </div>

                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Zoom: {Math.round(cropScale * 100)}%
                      </label>
                      <button
                        onClick={() => setCropScale(1)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                      >
                        Reset Zoom
                      </button>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.01"
                      value={cropScale}
                      onChange={(e) => setCropScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-300">Position X</label>
                        <button
                          onClick={() => setCropPosition(prev => ({ ...prev, x: 0 }))}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                        >
                          Reset Horizontal
                        </button>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={cropPosition.x}
                        onChange={(e) => setCropPosition(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-300">Position Y</label>
                        <button
                          onClick={() => setCropPosition(prev => ({ ...prev, y: 0 }))}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                        >
                          Reset Vertical
                        </button>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={cropPosition.y}
                        onChange={(e) => setCropPosition(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => {
                        setShowImageEditor(false);
                        setImageToEdit(null);
                        setCropScale(1);
                        setCropPosition({ x: 0, y: 0 });
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCropAndSave}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      Apply & Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      
      <canvas ref={canvasRef} className="hidden" />

      {isOAuthLinking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center p-6">
          <div className="max-w-xs w-full bg-[#1a1a1a] border border-gray-800 rounded-2xl p-8 text-center shadow-2xl transform animate-in fade-in zoom-in duration-300">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-green-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Linking Account</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Verifying your Minecraft profile with Microsoft. This will only take a moment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

