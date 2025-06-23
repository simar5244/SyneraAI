import mongoose from 'mongoose';
import { getFeedbackModel } from '@/models/Feedback';
import User, { getUserModel } from '@/models/User';
import connectDB from '@/lib/dbConnect';

class FeedbackService {
  /**
   * Submit feedback for an employee
   */
  async submitFeedback(
    evaluatorId: string,
    evaluatedEmail: string,
    relationshipType: 'direct-reporting' | 'project-collaboration' | 'no-connection',
    ratings: {
      accountability: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
      teamContribution: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
      adaptability: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
      communication: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
      confidence: 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';
    },
    topSkills: string,
    company: string
  ): Promise<any> {
    // EMERGENCY OVERRIDE: If company is empty, we'll try to find a company
    if (!company) {
      console.warn('WARNING: Company code is empty. Will try to find company by evaluator email:', evaluatorId);
      company = await this.guessCompanyFromEmail(evaluatorId) || 'LcowIAVo'; // Fallback to known company
      console.log('Using guessed company:', company);
    }
    await connectDB(company);

    // Use company-specific User model if multi-tenancy is enabled
    let UserModel = company ? getUserModel(company) : User;

    // The key issue: evaluatorId might be an email or id; handle both
    let evaluator;
    const evaluatorEmailLower = evaluatorId.toLowerCase();
    
    // First try to find by ID (if it's a valid ObjectId)
    if (mongoose.Types.ObjectId.isValid(evaluatorId)) {
      evaluator = await (UserModel as any).findById(evaluatorId);
    }
    
    // If not found by ID or not a valid ObjectId, try as email
    if (!evaluator) {
      evaluator = await UserModel.findOne({
        $or: [
          { email: evaluatorEmailLower },
          { email: { $regex: `^${evaluatorEmailLower}$`, $options: 'i' } }
        ]
      });
    }

    // Fallback: try global User collection if still not found
    if (!evaluator) {
      evaluator = await User.findOne({
        $or: [
          { email: evaluatorEmailLower },
          { email: { $regex: `^${evaluatorEmailLower}$`, $options: 'i' } }
        ]
      });
    }
    
    // EMERGENCY: if evaluator still not found and global fallbacks aren't working,
    // try known companies directly
    if (!evaluator) {
      console.log('Emergency evaluator search: Not found in default DB or company DB');
      evaluator = await this.findUserInAnyCompany(evaluatorEmailLower);
    }

    // Final fallback: if still not found and we used exact-case DB, retry lowercase DB
    if (!evaluator && company) {
      const lowerModel = getUserModel(company.toLowerCase());
      evaluator = await lowerModel.findOne({
        $or: [
          { email: evaluatorEmailLower },
          { email: { $regex: `^${evaluatorEmailLower}$`, $options: 'i' } }
        ]
      });
      if (evaluator) {
        UserModel = lowerModel; // switch for subsequent lookups
      }
    }

    if (!evaluator) {
      console.error(`Evaluator not found: ${evaluatorId} (company: ${company})`);
      throw new Error('Evaluator not found');
    }

    // Directly use the evaluator's role. Ensure it's trimmed and lowercased.
    const evaluatorInternalRole = evaluator.role ? evaluator.role.trim().toLowerCase() : ''; 

    // Get current quarter and year
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const quarter = `Q${currentQuarter}-${currentYear}`;

    // Connect to the company-specific database and get model
    await connectDB(company);
    const FeedbackModel = getFeedbackModel(company);

    // Check for existing feedback in the company database
    const existingFeedback = await FeedbackModel.findOne({
      documentType: 'feedback', 
      evaluatorEmail: evaluator.email, 
      evaluatedEmail, 
      quarter, 
      $or: [
        { companyCode: { $regex: `^${company}$`, $options: 'i' } },
        { company: { $regex: `^${company}$`, $options: 'i' } }
      ]
    });

    if (existingFeedback) {
      throw new Error('You have already provided feedback for this employee this quarter');
    }

    // Find the user being evaluated (case-insensitive)
    const evaluatedEmailLower = evaluatedEmail.toLowerCase();
    let evaluatedUser = await UserModel.findOne({
      $or: [
        { email: evaluatedEmailLower },
        { email: { $regex: `^${evaluatedEmailLower}$`, $options: 'i' } }
      ]
    });
    
    // Fallback to global collection if not found
    if (!evaluatedUser) {
      evaluatedUser = await User.findOne({
        email: { $regex: `^${evaluatedEmailLower}$`, $options: 'i' } }
      );
    }

    // Final fallback: if still not found and we used exact-case DB, retry lowercase DB
    if (!evaluatedUser && company) {
      const lowerModel = getUserModel(company.toLowerCase());
      evaluatedUser = await lowerModel.findOne({
        $or: [
          { email: evaluatedEmailLower },
          { email: { $regex: `^${evaluatedEmailLower}$`, $options: 'i' } }
        ]
      });
      if (evaluatedUser) {
        UserModel = lowerModel;
      }
    }

    if (!evaluatedUser) {
      console.error(`Evaluated user not found: ${evaluatedEmailLower}`);
      throw new Error('User being evaluated not found');
    }

    // Store which company we found the evaluator in, if we found one via fallback
    if (evaluator && !evaluator.companyCode && company) {
      console.log('Setting evaluator company code to:', company);
      evaluator.companyCode = company;
    }
    
    // Create new feedback document in the company database
    const feedback = new FeedbackModel({
      documentType: 'feedback',
      evaluatorId: evaluator._id,
      evaluatorName: evaluator.firstName && evaluator.lastName 
        ? `${evaluator.firstName} ${evaluator.lastName}` 
        : evaluator.username,
      evaluatorEmail: evaluator.email,
      evaluatorInternalRole,
      evaluatedEmail,
      relationshipType,
      ratings,
      topSkills,
      quarter,
      companyCode: evaluator.companyCode || company, // Use company as fallback
      company: company, // Ensure both fields are populated
      // Populate organizationId to satisfy schema (optional)
      organizationId: evaluator.organizationId,
    });

    await feedback.save();

    // Update metrics: first update giver (no reduction), then receiver with potential reduction
    const evaluatorAvg = evaluator.feedbackMetrics?.given?.averageRating || 0;
    await this.updateUserFeedbackMetrics(evaluator.email, company);
    await this.updateUserFeedbackMetrics(evaluatedEmail, company, evaluatorAvg);

    // Read updated user docs via the UserModel to ensure we hit the correct connection
    const updatedGiver = await UserModel.findOne({ email: evaluator.email.toLowerCase() }).lean();
    const updatedReceiver = await UserModel.findOne({ email: evaluatedEmail.toLowerCase() }).lean();
    // Return feedback plus updated users
    return { feedback, updatedGiver, updatedReceiver };
  }

  /**
   * Update feedback metrics for a user and store in user model
   * @param email User email
   * @param company User company
   * @param evaluatorAvgRatingGiven (Optional) Avg rating given by the person *who just submitted feedback* 
   *                              Used ONLY when updating the *evaluated* user to apply the 10% reduction rule.
   */
  async updateUserFeedbackMetrics(
    email: string, 
    company: string, 
    evaluatorAvgRatingGiven?: number
  ) {
    console.log('[feedbackService] updateUserFeedbackMetrics:', { email, company, evaluatorAvgRatingGiven });
    // Connect to company-specific DB and get models
    await connectDB(company);
    const FeedbackModel = getFeedbackModel(company);
    const UserModel = getUserModel(company);
    // Calculate raw metrics
    const metrics = await FeedbackModel.calculateUserFeedbackMetrics(email, company);
    // Apply weighting factors based on relationship type, role, and evaluator's average rating
    let finalWeighted = 0;
    const receivedDocs = await FeedbackModel.find({ documentType: 'feedback', evaluatedEmail: email }).sort({ createdAt: -1 }).lean();
    
    // Create MongoDB connection for the company
    const companyDb = mongoose.connection.useDb(`company_${company.toLowerCase()}`);
    
    if (receivedDocs.length) {
      // Get all evaluators to check their roles
      const evaluatorEmails = receivedDocs.map(fb => fb.evaluatorEmail || '');
      const evaluators = await companyDb.collection('users').find({ email: { $in: evaluatorEmails } }).toArray();
      const evaluatorMap: Record<string, any> = evaluators.reduce((map: Record<string, any>, user: any) => {
        if (user.email) {
          map[user.email.toLowerCase()] = user;
        }
        return map;
      }, {});
      
      let totalWeight = 0;
      let weightedSum = 0;
      
      for (const fb of receivedDocs) {
        // Calculate base rating (average of all rating fields)
        const ratings = fb.ratings || {};
        const ratingValues = Object.values(ratings).map(r => {
          const ratingMap = {
            'Average': 1,
            'Good': 2,
            'Very Good': 3,
            'Excellent': 4,
            'Outstanding': 5
          };
          return ratingMap[r] || 0;
        });
        
        const avgRating = ratingValues.length > 0 ? 
          ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length : 0;
        
        // 1. Relationship type weighting
        let relationshipWeight = 1.0; // direct-reporting (default)
        if (fb.relationshipType === 'project-collaboration') {
          relationshipWeight = 0.9;
        } else if (fb.relationshipType === 'no-connection') {
          relationshipWeight = 0.5;
        }
        
        // 2. Role-based weighting
        let roleWeight = 0.5; // default for lowest tier
        const evaluator = evaluatorMap[fb.evaluatorEmail.toLowerCase()];
        if (evaluator) {
          if (evaluator.role === 'admin' || evaluator.role === 'top_management_tier_1') {
            roleWeight = 1.0;
          } else if (evaluator.role === 'top_management_tier_2') {
            roleWeight = 0.9;
          } else if (evaluator.role === 'top_management_tier_3') {
            roleWeight = 0.8;
          } else if (evaluator.role === 'employee_tier_1') {
            roleWeight = 0.7;
          } else if (evaluator.role === 'employee_tier_2') {
            roleWeight = 0.6;
          }
        }
        
        // 3. Evaluator average rating reduction (if their average given rating is high)
        let evaluatorRatingWeight = 1.0;
        const evaluatorAvgGiven = evaluator?.feedbackMetrics?.given?.averageRating;
        if (evaluatorAvgGiven !== undefined && evaluatorAvgGiven >= 4.5) {
          evaluatorRatingWeight = 0.7; // 30% reduction
        }
        
        // Calculate final weight for this feedback
        const feedbackWeight = relationshipWeight * roleWeight * evaluatorRatingWeight;
        totalWeight += feedbackWeight;
        weightedSum += avgRating * feedbackWeight;
        
        // Store the weighted rating in the feedback document for future reference
        await FeedbackModel.findByIdAndUpdate(fb._id, { 
          weightedRating: avgRating * feedbackWeight,
          baseRating: avgRating,
          relationshipWeight,
          roleWeight,
          evaluatorRatingWeight
        });
      }
      
      finalWeighted = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    // Get current quarter for tracking
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentQuarter = `Q${Math.ceil(currentMonth / 3)}-${currentYear}`;
    
    // Group feedback by quarter for received feedback
    const quarterlyMetrics: Record<string, any> = {};
    const quarterlyGivenMetrics: Record<string, any> = {};
    
    // Process received feedback by quarter
    const receivedByQuarter: Record<string, any[]> = {};
    for (const fb of receivedDocs) {
      const quarter = fb.quarter || 'unknown';
      if (!receivedByQuarter[quarter]) {
        receivedByQuarter[quarter] = [];
      }
      receivedByQuarter[quarter].push(fb);
    }
    
    // Calculate metrics for each quarter
    for (const [quarter, feedbacks] of Object.entries(receivedByQuarter)) {
      let totalRating = 0;
      let totalWeightedRating = 0;
      
      for (const fb of feedbacks) {
        // Use the weighted rating we calculated and stored earlier
        totalWeightedRating += fb.weightedRating || 0;
        
        // For unweighted, use the base rating or calculate from ratings
        if (fb.baseRating) {
          totalRating += fb.baseRating;
        } else {
          const ratings = fb.ratings || {};
          const ratingValues = Object.values(ratings).map((r: any) => {
            const ratingMap: Record<string, number> = {
              'Average': 1,
              'Good': 2,
              'Very Good': 3,
              'Excellent': 4,
              'Outstanding': 5
            };
            return ratingMap[r as string] || 0;
          });
          
          const avgRating = ratingValues.length > 0 ? 
            ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length : 0;
          totalRating += avgRating;
        }
      }
      
      quarterlyMetrics[quarter] = {
        count: feedbacks.length,
        averageRating: feedbacks.length > 0 ? totalRating / feedbacks.length : 0,
        weightedAverageRating: feedbacks.length > 0 ? totalWeightedRating / feedbacks.length : 0
      };
    }
    
    // Process given feedback by quarter
    const givenFeedback = await FeedbackModel.find({ documentType: 'feedback', evaluatorEmail: email }).lean();
    const givenByQuarter: Record<string, any[]> = {};
    
    for (const fb of givenFeedback) {
      const quarter = fb.quarter || 'unknown';
      if (!givenByQuarter[quarter]) {
        givenByQuarter[quarter] = [];
      }
      givenByQuarter[quarter].push(fb);
    }
    
    // Calculate metrics for each quarter for given feedback
    for (const [quarter, feedbacks] of Object.entries(givenByQuarter)) {
      let totalRating = 0;
      
      for (const fb of feedbacks) {
        const ratings = fb.ratings || {};
        const ratingValues = Object.values(ratings).map((r: any) => {
          const ratingMap: Record<string, number> = {
            'Average': 1,
            'Good': 2,
            'Very Good': 3,
            'Excellent': 4,
            'Outstanding': 5
          };
          return ratingMap[r as string] || 0;
        });
        
        const avgRating = ratingValues.length > 0 ? 
          ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length : 0;
        totalRating += avgRating;
      }
      
      quarterlyGivenMetrics[quarter] = {
        count: feedbacks.length,
        averageRating: feedbacks.length > 0 ? totalRating / feedbacks.length : 0
      };
    }
    
    // Prepare update payload
    const update: any = {
      'feedbackMetrics.given.count': metrics.feedbackGiven.count,
      'feedbackMetrics.given.averageRating': metrics.feedbackGiven.averageRating,
      'feedbackMetrics.received.count': metrics.feedbackReceived.count,
      'feedbackMetrics.received.averageRating': metrics.feedbackReceived.averageRating,
      'feedbackMetrics.received.weightedAverageRating': finalWeighted,
      'skillsFeedback.given': metrics.skillsFeedback.given,
      'skillsFeedback.received': metrics.skillsFeedback.received,
      'feedbackMetrics.quarterlyReceived': quarterlyMetrics,
      'feedbackMetrics.quarterlyGiven': quarterlyGivenMetrics,
    };
    console.log('[feedbackService] update payload:', update);
    // Check if the user document has the required fields
    const userDoc = await companyDb.collection('users').findOne({ email: email.toLowerCase() });
    
    // Initialize fields if they don't exist
    if (userDoc && (!userDoc.feedbackMetrics || !userDoc.skillsFeedback)) {
      await companyDb.collection('users').updateOne(
        { email: email.toLowerCase() },
        { $set: {
            feedbackMetrics: userDoc.feedbackMetrics || {
              given: { count: 0, averageRating: 0 },
              received: { count: 0, averageRating: 0, weightedAverageRating: 0 }
            },
            skillsFeedback: userDoc.skillsFeedback || {
              given: [],
              received: []
            }
          }
        }
      );
    }
    
    // Now update with our calculated metrics
    const result = await companyDb.collection('users').updateOne(
      { email: email.toLowerCase() },
      { $set: update },
      { upsert: false }
    );
    
    // Fetch and log the updated document
    const res = await companyDb.collection('users').findOne({ email: email.toLowerCase() });
    console.log('[feedbackService] update result:', res);
    return metrics;
  }

  /**
   * Calculate raw feedback metrics for a user by delegating to the Feedback model
   */
  async calculateUserFeedbackMetrics(email: string, companyCode: string) {
    // Connect and ensure company-specific context
    await connectDB(companyCode);
    const FeedbackModel = getFeedbackModel(companyCode);
    return await FeedbackModel.calculateUserFeedbackMetrics(email, companyCode);
  }

  /**
   * Get feedback submitted by a specific evaluator
   */
  async getFeedbackByEvaluator(evaluatorEmail: string, company: string, quarter?: string) {
    // Connect and query company-specific Feedback model
    await connectDB(company);
    const FeedbackModel = getFeedbackModel(company);
    const query: any = { 
      documentType: 'feedback', 
      evaluatorEmail: { $regex: `^${evaluatorEmail}$`, $options: 'i' },
      $or: [
        { companyCode: { $regex: `^${company}$`, $options: 'i' } },
        { company: { $regex: `^${company}$`, $options: 'i' } }
      ]
    };
    
    if (quarter) {
      query.quarter = quarter;
    }
    
    return await FeedbackModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get all feedback for a specific employee by email
   */
  async getFeedbackForEmployee(evaluatedEmail: string, company: string, quarter?: string) {
    // Connect and query company-specific Feedback model
    await connectDB(company);
    const FeedbackModel = getFeedbackModel(company);
    const query: any = { 
      documentType: 'feedback',
      evaluatedEmail: { $regex: `^${evaluatedEmail}$`, $options: 'i' },
      $or: [
        { companyCode: { $regex: `^${company}$`, $options: 'i' } },
        { company: { $regex: `^${company}$`, $options: 'i' } }
      ]
    };
    
    if (quarter) query.quarter = quarter;
    
    return await FeedbackModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Calculate aggregated score for an employee (primarily reads from User model now)
   */
  async calculateAggregatedScore(evaluatedEmail: string, companyCode: string, quarter?: string) {
    // Connect and query company-specific Feedback model
    await connectDB(companyCode);
    
    // If quarter is specified, we need to calculate on the fly for that specific quarter
    if (quarter) {
        const FeedbackModel = getFeedbackModel(companyCode);
        const query: any = { 
          documentType: 'feedback',
          evaluatedEmail: { $regex: `^${evaluatedEmail}$`, $options: 'i' },
          $or: [
            { companyCode: { $regex: `^${companyCode}$`, $options: 'i' } },
            { company: { $regex: `^${companyCode}$`, $options: 'i' } }
          ],
          quarter: quarter
        };
        const feedbacks = await FeedbackModel.find(query);
        if (feedbacks.length === 0) return null;

        // Simplified: We won't apply the reduction for quarter-specific views for performance.
        const avgReceived = feedbacks.reduce((sum, fb) => sum + (fb.averageRating || 0), 0) / feedbacks.length;
        const weightedAvgReceived = feedbacks.reduce((sum, fb) => sum + (fb.weightedRating || 0), 0) / feedbacks.length;
        const skills = feedbacks.map(fb => fb.topSkills).filter(Boolean);
        
        return {
            count: feedbacks.length,
            averageRating: avgReceived,
            weightedAverageRating: weightedAvgReceived,
            skillsFeedback: { received: skills, given: [] } // Return in expected structure
        };
    }
    
    // Otherwise, get the overall metrics stored in the user profile (case-insensitive)
    const AggUserModel = companyCode ? getUserModel(companyCode) : User;
    const user = await AggUserModel.findOne({ email: { $regex: `^${evaluatedEmail}$`, $options: 'i' } });
    if (!user || !user.feedbackMetrics) {
      // Calculate if needed
      const metrics = await this.calculateUserFeedbackMetrics(evaluatedEmail, companyCode);
      return {
        count: metrics.feedbackReceived.count,
        averageRating: metrics.feedbackReceived.averageRating,
        weightedAverageRating: metrics.feedbackReceived.weightedAverageRating,
        skillsFeedback: metrics.skillsFeedback || { given: [], received: [] }
      };
    }
    
    // Return metrics from user profile
    return {
      count: user.feedbackMetrics.received.count,
      averageRating: user.feedbackMetrics.received.averageRating,
      weightedAverageRating: user.feedbackMetrics.received.weightedAverageRating,
      skillsFeedback: user.skillsFeedback || { given: [], received: [] }
    };
  }

  /**
   * Get current feedback cycle settings
   */
  async getFeedbackCycleSettings(company: string) {
    // Connect and get company-specific settings
    await connectDB(company);
    const FeedbackModel = getFeedbackModel(company);
    let settings = await FeedbackModel.findOne({ 
      documentType: 'settings', 
      $or: [
        { companyCode: { $regex: `^${company}$`, $options: 'i' } },
        { company: { $regex: `^${company}$`, $options: 'i' } }
      ]
    });
    
    if (!settings) {
      // Use create instead of new + save for atomicity
      settings = await FeedbackModel.create({
        documentType: 'settings',
        companyCode: company,
        company: company,
        frequency: 'quarterly',
        lastChanged: new Date()
        // nextChangeAvailable will be set by the API route
      });
    }
    
    return settings;
  }

  /**
   * EMERGENCY: Try to find a user's email in any company database we know about
   * This is a last-resort fallback when the JWT is missing the company code
   */
  private async findUserInAnyCompany(email: string): Promise<any> {
    // List of potential company codes to try (add more as needed)
    const knownCompanies = ['LcowIAVo', 'lcowiavo', 'company1', 'company2'];
    
    for (const companyCode of knownCompanies) {
      try {
        console.log(`Trying to find ${email} in company: ${companyCode}`);
        const CompanyUserModel = getUserModel(companyCode);
        
        const user = await CompanyUserModel.findOne({
          $or: [
            { email: email },
            { email: { $regex: `^${email}$`, $options: 'i' } }
          ]
        });
        
        if (user) {
          console.log(`Found user in company: ${companyCode}`);
          return user;
        }
      } catch (error) {
        console.error(`Error searching in company ${companyCode}:`, error);
        // Continue to next company
      }
    }
    
    console.error(`User not found in any known company: ${email}`);
    return null;
  }
  
  /**
   * Try to determine which company an email belongs to
   */
  private async guessCompanyFromEmail(email: string): Promise<string | null> {
    try {
      // First look in global user collection
      const globalUser = await User.findOne({ 
        email: { $regex: `^${email}$`, $options: 'i' } 
      });
      
      if (globalUser?.companyCode) {
        console.log(`Found company code in global user: ${globalUser.companyCode}`);
        return globalUser.companyCode;
      }
      
      // Otherwise try our last-resort search
      const user = await this.findUserInAnyCompany(email);
      if (user?.companyCode) {
        return user.companyCode;
      }
      
      return null;
    } catch (error) {
      console.error('Error guessing company from email:', error);
      return null;
    }
  }
}

export default new FeedbackService();