import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Loader2, ShieldCheck, Users, Store, Bike } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@swiftship.com", password: "Admin@123", icon: ShieldCheck, color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" },
  { role: "Manager", email: "manager@swiftship.com", password: "Manager@123", icon: Users, color: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100" },
  { role: "Vendor", email: "vendor1@swiftship.com", password: "Vendor@123", icon: Store, color: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100" },
  { role: "Rider", email: "rider1@swiftship.com", password: "Rider@123", icon: Bike, color: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: setAuthToken } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuthToken(data.token);
        toast({ title: "Welcome back", description: "Successfully logged in." });
        setLocation("/dashboard");
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: error.message || "Invalid credentials.",
        });
      },
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data });
  };

  const fillCredentials = (email: string, password: string) => {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", password, { shouldValidate: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center">
          <div className="bg-primary p-3 rounded-full mb-4">
            <Truck className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">SwiftShip</h2>
          <p className="mt-1 text-sm text-gray-500">Logistics Management System</p>
        </div>

        {/* Login form */}
        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>Enter your email and password to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...form.register("email")}
                  className={form.formState.errors.email ? "border-red-500" : ""}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register("password")}
                  className={form.formState.errors.password ? "border-red-500" : ""}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-xs text-gray-400">Secure access for authorized personnel only.</p>
          </CardFooter>
        </Card>

        {/* Demo credential quick-fill */}
        <div className="space-y-2">
          <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">Demo Accounts — click to auto-fill</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(({ role, email, password, icon: Icon, color }) => (
              <button
                key={role}
                type="button"
                onClick={() => fillCredentials(email, password)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${color}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{role}</div>
                  <div className="text-[10px] truncate opacity-70">{email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
