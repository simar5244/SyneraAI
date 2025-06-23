'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'react-hot-toast'; // Changed from sonner to react-hot-toast to match your-reports page
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { User as UserIcon, Briefcase, Bell, Lock, Terminal, LineChart, Loader2, RefreshCcw, Mail, UserCog, Phone, Building } from "lucide-react";
import { FaSpinner } from 'react-icons/fa';
import { useFieldArray } from 'react-hook-form';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const basicInfoSchema = z.object({
  username: z.string().min(3, {
    message: "Username must be at least 3 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  firstName: z.string().min(1, {
    message: "First name is required.",
  }),
  lastName: z.string().min(1, {
    message: "Last name is required.",
  }),
  phone: z.string().min(10, {
    message: "Please enter a valid phone number.",
  }).optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  role: z.string().min(1, {
    message: "Role is required.",
  }),
});

const jobProfileSchema = z.object({
  jobTitle: z.string().min(1, { message: "Job title is required." }),
  jobDuties: z.array(
    z.object({
      duty: z.string().min(1, { message: "Duty is required." }),
      hours: z.number().min(0, { message: "Hours must be >= 0." })
    })
  ).min(1, { message: "At least one duty is required." }),
  toolsProficient: z.string().optional(),
  salary: z.string().optional(),
  totalduration: z.string().optional(),
  currentroleduration: z.string().optional(),
  workMode: z.string().optional(),
  officeLocation: z.string().optional(),
  industry: z.string().optional(),
});

const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().default(true).optional(),
  projectUpdates: z.boolean().default(true).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required.' }),
  password: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});

// Define work mode options
const workModeOptions = [
  { label: "Remote", value: "Remote" },
  { label: "Hybrid", value: "Hybrid" },
  { label: "In-Office", value: "In-Office" }
];

// Define industry options
const industryOptions = [
  { label: "Technology", value: "Technology" },
  { label: "Finance", value: "Finance" },
  { label: "Healthcare", value: "Healthcare" },
  { label: "Education", value: "Education" },
  { label: "Retail", value: "Retail" },
  { label: "Manufacturing", value: "Manufacturing" },
  { label: "Media", value: "Media" },
  { label: "Consulting", value: "Consulting" },
  { label: "Legal", value: "Legal" },
  { label: "Real Estate", value: "Real Estate" },
  { label: "Energy", value: "Energy" },
  { label: "Transportation", value: "Transportation" },
  { label: "Hospitality", value: "Hospitality" },
  { label: "Other", value: "Other" }
];

// Define major city options for office locations
const officeLocationOptions = [
  { label: "New York", value: "New York" },
  { label: "San Francisco", value: "San Francisco" },
  { label: "Los Angeles", value: "Los Angeles" },
  { label: "Chicago", value: "Chicago" },
  { label: "Seattle", value: "Seattle" },
  { label: "Boston", value: "Boston" },
  { label: "Austin", value: "Austin" },
  { label: "Denver", value: "Denver" },
  { label: "Atlanta", value: "Atlanta" },
  { label: "Miami", value: "Miami" },
  { label: "London", value: "London" },
  { label: "Toronto", value: "Toronto" },
  { label: "Berlin", value: "Berlin" },
  { label: "Singapore", value: "Singapore" },
  { label: "Remote Only", value: "Remote Only" },
  { label: "Other", value: "Other" }
];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBasicInfoEditing, setIsBasicInfoEditing] = useState(false);
  const [isJobProfileEditing, setIsJobProfileEditing] = useState(false);
  const [isNotificationSettingsEditing, setIsNotificationSettingsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("basic-info");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  // Show toast notifications when saveSuccess or saveError state changes
  useEffect(() => {
    if (saveSuccess) {
      toast.success(saveSuccess, {
        position: 'top-right',
        duration: 3000,
      });
      setSaveSuccess('');
    }
  }, [saveSuccess]);

  useEffect(() => {
    if (saveError) {
      toast.error(saveError, {
        position: 'top-right',
        duration: 5000,
      });
      setSaveError('');
    }
  }, [saveError]);

  const [extendedProfileData, setExtendedProfileData] = useState<any>(null);
  const [loadingExtendedData, setLoadingExtendedData] = useState(false);

  const basicInfoForm = useForm<z.infer<typeof basicInfoSchema>>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      company: "",
      role: "employee",
    },
  });

  const jobProfileForm = useForm<z.infer<typeof jobProfileSchema>>({
    resolver: zodResolver(jobProfileSchema),
    defaultValues: { 
      jobTitle: "", 
      jobDuties: [{ duty: "", hours: 0 }], 
      toolsProficient: "",
      salary: "",
      totalduration: "",
      currentroleduration: "",
      workMode: "",
      officeLocation: "",
      industry: "",
    },
  });
  const { fields: dutyFields, append: appendDuty, remove: removeDuty } = useFieldArray({ control: jobProfileForm.control, name: 'jobDuties' });

  const notificationSettingsForm = useForm<z.infer<typeof notificationSettingsSchema>>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailNotifications: true,
      projectUpdates: true,
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Define fetchUserData function to be reusable
  const fetchUserData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    try {
      // Get user data from the original /api/profile endpoint
      console.log('Fetching user data from /api/profile');
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Handle errors but don't kick users out unnecessarily
        const errorText = await response.text().catch(() => 'No response text');
        console.error('Profile fetch error:', response.status, errorText);
        
        // Only redirect for auth issues
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login?error=session_expired');
          return;
        }
        
        // For other errors, show a message but don't crash
        setSaveError(`Error loading profile (${response.status}). Please try again later.`);
        setLoading(false);
        return;
      }

      const userData = await response.json();
      console.log('User data from /api/profile:', userData);
      setUser(userData);
      
      basicInfoForm.reset({
        username: userData.username || "",
        email: userData.email || "",
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        phone: userData.phone || "",
        company: userData.company || "",
        role: userData.role || "employee",
      });

      // Use jobTitle and jobResponsibilities from returned data
      jobProfileForm.reset({
        jobTitle: userData.jobTitle || "",
        jobDuties: userData.jobResponsibilities?.map((duty: any) => ({ duty: duty.duty, hours: duty.hours })) || [{ duty: "", hours: 0 }],
        toolsProficient: userData.toolsProficient || "",
        salary: userData.salary || "",
        totalduration: userData.totalduration || "",
        currentroleduration: userData.currentroleduration || "",
        workMode: userData.workMode || "",
        officeLocation: userData.officeLocation || "",
        industry: userData.industry || "",
      });

      notificationSettingsForm.reset({
        emailNotifications: userData.notificationSettings?.email ?? userData.notificationPreferences?.email ?? true,
        projectUpdates: userData.notificationPreferences?.types?.project ?? true,
      });
      
      localStorage.setItem('user', JSON.stringify(userData));

    } catch (error) {
      console.error('Error fetching profile:', error);
      setSaveError("Could not load profile data. Please try logging in again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [router]);

  const onBasicInfoSubmit = async (values: z.infer<typeof basicInfoSchema>) => {
    setSaveSuccess("");
    setSaveError("");
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/profile', { 
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to update profile.' }));
        setSaveError(errorData.message || 'Failed to update profile. Please try again.');
        return;
      }

      const updatedUser = await res.json();
      setUser(updatedUser); 
      localStorage.setItem('user', JSON.stringify(updatedUser)); 
      setIsBasicInfoEditing(false);
      setSaveSuccess("Basic info updated successfully!");
      setTimeout(() => setSaveSuccess(""), 3000); 
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveError("An unexpected error occurred. Please try again.");
    }
  };

  const handleJobProfileSubmit = async (values: z.infer<typeof jobProfileSchema>) => {
    setLoading(true);
    setSaveError("");
    
    try {
      // Convert jobDuties to array of objects
      const jobDuties = values.jobDuties.map(duty => ({
        duty: duty.duty,
        hours: Number(duty.hours)
      }));
      
      // Format updated profile data
      const updatedProfile = {
        jobTitle: values.jobTitle,
        jobResponsibilities: jobDuties,
        toolsProficient: values.toolsProficient,
        salary: values.salary,
        totalduration: values.totalduration,
        currentroleduration: values.currentroleduration,
        workMode: values.workMode,
        officeLocation: values.officeLocation,
        industry: values.industry,
      };
      
      console.log("Submitting job profile update:", updatedProfile);
      
      // Save profile data using the user endpoint
      const token = localStorage.getItem('token');
      const res = await fetch('/api/profile/job', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedProfile)
      });
      
      if (res.ok) {
        setSaveSuccess("Job profile updated successfully.");
        fetchUserData(); // Reload user data to ensure UI is up to date
        setIsJobProfileEditing(false);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to update profile.");
      }
    } catch (err) {
      setSaveError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onNotificationSettingsSubmit = async (values: z.infer<typeof notificationSettingsSchema>) => {
    setSaveSuccess("");
    setSaveError("");
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/profile/notifications', { 
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          notificationPreferences: {
            email: values.emailNotifications,
            browser: user?.notificationPreferences?.browser ?? true, 
            types: {
              system: user?.notificationPreferences?.types?.system ?? true,
              project: values.projectUpdates,
            }
          },
        }),
      });

      if (!res.ok) {
         const errorData = await res.json().catch(() => ({ message: 'Failed to update notifications.' }));
        setSaveError(errorData.message || 'Failed to update notification settings');
        return;
      }

      const updatedUser = await res.json();
      setUser(updatedUser); 
      localStorage.setItem('user', JSON.stringify(updatedUser)); 
      setIsNotificationSettingsEditing(false);
      setSaveSuccess("Notification settings updated successfully!");
       setTimeout(() => setSaveSuccess(""), 3000); 
    } catch (error) {
      console.error('Error updating notification settings:', error);
      setSaveError("An unexpected error occurred. Please try again.");
    }
  };

  const onPasswordChangeSubmit = async (values: z.infer<typeof passwordSchema>) => {
    setSaveSuccess('');
    setSaveError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setSaveError("Authentication token not found. Please log in again.");
      router.push('/login'); // Redirect if no token
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          currentPassword: values.currentPassword,
          newPassword: values.password // Send 'password' as 'newPassword'
        })
      });

      const data = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        // Use the specific error message from the API response
        setSaveError(data.message || 'Failed to change password. Please try again.'); 
        return;
      }

      setSaveSuccess(data.message || 'Password changed successfully!');
      passwordForm.reset({ currentPassword: '', password: '', confirmPassword: '' }); // Clear form on success

    } catch (error) {
      console.error("Password change error:", error);
      setSaveError('An unexpected network or server error occurred.');
    }
  };

  const fetchExtendedProfileData = async () => {
    if (!user?.email) return;
    
    try {
      setLoadingExtendedData(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('Extended profile data:', data);
        setExtendedProfileData(data);
      } else {
        console.error('Failed to fetch extended profile data');
      }
    } catch (error) {
      console.error('Error fetching extended profile data:', error);
    } finally {
      setLoadingExtendedData(false);
    }
  };
  
  useEffect(() => {
    if (user?.email) {
      fetchExtendedProfileData();
    }
  }, [user?.email]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <FaSpinner className="h-12 w-12 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Profile header with avatar */}
      <div className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-white">{user?.firstName} {user?.lastName}</h1>
            <p className="text-white text-lg">{user?.jobTitle || 'Position not set'}</p>
            <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
              {user?.department && <Badge className="bg-white/20 hover:bg-white/30 text-white">{user.department}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-80">
          <Spinner size="lg" />
        </div>
      ) : (
        <Tabs defaultValue="basic-info" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 lg:w-[600px] mx-auto mb-8 p-1 bg-purple-50 rounded-lg">
            <TabsTrigger
              value="basic-info"
              className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm flex items-center justify-center gap-2 text-black"
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Basic Info</span>
            </TabsTrigger>
            <TabsTrigger
              value="job-profile"
              className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm flex items-center justify-center gap-2 text-black"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Job Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm flex items-center justify-center gap-2 text-black"
            >
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* Feedback alerts */}
          {/* Success and error messages are now handled by toast notifications */}

          {/* Basic Info tab */}
          <TabsContent value="basic-info" className="space-y-6">
            <Card className="shadow-md border-purple-100">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <UserIcon className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-black">Basic Information</CardTitle>
                      <CardDescription className="text-black">Manage your personal information</CardDescription>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsBasicInfoEditing(!isBasicInfoEditing)}
                    className="hover:bg-purple-100 text-purple-700"
                  >
                    {isBasicInfoEditing ? 'Cancel' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {isBasicInfoEditing ? (
                  <Form {...basicInfoForm}>
                    <form onSubmit={basicInfoForm.handleSubmit(onBasicInfoSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={basicInfoForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input placeholder="First Name" {...field} className="pl-10 border-purple-200 focus:border-purple-400" />
                                  <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input placeholder="Last Name" {...field} className="pl-10 border-purple-200 focus:border-purple-400" />
                                  <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input placeholder="Email" {...field} className="pl-10 border-purple-200 focus:border-purple-400" />
                                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username <span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input placeholder="Username" {...field} className="pl-10 border-purple-200 focus:border-purple-400" />
                                  <UserCog className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input placeholder="Phone" {...field} className="pl-10 border-purple-200 focus:border-purple-400" />
                                  <Phone className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input placeholder="Company" {...field} className="pl-10 border-purple-200 focus:border-purple-400" />
                                  <Building className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {/* Role field is still in the form but hidden from UI */}
                        <input type="hidden" {...basicInfoForm.register("role")} />
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          className="bg-purple-600 hover:bg-purple-700"
                          disabled={!basicInfoForm.formState.isValid || basicInfoForm.formState.isSubmitting}
                        >
                          {basicInfoForm.formState.isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <UserIcon className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.firstName} {user?.lastName}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Mail className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Email</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.email}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <UserCog className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Username</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.username}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Phone className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.phone || '-'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Company</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.company || '-'}</p>
                      </div>
                      {/* Role field is hidden from UI */}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Profile tab */}
          <TabsContent value="job-profile" className="space-y-6">
            <Card className="shadow-md border-purple-100">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <Briefcase className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-black">Job Profile</CardTitle>
                      <CardDescription className="text-black">Your professional details and responsibilities</CardDescription>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsJobProfileEditing(!isJobProfileEditing)}
                    className="hover:bg-purple-100 text-purple-700"
                  >
                    {isJobProfileEditing ? 'Cancel' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {isJobProfileEditing ? (
                  <Form {...jobProfileForm}>
                    <form onSubmit={jobProfileForm.handleSubmit(handleJobProfileSubmit)} className="space-y-6">
                      <FormField
                        control={jobProfileForm.control}
                        name="jobTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Title <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Software Engineer" className="pl-10 border-purple-200 focus:border-purple-400" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {dutyFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-4">
                          <FormField
                            control={jobProfileForm.control}
                            name={`jobDuties.${index}.duty`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-black">Duty <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="e.g. Team management" className="border-purple-200 focus:border-purple-400 text-black" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={jobProfileForm.control}
                            name={`jobDuties.${index}.hours`}
                            render={({ field }) => (
                              <FormItem className="w-32">
                                <FormLabel className="text-black">Hours/week <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    placeholder="0" 
                                    className="border-purple-200 focus:border-purple-400 text-black"
                                    onChange={e => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="button"
                            size="sm" 
                            className="mt-8 bg-purple-200 hover:bg-purple-300 text-black" 
                            onClick={() => removeDuty(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button 
                        type="button"
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700 text-white" 
                        onClick={() => appendDuty({ duty: "", hours: 0 })}
                      >
                        Add Duty
                      </Button>
                      
                      <FormField
                        control={jobProfileForm.control}
                        name="toolsProficient"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tools Proficient In (comma separated)</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="e.g., Python, JavaScript, Docker, AWS" className="border-purple-200 focus:border-purple-400" />
                            </FormControl>
                            <FormDescription className="text-xs text-gray-500">
                              List the tools and technologies you're proficient with
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Employment information section */}
                      <div className="mt-6 mb-3">
                        <h3 className="text-base font-semibold text-black">Employment Information</h3>
                        <p className="text-xs text-gray-500">Details about your compensation and tenure</p>
                      </div>
                      
                      <FormField
                        control={jobProfileForm.control}
                        name="salary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Salary</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., $75,000/year" className="border-purple-200 focus:border-purple-400" />
                            </FormControl>
                            <FormDescription className="text-xs text-gray-500">
                              Your current compensation
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={jobProfileForm.control}
                        name="totalduration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Time with Company</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., 3 years 6 months" className="border-purple-200 focus:border-purple-400" />
                            </FormControl>
                            <FormDescription className="text-xs text-gray-500">
                              How long have you been with the company
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={jobProfileForm.control}
                        name="currentroleduration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Role Duration</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., 1 year 3 months" className="border-purple-200 focus:border-purple-400" />
                            </FormControl>
                            <FormDescription className="text-xs text-gray-500">
                              How long you've been in your current position
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={jobProfileForm.control}
                        name="workMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Work Mode</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={(value) => field.onChange(value)}
                              >
                                <SelectTrigger className="border-purple-200 focus:border-purple-400 bg-white text-black">
                                  <SelectValue placeholder="Select work mode" />
                                </SelectTrigger>
                                <SelectContent className="bg-white text-black">
                                  {workModeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-black">
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormDescription className="text-xs text-gray-500">
                              Your preferred work mode
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={jobProfileForm.control}
                        name="officeLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Office Location</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter office location" className="border-purple-200 focus:border-purple-400" />
                            </FormControl>
                            <FormDescription className="text-xs text-gray-500">
                              Your current office location
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={jobProfileForm.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Industry</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={(value) => field.onChange(value)}
                              >
                                <SelectTrigger className="border-purple-200 focus:border-purple-400 bg-white text-black">
                                  <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                                <SelectContent className="bg-white text-black">
                                  {industryOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-black">
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormDescription className="text-xs text-gray-500">
                              Your current industry
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end mt-8">
                        <Button 
                          type="submit" 
                          className="bg-purple-600 hover:bg-purple-700"
                          disabled={jobProfileForm.formState.isSubmitting}
                        >
                          {jobProfileForm.formState.isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Job Title</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.jobTitle || '-'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Total Time with Company</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.totalduration || '-'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Current Role Duration</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.currentroleduration || '-'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Work Mode</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.workMode || '-'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Office Location</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.officeLocation || '-'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-purple-500 mr-2" />
                          <h3 className="text-sm font-medium text-gray-500">Industry</h3>
                        </div>
                        <p className="text-base font-medium text-gray-900 pl-7">{user?.industry || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security tab (the Password tab renamed) */}
          <TabsContent value="security" className="space-y-6">
            <Card className="shadow-md border-purple-100">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <Lock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-black">Security Settings</CardTitle>
                    <CardDescription className="text-black">Manage your password and security preferences</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordChangeSubmit)} className="space-y-6">
                    <FormField 
                      control={passwordForm.control} 
                      name="currentPassword" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input {...field} type="password" placeholder="Enter your current password" className="pl-10 border-purple-200 focus:border-purple-400" />
                              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={passwordForm.control} 
                      name="password" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input {...field} type="password" placeholder="Enter a new password" className="pl-10 border-purple-200 focus:border-purple-400" />
                              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                            </div>
                          </FormControl>
                          <FormDescription className="text-xs text-gray-500">
                            Must be at least 6 characters long.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={passwordForm.control} 
                      name="confirmPassword" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input {...field} type="password" placeholder="Confirm your new password" className="pl-10 border-purple-200 focus:border-purple-400" />
                              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-purple-500" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={passwordForm.formState.isSubmitting}
                      >
                        {passwordForm.formState.isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          'Update Password'
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
} 