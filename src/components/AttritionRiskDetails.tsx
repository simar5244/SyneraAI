import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import AttritionMetricCard from './AttritionMetricCard';

interface AttritionFactor {
  factor: string;
  score: number;
  explanation: string;
}

interface FactorScores {
  responsibilityMismatch: number;
  tenureFactor: number;
  utilizationFactor: number;
  seniorityFactor: number;
  taskVarietyIndex: number;
  jobIntensity: number;
  roleProjectRatio: number;
  collaborationIndex: number;
}

interface AttritionRiskDetailsProps {
  attritionScore: number;
  attritionRisk: string;
  primaryExplanation: string;
  primaryRiskFactors: AttritionFactor[];
  factorScores: FactorScores;
  factorDetails?: Record<string, any>;
  className?: string;
}

// Function to get color based on risk level
const getRiskLevelColor = (risk: string) => {
  switch (risk.toLowerCase()) {
    case 'very_high':
    case 'very high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'very_low':
    case 'very low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Function to format risk level for display
const formatRiskLevel = (risk: string) => {
  return risk.toLowerCase().replace('_', ' ').split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const AttritionRiskDetails: React.FC<AttritionRiskDetailsProps> = ({
  attritionScore,
  attritionRisk,
  primaryExplanation,
  primaryRiskFactors,
  factorScores,
  factorDetails = {},
  className = ''
}) => {
  // Get explanations from factor details if available
  const getExplanation = (key: string) => {
    if (!factorDetails) return "";
    
    // Try to find explanation in the factor details
    const detailKey = key
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
    
    const detail = factorDetails[detailKey] || factorDetails[key];
    
    return detail?.explanation || "";
  };
  
  const scoreFormatted = Math.round(attritionScore * 100);
  const riskColor = getRiskLevelColor(attritionRisk);
  const formattedRiskLevel = formatRiskLevel(attritionRisk);
  
  return (
    <div className={className}>
      <Card className="border shadow-sm overflow-hidden mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-gray-900 flex items-center">
            <FaExclamationTriangle className="text-amber-500 mr-2" size={16} />
            Attrition Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center">
                <h3 className="font-medium text-gray-800 mr-2">Overall Risk:</h3>
                <Badge className={`${riskColor}`}>{formattedRiskLevel} - {scoreFormatted}%</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">{primaryExplanation}</p>
            </div>
          </div>
          
          {primaryRiskFactors.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Primary Risk Factors:</h3>
              <div className="space-y-2">
                {primaryRiskFactors.map((factor, index) => (
                  <div key={index} className="flex items-start">
                    <FaInfoCircle className="text-amber-500 mt-0.5 mr-2" size={14} />
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        {factor.factor.replace(/_/g, ' ')} ({Math.round(factor.score * 100)}%)
                      </span>
                      <p className="text-sm text-gray-600">{factor.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <h3 className="text-sm font-medium text-gray-700 mb-3">Risk Factor Breakdown:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AttritionMetricCard 
              factorKey="responsibilityMismatch" 
              score={factorScores.responsibilityMismatch}
              explanation={getExplanation('responsibilityMismatch')}
            />
            <AttritionMetricCard 
              factorKey="tenureFactor" 
              score={factorScores.tenureFactor}
              explanation={getExplanation('tenureFactor')}
            />
            <AttritionMetricCard 
              factorKey="utilizationFactor" 
              score={factorScores.utilizationFactor}
              explanation={getExplanation('utilizationFactor')}
            />
            <AttritionMetricCard 
              factorKey="seniorityFactor" 
              score={factorScores.seniorityFactor}
              explanation={getExplanation('seniorityFactor')}
            />
            <AttritionMetricCard 
              factorKey="taskVarietyIndex" 
              score={factorScores.taskVarietyIndex}
              isInversed={true} // For this factor, lower is worse (lack of variety)
              explanation={getExplanation('taskVarietyIndex')}
            />
            <AttritionMetricCard 
              factorKey="jobIntensity" 
              score={factorScores.jobIntensity}
              explanation={getExplanation('jobIntensity')}
            />
            <AttritionMetricCard 
              factorKey="roleProjectRatio" 
              score={factorScores.roleProjectRatio}
              explanation={getExplanation('roleProjectRatio')}
            />
            <AttritionMetricCard 
              factorKey="collaborationIndex" 
              score={factorScores.collaborationIndex}
              explanation={getExplanation('collaborationIndex')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttritionRiskDetails; 