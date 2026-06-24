import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sun, LogIn, Eye, EyeOff } from "lucide-react";
import { getLoginUrl } from "@/const";

const REMEMBER_KEY = "solar-survey-remember";
const SAVED_USERNAME_KEY = "solar-survey-saved-username";
const SAVED_PASSWORD_KEY = "solar-survey-saved-password";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_KEY) === "true";
    if (remembered) {
      setRememberMe(true);
      const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY) || "";
      const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY) || "";
      setUsername(savedUsername);
      setPassword(savedPassword);
    }
  }, []);

  const loginMutation = trpc.users.login.useMutation({
    onSuccess: (data) => {
      // Save or clear credentials based on Remember Me
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, "true");
        localStorage.setItem(SAVED_USERNAME_KEY, username.trim());
        localStorage.setItem(SAVED_PASSWORD_KEY, password);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(SAVED_USERNAME_KEY);
        localStorage.removeItem(SAVED_PASSWORD_KEY);
      }
      toast.success("เข้าสู่ระบบสำเร็จ");
      // Warehouse users go to installation-prep page
      if (data.user?.role === "warehouse") {
        window.location.href = "/installation-prep";
      } else {
        window.location.href = "/";
      }
    },
    onError: (err) => {
      toast.error(err.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("กรุณากรอกชื่อผู้ใช้");
      return;
    }
    if (!password) {
      toast.error("กรุณากรอกรหัสผ่าน");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  const handleRememberChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(SAVED_USERNAME_KEY);
      localStorage.removeItem(SAVED_PASSWORD_KEY);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo & Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-4 shadow-lg">
            <Sun className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Solar Survey</h1>
          <p className="text-sm text-muted-foreground mt-1">ระบบจัดการงานสำรวจโซล่าเซลล์</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center">เข้าสู่ระบบ</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">ชื่อผู้ใช้</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้"
                  className="mt-1"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="password">รหัสผ่าน</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => handleRememberChange(checked === true)}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm font-normal cursor-pointer select-none text-muted-foreground"
                >
                  จำรหัสผ่าน
                </Label>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  "กำลังเข้าสู่ระบบ..."
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    เข้าสู่ระบบ
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">หรือ</span>
              </div>
            </div>

            {/* Manus OAuth Login */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { window.location.href = getLoginUrl(); }}
            >
              เข้าสู่ระบบด้วย Manus Account
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          หากยังไม่มีบัญชี กรุณาติดต่อแอดมินเพื่อสร้างบัญชีให้
        </p>
      </div>
    </div>
  );
}
