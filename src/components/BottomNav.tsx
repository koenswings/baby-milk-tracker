"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconHome({ active }: { active: boolean }) {
  const c = active ? "#60a5fa" : "#94a3b8";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 21V12h6v9" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconLog({ active }: { active: boolean }) {
  const c = active ? "#60a5fa" : "#94a3b8";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.5"/>
      <path d="M12 8v4l2.5 2.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconHistory({ active }: { active: boolean }) {
  const c = active ? "#60a5fa" : "#94a3b8";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6h16M4 12h10M4 18h7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconAnalytics({ active }: { active: boolean }) {
  const c = active ? "#60a5fa" : "#94a3b8";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 17l5-6 4 4 4.5-6 4.5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSettings({ active }: { active: boolean }) {
  const c = active ? "#60a5fa" : "#94a3b8";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.5"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const navItems = [
  { href: "/",          label: "Home",      Icon: IconHome      },
  { href: "/log",       label: "Log",       Icon: IconLog       },
  { href: "/history",   label: "History",   Icon: IconHistory   },
  { href: "/analytics", label: "Analytics", Icon: IconAnalytics },
  { href: "/settings",  label: "Settings",  Icon: IconSettings  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors ${
                active ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <item.Icon active={active} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
