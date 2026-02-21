import { User, UserRole } from "../types";
import { supabase } from "../lib/supabase";

const SESSION_KEY = 'buildscape_session_v1';

export class AuthError extends Error {
    constructor(message: string, public code: 'NETWORK_ERROR' | 'SERVER_ERROR' | 'INVALID_CREDENTIALS' | 'NOT_CONFIGURED' | 'CONFIRMATION_REQUIRED' | 'EMAIL_NOT_CONFIRMED' | 'LEGACY_USER') {
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

// Helper: Get full profile with "Self-Healing" (creates profile if missing but user exists)
async function fetchUserProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle to avoid error if missing
        
    if (data) return mapProfile(data);

    // Self-healing: If profile is missing, try to create it from Auth metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId) {
        const username = user.user_metadata?.username || user.email?.split('@')[0] || 'User';
        
        const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                username: username,
                email: user.email,
                role: 'user'
            })
            .select()
            .single();

        if (!insertError && newProfile) {
            console.log("Self-healed: Profile created for user", userId);
            return mapProfile(newProfile);
        }
    }
        
    if (error) throw error;
    throw new Error("Profile not found and could not be self-healed.");
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
            
            // If identifier doesn't look like an email, resolve username → email
            if (!identifier.includes('@')) {
                // Check active profiles first
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', identifier)
                    .maybeSingle();
                
                if (profile?.email) {
                    email = profile.email;
                } else {
                    // Not found in active profiles — check legacy users by username
                    const { data: legacy } = await supabase
                        .from('legacy_users')
                        .select('email, username')
                        .ilike('username', identifier)
                        .maybeSingle();

                    if (legacy) {
                        throw new AuthError('LEGACY_USER', 'LEGACY_USER');
                    }

                    throw new AuthError("That username or password is incorrect.", "INVALID_CREDENTIALS");
                }
            }

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
               if (error.message.includes("Invalid login")) {
                    const { data: legacy } = await supabase
                        .from('legacy_users')
                        .select('username')
                        .eq('email', email.toLowerCase())
                        .maybeSingle();

                    if (legacy) throw new AuthError('LEGACY_USER', 'LEGACY_USER');

                    throw new AuthError("That username or password is incorrect.", "INVALID_CREDENTIALS");
               }
               if (error.message.includes("Email not confirmed")) throw new AuthError(email, "EMAIL_NOT_CONFIRMED");
               throw new AuthError("Something went wrong. Please try again.", "SERVER_ERROR");
            }
            
            if (!data.user) throw new AuthError("Login failed. Please try again.", "SERVER_ERROR");
            
            const profile = await fetchUserProfile(data.user.id);
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            return profile;
        } catch (e: any) {
             if (e instanceof AuthError) throw e;
             throw new AuthError("Something went wrong. Please try again.", "SERVER_ERROR");
        }
    },

    register: async (username: string, email: string, password: string): Promise<User> => {
        try {
            // Reverting to direct Supabase Auth integration as requested
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { 
                        username,
                        full_name: username, // Shows up in Supabase "Display name" column
                        display_name: username 
                    },
                    emailRedirectTo: window.location.origin
                }
            });

            if (error) throw error;
            if (!data.user) throw new Error("Registration failed");

            // Supabase handles OTP generation and email sending automatically
            throw new AuthError("Registration successful! Use the 8-digit code sent to your email to verify.", "CONFIRMATION_REQUIRED");
        } catch (e: any) {
             if (e instanceof AuthError) throw e;
             throw new AuthError(e.message || "Registration failed", "SERVER_ERROR");
        }
    },

    resendConfirmationEmail: async (email: string): Promise<void> => {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw new AuthError("Couldn't resend the email. Please wait a moment and try again.", "SERVER_ERROR");
    },

    verifyOtp: async (email: string, otp: string): Promise<void> => {
        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'signup'
        });
        
        if (error) {
            throw new AuthError(error.message, "SERVER_ERROR");
        }
    },

    requestPasswordReset: async (email: string): Promise<void> => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password'
        });
        if (error) throw new AuthError(error.message, "SERVER_ERROR");
    },

    logout: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(SESSION_KEY);
    },

    getCurrentUser: (): User | null => {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
    },
    
    // Sync session on load with a live server check
    refreshSession: async (): Promise<User | null> => {
        try {
            // getUser() fetches the user from the server, which is more reliable than getSession()
            // if the user was deleted from the Supabase dashboard.
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error || !user) {
                console.log("Session invalid or user deleted:", error?.message);
                AuthService.logout();
                return null;
            }

            const profile = await fetchUserProfile(user.id).catch(() => null);
            if (!profile) {
                AuthService.logout();
                return null;
            }

            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            return profile;
        } catch (e) {
            console.error("Auth refresh failed:", e);
            AuthService.logout();
            return null;
        }
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

    getMinecraftLoginUrl: async (redirectUri: string): Promise<string> => {
        const data = await fetchWithAuth('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'getMinecraftLoginUrl', redirectUri })
        });
        return data.url;
    },

    linkMinecraftOAuth: async (code: string, redirectUri: string): Promise<User> => {
        const data = await fetchWithAuth('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'linkMinecraftOAuth', code, redirectUri })
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
    },

    fetchWithAuth: async (url: string, options: RequestInit = {}) => {
        return fetchWithAuth(url, options);
    },

    // ── Legacy Migration (Supabase-native OTP) ───────────────────────────────
    // Step 1: Backend resolves username→email and creates the auth user if needed.
    //         Then we call Supabase's own signInWithOtp — it sends the email automatically.
    initiateLegacyMigration: async (identifier: string): Promise<{ email: string; maskedEmail: string; username: string }> => {
        // Ask backend to resolve the identifier and prep the auth user
        const res = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'initiateLegacyMigration', identifier })
        });
        const data = await res.json();
        if (!res.ok) throw new AuthError(data.error || 'Account not found', 'SERVER_ERROR');

        // Now trigger Supabase's built-in OTP email (6-digit code)
        const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: data.email,
            options: { shouldCreateUser: false } // user was already created by backend
        });
        if (otpErr) throw new AuthError(otpErr.message, 'SERVER_ERROR');

        return data; // { email, maskedEmail, username }
    },

    // Step 2: Verify Supabase OTP — user is now authenticated
    verifyLegacyOtp: async (email: string, token: string) => {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });
        if (error) throw new AuthError(error.message, 'INVALID_CREDENTIALS');
        return data.session;
    },

    // Step 3: Set a new password (user is already logged in via OTP)
    // Step 4: Restore old profile data from legacy_users table
    finalizeLegacyProfile: async (newPassword: string): Promise<User> => {
        // Set the new password
        const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
        if (pwErr) throw new AuthError(pwErr.message, 'SERVER_ERROR');

        // Get current session token to authenticate the backend call
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new AuthError('No session found', 'SERVER_ERROR');

        // Restore old profile (role, Minecraft, etc.) from legacy_users
        const res = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ action: 'finalizeLegacyProfile' })
        });
        const data = await res.json();
        if (!res.ok) throw new AuthError(data.error || 'Failed to restore profile', 'SERVER_ERROR');

        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        return data.user as User;
    },
};