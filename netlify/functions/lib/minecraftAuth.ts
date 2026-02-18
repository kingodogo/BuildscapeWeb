// Minecraft session verification utility
// Validates access tokens with Mojang/Microsoft session servers

export interface SessionVerificationResult {
  valid: boolean;
  error?: string;
  uuid?: string;
  username?: string;
}

/**
 * Verifies a Minecraft session by checking the access token with Mojang's session server
 * @param uuid - The player's UUID (without dashes)
 * @param accessToken - The player's access token from Minecraft authentication
 * @returns SessionVerificationResult indicating if the session is valid
 */
export async function verifyMinecraftSession(
  uuid: string,
  accessToken: string
): Promise<SessionVerificationResult> {
  try {
    // Validate inputs
    if (!uuid || typeof uuid !== 'string') {
      return { valid: false, error: 'UUID is required' };
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return { valid: false, error: 'Access token is required' };
    }

    // Normalize UUID (remove dashes if present)
    const normalizedUuid = uuid.replace(/-/g, '');

    // Validate UUID format (32 hex characters)
    const UUID_REGEX = /^[0-9a-f]{32}$/i;
    if (!UUID_REGEX.test(normalizedUuid)) {
      return { valid: false, error: 'Invalid UUID format' };
    }

    // Mojang session server endpoint
    // Note: In modern Minecraft, Microsoft authentication is used
    // The session server validates that the access token belongs to the UUID
    const sessionServerUrl = 'https://sessionserver.mojang.com/session/minecraft/hasJoined';

    // For server-side validation, we use a different approach
    // The hasJoined endpoint is for servers to verify players
    // For client token validation, we check with the auth server or use the profile endpoint

    // Try to validate using the Microsoft/Xbox authentication flow
    // First, check if we can get the profile with the access token
    const profileResponse = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      if (profileResponse.status === 401) {
        return { valid: false, error: 'Invalid or expired access token' };
      }
      return { valid: false, error: `Session verification failed: ${profileResponse.status}` };
    }

    const profile = await profileResponse.json();

    // Verify that the profile UUID matches the provided UUID
    // Profile UUID comes with dashes, so we need to normalize both
    const profileUuid = profile.id?.replace(/-/g, '');

    if (!profileUuid) {
      return { valid: false, error: 'Invalid profile response from Minecraft API' };
    }

    if (profileUuid.toLowerCase() !== normalizedUuid.toLowerCase()) {
      return { valid: false, error: 'UUID mismatch - token does not belong to this player' };
    }

    return {
      valid: true,
      uuid: normalizedUuid,
      username: profile.name,
    };
  } catch (error: any) {
    console.error('Minecraft session verification error:', error);
    return { valid: false, error: 'Session verification failed' };
  }
}

/**
 * Validates access token format
 * @param token - The access token to validate
 * @returns boolean indicating if the format is valid
 */
export function isValidAccessTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // JWT tokens typically have 3 parts separated by dots
  // Minecraft access tokens can be JWT or opaque tokens
  // Minimum length check for security
  if (token.length < 20) {
    return false;
  }

  // Check for suspicious characters
  const suspiciousPattern = /[<>\"'\{\}\[\]]/;
  if (suspiciousPattern.test(token)) {
    return false;
  }

  return true;
}

/**
 * Sanitizes UUID input by removing dashes and converting to lowercase
 * @param uuid - The UUID to sanitize
 * @returns Sanitized UUID or null if invalid
 */
export function sanitizeUUID(uuid: string): string | null {
  if (!uuid || typeof uuid !== 'string') {
    return null;
  }

  const sanitized = uuid.replace(/-/g, '').toLowerCase();

  // Validate it's 32 hex characters
  const UUID_REGEX = /^[0-9a-f]{32}$/;
  if (!UUID_REGEX.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Adds dashes back to a UUID for display purposes
 * @param uuid - UUID without dashes
 * @returns UUID with dashes (e.g., 550e8400-e29b-41d4-a716-446655440000)
 */
export function formatUUIDWithDashes(uuid: string): string {
  const sanitized = uuid.replace(/-/g, '');
  if (sanitized.length !== 32) {
    return uuid;
  }

  return `${sanitized.slice(0, 8)}-${sanitized.slice(8, 12)}-${sanitized.slice(12, 16)}-${sanitized.slice(16, 20)}-${sanitized.slice(20)}`;
}
