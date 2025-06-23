'use client';

import React from 'react';
import { MoveAnalysis } from './NewOrgSimAIContent';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  analysis?: MoveAnalysis | null;
  title?: string;
  message?: string;
  isDelete?: boolean;
  action?: 'move' | 'delete';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  analysis,
  title = "Confirm Action",
  message = "Are you sure you want to proceed with this action?",
  isDelete = false,
  action = "move"
}) => {
  if (!isOpen || !analysis) return null;

  // Use either the provided action or determine from isDelete
  const actionType = action || (isDelete ? 'delete' : 'move');
  const actionText = actionType === 'move' ? 'Move' : 'Remove';
  const employeeName = analysis.employeeName;
  const destination = analysis.destinationName;

  // Use the close handler or fall back to cancel
  const handleClose = onClose || onCancel;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            {title || `${actionText} ${employeeName}
            ${actionType === 'move' && destination ? ` to report to ${destination}` : ''}`}
          </h3>
        </div>
        
        <div className="px-6 py-4">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Impact Analysis:</h4>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 border border-green-100 rounded-md p-3">
                <h5 className="text-sm font-medium text-green-800 mb-2">Benefits</h5>
                <ul className="list-disc pl-5 text-sm text-green-700 space-y-1">
                  {analysis.pros.map((pro, index) => (
                    <li key={`pro-${index}`}>{pro}</li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-red-50 border border-red-100 rounded-md p-3">
                <h5 className="text-sm font-medium text-red-800 mb-2">Challenges</h5>
                <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                  {analysis.cons.map((con, index) => (
                    <li key={`con-${index}`}>{con}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-md p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overall Workload Impact:</span>
                <span className={`text-sm font-medium ${analysis.workloadChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {analysis.workloadChange > 0 ? '+' : ''}{analysis.workloadChange.toFixed(1)}%
                </span>
              </div>
              
              {analysis.costChange !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cost Impact:</span>
                  <span className={`text-sm font-medium ${analysis.costChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {analysis.costChange > 0 ? '+' : ''}{analysis.costChange.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                actionType === 'move' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Confirm {actionText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal; 