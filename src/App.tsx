import { LogOut } from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { IconButton } from "./components/IconButton";

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-header">
      <Link className="app-header__brand" to="/campaigns">
        Dungeon Manager
      </Link>
      {user && (
        <>
          <div className="app-header__user hover-actions">
            <span className="avatar" aria-hidden="true">
              {user.email[0]}
            </span>
            <IconButton icon={LogOut} label="Log out" onClick={() => void onLogout()} />
          </div>
        </>
      )}
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <Outlet />
    </AuthProvider>
  );
}
