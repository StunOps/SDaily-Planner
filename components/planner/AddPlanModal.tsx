'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { X, Plus, Trash2, Clock, Link, Paperclip, File } from 'lucide-react'
import clsx from 'clsx'
import { Plan, PlanFormData, TimeSlot, Attachment } from '@/lib/types'
import { format } from 'date-fns'
import { formatTimeTo12h } from '@/lib/utils'

interface AddPlanModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (plan: PlanFormData) => void
    selectedDate: Date
    planToEdit?: Plan | null
}

export default function AddPlanModal({ isOpen, onClose, onSave, selectedDate, planToEdit }: AddPlanModalProps) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const fileInputRef = useRef<HTMLInputElement>(null)

    const getInitialFormData = (): PlanFormData => ({
        title: '',
        description: '',
        date: format(selectedDate, 'yyyy-MM-dd'),
        timeSlots: [{ id: crypto.randomUUID(), time: '09:00', description: '' }],
        hasDueDate: false,
        dueDate: format(selectedDate, 'yyyy-MM-dd'),
        includeTime: false,
        attachments: []
    })

    const [formData, setFormData] = useState<PlanFormData>(getInitialFormData())
    const [linkInput, setLinkInput] = useState('')
    const [showLinkInput, setShowLinkInput] = useState(false)

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (planToEdit) {
                // Edit Mode
                setFormData({
                    title: planToEdit.title,
                    description: planToEdit.description || '',
                    date: planToEdit.date,
                    timeSlots: planToEdit.timeSlots || [{ id: crypto.randomUUID(), time: '09:00', description: '' }],
                    hasDueDate: planToEdit.hasDueDate || false,
                    dueDate: planToEdit.dueDate || planToEdit.date,
                    includeTime: !!(planToEdit.timeSlots && planToEdit.timeSlots.length > 0),
                    attachments: planToEdit.attachments || []
                })
            } else {
                // Add Mode
                setFormData({
                    ...getInitialFormData(),
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    dueDate: format(selectedDate, 'yyyy-MM-dd'),
                    includeTime: false
                })
            }
            setLinkInput('')
            setShowLinkInput(false)
        }
    }, [isOpen, selectedDate, planToEdit])

    const handleAddTimeSlot = () => {
        setFormData({
            ...formData,
            timeSlots: [
                ...formData.timeSlots,
                { id: crypto.randomUUID(), time: '10:00', description: '' }
            ]
        })
    }

    const handleRemoveTimeSlot = (id: string) => {
        if (formData.timeSlots.length > 1) {
            setFormData({
                ...formData,
                timeSlots: formData.timeSlots.filter(slot => slot.id !== id)
            })
        }
    }

    const handleTimeSlotChange = (id: string, field: 'time' | 'description', value: string) => {
        setFormData({
            ...formData,
            timeSlots: formData.timeSlots.map(slot =>
                slot.id === id ? { ...slot, [field]: value } : slot
            )
        })
    }

    const handleAddLink = () => {
        if (linkInput.trim()) {
            const newAttachment: Attachment = {
                id: crypto.randomUUID(),
                type: 'link',
                name: linkInput.trim(),
                url: linkInput.trim().startsWith('http') ? linkInput.trim() : `https://${linkInput.trim()}`
            }
            setFormData({
                ...formData,
                attachments: [...formData.attachments, newAttachment]
            })
            setLinkInput('')
            setShowLinkInput(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const file = files[0]
            const reader = new FileReader()
            reader.onload = (event) => {
                const newAttachment: Attachment = {
                    id: crypto.randomUUID(),
                    type: 'file',
                    name: file.name,
                    url: event.target?.result as string
                }
                setFormData({
                    ...formData,
                    attachments: [...formData.attachments, newAttachment]
                })
            }
            reader.readAsDataURL(file)
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleRemoveAttachment = (id: string) => {
        setFormData({
            ...formData,
            attachments: formData.attachments.filter(a => a.id !== id)
        })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title.trim()) return
        onSave(formData)
        setFormData(getInitialFormData())
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={clsx(
                "relative w-full max-w-lg mx-4 rounded-2xl shadow-xl p-6 transition-colors max-h-[90vh] overflow-y-auto",
                isDark ? "bg-[#1A1A1A]" : "bg-white"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className={clsx(
                        "text-xl font-bold",
                        isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                    )}>
                        {planToEdit ? 'Edit Plan' : 'Add Plan'}
                    </h2>
                    <button
                        onClick={onClose}
                        className={clsx(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                            isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
                        )}
                    >
                        <X className={clsx("w-5 h-5", isDark ? "text-gray-400" : "text-gray-500")} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div>
                        <label className={clsx(
                            "block text-sm font-medium mb-2",
                            isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                        )}>
                            Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="What do you need to do?"
                            className={clsx(
                                "w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                    : "bg-[#FFFBF5] border-[#EFEEEE] text-[#2D3436] placeholder-gray-400"
                            )}
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className={clsx(
                            "block text-sm font-medium mb-2",
                            isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                        )}>
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Add details..."
                            rows={2}
                            className={clsx(
                                "w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9F1C] resize-none",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                    : "bg-[#FFFBF5] border-[#EFEEEE] text-[#2D3436] placeholder-gray-400"
                            )}
                        />
                    </div>

                    {/* Start Date */}
                    <div>
                        <label className={clsx(
                            "block text-sm font-medium mb-2",
                            isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                        )}>
                            {formData.hasDueDate ? 'Start Date' : 'Date'}
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className={clsx(
                                "w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                    : "bg-[#FFFBF5] border-[#EFEEEE] text-[#2D3436]"
                            )}
                        />
                    </div>

                    {/* Has Due Date Toggle */}
                    <div className={clsx(
                        "flex items-center gap-3 p-3 rounded-xl",
                        isDark ? "bg-[#2A2A2A]" : "bg-[#FFF2E0]"
                    )}>
                        <input
                            type="checkbox"
                            id="hasDueDate"
                            checked={formData.hasDueDate}
                            onChange={(e) => setFormData({ ...formData, hasDueDate: e.target.checked })}
                            className="w-5 h-5 rounded accent-[#FF9F1C]"
                        />
                        <label
                            htmlFor="hasDueDate"
                            className={clsx(
                                "text-sm cursor-pointer",
                                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                            )}
                        >
                            This is a multi-day task (has due date)
                        </label>
                    </div>

                    {/* Conditional: Time Slots OR Due Date */}
                    {formData.hasDueDate ? (
                        // Due Date field
                        <div>
                            <label className={clsx(
                                "block text-sm font-medium mb-2",
                                isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                            )}>
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                min={formData.date}
                                className={clsx(
                                    "w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]",
                                    isDark
                                        ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                        : "bg-[#FFFBF5] border-[#EFEEEE] text-[#2D3436]"
                                )}
                            />
                        </div>
                    ) : (
                        // Time Slots
                        <div>
                            <div className={clsx(
                                "flex items-center gap-3 p-3 rounded-xl mb-4",
                                isDark ? "bg-[#2A2A2A]" : "bg-[#FFF2E0]"
                            )}>
                                <input
                                    type="checkbox"
                                    id="includeTime"
                                    checked={formData.includeTime}
                                    onChange={(e) => setFormData({ ...formData, includeTime: e.target.checked })}
                                    className="w-5 h-5 rounded accent-[#FF9F1C]"
                                />
                                <label
                                    htmlFor="includeTime"
                                    className={clsx(
                                        "text-sm cursor-pointer",
                                        isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                    )}
                                >
                                    Add specific time schedule
                                </label>
                            </div>

                            {formData.includeTime && (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className={clsx(
                                            "text-sm font-medium",
                                            isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                                        )}>
                                            Time Schedule
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleAddTimeSlot}
                                            className="flex items-center gap-1 text-sm text-[#FF9F1C] hover:text-[#F68E09] transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Time
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.timeSlots.map((slot, index) => (
                                            <div
                                                key={slot.id}
                                                className={clsx(
                                                    "p-3 rounded-xl border space-y-2",
                                                    isDark ? "bg-[#2A2A2A] border-[#3A3A3A]" : "bg-[#FFFBF5] border-[#EFEEEE]"
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className={clsx("w-4 h-4 flex-shrink-0", isDark ? "text-gray-500" : "text-gray-400")} />
                                                        <input
                                                            type="time"
                                                            value={slot.time}
                                                            onChange={(e) => handleTimeSlotChange(slot.id, 'time', e.target.value)}
                                                            className={clsx(
                                                                "w-32 px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]",
                                                                isDark
                                                                    ? "bg-[#1A1A1A] border-[#3A3A3A] text-[#F5F5F5]"
                                                                    : "bg-white border-[#EFEEEE] text-[#2D3436]"
                                                            )}
                                                        />
                                                        <span className={clsx(
                                                            "text-xs font-medium",
                                                            isDark ? "text-gray-400" : "text-gray-500"
                                                        )}>
                                                            ({formatTimeTo12h(slot.time)})
                                                        </span>
                                                    </div>
                                                    {formData.timeSlots.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveTimeSlot(slot.id)}
                                                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={slot.description}
                                                    onChange={(e) => handleTimeSlotChange(slot.id, 'description', e.target.value)}
                                                    placeholder="What's happening at this time?"
                                                    className={clsx(
                                                        "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]",
                                                        isDark
                                                            ? "bg-[#1A1A1A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                                            : "bg-white border-[#EFEEEE] text-[#2D3436] placeholder-gray-400"
                                                    )}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Attachments Section */}
                    <div>
                        <label className={clsx(
                            "block text-sm font-medium mb-2",
                            isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                        )}>
                            Attachments
                        </label>

                        {/* Attachment Buttons */}
                        <div className="flex gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => setShowLinkInput(!showLinkInput)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                                    showLinkInput
                                        ? "bg-[#FF9F1C] border-[#FF9F1C] text-white"
                                        : isDark
                                            ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#A0A0A0] hover:border-[#FF9F1C]"
                                            : "bg-white border-[#EFEEEE] text-[#636E72] hover:border-[#FF9F1C]"
                                )}
                            >
                                <Link className="w-4 h-4" />
                                Paste Link
                            </button>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                                    isDark
                                        ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#A0A0A0] hover:border-[#FF9F1C]"
                                        : "bg-white border-[#EFEEEE] text-[#636E72] hover:border-[#FF9F1C]"
                                )}
                            >
                                <Paperclip className="w-4 h-4" />
                                Attach File
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>

                        {/* Link Input */}
                        {showLinkInput && (
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={linkInput}
                                    onChange={(e) => setLinkInput(e.target.value)}
                                    placeholder="Paste URL here..."
                                    className={clsx(
                                        "flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]",
                                        isDark
                                            ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                            : "bg-white border-[#EFEEEE] text-[#2D3436] placeholder-gray-400"
                                    )}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddLink()
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddLink}
                                    className="px-3 py-2 rounded-lg bg-[#FF9F1C] text-white text-sm hover:bg-[#F68E09] transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                        )}

                        {/* Attached Items List */}
                        {formData.attachments.length > 0 && (
                            <div className="space-y-2">
                                {formData.attachments.map((attachment) => (
                                    <div
                                        key={attachment.id}
                                        className={clsx(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg border",
                                            isDark ? "bg-[#2A2A2A] border-[#3A3A3A]" : "bg-[#FFFBF5] border-[#EFEEEE]"
                                        )}
                                    >
                                        {attachment.type === 'link' ? (
                                            <Link className={clsx("w-4 h-4 flex-shrink-0", isDark ? "text-blue-400" : "text-blue-500")} />
                                        ) : (
                                            <File className={clsx("w-4 h-4 flex-shrink-0", isDark ? "text-green-400" : "text-green-500")} />
                                        )}
                                        <span className={clsx(
                                            "flex-1 text-sm truncate",
                                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                        )}>
                                            {attachment.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAttachment(attachment.id)}
                                            className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF9F1C] to-[#F68E09] text-white font-semibold hover:opacity-90 transition-opacity shadow-md cursor-pointer relative z-10"
                    >
                        {planToEdit ? 'Save Changes' : 'Add Plan'}
                    </button>
                </form>
            </div>
        </div>
    )
}
