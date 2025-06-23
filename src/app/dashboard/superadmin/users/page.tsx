"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FiArrowLeft } from "react-icons/fi";

interface User {
  _id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
}

export default function CompanyUsersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const companyName = params?.get("company") || '';
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyName) return;
    setLoading(true);
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/admin/users?company=${companyName}&role=admin`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch users');
        const data = await res.json();
        setUsers(data.users || data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [companyName]);

  return (
    <div className="container mx-auto py-8">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <FiArrowLeft /> Back to Dashboard
      </Button>
      <h1 className="text-2xl font-semibold mb-4 text-black">Users in {companyName}</h1>
      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-black">Username</TableHead>
                  <TableHead className="text-black">First Name</TableHead>
                  <TableHead className="text-black">Last Name</TableHead>
                  <TableHead className="text-black">Role</TableHead>
                  <TableHead className="text-black">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-black py-4">No users found.</TableCell>
                  </TableRow>
                ) : users.map(user => (
                  <TableRow key={user._id}>
                    <TableCell className="text-black">{user.username}</TableCell>
                    <TableCell className="text-black">{user.firstName}</TableCell>
                    <TableCell className="text-black">{user.lastName}</TableCell>
                    <TableCell className="text-black">{user.role === 'superadmin' ? 'Super Admin' : 'Admin'}</TableCell>
                    <TableCell className="text-black">{user.status || 'active'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
