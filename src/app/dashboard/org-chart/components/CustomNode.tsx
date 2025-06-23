import React from 'react';

type CustomNodeProps = any;

const CustomNode: React.FC<CustomNodeProps> = ({ data }) => {
  return (
    <div className="custom-node">
      {data?.label || 'Node'}
    </div>
  );
};

export default CustomNode;
