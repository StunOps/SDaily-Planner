'use client'

import { useState } from 'react'
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
    subMonths
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import clsx from 'clsx'

export default function CalendarGrid() {
    const [currentDate, setCurrentDate] = useState(new Date())

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const days = eachDayOfInterval({ start: startDate, end: endDate })

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const resetToday = () => setCurrentDate(new Date())

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-text-main">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                        <button onClick={prevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <button onClick={resetToday} className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-primary">
                            Today
                        </button>
                        <button onClick={nextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all">
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                </div>

                <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors shadow-sm">
                    <Plus className="w-5 h-5" />
                    <span>Add Event</span>
                </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-border bg-gray-50">
                {weekDays.map(day => (
                    <div key={day} className="py-3 text-center text-sm font-semibold text-text-muted">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                {days.map((day, dayIdx) => {
                    const isCurrentMonth = isSameMonth(day, monthStart)
                    const isToday = isSameDay(day, new Date())

                    return (
                        <div
                            key={day.toString()}
                            className={clsx(
                                'min-h-[100px] border-b border-r border-border p-3 transition-colors hover:bg-orange-50/30 flex flex-col gap-1',
                                !isCurrentMonth && 'bg-gray-50/50 text-gray-400',
                                isToday && 'bg-orange-50'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className={clsx(
                                    'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                                    isToday
                                        ? 'bg-primary text-white shadow-md'
                                        : isCurrentMonth ? 'text-text-main' : 'text-gray-400'
                                )}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            {/* Placeholder for events */}
                            {isToday && (
                                <div className="mt-2 text-xs bg-blue-100 text-blue-700 p-1.5 rounded border border-blue-200 truncate">
                                    Meeting with team
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
