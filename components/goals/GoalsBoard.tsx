'use client'

import { useState, useEffect } from 'react'
import { Goal, GoalType, ChecklistItem, Comment } from '@/lib/types'
import { fetchGoals, createGoal, updateGoal as updateGoalDB, deleteGoal as deleteGoalDB } from '@/lib/supabaseService'
import { generateUUID } from '@/lib/uuid'
import { Plus, X, Star, CheckSquare, MessageSquare, Calendar, Wallet, Target, Trash2, DollarSign, Heart, Edit2, Check } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useData } from '@/lib/DataContext'
import clsx from 'clsx'
import { format, parseISO, isPast, isToday } from 'date-fns'

const STORAGE_KEY = 'goals-data'

export function GoalsBoard() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { goals, setGoals, isLoading } = useData()
    const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isAddingGoal, setIsAddingGoal] = useState(false)
    const [newGoalTitle, setNewGoalTitle] = useState('')
    const [newGoalType, setNewGoalType] = useState<GoalType>('personal')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const addGoal = async () => {
        if (!newGoalTitle.trim() || isSubmitting) return
        setIsSubmitting(true)

        const newGoal: Goal = {
            id: generateUUID(),
            title: newGoalTitle.trim(),
            goalType: newGoalType,
            checklist: [],
            comments: [],
            createdAt: new Date().toISOString(),
            budget: newGoalType === 'material' ? { targetAmount: 0, currentAmount: 0, currency: '₱' } : undefined,
        }

        const created = await createGoal(newGoal)
        if (created) {
            setGoals(prev => [...prev, newGoal])
        }
        setNewGoalTitle('')
        setNewGoalType('personal')
        setIsAddingGoal(false)
        setIsSubmitting(false)
    }

    const updateGoal = async (updatedGoal: Goal) => {
        await updateGoalDB(updatedGoal)
        setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g))
        setSelectedGoal(updatedGoal)
    }

    const deleteGoal = async (goalId: string) => {
        await deleteGoalDB(goalId)
        setGoals(prev => prev.filter(g => g.id !== goalId))
        setIsModalOpen(false)
        setSelectedGoal(null)
    }

    const openGoal = (goal: Goal) => {
        setSelectedGoal(goal)
        setIsModalOpen(true)
    }

    const getProgress = (goal: Goal) => {
        if (goal.checklist.length === 0) return 0
        return Math.round((goal.checklist.filter(c => c.completed).length / goal.checklist.length) * 100)
    }

    const getBudgetProgress = (goal: Goal) => {
        if (!goal.budget || goal.budget.targetAmount === 0) return 0
        return Math.min(100, Math.round((goal.budget.currentAmount / goal.budget.targetAmount) * 100))
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className={clsx(
                    "text-3xl font-bold",
                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                )}>
                    Goals
                </h1>
                <p className={clsx(
                    "mt-2",
                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                )}>
                    Track your personal and material goals with progress tracking.
                </p>
            </header>

            {/* Add Goal Section */}
            {isAddingGoal ? (
                <div className={clsx(
                    "p-4 rounded-2xl border",
                    isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"
                )}>
                    <input
                        type="text"
                        value={newGoalTitle}
                        onChange={(e) => setNewGoalTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') addGoal()
                            if (e.key === 'Escape') setIsAddingGoal(false)
                        }}
                        placeholder="What's your goal?"
                        autoFocus
                        className={clsx(
                            "w-full p-3 rounded-lg text-base border outline-none mb-3",
                            isDark
                                ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                : "bg-gray-50 border-gray-200 text-[#2D3436]"
                        )}
                    />
                    <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setNewGoalType('personal')}
                                className={clsx(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                    newGoalType === 'personal'
                                        ? "bg-green-500 text-white"
                                        : isDark ? "bg-[#2A2A2A] text-[#A0A0A0]" : "bg-gray-100 text-gray-600"
                                )}
                            >
                                Personal
                            </button>
                            <button
                                onClick={() => setNewGoalType('material')}
                                className={clsx(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                    newGoalType === 'material'
                                        ? "bg-[#FF9F1C] text-white"
                                        : isDark ? "bg-[#2A2A2A] text-[#A0A0A0]" : "bg-gray-100 text-gray-600"
                                )}
                            >
                                Material
                            </button>
                        </div>
                        <div className="flex-1" />
                        <button
                            onClick={() => setIsAddingGoal(false)}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-sm",
                                isDark ? "text-[#A0A0A0] hover:bg-[#2A2A2A]" : "text-gray-500 hover:bg-gray-100"
                            )}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={addGoal}
                            className="px-4 py-1.5 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15]"
                        >
                            Add Goal
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsAddingGoal(true)}
                    className={clsx(
                        "w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors",
                        isDark
                            ? "border-[#2A2A2A] text-[#A0A0A0] hover:border-[#FF9F1C] hover:text-[#FF9F1C]"
                            : "border-gray-200 text-gray-500 hover:border-[#FF9F1C] hover:text-[#FF9F1C]"
                    )}
                >
                    <Plus className="w-5 h-5" />
                    Add New Goal
                </button>
            )}

            {/* Goals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map(goal => (
                    <div
                        key={goal.id}
                        onClick={() => openGoal(goal)}
                        className={clsx(
                            "p-5 rounded-2xl cursor-pointer transition-all border",
                            isDark
                                ? "bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#FF9F1C]"
                                : "bg-white border-gray-200 hover:border-[#FF9F1C]",
                            "hover:shadow-md hover:-translate-y-0.5"
                        )}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className={clsx(
                                    "font-semibold text-lg",
                                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                )}>
                                    {goal.title}
                                </h3>
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded-full mt-1 inline-block",
                                    goal.goalType === 'material'
                                        ? isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FFF2E0] text-[#CC7A00]"
                                        : isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"
                                )}>
                                    {goal.goalType === 'material' ? 'Material Goal' : 'Personal Goal'}
                                </span>
                            </div>
                            {goal.goalType === 'material' && goal.budget && (
                                <span className={clsx(
                                    "font-bold text-lg",
                                    isDark ? "text-[#FF9F1C]" : "text-[#CC7A00]"
                                )}>
                                    {goal.budget.currency}{goal.budget.targetAmount.toLocaleString()}
                                </span>
                            )}
                        </div>

                        {/* Progress Bar (Checklist-based) */}
                        <div className="mb-3">
                            <div className={clsx(
                                "w-full h-3 rounded-full overflow-hidden",
                                isDark ? "bg-[#2A2A2A]" : "bg-gray-100"
                            )}>
                                <div
                                    className={clsx(
                                        "h-full rounded-full transition-all",
                                        goal.goalType === 'material' ? "bg-[#FF9F1C]" : "bg-green-500"
                                    )}
                                    style={{ width: `${getProgress(goal)}%` }}
                                />
                            </div>
                            <p className={clsx(
                                "text-right text-sm mt-1",
                                isDark ? "text-[#A0A0A0]" : "text-gray-500"
                            )}>
                                {getProgress(goal)}% complete
                            </p>
                        </div>

                        {/* Footer indicators */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {goal.targetDate && (
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                    isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                                )}>
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(goal.targetDate), 'MMM d, yyyy')}
                                </span>
                            )}
                            {goal.checklist.length > 0 && (
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                    isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                                )}>
                                    <CheckSquare className="w-3 h-3" />
                                    {goal.checklist.filter(c => c.completed).length}/{goal.checklist.length}
                                </span>
                            )}
                            {goal.comments.length > 0 && (
                                <span className={clsx(
                                    "text-xs flex items-center gap-1",
                                    isDark ? "text-[#A0A0A0]" : "text-gray-500"
                                )}>
                                    <MessageSquare className="w-3 h-3" />
                                    {goal.comments.length}
                                </span>
                            )}
                            {goal.goalType === 'material' && goal.budget && goal.budget.targetAmount > 0 && (
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                    isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-700"
                                )}>
                                    <DollarSign className="w-3 h-3" />
                                    {getBudgetProgress(goal)}% saved
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {goals.length === 0 && !isAddingGoal && (
                <div className={clsx(
                    "text-center py-12",
                    isDark ? "text-[#666]" : "text-gray-400"
                )}>
                    <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No goals yet</p>
                    <p className="text-sm mt-1">Click the button above to add your first goal!</p>
                </div>
            )}

            {/* Goal Modal */}
            {isModalOpen && selectedGoal && (
                <GoalModal
                    key={selectedGoal.id}
                    goal={selectedGoal}
                    onClose={() => {
                        setIsModalOpen(false)
                        setSelectedGoal(null)
                    }}
                    onUpdate={updateGoal}
                    onDelete={deleteGoal}
                    isDark={isDark}
                />
            )}
        </div>
    )
}

// Goal Modal Component
interface GoalModalProps {
    goal: Goal
    onClose: () => void
    onUpdate: (goal: Goal) => void
    onDelete: (goalId: string) => void
    isDark: boolean
}

function GoalModal({ goal, onClose, onUpdate, onDelete, isDark }: GoalModalProps) {
    const [title, setTitle] = useState(goal.title)
    const [description, setDescription] = useState(goal.description || '')
    const [targetDate, setTargetDate] = useState(goal.targetDate || '')
    const [checklist, setChecklist] = useState<ChecklistItem[]>(goal.checklist)
    const [comments, setComments] = useState<Comment[]>(goal.comments)
    const [budget, setBudget] = useState(goal.budget)
    const [newChecklistItem, setNewChecklistItem] = useState('')
    const [newComment, setNewComment] = useState('')

    // Edit State
    const [editingCheckId, setEditingCheckId] = useState<string | null>(null)
    const [editingCheckText, setEditingCheckText] = useState('')
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [editingCommentText, setEditingCommentText] = useState('')

    const startEditingCheck = (item: ChecklistItem) => {
        setEditingCheckId(item.id)
        setEditingCheckText(item.text)
    }

    const saveEditingCheck = () => {
        if (!editingCheckId || !editingCheckText.trim()) {
            setEditingCheckId(null)
            return
        }
        setChecklist(checklist.map(item =>
            item.id === editingCheckId ? { ...item, text: editingCheckText.trim() } : item
        ))
        setEditingCheckId(null)
    }

    const startEditingComment = (comment: Comment) => {
        setEditingCommentId(comment.id)
        setEditingCommentText(comment.text)
    }

    const saveEditingComment = () => {
        if (!editingCommentId || !editingCommentText.trim()) {
            setEditingCommentId(null)
            return
        }
        setComments(comments.map(c =>
            c.id === editingCommentId ? { ...c, text: editingCommentText.trim() } : c
        ))
        setEditingCommentId(null)
    }

    const handleSave = () => {
        onUpdate({
            ...goal,
            title,
            description,
            targetDate: targetDate || undefined,
            checklist,
            comments,
            budget,
        })
    }

    const addChecklistItem = () => {
        if (!newChecklistItem.trim()) return
        setChecklist([...checklist, {
            id: generateUUID(),
            text: newChecklistItem.trim(),
            completed: false,
        }])
        setNewChecklistItem('')
    }

    const toggleChecklistItem = (id: string) => {
        setChecklist(checklist.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ))
    }

    const deleteChecklistItem = (id: string) => {
        setChecklist(checklist.filter(item => item.id !== id))
    }

    const addComment = () => {
        if (!newComment.trim()) return
        setComments([...comments, {
            id: generateUUID(),
            text: newComment.trim(),
            createdAt: new Date().toISOString(),
            isMarkedDone: false,
        }])
        setNewComment('')
    }

    const toggleCommentDone = (id: string) => {
        setComments(comments.map(c =>
            c.id === id ? { ...c, isMarkedDone: !c.isMarkedDone } : c
        ))
    }

    const deleteComment = (id: string) => {
        setComments(comments.filter(c => c.id !== id))
    }

    const checklistProgress = checklist.length > 0
        ? Math.round((checklist.filter(c => c.completed).length / checklist.length) * 100)
        : 0

    const budgetProgress = budget && budget.targetAmount > 0
        ? Math.min(100, Math.round((budget.currentAmount / budget.targetAmount) * 100))
        : 0

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
                "relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-xl flex",
                isDark ? "bg-[#1A1A1A]" : "bg-white"
            )}>
                {/* Left Side - Main Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={clsx(
                                "text-xl font-bold bg-transparent outline-none flex-1 mr-4",
                                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                            )}
                        />
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

                    {/* Goal Type Badge */}
                    <span className={clsx(
                        "text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1 mb-4",
                        goal.goalType === 'material'
                            ? isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FFF2E0] text-[#CC7A00]"
                            : isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"
                    )}>
                        <Target className="w-3 h-3" />
                        {goal.goalType === 'material' ? 'Material Goal' : 'Personal Goal'}
                    </span>

                    {/* Description */}
                    <div className="mb-4">
                        <label className={clsx(
                            "text-sm font-medium",
                            isDark ? "text-[#A0A0A0]" : "text-gray-600"
                        )}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add a detailed description..."
                            rows={3}
                            className={clsx(
                                "w-full mt-1 p-3 rounded-lg border outline-none resize-none",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                    : "bg-gray-50 border-gray-200 text-[#2D3436]"
                            )}
                        />
                    </div>

                    {/* Target Date */}
                    <div className="mb-4">
                        <label className={clsx(
                            "text-sm font-medium flex items-center gap-1",
                            isDark ? "text-[#A0A0A0]" : "text-gray-600"
                        )}>
                            <Calendar className="w-4 h-4" /> Target Date
                        </label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className={clsx(
                                "w-full mt-1 p-2 rounded-lg border outline-none",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                    : "bg-gray-50 border-gray-200 text-[#2D3436]"
                            )}
                        />
                    </div>

                    {/* Budget Section (Material Goals Only) */}
                    {goal.goalType === 'material' && budget && (
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-[#FF9F1C]" />
                                <span className={clsx(
                                    "text-sm font-medium",
                                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                )}>Budget</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <label className={clsx(
                                        "text-xs",
                                        isDark ? "text-[#A0A0A0]" : "text-gray-500"
                                    )}>Target Amount</label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className={isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"}>{budget.currency}</span>
                                        <input
                                            type="number"
                                            value={budget.targetAmount || ''}
                                            onChange={(e) => setBudget({ ...budget, targetAmount: Number(e.target.value) || 0 })}
                                            placeholder="0"
                                            className={clsx(
                                                "flex-1 p-2 rounded-lg border outline-none",
                                                isDark
                                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                                    : "bg-gray-50 border-gray-200 text-[#2D3436] placeholder-gray-400"
                                            )}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={clsx(
                                        "text-xs",
                                        isDark ? "text-[#A0A0A0]" : "text-gray-500"
                                    )}>Current Saved</label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className={isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"}>{budget.currency}</span>
                                        <input
                                            type="number"
                                            value={budget.currentAmount || ''}
                                            onChange={(e) => setBudget({ ...budget, currentAmount: Number(e.target.value) || 0 })}
                                            placeholder="0"
                                            className={clsx(
                                                "flex-1 p-2 rounded-lg border outline-none",
                                                isDark
                                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                                    : "bg-gray-50 border-gray-200 text-[#2D3436] placeholder-gray-400"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {budget.targetAmount > 0 && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className={isDark ? "text-[#A0A0A0]" : "text-gray-500"}>Savings Progress</span>
                                        <span className={isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"}>{budgetProgress}%</span>
                                    </div>
                                    <div className={clsx(
                                        "h-2 rounded-full overflow-hidden",
                                        isDark ? "bg-[#2A2A2A]" : "bg-gray-200"
                                    )}>
                                        <div
                                            className="h-full bg-[#FF9F1C] transition-all"
                                            style={{ width: `${budgetProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Checklist Section */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckSquare className="w-4 h-4 text-green-500" />
                            <span className={clsx(
                                "text-sm font-medium",
                                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                            )}>Checklist</span>
                        </div>

                        {checklist.length > 0 && (
                            <div className="space-y-1 mb-2">
                                <div className="flex justify-between text-xs">
                                    <span className={isDark ? "text-[#A0A0A0]" : "text-gray-500"}>Progress</span>
                                    <span className={isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"}>{checklistProgress}%</span>
                                </div>
                                <div className={clsx(
                                    "h-2 rounded-full overflow-hidden",
                                    isDark ? "bg-[#2A2A2A]" : "bg-gray-200"
                                )}>
                                    <div
                                        className="h-full bg-green-500 transition-all"
                                        style={{ width: `${checklistProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 mb-2">
                            {checklist.map(item => (
                                <div key={item.id} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={item.completed}
                                        onChange={() => toggleChecklistItem(item.id)}
                                        className="w-4 h-4 rounded accent-green-500"
                                    />
                                    {editingCheckId === item.id ? (
                                        <div className="flex-1 flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={editingCheckText}
                                                onChange={(e) => setEditingCheckText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEditingCheck()
                                                    if (e.key === 'Escape') setEditingCheckId(null)
                                                }}
                                                className={clsx(
                                                    "flex-1 p-1 text-sm rounded border outline-none",
                                                    isDark ? "bg-[#333] border-[#444] text-white" : "bg-white border-gray-300"
                                                )}
                                                autoFocus
                                            />
                                            <button onClick={saveEditingCheck} className="p-1 text-green-500 hover:bg-green-500/10 rounded">
                                                <Check className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => setEditingCheckId(null)} className="p-1 text-red-500 hover:bg-red-500/10 rounded">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className={clsx(
                                            "flex-1 text-sm cursor-text",
                                            item.completed && "line-through",
                                            isDark
                                                ? item.completed ? "text-[#666]" : "text-[#F5F5F5]"
                                                : item.completed ? "text-gray-400" : "text-[#2D3436]"
                                        )} onClick={() => startEditingCheck(item)}>
                                            {item.text}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => deleteChecklistItem(item.id)}
                                        className={clsx(
                                            "p-1 rounded opacity-50 hover:opacity-100",
                                            isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-gray-100"
                                        )}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    {/* Only show edit button if not editing */}
                                    {editingCheckId !== item.id && (
                                        <button
                                            onClick={() => startEditingCheck(item)}
                                            className={clsx(
                                                "p-1 rounded opacity-50 hover:opacity-100",
                                                isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-gray-100"
                                            )}
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newChecklistItem}
                                onChange={(e) => setNewChecklistItem(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                                placeholder="Add checklist item..."
                                className={clsx(
                                    "flex-1 p-2 rounded-lg text-sm border outline-none",
                                    isDark
                                        ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                        : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                )}
                            />
                            <button
                                onClick={addChecklistItem}
                                className="px-3 py-2 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15]"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Delete Button */}
                    <div className={clsx(
                        "pt-4 border-t",
                        isDark ? "border-[#2A2A2A]" : "border-gray-200"
                    )}>
                        <button
                            onClick={() => onDelete(goal.id)}
                            className="flex items-center gap-2 text-red-500 text-sm hover:underline"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Goal
                        </button>
                    </div>
                </div>

                {/* Right Side - Comments */}
                <div className={clsx(
                    "w-80 border-l overflow-y-auto p-4",
                    isDark ? "bg-[#0F0F0F] border-[#2A2A2A]" : "bg-gray-50 border-gray-200"
                )}>
                    <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                        <span className={clsx(
                            "text-sm font-medium",
                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                        )}>Comments & Notes</span>
                    </div>

                    {/* Add Comment */}
                    <div className="mb-4">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment or note..."
                            rows={2}
                            className={clsx(
                                "w-full p-2 rounded-lg text-sm border outline-none resize-none",
                                isDark
                                    ? "bg-[#1A1A1A] border-[#2A2A2A] text-[#F5F5F5] placeholder-gray-500"
                                    : "bg-white border-gray-200 text-[#2D3436]"
                            )}
                        />
                        <button
                            onClick={addComment}
                            className="w-full mt-2 px-3 py-2 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15]"
                        >
                            Add Comment
                        </button>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-3">
                        {comments.length === 0 ? (
                            <p className={clsx(
                                "text-sm text-center py-4",
                                isDark ? "text-[#666]" : "text-gray-400"
                            )}>
                                No comments yet
                            </p>
                        ) : (
                            comments.map(comment => (
                                <div
                                    key={comment.id}
                                    className={clsx(
                                        "p-3 rounded-lg group",
                                        comment.isMarkedDone
                                            ? isDark ? "bg-green-900/20 border border-green-800" : "bg-green-50 border border-green-200"
                                            : isDark ? "bg-[#1A1A1A]" : "bg-white"
                                    )}
                                >
                                    <p className={clsx(
                                        "text-xs mb-1",
                                        isDark ? "text-[#A0A0A0]" : "text-gray-500"
                                    )}>
                                        {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                                    </p>

                                    {editingCommentId === comment.id ? (
                                        <div className="mt-1 space-y-2">
                                            <textarea
                                                value={editingCommentText}
                                                onChange={(e) => setEditingCommentText(e.target.value)}
                                                className={clsx(
                                                    "w-full p-2 text-sm rounded border outline-none resize-none",
                                                    isDark ? "bg-[#333] border-[#444] text-white" : "bg-white border-gray-300"
                                                )}
                                                rows={2}
                                                autoFocus
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingCommentId(null)} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                                                <button onClick={saveEditingComment} className="text-xs px-2 py-1 bg-[#FF9F1C] text-white rounded">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className={clsx(
                                            "text-sm whitespace-pre-wrap",
                                            isDark ? "text-[#E0E0E0]" : "text-[#2D3436]"
                                        )}>
                                            {comment.text}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {editingCommentId !== comment.id && (
                                            <button
                                                onClick={() => startEditingComment(comment)}
                                                className={clsx(
                                                    "p-1 rounded transition-colors",
                                                    isDark ? "text-[#A0A0A0] hover:text-blue-400 hover:bg-[#333]" : "text-gray-400 hover:text-blue-500 hover:bg-gray-100"
                                                )}
                                                title="Edit"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteComment(comment.id)}
                                            className={clsx(
                                                "p-1 rounded transition-colors text-red-500 hover:bg-red-500/10",
                                            )}
                                            title="Delete comment"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => toggleCommentDone(comment.id)}
                                            className={clsx(
                                                "p-1 rounded transition-colors flex items-center gap-1",
                                                comment.isMarkedDone
                                                    ? "text-green-500"
                                                    : isDark ? "text-[#666] hover:text-green-400" : "text-gray-400 hover:text-green-500"
                                            )}
                                            title={comment.isMarkedDone ? "Mark as not done" : "Mark as done"}
                                        >
                                            <Heart className={clsx("w-4 h-4", comment.isMarkedDone && "fill-current")} />
                                            <span className="text-xs">{comment.isMarkedDone ? 'Done' : 'Mark done'}</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
