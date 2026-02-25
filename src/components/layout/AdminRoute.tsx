import { useAuth, isAdmin } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (!isAdmin(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
