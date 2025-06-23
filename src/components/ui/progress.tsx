import * as React from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({ value, max = 100, className = '', ...props }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      {...props}
      className={`w-full h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-blue-600 transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

Progress.displayName = 'Progress';
export { Progress };
