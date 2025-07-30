"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function Navigation() {
  const pathname = usePathname()

  return (
    <header className="p-4 border-b border-gray-200 bg-white">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="text-xl font-normal">Montage Generator</div>
        <nav className="flex space-x-6">
          <Link
            href="/"
            className={cn(
              "text-sm font-medium transition-colors hover:text-blue-600",
              pathname === "/" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600",
            )}
          >
            Generator
          </Link>
          <Link
            href="/installation"
            className={cn(
              "text-sm font-medium transition-colors hover:text-blue-600",
              pathname === "/installation" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600",
            )}
          >
            Install Guide
          </Link>
        </nav>
      </div>
    </header>
  )
}
