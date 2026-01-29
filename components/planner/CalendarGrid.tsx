'use client'

import { useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    parseISO
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, CalendarDays, X } from 'lucide-react'
import clsx from 'clsx'
import { Plan } from '@/lib/types'
import { isOverdue } from '@/lib/utils'

type CalendarView = 'day' | 'week' | 'month'

interface CalendarGridProps {
    plans: Plan[]
    onDateClick: (date: Date) => void
    onPlanClick?: (plan: Plan) => void
    view?: CalendarView
}

export default function CalendarGrid({ plans, onDateClick, onPlanClick, view = 'month' }: CalendarGridProps) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [currentDate, setCurrentDate] = useState(new Date())
    const [expandedDate, setExpandedDate] = useState<Date | null>(null)

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const weekStart = startOfWeek(currentDate)
    const weekEnd = endOfWeek(currentDate)

    // Get days based on view
    const getDays = () => {
        switch (view) {
            case 'day':
                return [currentDate]
            case 'week':
                return eachDayOfInterval({ start: weekStart, end: weekEnd })
            case 'month':
            default:
                const startDate = startOfWeek(monthStart)
                const endDate = endOfWeek(monthEnd)
                return eachDayOfInterval({ start: startDate, end: endDate })
        }
    }

    const days = getDays()
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Navigation based on view
    const goNext = () => {
        switch (view) {
            case 'day':
                setCurrentDate(addDays(currentDate, 1))
                break
            case 'week':
                setCurrentDate(addWeeks(currentDate, 1))
                break
            case 'month':
            default:
                setCurrentDate(addMonths(currentDate, 1))
        }
    }

    const goPrev = () => {
        switch (view) {
            case 'day':
                setCurrentDate(subDays(currentDate, 1))
                break
            case 'week':
                setCurrentDate(subWeeks(currentDate, 1))
                break
            case 'month':
            default:
                setCurrentDate(subMonths(currentDate, 1))
        }
    }

    const resetToday = () => setCurrentDate(new Date())

    // Get header text based on view
    const getHeaderText = () => {
        switch (view) {
            case 'day':
                return format(currentDate, 'EEEE, MMMM d, yyyy')
            case 'week':
                return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
            case 'month':
            default:
                return format(currentDate, 'MMMM yyyy')
        }
    }

    // Get plans for a specific date
    const getPlansForDate = (date: Date): Plan[] => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return plans.filter(plan => {
            if (plan.date === dateStr) return true
            if (plan.hasDueDate && plan.dueDate) {
                const startDate = parseISO(plan.date)
                const dueDate = parseISO(plan.dueDate)
                return date >= startDate && date <= dueDate
            }
            return false
        })
    }

    // Time slots for day/week view
    const timeSlots = Array.from({ length: 12 }, (_, i) => i + 7) // 7 AM to 6 PM

    return (
        <div className={clsx(
            "rounded-2xl shadow-sm border flex flex-col transition-colors",
            isDark
                ? "bg-[#1A1A1A] border-[#2A2A2A]"
                : "bg-white border-[#EFEEEE]"
        )}>
            {/* Header */}
            <div className={clsx(
                "p-6 flex items-center justify-between border-b transition-colors",
                isDark ? "border-[#2A2A2A]" : "border-[#EFEEEE]"
            )}>
                <div className="flex items-center gap-4">
                    <h2 className={clsx(
                        "text-2xl font-bold",
                        isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                    )}>
                        {getHeaderText()}
                    </h2>
                    <div className={clsx(
                        "flex items-center gap-1 rounded-lg p-1 border",
                        isDark
                            ? "bg-[#2A2A2A] border-[#3A3A3A]"
                            : "bg-gray-50 border-gray-200"
                    )}>
                        <button
                            onClick={goPrev}
                            className={clsx(
                                "p-1 rounded-md transition-all",
                                isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-white hover:shadow-sm"
                            )}
                        >
                            <ChevronLeft className={clsx("w-5 h-5", isDark ? "text-gray-400" : "text-gray-600")} />
                        </button>
                        <button
                            onClick={resetToday}
                            className={clsx(
                                "px-3 py-1 text-sm font-medium hover:text-[#FF9F1C]",
                                isDark ? "text-gray-400" : "text-gray-600"
                            )}
                        >
                            Today
                        </button>
                        <button
                            onClick={goNext}
                            className={clsx(
                                "p-1 rounded-md transition-all",
                                isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-white hover:shadow-sm"
                            )}
                        >
                            <ChevronRight className={clsx("w-5 h-5", isDark ? "text-gray-400" : "text-gray-600")} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Day View */}
            {view === 'day' && (
                <div className="flex flex-col">
                    {/* Day header */}
                    <div className={clsx(
                        "p-4 text-center border-b",
                        isDark ? "bg-[#0F0F0F] border-[#2A2A2A]" : "bg-gray-50 border-[#EFEEEE]"
                    )}>
                        <p className={clsx(
                            "text-sm font-semibold",
                            isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                        )}>
                            {format(currentDate, 'EEEE')}
                        </p>
                        <p className={clsx(
                            "text-3xl font-bold mt-1",
                            isSameDay(currentDate, new Date())
                                ? "text-[#FF9F1C]"
                                : isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                        )}>
                            {format(currentDate, 'd')}
                        </p>
                    </div>
                    {/* Time slots */}
                    <div className="flex-1 max-h-[500px] overflow-y-auto">
                        {timeSlots.map(hour => {
                            const dayPlans = getPlansForDate(currentDate)
                            const plansAtHour = dayPlans.filter(plan => {
                                if (plan.timeSlots) {
                                    return plan.timeSlots.some(slot => {
                                        const slotHour = parseInt(slot.time.split(':')[0])
                                        return slotHour === hour
                                    })
                                }
                                return false
                            })

                            return (
                                <div
                                    key={hour}
                                    onClick={() => onDateClick(currentDate)}
                                    className={clsx(
                                        "flex border-b min-h-[60px] cursor-pointer transition-colors",
                                        isDark ? "border-[#2A2A2A] hover:bg-[#2A2A2A]/30" : "border-[#EFEEEE] hover:bg-orange-50/30"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-20 p-2 text-sm text-right border-r flex-shrink-0",
                                        isDark ? "text-gray-500 border-[#2A2A2A]" : "text-gray-400 border-[#EFEEEE]"
                                    )}>
                                        {format(new Date().setHours(hour, 0), 'h a')}
                                    </div>
                                    <div className="flex-1 p-2 space-y-1">
                                        {plansAtHour.map(plan => (
                                            <div
                                                key={plan.id}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onPlanClick?.(plan)
                                                }}
                                                className={clsx(
                                                    "text-sm px-3 py-2 rounded-lg border cursor-pointer",
                                                    plan.completed
                                                        ? (isDark ? "bg-green-900/30 border-green-800 text-green-400 line-through" : "bg-green-50 border-green-200 text-green-600 line-through")
                                                        : isOverdue(plan.date, plan.dueDate, plan.completed)
                                                            ? (isDark ? "bg-red-900/30 border-red-800 text-red-400" : "bg-red-100 border-red-400 text-red-700")
                                                            : (isDark ? "bg-[#FF9F1C]/20 border-[#FF9F1C]/30 text-[#FF9F1C]" : "bg-[#FFF2E0] border-[#FFD699] text-[#CC7A00]")
                                                )}
                                            >
                                                {plan.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Week View */}
            {view === 'week' && (
                <>
                    {/* Weekday Headers */}
                    <div className={clsx(
                        "grid grid-cols-7 border-b",
                        isDark ? "bg-[#0F0F0F] border-[#2A2A2A]" : "bg-gray-50 border-[#EFEEEE]"
                    )}>
                        {days.map(day => (
                            <div
                                key={day.toString()}
                                className={clsx(
                                    "py-3 text-center border-r last:border-r-0",
                                    isDark ? "border-[#2A2A2A]" : "border-[#EFEEEE]"
                                )}
                            >
                                <p className={clsx(
                                    "text-xs font-semibold",
                                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                                )}>
                                    {format(day, 'EEE')}
                                </p>
                                <p className={clsx(
                                    "text-lg font-bold mt-1",
                                    isSameDay(day, new Date())
                                        ? "text-[#FF9F1C]"
                                        : isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                )}>
                                    {format(day, 'd')}
                                </p>
                            </div>
                        ))}
                    </div>
                    {/* Week Grid */}
                    <div className="grid grid-cols-7 flex-1 min-h-[400px]">
                        {days.map(day => {
                            const isToday = isSameDay(day, new Date())
                            const dayPlans = getPlansForDate(day)

                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => onDateClick(day)}
                                    className={clsx(
                                        "border-r last:border-r-0 p-2 cursor-pointer transition-colors",
                                        isDark ? "border-[#2A2A2A] hover:bg-[#2A2A2A]/50" : "border-[#EFEEEE] hover:bg-orange-50/30",
                                        isToday && (isDark ? 'bg-[#FF9F1C]/10' : 'bg-orange-50')
                                    )}
                                >
                                    <div className="space-y-1">
                                        {dayPlans.map(plan => (
                                            <div
                                                key={plan.id}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onPlanClick?.(plan)
                                                }}
                                                className={clsx(
                                                    "text-xs px-2 py-1.5 rounded-md border cursor-pointer",
                                                    plan.completed
                                                        ? (isDark ? "bg-green-900/30 border-green-800 text-green-400 line-through" : "bg-green-50 border-green-200 text-green-600 line-through")
                                                        : isOverdue(plan.date, plan.dueDate, plan.completed)
                                                            ? (isDark ? "bg-red-900/30 border-red-800 text-red-400" : "bg-red-100 border-red-400 text-red-700")
                                                            : plan.hasDueDate
                                                                ? (isDark ? "bg-blue-900/30 border-blue-800 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600")
                                                                : (isDark ? "bg-[#FF9F1C]/20 border-[#FF9F1C]/30 text-[#FF9F1C]" : "bg-[#FFF2E0] border-[#FFD699] text-[#CC7A00]")
                                                )}
                                            >
                                                <span className="truncate block">{plan.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {/* Month View */}
            {view === 'month' && (
                <>
                    {/* Weekday Headers */}
                    <div className={clsx(
                        "grid grid-cols-7 border-b",
                        isDark ? "bg-[#0F0F0F] border-[#2A2A2A]" : "bg-gray-50 border-[#EFEEEE]"
                    )}>
                        {weekDays.map(day => (
                            <div
                                key={day}
                                className={clsx(
                                    "py-3 text-center text-sm font-semibold",
                                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                                )}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 flex-1">
                        {days.map((day) => {
                            const isCurrentMonth = isSameMonth(day, monthStart)
                            const isToday = isSameDay(day, new Date())
                            const dayPlans = getPlansForDate(day)

                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => onDateClick(day)}
                                    className={clsx(
                                        'min-h-[120px] border-b border-r p-2 transition-colors cursor-pointer flex flex-col',
                                        isDark
                                            ? 'border-[#2A2A2A] hover:bg-[#2A2A2A]/50'
                                            : 'border-[#EFEEEE] hover:bg-orange-50/30',
                                        !isCurrentMonth && (isDark ? 'bg-[#0F0F0F]/50 text-gray-600' : 'bg-gray-50/50 text-gray-400'),
                                        isToday && (isDark ? 'bg-[#FF9F1C]/10' : 'bg-orange-50')
                                    )}
                                >
                                    {/* Day Number */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={clsx(
                                            'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0',
                                            isToday
                                                ? 'bg-[#FF9F1C] text-white shadow-md'
                                                : isCurrentMonth
                                                    ? (isDark ? 'text-[#F5F5F5]' : 'text-[#2D3436]')
                                                    : 'text-gray-400'
                                        )}>
                                            {format(day, 'd')}
                                        </span>
                                        {dayPlans.length > 0 && (
                                            <span className={clsx(
                                                "text-xs px-1.5 py-0.5 rounded-full flex-shrink-0",
                                                isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FF9F1C]/10 text-[#FF9F1C]"
                                            )}>
                                                {dayPlans.length}
                                            </span>
                                        )}
                                    </div>

                                    {/* Plans for this day */}
                                    <div className="flex-1 space-y-1 overflow-y-auto">
                                        {dayPlans.slice(0, 3).map((plan) => (
                                            <div
                                                key={plan.id}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onPlanClick?.(plan)
                                                }}
                                                className={clsx(
                                                    "text-xs px-2 py-1.5 rounded-md border cursor-pointer transition-colors",
                                                    plan.completed
                                                        ? (isDark ? "bg-green-900/30 border-green-800 text-green-400 line-through" : "bg-green-50 border-green-200 text-green-600 line-through")
                                                        : isOverdue(plan.date, plan.dueDate, plan.completed)
                                                            ? (isDark ? "bg-red-900/30 border-red-800 text-red-400" : "bg-red-100 border-red-400 text-red-700")
                                                            : plan.hasDueDate
                                                                ? (isDark ? "bg-blue-900/30 border-blue-800 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600")
                                                                : (isDark ? "bg-[#FF9F1C]/20 border-[#FF9F1C]/30 text-[#FF9F1C]" : "bg-[#FFF2E0] border-[#FFD699] text-[#CC7A00]")
                                                )}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {plan.hasDueDate ? (
                                                        <CalendarDays className="w-3 h-3 flex-shrink-0" />
                                                    ) : (
                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                    )}
                                                    <span className="truncate">{plan.title}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {dayPlans.length > 3 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setExpandedDate(day)
                                                }}
                                                className={clsx(
                                                    "text-xs px-2 py-0.5 rounded cursor-pointer w-full text-left transition-colors",
                                                    isDark ? "text-gray-400 hover:bg-[#2A2A2A] hover:text-[#F5F5F5]" : "text-gray-500 hover:bg-orange-100 hover:text-[#2D3436]"
                                                )}
                                            >
                                                +{dayPlans.length - 3} more
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
            {/* Expanded Day Modal */}
            {expandedDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setExpandedDate(null)}
                    />
                    <div className={clsx(
                        "relative w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl shadow-xl flex flex-col",
                        isDark ? "bg-[#1A1A1A]" : "bg-white"
                    )}>
                        {/* Header */}
                        <div className={clsx(
                            "p-4 border-b flex items-center justify-between",
                            isDark ? "border-[#2A2A2A]" : "border-gray-200"
                        )}>
                            <div>
                                <h3 className={clsx(
                                    "text-lg font-bold",
                                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                )}>
                                    {format(expandedDate, 'MMMM d, yyyy')}
                                </h3>
                                <p className={clsx(
                                    "text-xs",
                                    isDark ? "text-[#A0A0A0]" : "text-gray-500"
                                )}>
                                    {format(expandedDate, 'EEEE')}
                                </p>
                            </div>
                            <button
                                onClick={() => setExpandedDate(null)}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors",
                                    isDark ? "hover:bg-[#2A2A2A]" : "hover:bg-gray-100"
                                )}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {getPlansForDate(expandedDate).map(plan => (
                                <div
                                    key={plan.id}
                                    onClick={() => {
                                        onPlanClick?.(plan)
                                        setExpandedDate(null)
                                    }}
                                    className={clsx(
                                        "p-3 rounded-lg border cursor-pointer transition-all hover:translate-x-1",
                                        plan.completed
                                            ? (isDark ? "bg-green-900/10 border-green-900/50" : "bg-green-50 border-green-200")
                                            : isOverdue(plan.date, plan.dueDate, plan.completed)
                                                ? (isDark ? "bg-red-900/10 border-red-900/50" : "bg-red-50 border-red-200")
                                                : plan.hasDueDate
                                                    ? (isDark ? "bg-blue-900/10 border-blue-900/50" : "bg-blue-50 border-blue-200")
                                                    : (isDark ? "bg-[#FF9F1C]/10 border-[#FF9F1C]/30" : "bg-[#FFF2E0]/50 border-[#FFD699]/50")
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={clsx(
                                            "mt-0.5 p-1.5 rounded-md",
                                            plan.completed
                                                ? "bg-green-500 text-white"
                                                : isOverdue(plan.date, plan.dueDate, plan.completed)
                                                    ? "bg-red-500 text-white"
                                                    : plan.hasDueDate
                                                        ? "bg-blue-500 text-white"
                                                        : "bg-[#FF9F1C] text-white"
                                        )}>
                                            {plan.hasDueDate ? <CalendarDays className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={clsx(
                                                "font-medium truncate",
                                                plan.completed && "line-through opacity-50",
                                                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                            )}>
                                                {plan.title}
                                            </h4>
                                            {plan.description && (
                                                <p className={clsx(
                                                    "text-xs truncate mt-0.5",
                                                    isDark ? "text-gray-500" : "text-gray-400"
                                                )}>
                                                    {plan.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
