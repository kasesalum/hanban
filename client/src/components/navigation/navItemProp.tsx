"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

interface NavItemProps {
  label: string;
  href: string;
  icon: ReactNode;
  onClick?: () => void;
  badge?: boolean;
  collapsed?: boolean;
}

export default function NavItem({
  label,
  href,
  icon,
  onClick,
  badge,
  collapsed,
}: NavItemProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = href ? pathname.startsWith(href) : false;

  return (
    <button
      onClick={onClick ?? (() => router.push(href))}
      title={collapsed ? label : undefined}
      className={`relative flex items-center gap-2 py-2 rounded-lg transition
        ${collapsed ? "justify-center px-2" : "px-3"}
        ${
          isActive
            ? "bg-accent text-white hover:bg-accent-hover"
            : "hover:bg-accent-hover text-gray-300"
        }
      `}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
      {badge ? (
        <span
          className={`rounded-full bg-blue-400 ${
            collapsed
              ? "absolute top-1.5 right-1.5 w-1.5 h-1.5"
              : "ml-auto w-2 h-2"
          }`}
        />
      ) : null}
    </button>
  );
}
