/**
 * Minecraft account lookup service
 * Uses Mojang API to resolve Minecraft usernames to UUIDs and verify accounts
 */

export interface MinecraftProfile {
  uuid: string; // UUID without dashes
  username: string;
}

export class MinecraftError extends Error {
  constructor(message: string, public code: 'NOT_FOUND' | 'API_ERROR' | 'INVALID_USERNAME') {
    super(message);
    this.name = 'MinecraftError';
  }
}

/**
 * Resolves a Minecraft username to a UUID
 * Uses Mojang API: https://api.mojang.com/users/profiles/minecraft/<username>
 */
export async function resolveMinecraftUsername(username: string): Promise<MinecraftProfile> {
  if (!username || username.trim().length === 0) {
    throw new MinecraftError('Username cannot be empty', 'INVALID_USERNAME');
  }

  // Minecraft usernames must be 3-16 characters, alphanumeric and underscores
  const validUsernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
  if (!validUsernameRegex.test(username)) {
    throw new MinecraftError('Invalid Minecraft username format', 'INVALID_USERNAME');
  }

  try {
    const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      throw new MinecraftError(`Minecraft account "${username}" not found`, 'NOT_FOUND');
    }

    if (!response.ok) {
      throw new MinecraftError(`Mojang API error: ${response.status} ${response.statusText}`, 'API_ERROR');
    }

    const data = await response.json();

    if (!data.id || !data.name) {
      throw new MinecraftError('Invalid response from Mojang API', 'API_ERROR');
    }

    // Mojang API returns UUID with dashes, we'll store without dashes
    const uuid = data.id.replace(/-/g, '');
    
    return {
      uuid,
      username: data.name,
    };
  } catch (error: any) {
    if (error instanceof MinecraftError) {
      throw error;
    }
    
    // Network errors
    if (error.name === 'TypeError' || error.message?.includes('fetch')) {
      throw new MinecraftError('Failed to connect to Mojang API. Please check your internet connection.', 'API_ERROR');
    }

    throw new MinecraftError(`Unexpected error: ${error.message}`, 'API_ERROR');
  }
}

/**
 * Formats a UUID (without dashes) to include dashes for display
 * Example: "550e8400e29b41d4a716446655440000" -> "550e8400-e29b-41d4-a716-446655440000"
 */
export function formatUuid(uuid: string): string {
  if (!uuid) return '';
  // If already has dashes, return as is
  if (uuid.includes('-')) return uuid;
  // Add dashes
  return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20)}`;
}

/**
 * Removes dashes from a UUID
 */
export function unformatUuid(uuid: string): string {
  return uuid.replace(/-/g, '');
}

