import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
