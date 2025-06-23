import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { FaInfoCircle } from 'react-icons/fa';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Map factor names to their documentation
const factorExplanations: { [key: string]: { title: string, description: string } } = {
  responsibilityMismatch: {
    title: "Responsibility Mismatch",
    description: "Detects misalignment between an employee's job title and actual responsibilities, which can lead to frustration and turnover. Higher scores indicate greater misalignment."
  },
  tenureFactor: {
    title: "Tenure Factor",
    description: "Assesses risk based on time with company and in current role, identifying critical periods when employees are most likely to leave. Higher scores indicate higher risk periods."
  },
  utilizationFactor: {
    title: "Utilization Factor",
    description: "Evaluates how employee workload affects retention risk. Both over-utilization and under-utilization increase risk, with optimal utilization around 60%."
  },
  seniorityFactor: {
    title: "Seniority Factor",
    description: "Accounts for how career stage affects turnover patterns. Mid-level employees often have the highest attrition risk as they seek advancement."
  },
  taskVarietyIndex: {
    title: "Task Variety Index",
    description: "Measures job diversity and complexity as they relate to engagement. Moderate variety is optimal, while too little or too much can increase attrition risk."
  },
  jobIntensity: {
    title: "Job Intensity",
    description: "Assesses how job intensity affects burnout risk. High-intensity roles have higher turnover rates, especially when sustained over time."
  },
  roleProjectRatio: {
    title: "Role-Project Ratio",
    description: "Evaluates whether an employee's project load is appropriate for their seniority. Both overloading and underutilization increase attrition risk."
  },
  collaborationIndex: {
    title: "Collaboration Index",
    description: "Measures the strength of workplace relationships and social integration. Lower collaboration scores indicate higher attrition risk due to decreased social binding."
  }
};

// Utility function to determine color based on score
const getScoreColor = (score: number, isInversed: boolean = false) => {
  const normalizedScore = isInversed ? 1 - score : score;
  if (normalizedScore >= 0.8) return 'bg-red-100 text-red-800 border-red-200';
  if (normalizedScore >= 0.6) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (normalizedScore >= 0.4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-green-100 text-green-800 border-green-200';
};

interface AttritionMetricCardProps {
  factorKey: string;
  score: number;
  explanation?: string;
  isInversed?: boolean; // For metrics where lower is better
}

const AttritionMetricCard: React.FC<AttritionMetricCardProps> = ({
  factorKey,
  score,
  explanation,
  isInversed = false
}) => {
  const factorInfo = factorExplanations[factorKey] || {
    title: factorKey.replace(/([A-Z])/g, ' $1').trim(),
    description: "This metric contributes to the overall attrition risk assessment."
  };
  
  const scoreFormatted = Math.round(score * 100);
  const colorClass = getScoreColor(score, isInversed);
  
  return (
    <Card className="overflow-hidden border hover:shadow-sm transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              <h3 className="text-sm font-medium text-gray-700 mr-1">{factorInfo.title}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none">
                      <FaInfoCircle size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px] p-3 bg-white text-gray-800 shadow-lg border rounded-lg">
                    <div className="space-y-2">
                      <p className="text-sm">{factorInfo.description}</p>
                      {explanation && (
                        <div className="border-t pt-2 mt-2">
                          <p className="text-sm italic">{explanation}</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${isInversed ? 'bg-green-600' : 'bg-red-600'}`} 
                style={{ width: `${isInversed ? 100 - scoreFormatted : scoreFormatted}%` }}
              ></div>
            </div>
          </div>
          
          <div 
            className={`ml-3 text-sm font-semibold px-2 py-1 rounded-md ${colorClass}`}
          >
            {scoreFormatted}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttritionMetricCard; 