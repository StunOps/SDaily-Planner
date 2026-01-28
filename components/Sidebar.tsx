'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, KanbanSquare, Settings } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Board', href: '/board', icon: KanbanSquare },
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-surface border-r border-border p-6 flex flex-col">
            <div className="mb-10 flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">P</span>
                </div>
                <h1 className="text-xl font-bold text-text-main">Planner</h1>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                                isActive
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-text-muted hover:bg-gray-50 hover:text-text-main'
                            )}
                        >
                            <item.icon className={clsx('w-5 h-5', isActive ? 'text-primary' : 'text-text-muted')} />
                            <span>{item.name}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="pt-6 border-t border-border">
                <button className="flex items-center gap-3 px-4 py-3 text-text-muted hover:text-text-main w-full transition-colors">
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                </button>
            </div>
        </aside>
    )
}
