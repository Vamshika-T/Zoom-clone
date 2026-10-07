"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Grid2X2,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const storedUser =
      localStorage.getItem("auth_user");

    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");

    router.replace("/login");
  }

  const userName = currentUser?.name || "User";
  const userEmail =
    currentUser?.email || "";

  const initial =
    userName.charAt(0).toUpperCase();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
        >
          <span className="text-[24px] font-bold tracking-tight text-[#2D8CFF]">
            Zoom
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <Grid2X2 size={19} />
          </button>

          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <Bell size={19} />
          </button>

          <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <Settings size={19} />
          </button>

          <div className="ml-2 flex items-center gap-2 border-l border-gray-200 pl-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D8CFF] text-sm font-semibold text-white">
              {initial}
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold">
                {userName}
              </p>

              <p className="text-xs text-gray-500">
                {userEmail}
              </p>
            </div>

            <ChevronDown
              size={16}
              className="text-gray-500"
            />

            <button
              type="button"
              onClick={handleLogout}
              className="ml-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}