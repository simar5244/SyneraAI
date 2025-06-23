import React from 'react';

type SearchPanelProps = {
  onSearch?: (term: string) => void;
};

const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch }) => {
  const [term, setTerm] = React.useState('');

  const handleSearch = () => {
    onSearch?.(term);
  };

  return (
    <div className="search-panel p-2 bg-white shadow rounded">
      <input
        type="text"
        value={term}
        onChange={e => setTerm(e.target.value)}
        placeholder="Search employee..."
        className="border p-1 rounded w-full"
      />
      <button
        onClick={handleSearch}
        className="mt-2 px-2 py-1 bg-blue-500 text-white rounded"
      >
        Search
      </button>
    </div>
  );
};

export default SearchPanel;
