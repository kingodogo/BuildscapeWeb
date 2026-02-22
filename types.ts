
export interface Comment {
  id: string;
  author: string;
  role: UserRole;
  text: string;
  timestamp: number;
  images?: string[]; // Base64 strings
}

export interface BugReport {
  id: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  versions: string[]; // Changed to array
  mcVersions: string[]; // Changed to array
  author: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Resolved';
  assignedTo?: string;
  resolvedBy?: string;
  timestamp: number;
  aiAnalysis?: AIAnalysisResult;
  comments?: Comment[];
  tags?: string[];
  links?: string[]; // External links (Logs, Videos, Screenshots)
}

export interface AIAnalysisResult {
  qualityScore: number;
  suggestions: string[];
  severityAssessment: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  analyzedBy?: 'admin' | 'automated'; // Track who ran the analysis
  analyzedByUser?: string; // Username of admin who ran it (if admin)
  analyzedAt?: number; // Timestamp when analysis was run
}

export type UserRole = 'owner' | 'admin' | 'pending' | 'user' | string; // Allow custom roles

export interface Role {
  id: string;
  name: string;
  permissions: {
    canManageBugs?: boolean;
    canManageSuggestions?: boolean;
    canManageUsers?: boolean;
    canManageRoles?: boolean;
    canManageConfig?: boolean;
    canViewAdminPanel?: boolean;
    canAssignStaff?: boolean;
    canDeleteReports?: boolean;
    canDeleteSuggestions?: boolean;
  };
  color?: string; // Hex color for role badge
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  streamerMode?: boolean; // Hide sensitive info for streaming
  profileIcon?: string; // Base64 encoded image
  minecraftUsername?: string; // Linked Minecraft username
  minecraftUuid?: string; // Linked Minecraft UUID (without dashes, e.g., "550e8400e29b41d4a716446655440000")
  kofiUsername?: string; // Ko-fi username for subscription tracking
  twitchUsername?: string; // Linked Twitch username
  twitchId?: string; // Linked Twitch ID
  twitchSubscriptionData?: {
    isSub: boolean;
    tier?: string;
    avatar?: string;
    lastModified?: string;
  };
  kofiSubscription?: {
    isActive: boolean;
    tierName?: string;
    lastPaymentDate?: number; // timestamp
    nextPaymentDate?: number; // timestamp (for monthly subscriptions)
    amount?: string;
    currency?: string;
    kofiTransactionId?: string;
  };
}

export interface AppConfigLinks {
  curseforge: string;
  modrinth: string;
  discord: string;
  source: string;
  kofi?: string; // Ko-fi page URL (e.g., https://ko-fi.com/username)
}

export interface SocialHandles {
  author?: string;
  leadDev?: string;
  authorLinks?: {
    twitter?: string;
    github?: string;
    website?: string;
    email?: string;
    [key: string]: string | undefined;
  };
  leadDevLinks?: {
    twitter?: string;
    github?: string;
    website?: string;
    email?: string;
    [key: string]: string | undefined;
  };
}

export interface AppConfigHero {
  headline: string;
  subheadline: string;
  description: string;
  latestModVersion: string;
  latestMcVersions: string;
  headlineColor?: string; // CSS color value (e.g., "#10b981", "linear-gradient(to right, #10b981, #059669)", "rgb(16, 185, 129)")
  headlineGlowColor?: string; // CSS color value for glow effect (e.g., "#10b981", "rgb(16, 185, 129)")
}

export interface DatabaseConfig {
  type: 'local' | 'mongodb_api';
  endpoint?: string;
  apiKey?: string;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: 'Feature' | 'Enhancement' | 'Block' | 'Item' | 'Other';
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Under Review' | 'Planned' | 'Implemented' | 'Rejected';
  author: string;
  timestamp: number;
  comments?: Comment[];
  tags?: string[];
  links?: string[];
  upvotes?: number;
  mcVersions?: string[];
  modVersions?: string[];
  rejectionReason?: string;
}

export interface IconConfig {
  icon?: string; // Base64 encoded image
  size?: number; // Size in pixels (default: 40)
  borderRadius?: number; // Border radius in pixels/percentage (default: 8)
  backgroundColor?: string; // Background color (default: transparent)
  backgroundOpacity?: number; // Background opacity 0-1 (default: 1)
  padding?: number; // Padding in pixels (default: 0)
  borderColor?: string; // Border color (default: transparent)
  borderWidth?: number; // Border width in pixels (default: 0)
}

export interface ChangelogEntry {
  id: string;
  title?: string;
  type?: 'patch' | 'release';
  modVersion: string;
  fileName: string;
  mcVersions: string[];
  changelog: string;
  changelogType: 'html' | 'markdown';
  fileDate: string;
  downloadUrl?: string;
  isLatest?: boolean;
  linkedBugReports?: string[];
  visibility?: 'private' | 'public' | 'unlisted';
}

export interface KofiRewardItem {
  id: string;
  type: 'item' | 'command' | 'permission' | 'custom' | 'downloadable' | 'cosmetic'; // Type of reward
  itemId?: string; // Minecraft item ID (e.g., "minecraft:diamond")
  itemCount?: number; // Number of items
  command?: string; // Command to execute (e.g., "/give {player} diamond 10")
  permission?: string; // Permission node to grant
  customData?: string; // Custom JSON data for mod-specific rewards
  displayName: string; // Display name for UI
  description?: string; // Description of the reward
  downloadUrl?: string; // URL for downloadable assets
  cosmeticData?: {
    itemId?: string; // Item to apply cosmetic to (e.g., "buildscape:hammer")
    skinId?: string; // Skin/resource pack ID
    textureUrl?: string; // Direct texture URL
    modelData?: string; // Custom model data JSON
  }; // Data for cosmetic rewards (skins, textures, etc.)
}

export interface KofiTier {
  id: string;
  name: string; // Tier name (e.g., "Bronze", "Silver", "Gold")
  koFiTierName: string; // Exact name as it appears in Ko-fi (for matching)
  description?: string;
  rewards: KofiRewardItem[]; // List of rewards players get
  durationType: 'permanent' | 'subscription'; // Permanent or expires with subscription
  priority: number; // Higher priority tiers override lower ones
  enabled: boolean; // Whether this tier is active
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

export interface ManualReward {
  id: string;
  userId: string; // Website user ID
  minecraftUuid?: string; // Minecraft UUID (if linked)
  rewards: KofiRewardItem[]; // Rewards to give
  reason: string; // Reason for manual reward
  grantedBy: string; // Admin username who granted it
  grantedAt: number; // Timestamp
  expiresAt?: number; // Optional expiration timestamp
  granted: boolean; // Whether it's been granted (for tracking)
}

export interface RedeemCode {
  id: string;
  code: string; // The actual redeem code (e.g., "SUMMER2024")
  rewards: KofiRewardItem[]; // Rewards granted when code is redeemed
  description?: string; // Description of what the code gives
  maxUses?: number; // Maximum number of times this code can be used (undefined = unlimited)
  usedCount: number; // Number of times this code has been used
  expiresAt?: number; // Optional expiration timestamp
  requiresMembership?: string; // Optional: requires specific membership tier
  createdAt: number; // When the code was created
  createdBy: string; // Admin username who created it
  enabled: boolean; // Whether the code is active
}

export interface CodeRedemption {
  id: string;
  codeId: string; // Reference to RedeemCode
  code: string; // The code that was redeemed (for reference)
  userId: string; // Website user ID
  minecraftUuid: string; // Minecraft UUID (required for redemption)
  rewards: KofiRewardItem[]; // Rewards that were granted
  redeemedAt: number; // Timestamp when redeemed
}

export interface UserReward {
  id: string;
  userId: string;
  minecraftUuid?: string;
  source: 'code' | 'kofi' | 'manual' | 'membership' | 'streamelements'; // Source of the reward
  sourceId?: string; // ID of the source (code ID, kofi tier ID, etc.)
  rewards: KofiRewardItem[]; // The actual rewards
  grantedAt: number; // When it was granted
  expiresAt?: number; // Optional expiration
  downloaded?: boolean; // For downloadable assets, whether user has downloaded
  downloadUrl?: string; // URL for downloadable assets
  downloadExpiresAt?: number; // When download link expires
}

export interface PasswordResetCode {
  id: string;
  userId: string;
  email: string;
  code: string; // 6-digit verification code
  createdAt: number;
  expiresAt: number; // Typically 15-30 minutes
  used: boolean; // Whether the code has been used
  verified: boolean; // Whether the code has been verified (allows password reset)
}

export interface WikiFeature {
  id: string;
  title: string;
  mcVersions: string[]; // Multiple Minecraft versions (e.g., ["1.20.1", "1.21.1"])
  modVersions?: string[]; // Multiple Mod versions (e.g., ["2.0.1", "2.0.2"])
  categories: string[]; // Multiple categories
  subcategories?: string[]; // Multiple subcategories
  description: string;
  descriptionType?: 'text' | 'html' | 'markdown'; // Format type like changelog
  media?: string; // Image or video URL (external hosting only, not stored in database)
  details?: string[];
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
}

export interface AppConfig {
  mcVersions: string[];
  modVersions: string[];
  links: AppConfigLinks;
  hero: AppConfigHero;
  database?: DatabaseConfig;
  socialHandles?: SocialHandles;
  navbarIcon?: IconConfig;
  footerIcon?: IconConfig;
  roles?: Role[]; // Custom roles
  curseforgeProjectSlug?: string; // CurseForge project slug/ID for syncing
  autoSyncCurseForge?: boolean; // Auto-sync versions from CurseForge (deprecated, use curseforgeSyncInterval)
  curseforgeSyncInterval?: number; // Auto-sync interval in hours (0 = disabled, 6 = 6 hours, 12 = 12 hours)
  changelogs?: ChangelogEntry[]; // Manual changelog entries
  kofiTiers?: KofiTier[]; // Ko-fi subscription tiers configuration
}