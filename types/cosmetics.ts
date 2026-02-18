// Type definitions for the secure cosmetic system

/**
 * Minecraft user document in the database
 */
export interface MinecraftUser {
  uuid: string; // Player UUID without dashes
  unlockedCosmetics: string[]; // Array of cosmetic IDs
  selectedCosmetics: Record<string, string | null>; // type -> cosmeticId mapping
  redeemedCodes: string[]; // Array of redeemed code strings
  createdAt: number;
  updatedAt: number;
}

/**
 * Cosmetic definition document
 */
export interface Cosmetic {
  _id: string; // Cosmetic ID (e.g., "void_cape")
  type: 'cape' | 'hat' | 'aura' | 'pet' | 'particle' | 'emote' | 'title' | string;
  displayName: string;
  description?: string;
  isDefault: boolean;
  isCodeBased: boolean;
  isAdminGranted: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Redeem code document
 */
export interface RedeemCode {
  id: string;
  code: string; // The actual code (e.g., "WINTER2026")
  cosmeticIds?: string[]; // New schema: cosmetic IDs granted
  rewards?: any[]; // Legacy schema: reward objects
  description?: string;
  maxUses?: number;
  usedCount: number;
  usedBy: string[]; // Array of UUIDs that have used this code
  expiresAt?: number;
  requiresMembership?: string;
  createdAt: number;
  createdBy: string;
  enabled: boolean;
}

/**
 * Request body for authenticate action
 */
export interface AuthenticateRequest {
  action: 'authenticate';
  uuid: string;
  accessToken: string;
}

/**
 * Response from authenticate action
 */
export interface AuthenticateResponse {
  defaultCosmetics: string[];
  unlockedCosmetics: string[];
  selectedCosmetics: Record<string, string | null>;
}

/**
 * Request body for redeemCode action
 */
export interface RedeemCodeRequest {
  action: 'redeemCode';
  uuid: string;
  accessToken: string;
  code: string;
}

/**
 * Response from redeemCode action
 */
export interface RedeemCodeResponse {
  success: boolean;
  message: string;
  cosmetics: string[];
}

/**
 * Request body for selectCosmetic action
 */
export interface SelectCosmeticRequest {
  action: 'selectCosmetic';
  uuid: string;
  accessToken: string;
  cosmeticId: string;
  cosmeticType: string;
  equip?: boolean; // false to unequip
}

/**
 * Response from selectCosmetic action
 */
export interface SelectCosmeticResponse {
  success: boolean;
  message: string;
  selectedCosmetics: Record<string, string | null>;
}

/**
 * Request body for getAvailable action
 */
export interface GetAvailableRequest {
  action: 'getAvailable';
  uuid: string;
  accessToken: string;
}

/**
 * Response from getAvailable action
 */
export interface GetAvailableResponse {
  cosmetics: Array<{
    id: string;
    type: string;
    displayName: string;
    description?: string;
    isDefault?: boolean;
  }>;
  unlocked: string[];
  selected: Record<string, string | null>;
}

/**
 * Standard error response
 */
export interface ApiErrorResponse {
  error: string;
  code: string;
}

/**
 * Session verification result
 */
export interface SessionVerificationResult {
  valid: boolean;
  error?: string;
  uuid?: string;
  username?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}
