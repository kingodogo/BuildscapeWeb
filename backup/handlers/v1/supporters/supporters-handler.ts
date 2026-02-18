import clientPromise from '../../../lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateUUID, extractUUID } from '../../api/utils/uuid.js';
import { checkRateLimit, getIdentifier } from '../../api/utils/rateLimit.js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get route segments from slug parameter
  const slug = req.query?.slug;
  const routeParts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  
  // Route: /api/v1/supporters/tiers
  if (routeParts.length === 1 && routeParts[0] === 'tiers' && req.method === 'GET') {
    return handleTiers(req, res);
  }

  // Route: /api/v1/supporters/connect or /api/v1/supporters/connect/{uuid}
  if (routeParts[0] === 'connect' && req.method === 'POST') {
    const uuid = routeParts[1] || extractUUID(req);
    return handleConnect(req, res, uuid);
  }

  // Route: /api/v1/supporters/status or /api/v1/supporters/status/{uuid}
  if (routeParts[0] === 'status' && req.method === 'GET') {
    const uuid = routeParts[1] || extractUUID(req);
    return handleStatus(req, res, uuid);
  }

  // Route: /api/v1/supporters/cosmetics or /api/v1/supporters/cosmetics/{uuid}
  if (routeParts[0] === 'cosmetics' && req.method === 'GET') {
    const uuid = routeParts[1] || extractUUID(req);
    return handleCosmetics(req, res, uuid);
  }

  return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}

async function handleTiers(req: VercelRequest, res: VercelResponse) {
  const globalRateLimit = checkRateLimit('global', getIdentifier(req), 100, 60000);
  if (!globalRateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMIT' });
  }

  try {
    const client = await clientPromise;
    const db = client.db("buildscape_tracker");
    const tiers = await db.collection("kofi_tiers").find({}).sort({ amount: 1 }).toArray();
    
    if (tiers.length === 0) {
      return res.status(200).json({
        data: [
          { id: 1, name: "Supporter", amount: 5, benefits: ["Discord role", "Early access"] },
          { id: 2, name: "Member", amount: 10, benefits: ["All Supporter benefits", "Custom cosmetics"] },
          { id: 3, name: "VIP", amount: 25, benefits: ["All Member benefits", "Priority support"] }
        ]
      });
    }

    return res.status(200).json({ data: tiers });
  } catch (error: any) {
    console.error('Error fetching tiers:', error);
    return res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
}

async function handleConnect(req: VercelRequest, res: VercelResponse, uuid?: string) {
  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required', code: 'MISSING_UUID' });
  }

  const validation = validateUUID(uuid);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error || 'Invalid UUID format', code: 'INVALID_UUID' });
  }

  const uuidRateLimit = checkRateLimit(uuid, uuid, 5, 60000);
  if (!uuidRateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMIT' });
  }

  try {
    const client = await clientPromise;
    const db = client.db("buildscape_tracker");
    
    const verificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = Date.now() + 300000; // 5 minutes

    await db.collection("verification_codes").insertOne({
      uuid,
      code: verificationCode,
      expiresAt,
      createdAt: Date.now()
    });

    return res.status(200).json({
      code: verificationCode,
      expiresIn: 300,
      message: 'Verification code generated'
    });
  } catch (error: any) {
    console.error('Error generating verification code:', error);
    return res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
}

async function handleStatus(req: VercelRequest, res: VercelResponse, uuid?: string) {
  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required', code: 'MISSING_UUID' });
  }

  const validation = validateUUID(uuid);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error || 'Invalid UUID format', code: 'INVALID_UUID' });
  }

  const uuidRateLimit = checkRateLimit(uuid, uuid, 60, 60000);
  if (!uuidRateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMIT' });
  }

  try {
    const client = await clientPromise;
    const db = client.db("buildscape_tracker");
    
    const supporter = await db.collection("supporters").findOne({ uuid });
    
    if (!supporter) {
      return res.status(200).json({
        uuid,
        isSupporter: false,
        tier: null,
        username: null,
        cosmetics: []
      });
    }

    const user = await db.collection("users").findOne({ id: supporter.userId });
    
    return res.status(200).json({
      uuid,
      isSupporter: true,
      tier: supporter.tier || null,
      username: user?.username || null,
      cosmetics: supporter.cosmetics || []
    });
  } catch (error: any) {
    console.error('Error fetching supporter status:', error);
    return res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
}

async function handleCosmetics(req: VercelRequest, res: VercelResponse, uuid?: string) {
  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required', code: 'MISSING_UUID' });
  }

  const validation = validateUUID(uuid);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error || 'Invalid UUID format', code: 'INVALID_UUID' });
  }

  const uuidRateLimit = checkRateLimit(uuid, uuid, 60, 60000);
  if (!uuidRateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMIT' });
  }

  try {
    const client = await clientPromise;
    const db = client.db("buildscape_tracker");
    
    const supporter = await db.collection("supporters").findOne({ uuid });
    
    if (!supporter) {
      return res.status(200).json({
        unlocked: [],
        locked: [],
        equipped: []
      });
    }

    return res.status(200).json({
      unlocked: supporter.cosmetics?.unlocked || [],
      locked: supporter.cosmetics?.locked || [],
      equipped: supporter.cosmetics?.equipped || []
    });
  } catch (error: any) {
    console.error('Error fetching cosmetics:', error);
    return res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
}

