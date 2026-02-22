/**
 * MongoDB → Supabase Migration Script
 * Run: node scripts/migrate-mongo-to-supabase.mjs
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const MONGO_URI = process.env.MONGODB_URI || process.env.BuildScape_MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MONGO_URI) throw new Error('Missing MONGODB_URI in .env');
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL in .env');
if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const logLines = [];

/**
 * Log a migration message prefixed with "[migrate]" and record it in the in-memory log.
 * @param {string} msg - The message text to log.
 */
function log(msg) {
  const line = `[migrate] ${msg}`;
  console.log(line);
  logLines.push(line);
}
/**
 * Log a warning message to the console and record it in the in-memory migration log.
 * @param {string} msg - Warning text to emit and append to the migration log buffer.
 */
function warn(msg) {
  const line = `[migrate] WARN: ${msg}`;
  console.warn(line);
  logLines.push(line);
}

/**
 * Upserts multiple rows into a Supabase table using a specified conflict column.
 *
 * If `rows` is empty the function is a no-op. On success it logs the number of rows
 * inserted/updated; on failure it emits a warning containing the Supabase error message and code.
 *
 * @param {string} table - Name of the Supabase table to upsert into.
 * @param {Array<object>} rows - Array of row objects to upsert.
 * @param {string} [conflictColumn='id'] - Column name to use for conflict resolution (onConflict).
 */
async function upsertBatch(table, rows, conflictColumn = 'id') {
  if (!rows.length) { log(`  (no rows to insert into ${table})`); return; }
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictColumn, ignoreDuplicates: false });
  if (error) {
    warn(`Error upserting into ${table}: ${error.message} | code: ${error.code}`);
  } else {
    log(`  OK: ${rows.length} rows inserted/updated into ${table}`);
  }
}

/**
 * Map a MongoDB report document into the shape expected by the reports table.
 * @param {Object} r - Source MongoDB report document.
 * @returns {Object} An object with the report fields mapped for upsert:
 *  - `id`: report identifier
 *  - `title`: report title
 *  - `description`: detailed description
 *  - `steps_to_reproduce`: reproduction steps
 *  - `versions`: associated versions array
 *  - `mc_versions`: Minecraft versions array
 *  - `severity`: severity level
 *  - `status`: current status
 *  - `author`: author identifier or name
 *  - `assigned_to`: assignee identifier or `null`
 *  - `resolved_by`: resolver identifier or `null`
 *  - `timestamp`: numeric timestamp (milliseconds)
 *  - `tags`: array of tags
 *  - `links`: array of related links
 *  - `comments`: array of comments
 *  - `ai_analysis`: AI analysis data or `null`
 */
function mapReport(r) {
  return {
    id: r.id || String(r._id),
    title: r.title || 'Untitled',
    description: r.description || '',
    steps_to_reproduce: r.stepsToReproduce || '',
    versions: r.versions || [],
    mc_versions: r.mcVersions || [],
    severity: r.severity || 'Low',
    status: r.status || 'Open',
    author: r.author || 'unknown',
    assigned_to: r.assignedTo || null,
    resolved_by: r.resolvedBy || null,
    timestamp: r.timestamp || Date.now(),
    tags: r.tags || [],
    links: r.links || [],
    comments: r.comments || [],
    ai_analysis: r.aiAnalysis || null,
  };
}

/**
 * Map a MongoDB suggestion document to the shape expected by the suggestions table.
 * @param {object} s - Source MongoDB suggestion document.
 * @returns {object} An object with the following properties for upsert:
 *  - id: string identifier (uses `s.id` or stringified `_id`).
 *  - title: suggestion title (defaults to "Untitled").
 *  - description: detailed text (defaults to empty string).
 *  - category: category name (defaults to "Other").
 *  - priority: priority label (defaults to "Low").
 *  - status: workflow status (defaults to "Open").
 *  - author: author identifier or name (defaults to "unknown").
 *  - timestamp: numeric epoch milliseconds (uses `s.timestamp` or Date.now()).
 *  - tags: array of tag strings (defaults to []).
 *  - links: array of related links (defaults to []).
 *  - comments: array of comment objects (defaults to []).
 *  - upvotes: numeric upvote count (defaults to 0).
 *  - mc_versions: array of Minecraft version strings (defaults to []).
 *  - mod_versions: array of mod version strings (defaults to []).
 *  - rejection_reason: reason for rejection or null.
 */
function mapSuggestion(s) {
  return {
    id: s.id || String(s._id),
    title: s.title || 'Untitled',
    description: s.description || '',
    category: s.category || 'Other',
    priority: s.priority || 'Low',
    status: s.status || 'Open',
    author: s.author || 'unknown',
    timestamp: s.timestamp || Date.now(),
    tags: s.tags || [],
    links: s.links || [],
    comments: s.comments || [],
    upvotes: s.upvotes || 0,
    mc_versions: s.mcVersions || [],
    mod_versions: s.modVersions || [],
    rejection_reason: s.rejectionReason || null,
  };
}

/**
 * Map a MongoDB changelog document into the flattened shape expected by the changelogs table.
 *
 * @param {Object} c - Changelog document from MongoDB; may include fields like `_id`, `id`, `title`, `type`, `modVersion`, `fileName`, `mcVersions`, `changelog`, `changelogType`, `fileDate`, `downloadUrl`, `isLatest`, `linkedBugReports`, and `visibility`.
 * @returns {Object} The mapped changelog row with keys: `id`, `title`, `type`, `mod_version`, `file_name`, `mc_versions`, `changelog`, `changelog_type`, `file_date`, `download_url`, `is_latest`, `linked_bug_reports`, and `visibility`.
 */
function mapChangelog(c) {
  return {
    id: c.id || String(c._id),
    title: c.title || null,
    type: c.type || 'patch',
    mod_version: c.modVersion || '',
    file_name: c.fileName || '',
    mc_versions: c.mcVersions || [],
    changelog: c.changelog || '',
    changelog_type: c.changelogType || 'markdown',
    file_date: c.fileDate || '',
    download_url: c.downloadUrl || null,
    is_latest: c.isLatest || false,
    linked_bug_reports: c.linkedBugReports || [],
    visibility: c.visibility || 'public',
  };
}

/**
 * Map a MongoDB `wiki_feature` document to the shape expected by the `wiki_features` Supabase table.
 * @param {Object} w - Source MongoDB document (a `wiki_feature`) containing fields such as `_id`, `id`, `title`, `mcVersions`, `modVersions`, `categories`, `subcategories`, `description`, `descriptionType`, `media`, `details`, `createdAt`, `updatedAt`, and `createdBy`.
 * @returns {Object} An object with the target columns:
 *  - `id` (string) — `w.id` or stringified `_id`.
 *  - `title` (string) — `w.title` or `'Untitled'`.
 *  - `mc_versions` (Array) — `w.mcVersions` or `[]`.
 *  - `mod_versions` (Array) — `w.modVersions` or `[]`.
 *  - `categories` (Array) — `w.categories` or `[]`.
 *  - `subcategories` (Array) — `w.subcategories` or `[]`.
 *  - `description` (string) — `w.description` or `''`.
 *  - `description_type` (string) — `w.descriptionType` or `'markdown'`.
 *  - `media` (any|null) — `w.media` or `null`.
 *  - `details` (Array) — `w.details` or `[]`.
 *  - `created_at` (string) — ISO timestamp from `w.createdAt` or current time if missing.
 *  - `updated_at` (string) — ISO timestamp from `w.updatedAt` or current time if missing.
 *  - `created_by` (any|null) — `w.createdBy` or `null`.
 */
function mapWikiFeature(w) {
  return {
    id: w.id || String(w._id),
    title: w.title || 'Untitled',
    mc_versions: w.mcVersions || [],
    mod_versions: w.modVersions || [],
    categories: w.categories || [],
    subcategories: w.subcategories || [],
    description: w.description || '',
    description_type: w.descriptionType || 'markdown',
    media: w.media || null,
    details: w.details || [],
    created_at: w.createdAt ? new Date(w.createdAt).toISOString() : new Date().toISOString(),
    updated_at: w.updatedAt ? new Date(w.updatedAt).toISOString() : new Date().toISOString(),
    created_by: w.createdBy || null,
  };
}

/**
 * Produce an ISO 8601 timestamp string from a date-like value for use in timestamptz columns.
 * @param {*} v - A date-like value (Date, numeric epoch, or date string). Falsy values (null/undefined/empty) are accepted.
 * @returns {string|null} `ISO 8601` timestamp string if `v` is provided, `null` otherwise.
 */
function toIso(v) {
  if (!v) return null;
  if (typeof v === 'number') return new Date(v).toISOString();
  return new Date(v).toISOString();
}

/**
 * Convert a date-like value into Unix milliseconds for bigint timestamp columns.
 * @param {*} v - A date-like value (Date, ISO/string, or numeric timestamp). Falsy values are treated as absent.
 * @returns {number|null} The timestamp in milliseconds since the Unix epoch, or `null` if `v` is falsy.
 */
function toTs(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  return new Date(v).getTime();
}

/**
 * Map a MongoDB redeem_code document to the shape expected by the redeem_codes Supabase table.
 * @param {Object} c - MongoDB redeem_code document.
 * @returns {Object} Mapped redeem code row with the following properties:
 *  - id: string identifier.
 *  - code: redemption code string.
 *  - rewards: array of reward entries.
 *  - description: string or `null`.
 *  - max_uses: number or `null`.
 *  - used_count: number.
 *  - expires_at: number (milliseconds since epoch) or `null`.
 *  - requires_membership: boolean or `null`.
 *  - created_at: number (milliseconds since epoch).
 *  - created_by: string.
 *  - enabled: boolean.
 */
function mapRedeemCode(c) {
  return {
    id: c.id || String(c._id),
    code: c.code,
    rewards: c.rewards || [],
    description: c.description || null,
    max_uses: c.maxUses || null,
    used_count: c.usedCount || 0,
    expires_at: toTs(c.expiresAt),          // bigint column → ms timestamp
    requires_membership: c.requiresMembership || null,
    created_at: toTs(c.createdAt) || Date.now(), // bigint column → ms timestamp
    created_by: c.createdBy || 'migrated',
    enabled: c.enabled !== false,
  };
}

/**
 * Map a MongoDB code_redemption document into a row suitable for the code_redemptions table.
 *
 * @param {Object} r - MongoDB code_redemption document.
 * @returns {Object} Mapped row with the following properties:
 *  - {string} id - Primary identifier; uses `r.id` if present, otherwise stringified `r._id`.
 *  - {string|null} code_id - Associated redeem code id or `null`.
 *  - {string} code - Redeem code string.
 *  - {string} user_id - ID of the user who redeemed the code.
 *  - {string|null} minecraft_uuid - Minecraft UUID if available, otherwise `null`.
 *  - {Array} rewards - Array of reward entries (defaults to an empty array).
 *  - {number} redeemed_at - Redemption timestamp in milliseconds since epoch (uses the document timestamp if available, otherwise current time).
 */
function mapCodeRedemption(r) {
  return {
    id: r.id || String(r._id),
    code_id: r.codeId || null,
    code: r.code,
    user_id: r.userId,
    minecraft_uuid: r.minecraftUuid || null,
    rewards: r.rewards || [],
    redeemed_at: toTs(r.redeemedAt) || Date.now(), // bigint column → ms timestamp
  };
}

/**
 * Map a MongoDB user_reward document to the shape expected by the user_rewards table.
 *
 * @param {Object} r - The source MongoDB document for a user reward.
 * @returns {Object} An object with keys:
 *  - `id`: record id (uses `r.id` or stringified `_id`),
 *  - `user_id`: target user identifier,
 *  - `minecraft_uuid`: Minecraft UUID or `null`,
 *  - `source`: origin of the reward (defaults to `'manual'`),
 *  - `source_id`: optional identifier from the source system or `null`,
 *  - `rewards`: array of reward items (defaults to empty array),
 *  - `granted_at`: Unix milliseconds timestamp when granted (falls back to current time),
 *  - `expires_at`: Unix milliseconds timestamp when the reward expires or `null`,
 *  - `downloaded`: boolean flag whether reward was downloaded,
 *  - `download_url`: URL to download any reward assets or `null`,
 *  - `download_expires_at`: Unix milliseconds timestamp when the download link expires or `null`.
 */
function mapUserReward(r) {
  return {
    id: r.id || String(r._id),
    user_id: r.userId,
    minecraft_uuid: r.minecraftUuid || null,
    source: r.source || 'manual',
    source_id: r.sourceId || null,
    rewards: r.rewards || [],
    granted_at: toTs(r.grantedAt) || Date.now(),
    expires_at: toTs(r.expiresAt),
    downloaded: r.downloaded || false,
    download_url: r.downloadUrl || null,
    download_expires_at: toTs(r.downloadExpiresAt),
  };
}

/**
 * Map a MongoDB kofi_manual_reward document to a row suitable for the kofi_manual_rewards table.
 * @param {Object} r - Source manual reward document (MongoDB). Expected properties: `_id`, `id`, `userId`, `minecraftUuid`, `rewards`, `reason`, `grantedBy`, `grantedAt`, `expiresAt`, `granted`.
 * @returns {Object} An object with properties:
 *  - `id`: string identifier (uses `id` or `_id`),
 *  - `user_id`: user identifier,
 *  - `minecraft_uuid`: Minecraft UUID or `null`,
 *  - `rewards`: array of reward entries (defaults to []),
 *  - `reason`: reason string (defaults to "migrated"),
 *  - `granted_by`: grantor identifier (defaults to "migrated"),
 *  - `granted_at`: ISO timestamp string for when the reward was granted,
 *  - `expires_at`: ISO timestamp string for expiration or `null`,
 *  - `granted`: `true` if granted (defaults to `true` unless explicitly `false`).
 */
function mapManualReward(r) {
  return {
    id: r.id || String(r._id),
    user_id: r.userId,
    minecraft_uuid: r.minecraftUuid || null,
    rewards: r.rewards || [],
    reason: r.reason || 'migrated',
    granted_by: r.grantedBy || 'migrated',
    granted_at: r.grantedAt ? new Date(r.grantedAt).toISOString() : new Date().toISOString(),
    expires_at: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    granted: r.granted !== false,
  };
}

/**
 * Migrate data from the MongoDB "buildscape_tracker" database into Supabase tables and write migration artifacts.
 *
 * Connects to MongoDB, enumerates collections, exports user records to a local JSON file and seeds the
 * `legacy_users` table, and upserts transformed documents for reports, suggestions, config, changelogs,
 * wiki features, redeem codes, code redemptions, user rewards, and manual Ko-fi rewards into their
 * corresponding Supabase tables. Counts Ko-fi payments and links for reporting. Closes the MongoDB client
 * when finished and writes a consolidated migration log to disk.
 */
async function main() {
  log('Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db('buildscape_tracker');
  log('Connected!');

  // 1. List collections
  const colls = (await db.listCollections().toArray()).map(c => c.name);
  log(`Collections found: ${colls.join(', ')}`);

  // 2. Users - print only
  log('\n--- Users (info only, not migrated due to FK constraint) ---');
  const users = await db.collection('users').find({}).toArray();
  log(`Found ${users.length} users:`);
  for (const u of users) {
    log(`  username=${u.username} email=${u.email} role=${u.role} mc=${u.minecraftUsername || 'none'} id=${u.id}`);
  }
  // Save user data to a JSON file for manual reference
  fs.writeFileSync('scripts/mongo-users.json', JSON.stringify(users, null, 2));
  log('  -> Saved to scripts/mongo-users.json for reference');

  // 2a. Seed legacy_users table (for migration message on login)
  log('\n--- Seeding legacy_users (for friendly login message) ---');
  const legacyRows = users.map(u => ({
    email: (u.email || '').toLowerCase().trim(),
    username: u.username || u.name || '',
    old_role: u.role || 'user',
    old_minecraft_username: u.minecraftUsername || null,
    old_minecraft_uuid: u.minecraftUuid || null,
    old_kofi_username: u.kofiUsername || null,
  })).filter(u => u.email);
  if (legacyRows.length) {
    const { error } = await supabase
      .from('legacy_users')
      .upsert(legacyRows, { onConflict: 'email', ignoreDuplicates: false });
    if (error) warn(`legacy_users error: ${error.message} (table may not exist yet - see SQL below)`);
    else log(`  OK: ${legacyRows.length} legacy users seeded`);
  }

  log('\n--- Reports ---');
  const reports = await db.collection('reports').find({}).toArray();
  log(`Found ${reports.length}`);
  if (reports.length) await upsertBatch('reports', reports.map(mapReport));

  // 4. Suggestions
  log('\n--- Suggestions ---');
  const suggestions = await db.collection('suggestions').find({}).toArray();
  log(`Found ${suggestions.length}`);
  if (suggestions.length) await upsertBatch('suggestions', suggestions.map(mapSuggestion));

  // 5. Config
  log('\n--- Config ---');
  const config = await db.collection('config').findOne({ id: 'main_config' });
  if (config) {
    const { _id, ...configData } = config;
    const { error } = await supabase.from('config').upsert({ id: 'main_config', data: configData }, { onConflict: 'id' });
    if (error) warn(`Config error: ${error.message}`);
    else log('  OK: Config migrated');
    fs.writeFileSync('scripts/mongo-config.json', JSON.stringify(configData, null, 2));
    log('  -> Saved to scripts/mongo-config.json');
  } else {
    warn('No main_config found');
  }

  // 6. Changelogs
  log('\n--- Changelogs ---');
  const changelogs = await db.collection('changelogs').find({}).toArray();
  log(`Found ${changelogs.length}`);
  if (changelogs.length) await upsertBatch('changelogs', changelogs.map(mapChangelog));

  // 7. Wiki Features
  log('\n--- Wiki Features ---');
  const wiki = await db.collection('wiki_features').find({}).toArray();
  log(`Found ${wiki.length}`);
  if (wiki.length) await upsertBatch('wiki_features', wiki.map(mapWikiFeature));

  // 8. Ko-fi Payments
  log('\n--- Ko-fi Payments ---');
  const kp = await db.collection('kofi_payments').find({}).toArray();
  log(`Found ${kp.length} in kofi_payments`);
  const kl = await db.collection('kofi_links').find({}).toArray();
  log(`Found ${kl.length} in kofi_links`);

  // 9. Redeem Codes
  log('\n--- Redeem Codes ---');
  const rc = await db.collection('redeem_codes').find({}).toArray();
  log(`Found ${rc.length}`);
  if (rc.length) await upsertBatch('redeem_codes', rc.map(mapRedeemCode));

  // 10. Code Redemptions
  log('\n--- Code Redemptions ---');
  const cr = await db.collection('code_redemptions').find({}).toArray();
  log(`Found ${cr.length}`);
  if (cr.length) await upsertBatch('code_redemptions', cr.map(mapCodeRedemption));

  // 11. User Rewards
  log('\n--- User Rewards ---');
  const ur = await db.collection('user_rewards').find({}).toArray();
  log(`Found ${ur.length}`);
  if (ur.length) await upsertBatch('user_rewards', ur.map(mapUserReward));

  // 12. Manual Rewards
  log('\n--- Manual Rewards ---');
  const mr = await db.collection('kofi_manual_rewards').find({}).toArray();
  log(`Found ${mr.length}`);
  if (mr.length) await upsertBatch('kofi_manual_rewards', mr.map(mapManualReward));

  await client.close();
  log('\nMigration complete!');

  // Write full log
  fs.writeFileSync('scripts/migration-result.txt', logLines.join('\n'));
  log('Full log saved to scripts/migration-result.txt');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  fs.writeFileSync('scripts/migration-result.txt', logLines.join('\n') + '\nFATAL: ' + err.message);
  process.exit(1);
});