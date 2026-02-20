import { User, UserRole } from "../types";
import { supabase } from "../lib/supabase";

const SESSION_KEY = 'buildscape_session_v1';

export class AuthError extends Error {
    constructor(message: string, public code: 'NETWORK_ERROR' | 'SERVER_ERROR' | 'INVALID_CREDENTIALS' | 'NOT_CONFIGURED' | 'CONFIRMATION_REQUIRED' | 'EMAIL_NOT_CONFIRMED') {
        super(message);
        this.name = 'AuthError';
    }
}

// Helper: map Supabase profile to User type
function mapProfile(profile: any): User {
    return {
        id: profile.id,
        username: profile.username,
        email: profile.email || '',
        role: profile.role as UserRole,
        minecraftUsername: profile.minecraft_username || '',
        minecraftUuid: profile.minecraft_uuid || '',
        kofiUsername: profile.kofi_username || '',
        profileIcon: profile.profile_icon || '',
        streamerMode: profile.streamer_mode || false,
        kofiSubscription: profile.kofi_subscription || null
    };
}

// Helper: Get full profile
async function fetchUserProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
    if (error || !data) throw error || new Error("Profile not found");
    return mapProfile(data);
}

// Helper: Call Netlify Function with Auth Header
async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) throw new AuthError("Not authenticated", "INVALID_CREDENTIALS");
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };
    
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new AuthError(err.error || "Request failed", "SERVER_ERROR");
    }
    return res.json();
}

export const AuthService = {
    login: async (identifier: string, password: string): Promise<User> => {
        try {
            let email = identifier;
            
            // If identifier doesn't look like an email, treat as username
            if (!identifier.includes('@')) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', identifier)
                    .single();
                
                if (profileError || !profile) {
                    // Start with a generic error, but if we can't find the username, 
                    // the subsequent login attempt (if we continued) would fail anyway.
                    // We'll throw 'Invalid credentials' to avoid username enumeration if desired, 
                    // or specific error. For now, let's just throw invalid credentials.
                    throw new AuthError("Invalid username or password", "INVALID_CREDENTIALS");
                }
                
                if (profile.email) {
                    email = profile.email;
                }
            }

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
               if (error.message.includes("Invalid login")) throw new AuthError("Invalid username or password", "INVALID_CREDENTIALS");
               if (error.message.includes("Email not confirmed")) throw new AuthError(email, "EMAIL_NOT_CONFIRMED");
               throw new AuthError(error.message, "SERVER_ERROR");
            }
            
            if (!data.user) throw new AuthError("No user returned", "SERVER_ERROR");
            
            const profile = await fetchUserProfile(data.user.id);
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            return profile;
        } catch (e: any) {
             if (e instanceof AuthError) throw e;
             throw new AuthError(e.message || "Login failed", "SERVER_ERROR");
        }
    },

    register: async (username: string, email: string, password: string): Promise<User> => {
        try {
            // Updated to use Instant Email API (Netlify Function + Resend)
            const res = await fetch('/.netlify/functions/auth?action=signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    email, 
                    password,
                    redirectTo: window.location.origin 
                })
            });

            const data = await res.json();
            
            if (!res.ok) {
                const errorMsg = data.error || "Registration failed";
                if (errorMsg.includes("User already exists")) throw new AuthError("This email is already registered.", "SERVER_ERROR");
                if (errorMsg.includes("Username already taken")) throw new AuthError("This username is already taken.", "SERVER_ERROR");
                throw new AuthError(errorMsg, "SERVER_ERROR");
            }
            
            if (data.mock) {
                console.warn("Dev Mode: Email simulated by backend (no API key).");
            }

            // The user is created but unconfirmed. We must throw CONFIRMATION_REQUIRED to show the UI.
            throw new AuthError("Please check your email to confirm your account.", "CONFIRMATION_REQUIRED");
        } catch (e: any) {
             if (e instanceof AuthError) throw e;
             throw new AuthError(e.message || "Registration failed", "SERVER_ERROR");
        }
    },

    resendConfirmationEmail: async (email: string): Promise<void> => {
        const res = await fetch('/.netlify/functions/auth?action=resendConfirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email,
                redirectTo: window.location.origin
            })
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new AuthError(data.error || "Failed to resend email", "SERVER_ERROR");
        }
    },

    verifyOtp: async (email: string, otp: string): Promise<void> => {
        const res = await fetch('/.netlify/functions/auth?action=verifyOtp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new AuthError(data.error || "Verification failed", "SERVER_ERROR");
        }
    },

    requestPasswordReset: async (email: string): Promise<void> => {
        const res = await fetch('/.netlify/functions/auth?action=forgotPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email,
                redirectTo: window.location.origin 
            })
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new AuthError(data.error || "Failed to request password reset", "SERVER_ERROR");
        }
    },

    logout: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(SESSION_KEY);
    },

    getCurrentUser: (): User | null => {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
    },
    
    // Sync session on load
    refreshSession: async (): Promise<User | null> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        const profile = await fetchUserProfile(session.user.id);
        localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        return profile;
    },



    resetPassword: async (newPassword: string): Promise<void> => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new AuthError(error.message, "SERVER_ERROR");
    },

    // --- Server-side operations via Netlify Functions ---

    getAllUsers: async (): Promise<User[]> => {
        const data = await fetchWithAuth('/.netlify/functions/auth?action=getAllUsers');
        return data.users;
    },

    updateUserRole: async (id: string, role: UserRole): Promise<void> => {
        await fetchWithAuth('/.netlify/functions/auth', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'updateRole', id, role })
        });
    },

    deleteUser: async (id: string): Promise<void> => {
        await fetchWithAuth(`/.netlify/functions/auth?action=deleteUser&id=${id}`, {
            method: 'DELETE'
        });
    },

    checkUsernameAvailability: async (username: string): Promise<boolean> => {
        const res = await fetch('/.netlify/functions/auth', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ action: 'checkUsername', username })
        });
        const data = await res.json();
        return data.available;
    },

    updateProfile: async (updates: any): Promise<User> => {
        const data = await fetchWithAuth('/.netlify/functions/auth', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'updateProfile', ...updates })
        });
        const user = data.user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
    },

    updateKofiUsername: async (userId: string, kofiUsername: string): Promise<User> => {
        const data = await fetchWithAuth('/.netlify/functions/auth', {
            method: 'PATCH',
            body: JSON.stringify({ action: 'updateKofiUsername', kofiUsername })
        });
        const user = data.user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
    },
    
    linkMinecraftAccount: async (userId: string, minecraftUsername: string): Promise<User> => {
        const data = await fetchWithAuth('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'linkMinecraft', minecraftUsername })
        });
        const user = data.user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
    },

    unlinkMinecraftAccount: async (userId: string): Promise<User> => {
        const data = await fetchWithAuth('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'unlinkMinecraft' })
        });
        const user = data.user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
    },

    verifyPlayer: async (uuid: string) => {
        // Public endpoint
        const res = await fetch(`/.netlify/functions/auth?action=verifyPlayer&uuid=${uuid}`);
        return res.json();
    },

    getLinkedPlayers: async () => {
         // Public endpoint (maybe should be protected? Spec implies public for server whitelist)
         const res = await fetch(`/.netlify/functions/auth?action=getLinkedPlayers`);
         return res.json();
    },
    
    generateKofiLinkToken: async (userId: string): Promise<string> => {
        const data = await fetchWithAuth('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'generateKofiLinkToken', userId }) // userId implicit from token but passed for back-compat
        });
        return data.token;
    }
};