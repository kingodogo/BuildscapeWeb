import { BugReport, AppConfig, Suggestion } from "../types";

const API_URL = '/api/data';

export class StorageError extends Error {
    constructor(message: string, public code: 'NETWORK_ERROR' | 'SERVER_ERROR' | 'NOT_CONFIGURED') {
        super(message);
        this.name = 'StorageError';
    }
}

export const StorageService = {
    async isCloudAvailable(): Promise<boolean> {
        try {
            const res = await fetch(API_URL, { 
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            return res.status === 200;
        } catch (e) {
            return false;
        }
    },

    async loadAll(): Promise<{ reports: BugReport[], suggestions: Suggestion[], config: AppConfig | null, source: 'cloud' | 'error' }> {
        try {
            const res = await fetch(API_URL, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                if (res.status === 503) {
                    throw new StorageError(
                        "Database services unavailable. Please check server configuration.",
                        'NOT_CONFIGURED'
                    );
                }
                // Try to parse error details from response
                let errorMessage = `Server error: ${res.status} ${res.statusText}`;
                try {
                    const errorData = await res.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                        // Include stack trace in dev mode if available
                        if (errorData.stack && window.location.hostname === 'localhost') {
                            console.error('Server error details:', errorData);
                        }
                    }
                } catch (e) {
                    // If JSON parsing fails, use default message
                }
                throw new StorageError(
                    errorMessage,
                    'SERVER_ERROR'
                );
            }

            const data = await res.json();
            return {
                reports: data.reports || [],
                suggestions: data.suggestions || [],
                config: data.config || null,
                source: 'cloud'
            };
        } catch (e: any) {
            if (e instanceof StorageError) {
                throw e;
            }
            throw new StorageError(
                "Failed to connect to server. Please check your internet connection and ensure the backend is running.",
                'NETWORK_ERROR'
            );
        }
    },

    async saveAll(reports: BugReport[], suggestions: Suggestion[], config: AppConfig): Promise<void> {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reports, suggestions, config })
            });

            if (!res.ok) {
                if (res.status === 503) {
                    throw new StorageError(
                        "Database services unavailable. Please check server configuration.",
                        'NOT_CONFIGURED'
                    );
                }
                const errorData = await res.json().catch(() => ({}));
                throw new StorageError(
                    errorData.error || `Server error: ${res.status} ${res.statusText}`,
                    'SERVER_ERROR'
                );
            }
        } catch (e: any) {
            if (e instanceof StorageError) {
                throw e;
            }
            throw new StorageError(
                "Failed to save data. Please check your internet connection and ensure the backend is running.",
                'NETWORK_ERROR'
            );
        }
    },

    async saveReport(report: BugReport): Promise<void> {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report })
            });

            if (!res.ok) {
                if (res.status === 503) {
                    throw new StorageError(
                        "Database services unavailable. Please check server configuration.",
                        'NOT_CONFIGURED'
                    );
                }
                const errorData = await res.json().catch(() => ({}));
                throw new StorageError(
                    errorData.error || `Failed to save report: ${res.status}`,
                    'SERVER_ERROR'
                );
            }
        } catch (e: any) {
            if (e instanceof StorageError) {
                throw e;
            }
            throw new StorageError(
                "Failed to save report. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    async deleteReport(reportId: string): Promise<void> {
        try {
            const res = await fetch(`${API_URL}?id=${reportId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                if (res.status === 503) {
                    throw new StorageError(
                        "Database services unavailable. Please check server configuration.",
                        'NOT_CONFIGURED'
                    );
                }
                const errorData = await res.json().catch(() => ({}));
                throw new StorageError(
                    errorData.error || `Failed to delete report: ${res.status}`,
                    'SERVER_ERROR'
                );
            }
        } catch (e: any) {
            if (e instanceof StorageError) {
                throw e;
            }
            throw new StorageError(
                "Failed to delete report. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    async saveSuggestion(suggestion: Suggestion): Promise<void> {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suggestion })
            });

            if (!res.ok) {
                if (res.status === 503) {
                    throw new StorageError(
                        "Database services unavailable. Please check server configuration.",
                        'NOT_CONFIGURED'
                    );
                }
                const errorData = await res.json().catch(() => ({}));
                throw new StorageError(
                    errorData.error || `Failed to save suggestion: ${res.status}`,
                    'SERVER_ERROR'
                );
            }
        } catch (e: any) {
            if (e instanceof StorageError) {
                throw e;
            }
            throw new StorageError(
                "Failed to save suggestion. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    },

    async deleteSuggestion(suggestionId: string): Promise<void> {
        try {
            const res = await fetch(`${API_URL}?id=${suggestionId}&type=suggestion`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                if (res.status === 503) {
                    throw new StorageError(
                        "Database services unavailable. Please check server configuration.",
                        'NOT_CONFIGURED'
                    );
                }
                const errorData = await res.json().catch(() => ({}));
                throw new StorageError(
                    errorData.error || `Failed to delete suggestion: ${res.status}`,
                    'SERVER_ERROR'
                );
            }
        } catch (e: any) {
            if (e instanceof StorageError) {
                throw e;
            }
            throw new StorageError(
                "Failed to delete suggestion. Please check your internet connection.",
                'NETWORK_ERROR'
            );
        }
    }
};