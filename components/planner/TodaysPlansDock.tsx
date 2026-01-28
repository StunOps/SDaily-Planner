'use client'

import { useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { Plan } from '@/lib/types'
import { format } from 'date-fns'
import { formatTimeTo12h } from '@/lib/utils'
import clsx from 'clsx'
import { Check, ChevronDown, ChevronUp, Calendar, X } from 'lucide-react'

interface TodaysPlansDockProps {
    plans: Plan[]
    onPlanClick: (plan: Plan) => void
    onToggleComplete: (planId: string) => void
}

export default function TodaysPlansDock({ plans, onPlanClick, onToggleComplete }: TodaysPlansDockProps) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [isExpanded, setIsExpanded] = useState(true)
    const [isVisible, setIsVisible] = useState(true)

    // Get today's plans
    const todayPlans = plans.filter(plan => {
        const today = format(new Date(), 'yyyy-MM-dd')
        if (plan.date === today) return true
        if (plan.hasDueDate && plan.dueDate) {
            return plan.date <= today && plan.dueDate >= today
        }
        return false
    })

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className={clsx(
                    "fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105",
                    "bg-gradient-to-br from-[#FF9F1C] to-[#F68E09]"
                )}
            >
                <Calendar className="w-6 h-6 text-white" />
                {todayPlans.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {todayPlans.length}
                    </span>
                )}
            </button>
        )
    }

    return (
        <div className={clsx(
            "fixed bottom-6 right-6 z-40 w-80 rounded-2xl shadow-2xl transition-all",
            isDark ? "bg-[#1A1A1A] border border-[#2A2A2A]" : "bg-white border border-[#EFEEEE]"
        )}>
            {/* Header */}
            <div
                className={clsx(
                    "flex items-center justify-between p-4 cursor-pointer rounded-t-2xl",
                    isDark ? "bg-[#2A2A2A]" : "bg-gradient-to-r from-[#FF9F1C] to-[#F68E09]"
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Calendar className={clsx("w-5 h-5", isDark ? "text-[#FF9F1C]" : "text-white")} />
                    <h3 className={clsx(
                        "font-semibold",
                        isDark ? "text-[#F5F5F5]" : "text-white"
                    )}>
                        Today's Plans
                    </h3>
                    {todayPlans.length > 0 && (
                        <span className={clsx(
                            "px-2 py-0.5 text-xs font-bold rounded-full",
                            isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-white/20 text-white"
                        )}>
                            {todayPlans.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsVisible(false)
                        }}
                        className={clsx(
                            "p-1 rounded-lg transition-colors",
                            isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-white/20"
                        )}
                    >
                        <X className={clsx("w-4 h-4", isDark ? "text-gray-400" : "text-white/80")} />
                    </button>
                    {isExpanded ? (
                        <ChevronDown className={clsx("w-5 h-5", isDark ? "text-gray-400" : "text-white")} />
                    ) : (
                        <ChevronUp className={clsx("w-5 h-5", isDark ? "text-gray-400" : "text-white")} />
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 max-h-80 overflow-y-auto">
                    {todayPlans.length === 0 ? (
                        <p className={clsx(
                            "text-sm text-center py-4",
                            isDark ? "text-gray-500" : "text-gray-400"
                        )}>
                            No plans for today 🎉
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {todayPlans.map(plan => (
                                <div
                                    key={plan.id}
                                    onClick={() => onPlanClick(plan)}
                                    className={clsx(
                                        "p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]",
                                        plan.completed
                                            ? (isDark ? "bg-green-900/20 border-green-800" : "bg-green-50 border-green-200")
                                            : (isDark ? "bg-[#2A2A2A] border-[#3A3A3A] hover:border-[#FF9F1C]" : "bg-[#FFFBF5] border-[#EFEEEE] hover:border-[#FF9F1C]")
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onToggleComplete(plan.id)
                                            }}
                                            className={clsx(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                                                plan.completed
                                                    ? "bg-green-500 border-green-500"
                                                    : (isDark ? "border-gray-500 hover:border-[#FF9F1C]" : "border-gray-300 hover:border-[#FF9F1C]")
                                            )}
                                        >
                                            {plan.completed && <Check className="w-3 h-3 text-white" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className={clsx(
                                                "font-medium truncate",
                                                plan.completed && "line-through",
                                                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                            )}>
                                                {plan.title}
                                            </p>
                                            <p className={clsx(
                                                "text-xs",
                                                isDark ? "text-gray-500" : "text-gray-400"
                                            )}>
                                                {plan.hasDueDate
                                                    ? `Due: ${format(new Date(plan.dueDate!), 'MMM d')}`
                                                    : plan.timeSlots && plan.timeSlots.length > 0
                                                        ? plan.timeSlots.map(s => formatTimeTo12h(s.time)).join(', ')
                                                        : 'No time set'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
