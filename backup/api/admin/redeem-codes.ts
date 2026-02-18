// Direct route for /api/admin/redeem-codes
import clientPromise from '../../lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { RedeemCode } from '../../types';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const uri = process.env.MONGODB_URI || process.env.BuildScape_MONGODB_URI;
    if (!uri) {
      return res.status(503).json({ error: "Database not configured. Please set MONGODB_URI environment variable." });
    }

    const client = await clientPromise;
    const db = client.db("buildscape_tracker");

    if (req.method === 'GET') {
      const codes = await db.collection("redeem_codes").find({}).sort({ createdAt: -1 }).toArray();
      const cleanCodes = codes.map((c: any) => {
        const { _id, ...rest } = c;
        return rest;
      });
      return res.status(200).json({ codes: cleanCodes });
    }

    if (req.method === 'POST') {
      const { code, description, rewards, maxUses, expiresAt, requiresMembership, enabled } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: "Code is required" });
      }
      if (!rewards || !Array.isArray(rewards) || rewards.length === 0) {
        return res.status(400).json({ error: "At least one reward is required" });
      }
      const existingCode = await db.collection("redeem_codes").findOne({ code: code.toUpperCase().trim() });
      if (existingCode) {
        return res.status(400).json({ error: "Code already exists" });
      }
      const newCode: RedeemCode = {
        id: generateUUID(),
        code: code.toUpperCase().trim(),
        rewards: rewards,
        description: description || '',
        maxUses: maxUses || undefined,
        usedCount: 0,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
        requiresMembership: requiresMembership || undefined,
        createdAt: Date.now(),
        createdBy: req.body.createdBy || 'admin',
        enabled: enabled !== undefined ? enabled : true
      };
      await db.collection("redeem_codes").insertOne(newCode);
      const cleanCode: any = { ...newCode };
      delete (cleanCode as any)._id;
      return res.status(200).json({ code: cleanCode, success: true });
    }

    if (req.method === 'PUT') {
      const { id, code, description, rewards, maxUses, expiresAt, requiresMembership, enabled } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Code ID is required" });
      }
      const updateData: any = {};
      if (code !== undefined) updateData.code = code.toUpperCase().trim();
      if (description !== undefined) updateData.description = description;
      if (rewards !== undefined) updateData.rewards = rewards;
      if (maxUses !== undefined) updateData.maxUses = maxUses;
      if (expiresAt !== undefined) {
        updateData.expiresAt = expiresAt ? new Date(expiresAt).getTime() : undefined;
      }
      if (requiresMembership !== undefined) updateData.requiresMembership = requiresMembership;
      if (enabled !== undefined) updateData.enabled = enabled;
      const result = await db.collection("redeem_codes").updateOne({ id: id }, { $set: updateData });
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Code not found" });
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Code ID is required" });
      }
      const result = await db.collection("redeem_codes").deleteOne({ id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Code not found" });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error('=== REDEEM-CODES HANDLER ERROR ===', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}

