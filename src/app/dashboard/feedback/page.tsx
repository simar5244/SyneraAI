'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { FaUserFriends, FaComments, FaPaperPlane, FaEnvelope, FaUsers, FaCheckCircle, FaLightbulb, FaChevronDown, FaChevronUp, FaStar, FaRegStar, FaInfoCircle, FaSpinner, FaHistory } from 'react-icons/fa';

// Define types for our form data
type RelationshipType = 'direct-reporting' | 'project-collaboration' | 'no-connection';
type RatingValue = 'Average' | 'Good' | 'Very Good' | 'Excellent' | 'Outstanding';

const ratingOptions: RatingValue[] = ['Average', 'Good', 'Very Good', 'Excellent', 'Outstanding'];

interface FeedbackFormData {
  evaluatedEmail: string;
  relationshipType: RelationshipType;
  ratings: {
    accountability: RatingValue;
    teamContribution: RatingValue;
    adaptability: RatingValue;
    communication: RatingValue;
    confidence: RatingValue;
  };
  topSkills: string;
}

const initialFormState: FeedbackFormData = {
  evaluatedEmail: '',
  relationshipType: 'no-connection',
  ratings: {
    accountability: 'Average',
    teamContribution: 'Average',
    adaptability: 'Average',
    communication: 'Average',
    confidence: 'Average'
  },
  topSkills: ''
};

const ratingCategories = {
  accountability: "Accountability",
  teamContribution: "Team Contribution",
  adaptability: "Adaptability",
  communication: "Communication",
  confidence: "Confidence & Impact"
};

export default function FeedbackEvaluationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FeedbackFormData>(initialFormState);
  const [formStep, setFormStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [recentFeedback, setRecentFeedback] = useState<any[]>([]);
  const [showRecentFeedback, setShowRecentFeedback] = useState<boolean>(false);

  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar { width: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: #E5E7EB; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #A78BFA; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #8B5CF6; }
      .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #A78BFA #E5E7EB; }
      .custom-select-arrow {
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        background-position: right 0.75rem center;
        background-repeat: no-repeat;
        background-size: 1.25em 1.25em;
        padding-right: 2.5rem; /* Make space for the arrow */
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      toast.error('Please log in to access feedback features');
      router.push('/login');
      return;
    }
    fetchRecentFeedback(storedToken);
  }, [router]);

  const fetchRecentFeedback = async (currentToken: string) => {
    try {
      const response = await fetch('/api/feedback?type=given', {
        headers: { 'Authorization': `Bearer ${currentToken}`, 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        setRecentFeedback(data.feedback || []);
      } else {
        toast.error('Failed to load your recent feedback.');
        setRecentFeedback([]);
      }
    } catch (error) {
      console.error('Error fetching recent feedback:', error);
      toast.error('Connection error fetching feedback.');
      setRecentFeedback([]);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.evaluatedEmail || !formData.evaluatedEmail.includes('@')) {
      toast.error('Please enter a valid email address.'); return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication error. Please log in again.');
      router.push('/login'); return;
    }
    setIsSubmitting(true);
    try {
      const userResponse = await fetch('/api/user/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!userResponse.ok) throw new Error('Failed to authenticate current user.');
      const userData = await userResponse.json();
      if (userData.email?.toLowerCase() === formData.evaluatedEmail.toLowerCase()) {
        toast.error('You cannot provide feedback for yourself.');
        setIsSubmitting(false); return;
      }

      const now = new Date();
      const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}-${now.getFullYear()}`;
      
      const allGivenFeedbackResponse = await fetch('/api/feedback?type=given', {
          headers: { 'Authorization': `Bearer ${token}` }
      });

      if (allGivenFeedbackResponse.ok) {
          const allGivenFeedbackData = await allGivenFeedbackResponse.json();
          if (allGivenFeedbackData.feedback && Array.isArray(allGivenFeedbackData.feedback)) {
              const existingFeedback = allGivenFeedbackData.feedback.find((f: any) =>
                  f.evaluatedEmail?.toLowerCase() === formData.evaluatedEmail.toLowerCase() &&
                  f.quarter === quarter
              );
              if (existingFeedback) {
                  toast.error(`You have already provided feedback for ${formData.evaluatedEmail} this quarter (${quarter}).`);
                  setIsSubmitting(false); return;
              }
          } else {
              console.warn("Unexpected response structure from /api/feedback?type=given:", allGivenFeedbackData);
          }
      } else {
          toast.error('Could not verify existing feedback. Please try again.');
          setIsSubmitting(false); return;
      }

      const checkUserExistsResponse = await fetch(`/api/user/check-exists?email=${encodeURIComponent(formData.evaluatedEmail)}`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const userExistsData = await checkUserExistsResponse.json();
      if (checkUserExistsResponse.ok && userExistsData.exists) {
        setFormStep(1);
      } else {
        toast.error('User to be evaluated not found in the system.');
      }
    } catch (error: any) {
      console.error('Error in email submission step:', error);
      toast.error(error.message || 'Error processing your request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormNavigation = (e: React.FormEvent, nextStep?: number) => {
    e.preventDefault();
    if (typeof nextStep === 'number') {
        if (formStep === 1 && !formData.relationshipType) {
            toast.error('Please select your relationship type.'); return;
        }
        if (formStep === 2) {
            const allRated = Object.values(formData.ratings).every(r => ratingOptions.includes(r));
            if (!allRated) {
                toast.error('Please provide all ratings.'); return;
            }
        }
        setFormStep(nextStep);
    } else { // Final submission
        if (!formData.topSkills.trim()) {
          toast.error('Please describe the top skills.'); return;
        }
        submitFinalFeedback();
    }
  };

  const submitFinalFeedback = async () => {
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication error. Please log in.');
      router.push('/login'); setIsSubmitting(false); return;
    }
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        toast.success('Feedback submitted successfully!');
        setFormData(initialFormState);
        setFormStep(0);
        fetchRecentFeedback(token);
        setShowRecentFeedback(true);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to submit feedback.');
        if (response.status === 401) router.push('/login');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('An error occurred during submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRelationshipChange = (value: RelationshipType) => {
    setFormData(prev => ({ ...prev, relationshipType: value }));
  };

  const handleRatingChange = (category: keyof FeedbackFormData['ratings'], value: RatingValue) => {
    setFormData(prev => ({ ...prev, ratings: { ...prev.ratings, [category]: value } }));
  };

  const progressBar = (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
      <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${((formStep + 1) / 4) * 100}%` }}></div>
    </div>
  );

  const renderFormStepContent = () => {
    switch (formStep) {
      case 0:
        return (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label htmlFor="evaluatedEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Employee Email to Evaluate</label>
              <input id="evaluatedEmail" name="evaluatedEmail" type="email" placeholder="e.g., colleague@example.com" value={formData.evaluatedEmail} onChange={handleInputChange} required 
                     className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-800 shadow-sm" />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? <FaSpinner className="animate-spin mr-2" /> : <FaPaperPlane className="mr-2" />} Start Feedback
            </button>
          </form>
        );
      case 1:
        return (
          <form onSubmit={(e) => handleFormNavigation(e, 2)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Relationship with <span className="font-semibold text-purple-700">{formData.evaluatedEmail}</span></label>
              <div className="space-y-3">
                {(['direct-reporting', 'project-collaboration', 'no-connection'] as RelationshipType[]).map(type => (
                  <button key={type} type="button" onClick={() => handleRelationshipChange(type)}
                          className={`w-full text-left p-4 border rounded-lg transition-all duration-150 ease-in-out flex items-center justify-between ${formData.relationshipType === type ? 'bg-purple-600 border-purple-600 text-white shadow-lg ring-2 ring-purple-300' : 'bg-white hover:bg-purple-50 hover:border-purple-400 border-gray-300 text-gray-800'}`}>
                    <span className="font-medium">{type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                    {formData.relationshipType === type && <FaCheckCircle className="text-white h-5 w-5" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setFormStep(0)} className="px-6 py-2.5 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">Back</button>
              <button type="submit" className="px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">Next</button>
            </div>
          </form>
        );
      case 2:
        return (
          <form onSubmit={(e) => handleFormNavigation(e, 3)} className="space-y-6">
            <p className="text-base text-gray-700 mb-1">Rate <span className="font-semibold text-purple-700">{formData.evaluatedEmail}</span> on the following attributes:</p>
            {Object.entries(ratingCategories).map(([key, label]) => (
              <div key={key} className="p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
                <label htmlFor={key} className="block text-sm font-medium text-gray-800 mb-1.5">{label}</label>
                <div className="relative">
                  <select 
                    id={key} 
                    name={key}
                    value={formData.ratings[key as keyof typeof formData.ratings]}
                    onChange={(e) => handleRatingChange(key as keyof typeof formData.ratings, e.target.value as RatingValue)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-800 shadow-sm bg-white custom-select-arrow"
                  >
                    {ratingOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setFormStep(1)} className="px-6 py-2.5 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">Back</button>
              <button type="submit" className="px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">Next</button>
            </div>
          </form>
        );
      case 3:
        return (
          <form onSubmit={(e) => handleFormNavigation(e)} className="space-y-6">
            <div>
              <label htmlFor="topSkills" className="block text-sm font-medium text-gray-700 mb-1.5">Top Skills / Strengths of <span className="font-semibold text-purple-700">{formData.evaluatedEmail}</span></label>
              <textarea id="topSkills" name="topSkills" placeholder="e.g., Excellent problem solver, great communicator, proactive..." value={formData.topSkills} onChange={handleInputChange} rows={5} required 
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-800 shadow-sm resize-y" />
            </div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setFormStep(2)} className="px-6 py-2.5 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">Back</button>
              <button type="submit" disabled={isSubmitting} className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? <FaSpinner className="animate-spin -ml-1 mr-2 h-5 w-5" /> : <FaPaperPlane className="-ml-1 mr-2 h-5 w-5" />} Submit Feedback
              </button>
            </div>
          </form>
        );
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "Invalid Date";
        return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    } catch (e) { return "Invalid Date"; }
  };

  const getStepTitle = () => {
    if (formStep === 0) return "Start New Feedback";
    if (formStep === 1) return `Relationship with ${formData.evaluatedEmail || 'Colleague'}`;
    if (formStep === 2) return `Rate Performance of ${formData.evaluatedEmail || 'Colleague'}`;
    if (formStep === 3) return `Summarize Skills for ${formData.evaluatedEmail || 'Colleague'}`;
    return "Provide Feedback";
  };

  return (
    <div className="relative min-h-screen bg-gray-50 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mt-4">
            Feedback <span className="text-purple-700">Evaluation</span>
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-xl mx-auto">
            Share constructive feedback to foster growth and collaboration within the team.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 md:p-8 mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 text-center mb-2">{getStepTitle()}</h2>
            {progressBar}
          </div>
          {renderFormStepContent()}
        </div>

        {recentFeedback.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 transition-all duration-300 ease-in-out mb-8">
            <button onClick={() => setShowRecentFeedback(!showRecentFeedback)} className="w-full flex justify-between items-center p-4 md:p-5 hover:bg-gray-50 rounded-t-xl focus:outline-none">
              <div className="flex items-center"><FaHistory className="h-5 w-5 text-purple-600 mr-3" /><h2 className="text-lg font-semibold text-gray-700">Recently Given Feedback</h2></div>
              {showRecentFeedback ? <FaChevronUp className="text-purple-600" /> : <FaChevronDown className="text-purple-600" />}
            </button>
            {showRecentFeedback && (
              <div className="p-4 md:p-5 border-t border-gray-200">
                <div className="space-y-3 custom-scrollbar max-h-72 overflow-y-auto pr-2">
                  {recentFeedback.map((fb) => (
                    <div key={fb._id || fb.id} className="p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors duration-150">
                      <div className="text-sm text-purple-800"><span className="font-medium">To:</span> {fb.evaluatedEmail}</div>
                      <div className="text-xs text-gray-700 mt-1">Relationship: <span className="font-medium text-gray-800">{fb.relationshipType?.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'N/A'}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 