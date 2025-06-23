"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRightIcon, 
  PersonIcon, 
  MixerHorizontalIcon, 
  StackIcon,
  ReloadIcon
} from "@radix-ui/react-icons";

export interface Recommendation {
  id: string;
  type: 'workload_redistribution' | 'team_restructuring' | 'role_optimization';
  title: string;
  description: string;
  impact: {
    efficiency: number;
    cost: number;
    morale: number;
  };
  changes: {
    before: string;
    after: string;
  }[];
}

interface RecommendationPanelProps {
  recommendations: Recommendation[];
  selectedRecommendationId?: string;
  onSelectRecommendation: (id: string) => void;
  onApplyRecommendation: (id: string) => void;
  onRefreshRecommendations: () => void;
  isLoading?: boolean;
}

export default function RecommendationPanel({
  recommendations,
  selectedRecommendationId,
  onSelectRecommendation,
  onApplyRecommendation,
  onRefreshRecommendations,
  isLoading = false
}: RecommendationPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  
  const filteredRecommendations = activeTab === 'all' 
    ? recommendations
    : recommendations.filter(rec => rec.type === activeTab);
  
  // Get the currently selected recommendation details
  const selectedRecommendation = recommendations.find(
    rec => rec.id === selectedRecommendationId
  );
  
  // Helper function to render the type badge
  const renderTypeBadge = (type: Recommendation['type']) => {
    switch(type) {
      case 'workload_redistribution':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Workload</Badge>;
      case 'team_restructuring':
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Structure</Badge>;
      case 'role_optimization':
        return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Roles</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium">AI Recommendations</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefreshRecommendations}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ReloadIcon className="mr-1 h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <ReloadIcon className="mr-1 h-3 w-3" />
              Refresh
            </>
          )}
        </Button>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="workload_redistribution">
            <PersonIcon className="mr-1 h-3 w-3" />
            Workload
          </TabsTrigger>
          <TabsTrigger value="team_restructuring">
            <MixerHorizontalIcon className="mr-1 h-3 w-3" />
            Structure
          </TabsTrigger>
          <TabsTrigger value="role_optimization">
            <StackIcon className="mr-1 h-3 w-3" />
            Roles
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-gray-500 flex flex-col items-center">
            <ReloadIcon className="animate-spin h-6 w-6 mb-2" />
            <p>Analyzing organization structure...</p>
          </div>
        </div>
      ) : (
        <>
          {filteredRecommendations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-gray-500">
                No recommendations available for this category
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 mb-4">
              {filteredRecommendations.map(rec => (
                <Card 
                  key={rec.id}
                  className={`p-3 cursor-pointer transition-all hover:border-blue-300 ${
                    selectedRecommendationId === rec.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => onSelectRecommendation(rec.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm">
                      {rec.title}
                    </div>
                    {renderTypeBadge(rec.type)}
                  </div>
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {rec.description}
                  </p>
                  <div className="flex space-x-3 text-xs">
                    <div className={`flex items-center ${rec.impact.efficiency > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Efficiency: {rec.impact.efficiency > 0 ? '+' : ''}{rec.impact.efficiency}%
                    </div>
                    <div className={`flex items-center ${rec.impact.morale > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Morale: {rec.impact.morale > 0 ? '+' : ''}{rec.impact.morale}%
                    </div>
                    <div className={`flex items-center ${rec.impact.cost <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Cost: {rec.impact.cost > 0 ? '+' : ''}{rec.impact.cost}%
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      
      {selectedRecommendation && (
        <div className="mt-auto">
          <Card className="p-3 bg-gray-50">
            <h4 className="text-sm font-medium mb-2">Apply Recommendation</h4>
            <p className="text-xs text-gray-600 mb-2">
              {selectedRecommendation.description}
            </p>
            <div className="mb-2">
              {selectedRecommendation.changes.map((change, index) => (
                <div key={index} className="text-xs mb-1 flex items-center">
                  <span className="text-gray-600">{change.before}</span>
                  <ArrowRightIcon className="mx-1 h-3 w-3 text-blue-500" />
                  <span className="text-blue-600 font-medium">{change.after}</span>
                </div>
              ))}
            </div>
            <Button 
              className="w-full mt-2"
              size="sm"
              onClick={() => onApplyRecommendation(selectedRecommendation.id)}
            >
              Apply This Recommendation
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
} 