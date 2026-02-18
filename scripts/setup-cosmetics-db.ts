/**
 * Database setup script for the secure cosmetic system
 * Creates necessary collections and indexes
 * Run with: npx ts-node scripts/setup-cosmetics-db.ts
 */

import clientPromise from '../api/db.js';

async function setupDatabase() {
  console.log('Setting up cosmetic system database...\n');

  try {
    const client = await clientPromise;
    const db = client.db('buildscape_tracker');

    // 1. Create minecraft_users collection with indexes
    console.log('1. Setting up minecraft_users collection...');
    const minecraftUsers = db.collection('minecraft_users');

    // Create unique index on uuid
    await minecraftUsers.createIndex(
      { uuid: 1 },
      { unique: true, name: 'uuid_unique' }
    );
    console.log('   - Created unique index on uuid');

    // Create index on unlockedCosmetics for faster lookups
    await minecraftUsers.createIndex(
      { unlockedCosmetics: 1 },
      { name: 'unlocked_cosmetics' }
    );
    console.log('   - Created index on unlockedCosmetics');

    // Create index on createdAt for sorting
    await minecraftUsers.createIndex(
      { createdAt: -1 },
      { name: 'created_at_desc' }
    );
    console.log('   - Created index on createdAt');

    // 2. Create cosmetics collection with indexes
    console.log('\n2. Setting up cosmetics collection...');
    const cosmetics = db.collection('cosmetics');

    // Create index on isDefault for faster default cosmetic queries
    await cosmetics.createIndex(
      { isDefault: 1 },
      { name: 'is_default' }
    );
    console.log('   - Created index on isDefault');

    // Create index on isCodeBased
    await cosmetics.createIndex(
      { isCodeBased: 1 },
      { name: 'is_code_based' }
    );
    console.log('   - Created index on isCodeBased');

    // Create index on type for filtering
    await cosmetics.createIndex(
      { type: 1 },
      { name: 'cosmetic_type' }
    );
    console.log('   - Created index on type');

    // 3. Create redeem_codes collection with indexes
    console.log('\n3. Setting up redeem_codes collection...');
    const redeemCodes = db.collection('redeem_codes');

    // Create unique index on code
    await redeemCodes.createIndex(
      { code: 1 },
      { unique: true, name: 'code_unique' }
    );
    console.log('   - Created unique index on code');

    // Create index on expiresAt for expiration checks
    await redeemCodes.createIndex(
      { expiresAt: 1 },
      { name: 'expires_at' }
    );
    console.log('   - Created index on expiresAt');

    // Create index on enabled for filtering active codes
    await redeemCodes.createIndex(
      { enabled: 1 },
      { name: 'enabled' }
    );
    console.log('   - Created index on enabled');

    // Create index on usedBy for checking if user redeemed
    await redeemCodes.createIndex(
      { usedBy: 1 },
      { name: 'used_by' }
    );
    console.log('   - Created index on usedBy');

    // 4. Insert sample default cosmetics (optional)
    console.log('\n4. Checking for default cosmetics...');
    const defaultCosmeticCount = await cosmetics.countDocuments({ isDefault: true });

    if (defaultCosmeticCount === 0) {
      console.log('   - No default cosmetics found. Inserting sample defaults...');

      const sampleDefaults = [
        {
          _id: 'default_cape',
          type: 'cape',
          displayName: 'Default Cape',
          description: 'A simple cape for all players',
          isDefault: true,
          isCodeBased: false,
          isAdminGranted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      await cosmetics.insertMany(sampleDefaults as any);
      console.log(`   - Inserted ${sampleDefaults.length} default cosmetic(s)`);
    } else {
      console.log(`   - Found ${defaultCosmeticCount} default cosmetic(s)`);
    }

    console.log('\n✅ Database setup complete!');
    console.log('\nCreated collections:');
    console.log('  - minecraft_users');
    console.log('  - cosmetics');
    console.log('  - redeem_codes');

  } catch (error: any) {
    console.error('\n❌ Database setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase().then(() => {
    console.log('\nSetup script finished.');
    process.exit(0);
  }).catch((error) => {
    console.error('Setup script failed:', error);
    process.exit(1);
  });
}

export { setupDatabase };
