'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { useData } from '@/lib/DataContext'
import CalendarGrid from '@/components/planner/CalendarGrid'
import AddPlanModal from '@/components/planner/AddPlanModal'
import TodaysPlansDock from '@/components/planner/TodaysPlansDock'
import { Plan, PlanFormData } from '@/lib/types'
import { fetchPlans, createPlan, updatePlan, deletePlan } from '@/lib/supabaseService'
import { format } from 'date-fns'
import clsx from 'clsx'
import { Plus, Check, Trash2, Clock, X, Edit } from 'lucide-react'
import { formatTimeTo12h } from '@/lib/utils'

type CalendarView = 'day' | 'week' | 'month'

export default function PlannerPage() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { plans, setPlans, isLoading } = useData()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
    const [planToEdit, setPlanToEdit] = useState<Plan | null>(null)
    const [calendarView, setCalendarView] = useState<CalendarView>('month')

    const handleDateClick = (date: Date) => {
        setSelectedDate(date)
        setPlanToEdit(null)
        setIsModalOpen(true)
    }

    const handlePlanClick = (plan: Plan) => {
        setSelectedPlan(plan)
    }

    const handleSavePlan = async (formData: PlanFormData) => {
        if (planToEdit) {
            // Update existing plan
            const updatedPlan: Plan = {
                ...planToEdit,
                title: formData.title,
                description: formData.description || undefined,
                date: formData.date,
                timeSlots: (!formData.hasDueDate && formData.includeTime) ? formData.timeSlots : undefined,
                hasDueDate: formData.hasDueDate,
                dueDate: formData.hasDueDate ? formData.dueDate : undefined,
                attachments: formData.attachments.length > 0 ? formData.attachments : undefined,
            }
            const success = await updatePlan(updatedPlan)
            if (success) {
                setPlans(plans.map(p => p.id === planToEdit.id ? updatedPlan : p))
            }
            setPlanToEdit(null)
        } else {
            // Create new plan
            const newPlan: Plan = {
                id: crypto.randomUUID(),
                title: formData.title,
                description: formData.description || undefined,
                date: formData.date,
                timeSlots: (!formData.hasDueDate && formData.includeTime) ? formData.timeSlots : undefined,
                hasDueDate: formData.hasDueDate,
                dueDate: formData.hasDueDate ? formData.dueDate : undefined,
                attachments: formData.attachments.length > 0 ? formData.attachments : undefined,
                completed: false,
                createdAt: new Date().toISOString()
            }
            const created = await createPlan(newPlan)
            if (created) {
                setPlans([...plans, newPlan])
            }
        }
    }

    const handleToggleComplete = async (planId: string) => {
        const plan = plans.find(p => p.id === planId)
        if (!plan) return

        const updated = { ...plan, completed: !plan.completed }
        const success = await updatePlan(updated)
        if (success) {
            setPlans(plans.map(p => p.id === planId ? updated : p))
        }
        if (selectedPlan?.id === planId) {
            setSelectedPlan(null)
        }
    }

    const handleDeletePlan = async (planId: string) => {
        const success = await deletePlan(planId)
        if (success) {
            setPlans(plans.filter(plan => plan.id !== planId))
        }
        setSelectedPlan(null)
    }

    const viewOptions: { value: CalendarView; label: string }[] = [
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className={clsx(
                        "text-3xl font-bold",
                        isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                    )}>
                        Planner
                    </h1>
                    <p className={clsx(
                        "mt-2",
                        isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                    )}>
                        Schedule your events and manage your calendar.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Toggle Buttons */}
                    <div className={clsx(
                        "flex items-center p-1 rounded-xl",
                        isDark ? "bg-[#2A2A2A]" : "bg-gray-100"
                    )}>
                        {viewOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setCalendarView(option.value)}
                                className={clsx(
                                    "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                                    calendarView === option.value
                                        ? "bg-gradient-to-r from-[#FF9F1C] to-[#F68E09] text-white shadow-md"
                                        : isDark
                                            ? "text-gray-400 hover:text-gray-200"
                                            : "text-gray-500 hover:text-gray-800"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {/* Add Plan Button */}
                    <button
                        onClick={() => {
                            setSelectedDate(new Date())
                            setPlanToEdit(null)
                            setIsModalOpen(true)
                        }}
                        className="flex items-center gap-2 bg-gradient-to-r from-[#FF9F1C] to-[#F68E09] text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-md"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">Add Plan</span>
                    </button>
                </div>
            </header>

            {/* Calendar - Full Width */}
            <CalendarGrid
                plans={plans}
                onDateClick={handleDateClick}
                onPlanClick={handlePlanClick}
                view={calendarView}
            />

            {/* Floating Today's Plans Dock */}
            <TodaysPlansDock
                plans={plans}
                onPlanClick={handlePlanClick}
                onToggleComplete={handleToggleComplete}
            />

            {/* Add Plan Modal */}
            <AddPlanModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setPlanToEdit(null)
                }}
                onSave={handleSavePlan}
                selectedDate={selectedDate}
                planToEdit={planToEdit}
            />

            {/* Plan Detail Modal */}
            {selectedPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setSelectedPlan(null)}
                    />
                    <div className={clsx(
                        "relative w-full max-w-md mx-4 rounded-2xl shadow-xl p-6 transition-colors max-h-[90vh] overflow-y-auto",
                        isDark ? "bg-[#1A1A1A]" : "bg-white"
                    )}>
                        {/* Close button */}
                        <button
                            onClick={() => setSelectedPlan(null)}
                            className={clsx(
                                "absolute top-4 right-4 p-2 rounded-full transition-colors",
                                isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                            )}
                        >
                            <X className={clsx("w-5 h-5", isDark ? "text-gray-400" : "text-gray-500")} />
                        </button>

                        <h3 className={clsx(
                            "text-xl font-bold mb-4 pr-8",
                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                        )}>
                            {selectedPlan.title}
                        </h3>

                        {selectedPlan.description && (
                            <p className={clsx(
                                "mb-4",
                                isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                            )}>
                                {selectedPlan.description}
                            </p>
                        )}

                        <div className={clsx(
                            "text-sm mb-4",
                            isDark ? "text-gray-400" : "text-gray-500"
                        )}>
                            {selectedPlan.hasDueDate ? (
                                <p>📅 {format(new Date(selectedPlan.date), 'MMM d, yyyy')} → {format(new Date(selectedPlan.dueDate!), 'MMM d, yyyy')}</p>
                            ) : (
                                <p>📅 {format(new Date(selectedPlan.date), 'MMM d, yyyy')}</p>
                            )}
                        </div>

                        {/* Time Slots */}
                        {selectedPlan.timeSlots && selectedPlan.timeSlots.length > 0 && (
                            <div className="mb-4 space-y-2">
                                <p className={clsx(
                                    "text-sm font-medium mb-2",
                                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                                )}>
                                    Schedule:
                                </p>
                                {selectedPlan.timeSlots.map(slot => (
                                    <div
                                        key={slot.id}
                                        className={clsx(
                                            "flex items-center gap-3 p-2 rounded-lg",
                                            isDark ? "bg-[#2A2A2A]" : "bg-[#FFF2E0]"
                                        )}
                                    >
                                        <Clock className={clsx("w-4 h-4", isDark ? "text-[#FF9F1C]" : "text-[#CC7A00]")} />
                                        <span className={clsx(
                                            "font-medium",
                                            isDark ? "text-[#FF9F1C]" : "text-[#CC7A00]"
                                        )}>
                                            {formatTimeTo12h(slot.time)}
                                        </span>
                                        <span className={clsx(
                                            "flex-1",
                                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                        )}>
                                            {slot.description || 'No description'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Attachments */}
                        {selectedPlan.attachments && selectedPlan.attachments.length > 0 && (
                            <div className="mb-6 space-y-2">
                                <p className={clsx(
                                    "text-sm font-medium mb-2",
                                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                                )}>
                                    Attachments:
                                </p>
                                {selectedPlan.attachments.map(attachment => (
                                    <a
                                        key={attachment.id}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={attachment.type === 'file' ? attachment.name : undefined}
                                        className={clsx(
                                            "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer",
                                            isDark
                                                ? "bg-[#2A2A2A] hover:bg-[#3A3A3A]"
                                                : "bg-gray-50 hover:bg-gray-100"
                                        )}
                                    >
                                        {attachment.type === 'link' ? (
                                            <span className="text-blue-500">🔗</span>
                                        ) : (
                                            <span className="text-green-500">📎</span>
                                        )}
                                        <span className={clsx(
                                            "flex-1 text-sm truncate underline",
                                            attachment.type === 'link'
                                                ? isDark ? "text-blue-400" : "text-blue-600"
                                                : isDark ? "text-green-400" : "text-green-600"
                                        )}>
                                            {attachment.name}
                                        </span>
                                        <span className={clsx(
                                            "text-xs px-2 py-0.5 rounded-full",
                                            attachment.type === 'link'
                                                ? isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                                                : isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600"
                                        )}>
                                            {attachment.type === 'link' ? 'Link' : 'File'}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleToggleComplete(selectedPlan.id)}
                                className={clsx(
                                    "flex-1 py-2 rounded-xl font-medium transition-colors",
                                    selectedPlan.completed
                                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        : "bg-green-500 text-white hover:bg-green-600"
                                )}
                            >
                                {selectedPlan.completed ? 'Mark Incomplete' : 'Mark Complete'}
                            </button>
                            <button
                                onClick={() => {
                                    setPlanToEdit(selectedPlan)
                                    setSelectedPlan(null)
                                    setIsModalOpen(true)
                                }}
                                className={clsx(
                                    "px-4 py-2 rounded-xl text-white transition-colors",
                                    isDark ? "bg-[#2A2A2A] hover:bg-[#3A3A3A] text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                                )}
                                title="Edit Plan"
                            >
                                <Edit className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleDeletePlan(selectedPlan.id)}
                                className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                                title="Delete Plan"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
