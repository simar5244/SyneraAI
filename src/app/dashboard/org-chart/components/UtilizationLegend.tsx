import React from 'react';

const UtilizationLegend: React.FC = () => (
  <div className="utilization-legend p-2 bg-white shadow rounded">
    <h4 className="text-sm font-semibold mb-1">Utilization Legend</h4>
    <div className="flex flex-col gap-1">
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-sm mr-1 bg-red-500 opacity-30"></div>
        <span className="text-xs">Overutilized (&gt;130%)</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-sm mr-1 bg-yellow-500 opacity-30"></div>
        <span className="text-xs">Very High (120-130%)</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-sm mr-1 bg-green-500 opacity-30"></div>
        <span className="text-xs">Optimal (90-100%)</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-sm mr-1 bg-blue-300 opacity-30"></div>
        <span className="text-xs">Moderate (70-90%)</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-sm mr-1 bg-blue-600 opacity-30"></div>
        <span className="text-xs">Low (&lt;70%)</span>
      </div>
    </div>
  </div>
);

export default UtilizationLegend;
