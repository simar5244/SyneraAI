'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { FaProjectDiagram, FaUsers, FaChartBar } from "react-icons/fa";

export default function Dashboard() {
  const router = useRouter();
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Organization Chart Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2">
              <FaProjectDiagram className="text-blue-500" />
              Organization Chart
            </CardTitle>
            <CardDescription>
              Interactive visualization of company structure
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600 mb-4">
              View, edit and manage your organizational hierarchy. Visualize reporting structure, 
              department groupings, and employee workload distribution.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => router.push('/dashboard/org-chart')}>
              Open Organization Chart
            </Button>
          </CardFooter>
        </Card>
        
        {/* Employees Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="bg-purple-50">
            <CardTitle className="flex items-center gap-2">
              <FaUsers className="text-purple-500" />
              Employees
            </CardTitle>
            <CardDescription>
              Manage employee information
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600 mb-4">
              View and manage employee profiles, skills, performance metrics, 
              and other related information.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard/employees')}>
              Manage Employees
            </Button>
          </CardFooter>
        </Card>
        
        {/* Analytics Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="bg-green-50">
            <CardTitle className="flex items-center gap-2">
              <FaChartBar className="text-green-500" />
              Analytics
            </CardTitle>
            <CardDescription>
              Workforce insights and metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600 mb-4">
              View analytics on workforce utilization, department performance, 
              attrition risk, and other key metrics.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard/analytics')}>
              View Analytics
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 