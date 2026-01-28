'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import {
    LayoutDashboard,
    Calendar,
    Layers,
    Target,
    Wallet,
    Sun,
    Moon
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Planner', href: '/planner', icon: Calendar },
    { name: 'Cards', href: '/cards', icon: Layers },
    { name: 'Goals', href: '/goals', icon: Target },
    { name: 'Revenue', href: '/revenue', icon: Wallet },
]

export default function Navbar() {
    const pathname = usePathname()
    const { theme, toggleTheme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <header
            className={clsx(
                "fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur-xl border-b transition-colors duration-300",
                isDark
                    ? "bg-[#1A1A1A]/90 border-[#2A2A2A]"
                    : "bg-white/90 border-[#EFEEEE]"
            )}
        >
            <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <img
                        src="/images/Logo Only (White).jpg"
                        alt="SDaily Logo"
                        className="w-9 h-9 rounded-xl object-cover shadow-md"
                    />
                    <span className={clsx(
                        "text-xl font-bold transition-colors",
                        isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                    )}>
                        SDaily Planner
                    </span>
                </div>

                {/* Navigation Links */}
                <nav className={clsx(
                    "flex items-center gap-1 rounded-full p-1 transition-colors",
                    isDark ? "bg-gray-800/50" : "bg-gray-100/80"
                )}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={clsx(
                                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? isDark
                                            ? 'bg-gray-700 text-[#FF9F1C] shadow-sm'
                                            : 'bg-white text-[#FF9F1C] shadow-sm'
                                        : isDark
                                            ? 'text-gray-400 hover:text-gray-200'
                                            : 'text-gray-500 hover:text-gray-800'
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                <span className="hidden md:inline">{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Right Side - Theme Toggle & Profile */}
                <div className="flex items-center gap-4">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className={clsx(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            isDark
                                ? "bg-gray-800 hover:bg-gray-700"
                                : "bg-gray-100 hover:bg-gray-200"
                        )}
                        aria-label="Toggle theme"
                    >
                        {isDark ? (
                            <Sun className="w-5 h-5 text-yellow-400" />
                        ) : (
                            <Moon className="w-5 h-5 text-gray-500" />
                        )}
                    </button>

                    {/* Profile */}
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className={clsx(
                                "text-sm font-semibold",
                                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                            )}>
                                Stun
                            </p>
                            <p className={clsx(
                                "text-xs",
                                isDark ? "text-gray-500" : "text-gray-400"
                            )}>
                                SD Owner
                            </p>
                        </div>
                        <img
                            src="/images/Me.jpg"
                            alt="Profile"
                            className="w-10 h-10 rounded-full object-cover border-2 border-[#FF9F1C] shadow-md"
                        />
                    </div>
                </div>
            </div>
        </header>
    )
}
