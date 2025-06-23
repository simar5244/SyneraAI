import { ExampleForm } from "@/components/ExampleForm";

export default function ExampleFormPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Example Form</h1>
        <p className="text-gray-600 mb-6">
          This is an example form built with React Hook Form and our custom Form components.
        </p>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <ExampleForm />
        </div>
      </div>
    </div>
  );
} 