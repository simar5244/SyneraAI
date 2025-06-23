'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { toast } from "sonner";

const ERPConnectPage: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [erpSystem, setErpSystem] = useState<string>('');
  const [formData, setFormData] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
    apiKey: '',
    tenantId: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleConnect = async () => {
    if (!erpSystem) {
      toast.error("Please select an ERP system");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/erp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: erpSystem,
          ...formData
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        // Redirect to visualization page with connection ID
        router.push(`/erp/visualize?connectionId=${data.connectionId}`);
      } else {
        toast.error(data.message || 'Failed to connect to ERP system');
      }
    } catch (error) {
      console.error('Error connecting to ERP system:', error);
      toast.error('An error occurred while connecting to the ERP system');
    } finally {
      setIsLoading(false);
    }
  };

  const renderConnectionFields = () => {
    switch (erpSystem) {
      case 'SAP_HR':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" name="host" value={formData.host} onChange={handleInputChange} placeholder="e.g., sap.example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" name="port" value={formData.port} onChange={handleInputChange} placeholder="e.g., 8000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" value={formData.username} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} />
            </div>
          </>
        );
      
      case 'WORKDAY':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="tenantId">Tenant ID</Label>
              <Input id="tenantId" name="tenantId" value={formData.tenantId} onChange={handleInputChange} placeholder="e.g., acme_corporation" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" name="apiKey" value={formData.apiKey} onChange={handleInputChange} />
            </div>
          </>
        );
      
      case 'ORACLE':
      case 'PEOPLESOFT':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" name="host" value={formData.host} onChange={handleInputChange} placeholder="e.g., oracle.example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="database">Database</Label>
              <Input id="database" name="database" value={formData.database} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" value={formData.username} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} />
            </div>
          </>
        );
      
      case 'MICROSOFT_AD':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" value={formData.username} onChange={handleInputChange} placeholder="e.g., admin@domain.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} />
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Connect to ERP System</h1>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>ERP Integration</CardTitle>
          <CardDescription>
            Connect to your organization's ERP system to visualize your organizational structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="erp-system">ERP System</Label>
            <Select value={erpSystem} onValueChange={setErpSystem}>
              <SelectTrigger id="erp-system">
                <SelectValue placeholder="Select ERP system" />
              </SelectTrigger>
              <SelectContent>
                {/* Apply text-foreground to ensure text is visible on all backgrounds */}
                <SelectItem value="SAP_HR" className="text-foreground">SAP HR</SelectItem>
                <SelectItem value="PEOPLESOFT" className="text-foreground">PeopleSoft</SelectItem>
                <SelectItem value="MICROSOFT_AD" className="text-foreground">Microsoft Active Directory</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {erpSystem && (
            <div className="space-y-4">
              {renderConnectionFields()}
              
              <Button 
                onClick={handleConnect} 
                className="w-full mt-4" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ERPConnectPage; 