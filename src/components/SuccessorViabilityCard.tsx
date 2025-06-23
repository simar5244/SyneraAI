import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaChevronRight, FaUserCheck, FaUserTimes, FaInfoCircle, FaChartLine, FaShieldAlt, FaBrain, FaProjectDiagram, FaPuzzlePiece } from 'react-icons/fa';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SuccessorViabilityCardProps {
  name: string;
  email?: string;
  score: number;
  isViable: boolean;
  explanation: string;
  viableExplanation?: string;
  strengths?: string[];
  developmentAreas?: string[];
  factorScores?: {
    stabilityIndex?: number;
    projectComplexity?: number;
    cognitiveLoad?: number;
    promotionVelocity?: number;
    competencySimilarity?: number;
    [key: string]: number | undefined;
  };
  factorDetails?: Record<string, any>;
  jobTitle?: string;
  department?: string;
  utilization?: {
    score: number;
  };
  attrition?: {
    score: number;
    risk: string;
  };
  tools?: string;
  skills?: string[];
  responsibilities?: any[];
  onViewDetails: (name: string, scores: any, explanation: string) => void;
}

const SuccessorViabilityCard = ({
  name,
  email,
  score,
  isViable,
  explanation,
  viableExplanation,
  strengths = [],
  developmentAreas = [],
  factorScores = {},
  factorDetails = {},
  jobTitle,
  department,
  utilization,
  attrition,
  tools,
  skills,
  responsibilities,
  onViewDetails
}: SuccessorViabilityCardProps) => {
  const [showDetails, setShowDetails] = useState(false);

  // Format the score as a percentage
  const formattedScore = Math.round(score * 100);
  
  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-700 bg-green-50";
    if (score >= 0.5) return "text-yellow-700 bg-yellow-50";
    return "text-red-700 bg-red-50";
  };

  // Get score text
  const getScoreText = (score: number) => {
    if (score >= 0.7) return "Strong Match";
    if (score >= 0.5) return "Moderate Match";
    return "Weak Match";
  };

  // Get factor icon
  const getFactorIcon = (key: string) => {
    switch(key) {
      case 'stabilityIndex': return <FaShieldAlt className="text-blue-500" />;
      case 'projectComplexity': return <FaProjectDiagram className="text-purple-500" />;
      case 'cognitiveLoad': return <FaBrain className="text-amber-500" />;
      case 'promotionVelocity': return <FaChartLine className="text-green-500" />;
      case 'competencySimilarity': return <FaPuzzlePiece className="text-indigo-500" />;
      default: return <FaInfoCircle className="text-gray-500" />;
    }
  };

  // Get factor name
  const getFactorName = (key: string) => {
    return key.replace(/([A-Z])/g, ' $1').trim();
  };

  // Get factor explanation
  const getFactorExplanation = (key: string) => {
    switch(key) {
      case 'stabilityIndex':
        return "Likelihood to stay with company long-term";
      case 'projectComplexity':
        return "Experience with challenging work";
      case 'cognitiveLoad':
        return "Ability to handle complex demands";
      case 'promotionVelocity':
        return "Career growth trajectory";
      case 'competencySimilarity':
        return "Skill overlap with position";
      default:
        return "Factor measurement";
    }
  };

  return (
    <Card className={`border ${isViable ? 'border-green-200' : 'border-gray-200'} hover:shadow-md transition-shadow`}>
      <CardContent className="p-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-800 text-sm">{name}</h3>
            {jobTitle && <p className="text-xs text-gray-600">{jobTitle}</p>}
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>
          <div className="flex items-center space-x-1">
            <Badge className={`${getScoreColor(score)} border border-gray-200 text-xs h-5 px-1.5`}>
              {formattedScore}%
            </Badge>
            {isViable ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs h-5 px-1.5">
                <FaUserCheck className="mr-1" size={10} />
                Viable
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs h-5 px-1.5">
                <FaUserTimes className="mr-1" size={10} />
                Non-Viable
              </Badge>
            )}
          </div>
        </div>
        
        <div className="mt-1 text-xs text-gray-600 line-clamp-2">
          {explanation}
        </div>
        
        {/* Show more details when button is clicked */}
        {showDetails && (
          <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex flex-wrap gap-2">
              {/* Left column - Utilization & Attrition */}
              <div className="w-full sm:w-1/2 space-y-1">
                {/* Utilization */}
                {utilization && (
                  <div className="flex items-center">
                    <span className="text-xs text-gray-700 mr-1 w-20">Utilization:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full">
                        <div 
                          className={`h-1 rounded-full ${
                            utilization.score >= 0.7 ? 'bg-green-500' : 
                            utilization.score >= 0.3 ? 'bg-yellow-500' : 
                            'bg-red-500'
                          }`} 
                          style={{ width: `${Math.round(utilization.score * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">{Math.round(utilization.score * 100)}%</span>
                    </div>
                  </div>
                )}
                
                {/* Attrition Risk */}
                {attrition && (
                  <div className="flex items-center">
                    <span className="text-xs text-gray-700 mr-1 w-20">Retention:</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full">
                        <div 
                          className={`h-1 rounded-full ${
                            attrition.score <= 0.3 ? 'bg-green-500' : 
                            attrition.score <= 0.6 ? 'bg-yellow-500' : 
                            'bg-red-500'
                          }`} 
                          style={{ width: `${Math.round((1 - attrition.score) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">{Math.round((1 - attrition.score) * 100)}%</span>
                    </div>
                  </div>
                )}
                
                {/* Department */}
                {department && (
                  <div className="text-xs">
                    <span className="text-gray-700">Dept:</span>{' '}
                    <span className="text-gray-900">{department}</span>
                  </div>
                )}
              </div>
              
              {/* Right column - Skills & Tools */}
              <div className="w-full sm:w-1/2">
                {/* Skills */}
                {skills && skills.length > 0 && (
                  <div className="mb-1">
                    <div className="text-xs text-gray-700 mb-0.5">Skills:</div>
                    <div className="flex flex-wrap gap-1">
                      {skills.slice(0, 2).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="bg-blue-50 text-xs py-0 px-1.5">
                          {skill}
                        </Badge>
                      ))}
                      {skills.length > 2 && <span className="text-xs text-gray-500">+{skills.length - 2} more</span>}
                    </div>
                  </div>
                )}
                
                {/* Tools */}
                {tools && (
                  <div className="text-xs">
                    <span className="text-gray-700">Tools:</span>{' '}
                    <span className="text-gray-900 truncate" title={tools}>{tools}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Factor Scores Section */}
            {Object.keys(factorScores).length > 0 && (
              <div className="mt-2">
                <h4 className="text-xs font-medium text-gray-800 mb-1">Match Factors:</h4>
                <div className="space-y-1">
                  {Object.entries(factorScores).slice(0, 3).map(([key, value]) => {
                    if (typeof value !== 'number') return null;
                    const scorePercent = Math.round(value * 100);
                    
                    return (
                      <div key={key} className="flex items-center">
                        <div className="w-4 h-4 mr-1 flex items-center justify-center">
                          {getFactorIcon(key)}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              <span className="text-xs text-gray-700">{getFactorName(key)}</span>
                            </div>
                            <span className={`text-xs ${scorePercent >= 70 ? 'text-green-700' : scorePercent >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>
                              {scorePercent}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className={`h-1 rounded-full ${
                                scorePercent >= 70 ? 'bg-green-500' : 
                                scorePercent >= 50 ? 'bg-yellow-500' : 
                                'bg-red-500'
                              }`} 
                              style={{ width: `${scorePercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-2 flex justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-0 h-6 text-xs"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Quick View'}
          </Button>
          
          <Button 
            size="sm"
            variant="outline"
            className="bg-white text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center h-6 text-xs"
            onClick={() => onViewDetails(name, 
              { ...factorScores, utilization: utilization?.score, attrition: attrition?.score },
              explanation)}
          >
            Profile <FaChevronRight size={10} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SuccessorViabilityCard; 