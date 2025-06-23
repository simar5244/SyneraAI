import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import connectDB from '@/lib/dbConnect';
import { verifyAuth } from '@/lib/auth';
import feedbackService from '@/services/feedbackService';
import { getUserModel } from '@/models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1] || req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let payload;
  try {
    payload = await verifyAuth(token as string);
    if (!payload?.id) throw new Error();
  } catch {
    return res.status(401).json({ error: 'Invalid authentication' });
  }

  const rawCompanyCode = (payload.companyCode || payload.company_code) as string;
  if (!rawCompanyCode) return res.status(403).json({ error: 'Company context required' });
  // Connect to the company-specific database
  await connectDB(rawCompanyCode);
  const userEmail = payload.email as string;

  if (req.method === 'GET') {
    const { type = 'given', email: targetEmail, quarter } = req.query;
    try {
      // If querying feedback for another user, handle first
      if (targetEmail && typeof targetEmail === 'string') {
        const feedbackFor = await feedbackService.getFeedbackForEmployee(
          targetEmail.toLowerCase(),
          rawCompanyCode,
          quarter as string
        );
        const metrics = await feedbackService.updateUserFeedbackMetrics(
          targetEmail.toLowerCase(),
          rawCompanyCode
        );
        // Use direct MongoDB connection to get complete user document
        const db = mongoose.connection.useDb(`company_${rawCompanyCode.toLowerCase()}`);
        const user = await db.collection('users').findOne({ email: targetEmail.toLowerCase() });
        return res.status(200).json({ feedback: feedbackFor, metrics: metrics.feedbackReceived, user });
      }
      // Otherwise, use type parameter for self
      if (type === 'given') {
        const feedbackGiven = await feedbackService.getFeedbackByEvaluator(
          userEmail.toLowerCase(),
          rawCompanyCode,
          quarter as string
        );
        const metrics = await feedbackService.updateUserFeedbackMetrics(
          userEmail.toLowerCase(),
          rawCompanyCode
        );
        // Use direct MongoDB connection to get complete user document
        const db = mongoose.connection.useDb(`company_${rawCompanyCode.toLowerCase()}`);
        const user = await db.collection('users').findOne({ email: userEmail.toLowerCase() });
        return res.status(200).json({ feedback: feedbackGiven, metrics: metrics.feedbackGiven, user });
      }
      if (type === 'received') {
        const feedbackReceived = await feedbackService.getFeedbackForEmployee(
          userEmail.toLowerCase(),
          rawCompanyCode,
          quarter as string
        );
        const metrics = await feedbackService.updateUserFeedbackMetrics(
          userEmail.toLowerCase(),
          rawCompanyCode
        );
        // Use direct MongoDB connection to get complete user document
        const db = mongoose.connection.useDb(`company_${rawCompanyCode.toLowerCase()}`);
        const user = await db.collection('users').findOne({ email: userEmail.toLowerCase() });
        return res.status(200).json({ feedback: feedbackReceived, metrics: metrics.feedbackReceived, user });
      }
      return res.status(400).json({ error: 'Invalid request' });
    } catch (err: any) {
      console.error('GET /api/feedback error:', err);
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }

  if (req.method === 'POST') {
    const { evaluatedEmail, relationshipType, ratings, topSkills } = req.body;
    if (!evaluatedEmail) return res.status(400).json({ error: 'Evaluated email required' });
    console.log('API POST /api/feedback: userEmail =', userEmail, 'rawCompanyCode =', rawCompanyCode, 'body =', req.body);
    try {
      const { feedback, updatedReceiver: user } = await feedbackService.submitFeedback(
        userEmail.toLowerCase(),
        (evaluatedEmail as string).toLowerCase(),
        relationshipType,
        ratings,
        topSkills,
        rawCompanyCode
      );
      return res.status(201).json({ feedback, user });
    } catch (err: any) {
      console.error('POST /api/feedback error:', err);
      return res.status(400).json({ error: err.message || 'Failed to submit feedback' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
