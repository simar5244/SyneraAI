export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white border-t border-gray-200 p-4 text-center text-sm text-gray-600">
      <p>© {currentYear} Synera. All rights reserved.</p>
    </footer>
  );
} 