import { User, UserRole } from "../types";

const SESSION_KEY = 'buildscape_session_v1';

export class AuthError extends Error {
    constructor(message: string, public code: 'NETWORK_ERROR' | 'SERVER_ERROR' | 'INVALID_CREDENTIALS' | 'NOT_CONFIGURED') {
        super(message);
        this.name = 'AuthError';
    }
}

export const AuthService = {
    login: async (username: string, password: string): Promise<User> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            });
            
            const contentType = res.headers.get("content-type");
            if (!contentType || contentType.indexOf("application/json") === -1) {
                throw new AuthError("Server returned invalid response", 'SERVER_ERROR');
            }

            const data = await res.json();
            
            if (!res.ok) {
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                if (res.status === 401) {
                    throw new AuthError(data.error || 'Invalid credentials', 'INVALID_CREDENTIALS');
                }
                throw new AuthError(data.error || 'Login failed', 'SERVER_ERROR');
            }

            localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
            return data.user;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to connect to server. Please check your internet connection and ensure the backend is running.",
                'NETWORK_ERROR'
            );
        }
    },

    register: async (username: string, email: string, password: string): Promise<User> => {
        const id = crypto.randomUUID();
        const role: UserRole = 'user';

        try {
            console.log("Attempting registration:", { username, email, id });
            
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', id, username, email, password, role })
            });

            console.log("Registration response status:", res.status);
            console.log("Registration response headers:", Object.fromEntries(res.headers.entries()));

            const contentType = res.headers.get("content-type");
            let data;
            
            try {
                const text = await res.text();
                console.log("Registration response body:", text);
                data = JSON.parse(text);
            } catch (parseError) {
                console.error("Failed to parse response:", parseError);
                throw new AuthError("Server returned invalid response. Check browser console for details.", 'SERVER_ERROR');
            }
            
            if (!res.ok) {
                console.error("Registration failed:", data);
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || `Registration failed: ${res.status} ${res.statusText}`, 'SERVER_ERROR');
            }

            if (!data.user) {
                console.error("No user in response:", data);
                throw new AuthError("Server response missing user data", 'SERVER_ERROR');
            }

            localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
            console.log("Registration successful:", data.user);
            return data.user;
        } catch (e: any) {
            console.error("Registration error:", e);
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                `Failed to register: ${e.message || 'Unknown error'}. Check browser console (F12) for details.`,
                'NETWORK_ERROR'
            );
        }
    },

    logout: () => {
        localStorage.removeItem(SESSION_KEY);
    },

    getCurrentUser: (): User | null => {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
    },

    getAllUsers: async (): Promise<User[]> => {
        try {
            const res = await fetch('/api/auth', {
                headers: { 'Content-Type': 'application/json' }
            });
            
            const contentType = res.headers.get("content-type");
            if (!contentType || contentType.indexOf("application/json") === -1) {
                throw new AuthError("Server returned invalid response", 'SERVER_ERROR');
            }

            if (!res.ok) {
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError("Failed to fetch users", 'SERVER_ERROR');
            }

            const data = await res.json();
            return data.users || [];
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to fetch users. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    updateUserRole: async (id: string, role: UserRole): Promise<void> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateRole', id, role })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to update user role", 'SERVER_ERROR');
            }
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to update user role. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    deleteUser: async (id: string): Promise<void> => {
        try {
            const res = await fetch(`/api/auth?id=${id}`, { 
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to delete user", 'SERVER_ERROR');
            }
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to delete user. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    checkUsernameAvailability: async (username: string): Promise<boolean> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'checkUsername', username })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to check username", 'SERVER_ERROR');
            }

            const data = await res.json();
            return data.available === true;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to check username. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    updateProfile: async (updates: {
        userId: string;
        username?: string;
        email?: string;
        newPassword?: string;
        currentPassword?: string;
        profileIcon?: string;
    }): Promise<User> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateProfile',
                    ...updates
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to update profile", 'SERVER_ERROR');
            }

            const data = await res.json();
            if (data.user) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
            }
            return data.user;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to update profile. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    updateKofiUsername: async (userId: string, kofiUsername: string): Promise<User> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateKofiUsername',
                    userId,
                    kofiUsername
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to update Ko-fi email", 'SERVER_ERROR');
            }

            const data = await res.json();
            if (data.user) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
            }
            return data.user;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to update Ko-fi email. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    generateKofiLinkToken: async (userId: string): Promise<string> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generateKofiLinkToken',
                    userId
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to generate link token", 'SERVER_ERROR');
            }

            const data = await res.json();
            return data.token;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to generate link token. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    linkMinecraftAccount: async (userId: string, minecraftUsername: string): Promise<User> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'linkMinecraft',
                    userId,
                    minecraftUsername
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to link Minecraft account", 'SERVER_ERROR');
            }

            const data = await res.json();
            if (data.user) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
            }
            return data.user;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to link Minecraft account. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    unlinkMinecraftAccount: async (userId: string): Promise<User> => {
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unlinkMinecraft',
                    userId
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to unlink Minecraft account", 'SERVER_ERROR');
            }

            const data = await res.json();
            if (data.user) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
            }
            return data.user;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to unlink Minecraft account. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    verifyPlayer: async (uuid: string): Promise<{ verified: boolean; user?: any }> => {
        try {
            const res = await fetch(`/api/auth?action=verifyPlayer&uuid=${encodeURIComponent(uuid)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 404) {
                    return { verified: false };
                }
                throw new AuthError(data.error || "Failed to verify player", 'SERVER_ERROR');
            }

            const data = await res.json();
            return data;
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to verify player. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    getLinkedPlayers: async (): Promise<any[]> => {
        try {
            const res = await fetch('/api/auth?action=getLinkedPlayers', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    throw new AuthError(
                        "Database not configured. Please set up MongoDB Atlas and configure MONGODB_URI environment variable.",
                        'NOT_CONFIGURED'
                    );
                }
                throw new AuthError(data.error || "Failed to get linked players", 'SERVER_ERROR');
            }

            const data = await res.json();
            return data.players || [];
        } catch (e: any) {
            if (e instanceof AuthError) {
                throw e;
            }
            throw new AuthError(
                "Failed to get linked players. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    }
};