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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Spinner } from '@/components/ui/spinner';

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
  }).optional(),
  company: z.string().optional(),
  role: z.string().min(1, {
    message: "Role is required.",
  }),
});

const jobProfileSchema = z.object({
  jobTitle: z.string().min(1, {
    message: "Job title is required.",
  }),
  jobResponsibilities: z.string().min(1, {
    message: "Job responsibilities are required.",
  }),
});

const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().default(true).optional(),
  projectUpdates: z.boolean().default(true).optional(),
  teamMessages: z.boolean().default(true).optional(),
  taskReminders: z.boolean().default(true).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required.' }),
  password: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBasicInfoEditing, setIsBasicInfoEditing] = useState(false);
  const [isJobProfileEditing, setIsJobProfileEditing] = useState(false);
  const [isNotificationSettingsEditing, setIsNotificationSettingsEditing] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [activeTab, setActiveTab] = useState("basic-info");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

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
      jobResponsibilities: "",
    },
  });

  const notificationSettingsForm = useForm<z.infer<typeof notificationSettingsSchema>>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailNotifications: true,
      projectUpdates: true,
      teamMessages: true,
      taskReminders: true,
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

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch user data
    const fetchUserProfile = async () => {
      try {
        const response = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile data');
        }

        const userData = await response.json();
        setUser(userData);
        
        // Set form values
        basicInfoForm.reset({
          username: userData.username || "",
          email: userData.email || "",
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          phone: userData.phone || "",
          company: userData.company || "",
          role: userData.role || "employee",
        });

        jobProfileForm.reset({
          jobTitle: userData.jobTitle || "",
          jobResponsibilities: userData.jobResponsibilities || "",
        });

        notificationSettingsForm.reset({
          emailNotifications: userData.emailNotifications ?? true,
          projectUpdates: userData.projectUpdates ?? true,
          teamMessages: userData.teamMessages ?? true,
          taskReminders: userData.taskReminders ?? true,
        });

      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const onBasicInfoSubmit = async (values: z.infer<typeof basicInfoSchema>) => {
    setSaveSuccess("");
    setSaveError("");
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        setSaveError('Failed to update profile. Please try again.');
        return;
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setIsBasicInfoEditing(false);
      setSaveSuccess("Basic info updated successfully!");
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveError("Failed to update basic info. Please try again.");
    }
  };

  const onJobProfileSubmit = async (values: z.infer<typeof jobProfileSchema>) => {
    setSaveSuccess("");
    setSaveError("");
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile/job', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to update job profile');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setIsJobProfileEditing(false);
      setSaveSuccess("Job profile updated successfully!");
    } catch (error) {
      console.error('Error updating job profile:', error);
      setSaveError("Failed to update job profile. Please try again.");
    }
  };

  const onNotificationSettingsSubmit = async (values: z.infer<typeof notificationSettingsSchema>) => {
    setSaveSuccess("");
    setSaveError("");
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification settings');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setIsNotificationSettingsEditing(false);
      setSaveSuccess("Notification settings updated successfully!");
    } catch (error) {
      console.error('Error updating notification settings:', error);
      setSaveError("Failed to update notification settings. Please try again.");
    }
  };

  const onPasswordChangeSubmit = async (values: z.infer<typeof passwordSchema>) => {
    setSaveSuccess("");
    setSaveError("");
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          currentPassword: values.currentPassword, 
          newPassword: values.password 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setSaveError(data.message || 'Failed to change password');
        return;
      }

      setSaveSuccess('Password changed successfully!');
      passwordForm.reset();
    } catch (err) {
      console.error('Error changing password:', err);
      setSaveError('Unable to change password. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <style jsx global>{` input, textarea { color: black !important; } `}</style>
      <div className="container mx-auto py-10 bg-white min-h-screen text-black">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">User Profile</h1>
          <Button variant="default" onClick={() => router.back()}>Close</Button>
        </div>
        
        {saveSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {saveSuccess}
          </div>
        )}
        
        {saveError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {saveError}
          </div>
        )}
        
        <Tabs defaultValue="basic-info" value={activeTab} onValueChange={setActiveTab} className="bg-white rounded-lg shadow">
          <TabsList className="mb-0 grid w-full grid-cols-4 rounded-t-lg bg-gray-50 p-1">
            <TabsTrigger value="basic-info" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Basic Info</TabsTrigger>
            <TabsTrigger value="job-profile" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Job Profile</TabsTrigger>
            <TabsTrigger value="notification-settings" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Notification Settings</TabsTrigger>
            <TabsTrigger value="change-password" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Change Password</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic-info" className="p-6">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl text-gray-800">Basic Information</CardTitle>
                <CardDescription className="text-gray-600">
                  Update your personal information here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...basicInfoForm}>
                  <form id="basic-info-form" onSubmit={basicInfoForm.handleSubmit(onBasicInfoSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={basicInfoForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                disabled={!isBasicInfoEditing} 
                                placeholder="Username" 
                              />
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
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                disabled={!isBasicInfoEditing} 
                                placeholder="Email" 
                                type="email" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={basicInfoForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                disabled={!isBasicInfoEditing} 
                                placeholder="First Name" 
                              />
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
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                disabled={!isBasicInfoEditing} 
                                placeholder="Last Name" 
                              />
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
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                disabled={!isBasicInfoEditing} 
                                placeholder="Phone Number" 
                              />
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
                              <Input 
                                {...field} 
                                disabled={!isBasicInfoEditing} 
                                placeholder="Company" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={basicInfoForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                disabled={true}
                                placeholder="Role" 
                              />
                            </FormControl>
                            <FormDescription className="text-amber-600">
                              Your role can only be changed by an admin.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex justify-between px-0 pb-0">
                {isBasicInfoEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsBasicInfoEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" form="basic-info-form" className="bg-blue-600 hover:bg-blue-700">
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsBasicInfoEditing(true)} className="bg-blue-600 hover:bg-blue-700">
                    Edit Information
                  </Button>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="job-profile" className="p-6">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl text-gray-800">Job Profile</CardTitle>
                <CardDescription className="text-gray-600">
                  Manage your job title and responsibilities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...jobProfileForm}>
                  <form id="job-profile-form" onSubmit={jobProfileForm.handleSubmit(onJobProfileSubmit)} className="space-y-6">
                    <FormField
                      control={jobProfileForm.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              disabled={!isJobProfileEditing} 
                              placeholder="Job Title" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobProfileForm.control}
                      name="jobResponsibilities"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Responsibilities</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              disabled={!isJobProfileEditing} 
                              placeholder="Describe your job responsibilities here..." 
                              className="min-h-[150px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex justify-between px-0 pb-0">
                {isJobProfileEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsJobProfileEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" form="job-profile-form" className="bg-blue-600 hover:bg-blue-700">
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsJobProfileEditing(true)} className="bg-blue-600 hover:bg-blue-700">
                    Edit Job Profile
                  </Button>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="notification-settings" className="p-6">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl text-gray-800">Notification Settings</CardTitle>
                <CardDescription className="text-gray-600">
                  Manage how you receive notifications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationSettingsForm}>
                  <form id="notification-settings-form" onSubmit={notificationSettingsForm.handleSubmit(onNotificationSettingsSubmit)} className="space-y-6">
                    <FormField
                      control={notificationSettingsForm.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(checked) => field.onChange(checked)}
                              disabled={!isNotificationSettingsEditing}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Email Notifications</FormLabel>
                            <FormDescription>
                              Receive notifications via email.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationSettingsForm.control}
                      name="projectUpdates"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(checked) => field.onChange(checked)}
                              disabled={!isNotificationSettingsEditing}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Project Updates</FormLabel>
                            <FormDescription>
                              Receive updates about your projects.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationSettingsForm.control}
                      name="teamMessages"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(checked) => field.onChange(checked)}
                              disabled={!isNotificationSettingsEditing}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Team Messages</FormLabel>
                            <FormDescription>
                              Receive team communication updates.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationSettingsForm.control}
                      name="taskReminders"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(checked) => field.onChange(checked)}
                              disabled={!isNotificationSettingsEditing}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Task Reminders</FormLabel>
                            <FormDescription>
                              Receive reminders about upcoming and overdue tasks.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex justify-between px-0 pb-0">
                {isNotificationSettingsEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsNotificationSettingsEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" form="notification-settings-form" className="bg-blue-600 hover:bg-blue-700">
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsNotificationSettingsEditing(true)} className="bg-blue-600 hover:bg-blue-700">
                    Edit Notification Settings
                  </Button>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="change-password" className="p-6">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl text-gray-800">Change Password</CardTitle>
                <CardDescription className="text-gray-600">Enter current password and choose a new one.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form id="change-password-form" onSubmit={passwordForm.handleSubmit(onPasswordChangeSubmit)} className="space-y-6">
                    <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="Current Password" /></FormControl>
                        <FormMessage />
                      </FormItem>)} />
                    <FormField control={passwordForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="New Password" /></FormControl>
                        <FormMessage />
                      </FormItem>)} />
                    <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="Confirm New Password" /></FormControl>
                        <FormMessage />
                      </FormItem>)} />
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex justify-end px-0 pb-0">
                <Button type="submit" form="change-password-form" className="bg-blue-600 hover:bg-blue-700">Save Password</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
} 