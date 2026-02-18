// Direct route for /api/admin/code-redemptions
import clientPromise from '../../lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { User } from '../../types';

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
      const { codeId, startDate, endDate } = req.query;
      const query: any = {};
      if (codeId && typeof codeId === 'string' && codeId !== 'all') {
        query.codeId = codeId;
      }
      if (startDate || endDate) {
        query.redeemedAt = {};
        if (startDate && typeof startDate === 'string') {
          query.redeemedAt.$gte = parseInt(startDate);
        }
        if (endDate && typeof endDate === 'string') {
          query.redeemedAt.$lte = parseInt(endDate);
        }
      }
      const redemptions = await db.collection("code_redemptions")
        .find(query)
        .sort({ redeemedAt: -1 })
        .toArray();
      const userIds = Array.from(new Set(redemptions.map((r: any) => r.userId).filter(Boolean)));
      let users: any[] = [];
      if (userIds.length > 0) {
        users = await db.collection("users").find({ id: { $in: userIds } }).toArray();
      }
      const userMap = new Map(users.map((u: any) => [u.id, u as User]));
      const redemptionsWithUsers = redemptions.map((r: any) => {
        const { _id, ...redemption } = r;
        const user = userMap.get(r.userId) as User | undefined;
        return {
          ...redemption,
          username: user?.username || 'Unknown',
          email: user?.email || null,
          minecraftUsername: user?.minecraftUsername || null
        };
      });
      return res.status(200).json({ redemptions: redemptionsWithUsers });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error('=== CODE-REDEMPTIONS HANDLER ERROR ===', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}

