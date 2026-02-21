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

function log(msg) {
  const line = `[migrate] ${msg}`;
  console.log(line);
  logLines.push(line);
}
function warn(msg) {
  const line = `[migrate] WARN: ${msg}`;
  console.warn(line);
  logLines.push(line);
}

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

// Convert any date value to ISO string for Supabase timestamptz columns
function toIso(v) {
  if (!v) return null;
  if (typeof v === 'number') return new Date(v).toISOString();
  return new Date(v).toISOString();
}

// Convert any date value to Unix ms for Supabase bigint columns
function toTs(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  return new Date(v).getTime();
}

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
