'use client'

import { useState, useEffect } from 'react'
import { Revenue } from '@/lib/types'
import { fetchRevenues, createRevenue, updateRevenue as updateRevenueDB, deleteRevenue as deleteRevenueDB } from '@/lib/supabaseService'
import { generateUUID } from '@/lib/uuid'
import { Plus, X, Calendar, Briefcase, DollarSign, FileText, Trash2 } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useData } from '@/lib/DataContext'
import clsx from 'clsx'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns'

const STORAGE_KEY = 'revenue-data'

function getTodayDate() {
    return format(new Date(), 'yyyy-MM-dd')
}

export function RevenueBoard() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { revenues, setRevenues, isLoading } = useData()
    const [selectedRevenue, setSelectedRevenue] = useState<Revenue | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isAddingRevenue, setIsAddingRevenue] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // New revenue form state
    const [newName, setNewName] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newProjectName, setNewProjectName] = useState('')
    const [newPrice, setNewPrice] = useState<number | ''>('')
    const [newDateCompleted, setNewDateCompleted] = useState(getTodayDate())

    const addRevenue = async () => {
        if (!newName.trim() || !newProjectName.trim() || !newPrice || isSubmitting) return
        setIsSubmitting(true)

        const newRevenue: Revenue = {
            id: generateUUID(),
            name: newName.trim(),
            description: newDescription.trim() || undefined,
            projectName: newProjectName.trim(),
            price: Number(newPrice),
            currency: '₱',
            dateCompleted: newDateCompleted,
            createdAt: new Date().toISOString(),
        }

        const created = await createRevenue(newRevenue)
        if (created) {
            setRevenues(prev => [...prev, newRevenue])
        }
        resetForm()
        setIsAddingRevenue(false)
        setIsSubmitting(false)
    }

    const resetForm = () => {
        setNewName('')
        setNewDescription('')
        setNewProjectName('')
        setNewPrice('')
        setNewDateCompleted(getTodayDate())
    }

    const updateRevenue = async (updatedRevenue: Revenue) => {
        await updateRevenueDB(updatedRevenue)
        setRevenues(prev => prev.map(r => r.id === updatedRevenue.id ? updatedRevenue : r))
        setSelectedRevenue(updatedRevenue)
    }

    const deleteRevenue = async (revenueId: string) => {
        await deleteRevenueDB(revenueId)
        setRevenues(prev => prev.filter(r => r.id !== revenueId))
        setIsModalOpen(false)
        setSelectedRevenue(null)
    }

    const openRevenue = (revenue: Revenue) => {
        setSelectedRevenue(revenue)
        setIsModalOpen(true)
    }

    // Calculate summaries
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const thisYearStart = startOfYear(now)
    const thisYearEnd = endOfYear(now)

    const thisMonthRevenue = revenues
        .filter(r => {
            const date = parseISO(r.dateCompleted)
            return isWithinInterval(date, { start: thisMonthStart, end: thisMonthEnd })
        })
        .reduce((sum, r) => sum + r.price, 0)

    const thisYearRevenue = revenues
        .filter(r => {
            const date = parseISO(r.dateCompleted)
            return isWithinInterval(date, { start: thisYearStart, end: thisYearEnd })
        })
        .reduce((sum, r) => sum + r.price, 0)

    const totalProjects = revenues.length

    return (
        <div className="space-y-6">
            <header>
                <h1 className={clsx(
                    "text-3xl font-bold",
                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                )}>
                    Revenue
                </h1>
                <p className={clsx(
                    "mt-2",
                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                )}>
                    Track your income from completed projects.
                </p>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={clsx(
                    "p-6 rounded-2xl border",
                    isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"
                )}>
                    <p className={clsx(
                        "text-sm mb-1",
                        isDark ? "text-[#A0A0A0]" : "text-gray-500"
                    )}>This Month</p>
                    <p className="text-3xl font-bold text-[#FF9F1C]">
                        ₱{thisMonthRevenue.toLocaleString()}
                    </p>
                </div>
                <div className={clsx(
                    "p-6 rounded-2xl border",
                    isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"
                )}>
                    <p className={clsx(
                        "text-sm mb-1",
                        isDark ? "text-[#A0A0A0]" : "text-gray-500"
                    )}>This Year</p>
                    <p className="text-3xl font-bold text-green-500">
                        ₱{thisYearRevenue.toLocaleString()}
                    </p>
                </div>
                <div className={clsx(
                    "p-6 rounded-2xl border",
                    isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"
                )}>
                    <p className={clsx(
                        "text-sm mb-1",
                        isDark ? "text-[#A0A0A0]" : "text-gray-500"
                    )}>Projects Completed</p>
                    <p className="text-3xl font-bold text-blue-500">
                        {totalProjects}
                    </p>
                </div>
            </div>

            {/* Add Revenue Section */}
            {isAddingRevenue ? (
                <div className={clsx(
                    "p-4 rounded-2xl border",
                    isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"
                )}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={clsx(
                                "text-sm font-medium",
                                isDark ? "text-[#A0A0A0]" : "text-gray-600"
                            )}>Name *</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="e.g., Website Development"
                                autoFocus
                                className={clsx(
                                    "w-full mt-1 p-3 rounded-lg border outline-none",
                                    isDark
                                        ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                        : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                )}
                            />
                        </div>
                        <div>
                            <label className={clsx(
                                "text-sm font-medium",
                                isDark ? "text-[#A0A0A0]" : "text-gray-600"
                            )}>Project Name *</label>
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="e.g., Client XYZ Website"
                                className={clsx(
                                    "w-full mt-1 p-3 rounded-lg border outline-none",
                                    isDark
                                        ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                        : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                )}
                            />
                        </div>
                        <div>
                            <label className={clsx(
                                "text-sm font-medium",
                                isDark ? "text-[#A0A0A0]" : "text-gray-600"
                            )}>Price *</label>
                            <div className="flex items-center gap-1 mt-1">
                                <span className={isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"}>₱</span>
                                <input
                                    type="number"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="0"
                                    className={clsx(
                                        "flex-1 p-3 rounded-lg border outline-none",
                                        isDark
                                            ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                            : "bg-gray-50 border-gray-200 text-[#2D3436] placeholder-gray-400"
                                    )}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={clsx(
                                "text-sm font-medium",
                                isDark ? "text-[#A0A0A0]" : "text-gray-600"
                            )}>Date Completed</label>
                            <input
                                type="date"
                                value={newDateCompleted}
                                onChange={(e) => setNewDateCompleted(e.target.value)}
                                className={clsx(
                                    "w-full mt-1 p-3 rounded-lg border outline-none",
                                    isDark
                                        ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                        : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                )}
                            />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className={clsx(
                            "text-sm font-medium",
                            isDark ? "text-[#A0A0A0]" : "text-gray-600"
                        )}>Description</label>
                        <textarea
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="Optional description..."
                            rows={2}
                            className={clsx(
                                "w-full mt-1 p-3 rounded-lg border outline-none resize-none",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                    : "bg-gray-50 border-gray-200 text-[#2D3436]"
                            )}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => {
                                resetForm()
                                setIsAddingRevenue(false)
                            }}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm",
                                isDark ? "text-[#A0A0A0] hover:bg-[#2A2A2A]" : "text-gray-500 hover:bg-gray-100"
                            )}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={addRevenue}
                            className="px-4 py-2 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15]"
                        >
                            Add Revenue
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsAddingRevenue(true)}
                    className={clsx(
                        "w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors",
                        isDark
                            ? "border-[#2A2A2A] text-[#A0A0A0] hover:border-[#FF9F1C] hover:text-[#FF9F1C]"
                            : "border-gray-200 text-gray-500 hover:border-[#FF9F1C] hover:text-[#FF9F1C]"
                    )}
                >
                    <Plus className="w-5 h-5" />
                    Add New Revenue
                </button>
            )}

            {/* Recent Projects List */}
            <div className={clsx(
                "p-6 rounded-2xl border",
                isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"
            )}>
                <h2 className={clsx(
                    "text-lg font-semibold mb-4",
                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                )}>Recent Projects</h2>

                {revenues.length === 0 ? (
                    <div className={clsx(
                        "text-center py-8",
                        isDark ? "text-[#666]" : "text-gray-400"
                    )}>
                        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No revenue entries yet</p>
                        <p className="text-sm mt-1">Add your first completed project above!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {revenues
                            .sort((a, b) => new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime())
                            .map(revenue => (
                                <div
                                    key={revenue.id}
                                    onClick={() => openRevenue(revenue)}
                                    className={clsx(
                                        "flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all",
                                        isDark
                                            ? "bg-[#2A2A2A] hover:bg-[#333] border border-transparent hover:border-[#FF9F1C]"
                                            : "bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-[#FF9F1C]"
                                    )}
                                >
                                    <div className="flex-1">
                                        <p className={clsx(
                                            "font-medium",
                                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                        )}>
                                            {revenue.name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={clsx(
                                                "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                                            )}>
                                                <Briefcase className="w-3 h-3" />
                                                {revenue.projectName}
                                            </span>
                                            <span className={clsx(
                                                "text-xs flex items-center gap-1",
                                                isDark ? "text-[#A0A0A0]" : "text-gray-500"
                                            )}>
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(revenue.dateCompleted), 'MMM d, yyyy')}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[#FF9F1C] font-bold text-lg">
                                        {revenue.currency}{revenue.price.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* Revenue Modal */}
            {isModalOpen && selectedRevenue && (
                <RevenueModal
                    revenue={selectedRevenue}
                    onClose={() => {
                        setIsModalOpen(false)
                        setSelectedRevenue(null)
                    }}
                    onUpdate={updateRevenue}
                    onDelete={deleteRevenue}
                    isDark={isDark}
                />
            )}
        </div>
    )
}

// Revenue Modal Component
interface RevenueModalProps {
    revenue: Revenue
    onClose: () => void
    onUpdate: (revenue: Revenue) => void
    onDelete: (revenueId: string) => void
    isDark: boolean
}

function RevenueModal({ revenue, onClose, onUpdate, onDelete, isDark }: RevenueModalProps) {
    const [name, setName] = useState(revenue.name)
    const [description, setDescription] = useState(revenue.description || '')
    const [projectName, setProjectName] = useState(revenue.projectName)
    const [price, setPrice] = useState(revenue.price)
    const [dateCompleted, setDateCompleted] = useState(revenue.dateCompleted)

    const handleSave = () => {
        onUpdate({
            ...revenue,
            name,
            description: description || undefined,
            projectName,
            price,
            dateCompleted,
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                    handleSave()
                    onClose()
                }}
            />

            {/* Modal */}
            <div className={clsx(
                "relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl p-6",
                isDark ? "bg-[#1A1A1A]" : "bg-white"
            )}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-[#FF9F1C]" />
                        <span className={clsx(
                            "text-xs px-2 py-0.5 rounded",
                            isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FFF2E0] text-[#CC7A00]"
                        )}>Revenue Entry</span>
                    </div>
                    <button
                        onClick={() => {
                            handleSave()
                            onClose()
                        }}
                        className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isDark ? "hover:bg-[#2A2A2A]" : "hover:bg-gray-100"
                        )}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Name */}
                <div className="mb-4">
                    <label className={clsx(
                        "text-sm font-medium",
                        isDark ? "text-[#A0A0A0]" : "text-gray-600"
                    )}>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={clsx(
                            "w-full mt-1 p-3 rounded-lg border outline-none text-lg font-semibold",
                            isDark
                                ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                : "bg-gray-50 border-gray-200 text-[#2D3436]"
                        )}
                    />
                </div>

                {/* Description */}
                <div className="mb-4">
                    <label className={clsx(
                        "text-sm font-medium flex items-center gap-1",
                        isDark ? "text-[#A0A0A0]" : "text-gray-600"
                    )}>
                        <FileText className="w-4 h-4" /> Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add details about this project..."
                        rows={3}
                        className={clsx(
                            "w-full mt-1 p-3 rounded-lg border outline-none resize-none",
                            isDark
                                ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                : "bg-gray-50 border-gray-200 text-[#2D3436]"
                        )}
                    />
                </div>

                {/* Project Name */}
                <div className="mb-4">
                    <label className={clsx(
                        "text-sm font-medium flex items-center gap-1",
                        isDark ? "text-[#A0A0A0]" : "text-gray-600"
                    )}>
                        <Briefcase className="w-4 h-4" /> Project Name
                    </label>
                    <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className={clsx(
                            "w-full mt-1 p-3 rounded-lg border outline-none",
                            isDark
                                ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                : "bg-gray-50 border-gray-200 text-[#2D3436]"
                        )}
                    />
                </div>

                {/* Price */}
                <div className="mb-4">
                    <label className={clsx(
                        "text-sm font-medium flex items-center gap-1",
                        isDark ? "text-[#A0A0A0]" : "text-gray-600"
                    )}>
                        <DollarSign className="w-4 h-4" /> Price
                    </label>
                    <div className="flex items-center gap-1 mt-1">
                        <span className={clsx(
                            "text-lg font-medium",
                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                        )}>{revenue.currency}</span>
                        <input
                            type="number"
                            value={price || ''}
                            onChange={(e) => setPrice(Number(e.target.value) || 0)}
                            placeholder="0"
                            className={clsx(
                                "flex-1 p-3 rounded-lg border outline-none text-lg font-bold",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#FF9F1C] placeholder-gray-500"
                                    : "bg-gray-50 border-gray-200 text-[#CC7A00] placeholder-gray-400"
                            )}
                        />
                    </div>
                </div>

                {/* Date Completed */}
                <div className="mb-6">
                    <label className={clsx(
                        "text-sm font-medium flex items-center gap-1",
                        isDark ? "text-[#A0A0A0]" : "text-gray-600"
                    )}>
                        <Calendar className="w-4 h-4" /> Date Completed
                    </label>
                    <input
                        type="date"
                        value={dateCompleted}
                        onChange={(e) => setDateCompleted(e.target.value)}
                        className={clsx(
                            "w-full mt-1 p-3 rounded-lg border outline-none",
                            isDark
                                ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                : "bg-gray-50 border-gray-200 text-[#2D3436]"
                        )}
                    />
                </div>

                {/* Delete Button */}
                <div className={clsx(
                    "pt-4 border-t",
                    isDark ? "border-[#2A2A2A]" : "border-gray-200"
                )}>
                    <button
                        onClick={() => onDelete(revenue.id)}
                        className="flex items-center gap-2 text-red-500 text-sm hover:underline"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Revenue Entry
                    </button>
                </div>
            </div>
        </div>
    )
}
