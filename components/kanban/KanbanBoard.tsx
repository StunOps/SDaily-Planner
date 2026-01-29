'use client'

import { useState, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { KanbanCard, CardStatus, ChecklistItem, Comment, Attachment, Plan, TimeSlot } from '@/lib/types'
import { fetchCards, createCard, updateCard as updateCardDB, deleteCard as deleteCardDB, fetchPlans, deletePlan, updatePlan, createPlan } from '@/lib/supabaseService'
import { generateUUID } from '@/lib/uuid'
import { Plus, X, Calendar, CheckSquare, MessageSquare, Paperclip, Link2, Trash2, Heart, Clock, FileText, Download, Eye, Image as ImageIcon, Upload, AlignLeft, Edit2, Check } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useData } from '@/lib/DataContext'
import clsx from 'clsx'
import { format, isToday, parseISO, isBefore, isAfter, startOfDay } from 'date-fns'
import { formatTimeTo12h, isOverdue } from '@/lib/utils'

const STORAGE_KEY = 'kanban-cards'
const PLANNER_STORAGE_KEY = 'planner-plans'

const DEFAULT_COLUMNS: KanbanColumn[] = [
    { id: 'inbox', title: 'Inbox', color: '#6366F1', description: 'New tasks' },
    { id: 'pending', title: 'Pending', color: '#F59E0B', description: 'Ongoing plans' },
    { id: 'in-progress', title: 'In Progress', color: '#10B981', description: "Today's plans" },
    { id: 'completed', title: 'Completed', color: '#8B5CF6', description: 'Done' },
]

interface KanbanColumn {
    id: CardStatus;
    title: string;
    color: string;
    description: string;
}

// Convert a Plan from planner to KanbanCard
function planToCard(plan: Plan): KanbanCard {
    return {
        id: `plan-${plan.id}`,
        title: plan.title,
        description: plan.description,
        status: determineCardStatus(plan),
        startDate: plan.date,
        endDate: plan.hasDueDate ? plan.dueDate : plan.date,
        timeSlots: plan.timeSlots,
        checklist: [],
        comments: [],
        attachments: plan.attachments || [],
        createdAt: plan.createdAt,
        linkedPlanId: plan.id,
    }
}

// Determine which column a plan should be in
function determineCardStatus(plan: Plan): CardStatus {
    if (plan.completed) return 'completed'

    const today = startOfDay(new Date())
    const startDate = parseISO(plan.date)
    const endDate = plan.hasDueDate && plan.dueDate ? parseISO(plan.dueDate) : startDate

    // OVERDUE: If it's in the past and not completed, keep it "In Progress" so it stays visible
    if (isOverdue(plan.date, plan.dueDate, plan.completed)) {
        return 'in-progress'
    }

    if (isToday(startDate) || (startDate <= today && endDate >= today)) {
        return 'in-progress'
    }

    if (isAfter(startDate, today) || (plan.hasDueDate && isBefore(today, startDate))) {
        return 'pending'
    }

    return 'inbox'
}

export function KanbanBoard() {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [cards, setCards] = useState<KanbanCard[]>([])
    const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newCardColumn, setNewCardColumn] = useState<CardStatus | null>(null)
    const [newCardTitle, setNewCardTitle] = useState('')
    const [customColumns, setCustomColumns] = useState<KanbanColumn[]>([])
    const {
        cards: rawCards,
        plans,
        isLoading: isDataLoading,
        refreshAll,
        setPlans,
        setCards: setRawCards
    } = useData() // Use global data
    const [isAddSectionOpen, setIsAddSectionOpen] = useState(false)
    const [newSectionTitle, setNewSectionTitle] = useState('')
    const [newSectionDescription, setNewSectionDescription] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [ignoredPlanIds, setIgnoredPlanIds] = useState<string[]>([]) // To suppress ghost plans during deletion

    const [isColumnsLoaded, setIsColumnsLoaded] = useState(false)

    // Load custom columns
    useEffect(() => {
        const savedColumns = localStorage.getItem('kanban-custom-columns')
        if (savedColumns) {
            setCustomColumns(JSON.parse(savedColumns))
        }
        setIsColumnsLoaded(true)
    }, [])

    // Save custom columns
    useEffect(() => {
        if (isColumnsLoaded) {
            localStorage.setItem('kanban-custom-columns', JSON.stringify(customColumns))
        }
    }, [customColumns, isColumnsLoaded])

    const allColumns = [...DEFAULT_COLUMNS, ...customColumns]

    const addSection = () => {
        if (!newSectionTitle.trim()) return
        const newColumn: KanbanColumn = {
            id: `custom-${generateUUID()}`,
            title: newSectionTitle.trim(),
            description: newSectionDescription.trim(),
            color: '#64748B', // Default slate color for custom sections
        }
        setCustomColumns([...customColumns, newColumn])
        setNewSectionTitle('')
        setNewSectionDescription('')
        setIsAddSectionOpen(false)
    }

    const deleteSection = (columnId: string) => {
        if (DEFAULT_COLUMNS.some(c => c.id === columnId)) return // Can't delete default columns
        setCustomColumns(customColumns.filter(c => c.id !== columnId))
        // Note: Cards in this section will become "orphaned" or should be moved?
        // Default behavior: user should move them first, or they stay filtered out.
    }
    // Remove local isLoading, use derived one if needed, or just rely on data presence

    // Sync cards with plans when data changes
    // Sync cards with plans when data changes
    useEffect(() => {
        if (isDataLoading) return

        let kanbanCards = [...rawCards]

        // Sync plans from planner, excluding ignored ones
        plans.forEach(plan => {
            if (ignoredPlanIds.includes(plan.id)) return

            const existingCardIndex = kanbanCards.findIndex(c => c.linkedPlanId === plan.id)
            const newCard = planToCard(plan)

            if (existingCardIndex >= 0) {
                kanbanCards[existingCardIndex] = {
                    ...newCard,
                    timeSlots: plan.timeSlots,
                    checklist: kanbanCards[existingCardIndex].checklist,
                    comments: kanbanCards[existingCardIndex].comments,
                    // Preserve position from DB if it exists (for manually ordered plans)
                    position: kanbanCards[existingCardIndex].position || newCard.position,
                    status: kanbanCards[existingCardIndex].status.startsWith('custom-')
                        ? kanbanCards[existingCardIndex].status // Keep in custom column
                        : kanbanCards[existingCardIndex].status === 'completed'
                            ? 'completed'
                            : newCard.status,
                }
            } else {
                kanbanCards.push(newCard)
            }
        })

        // Remove cards whose linked plans were deleted OR are ignored
        kanbanCards = kanbanCards.filter(card => {
            if (card.linkedPlanId) {
                // If ignored, treat as "missing/deleted" from planner perspective
                if (ignoredPlanIds.includes(card.linkedPlanId)) return false
                return plans.some(p => p.id === card.linkedPlanId)
            }
            return true
        })

        setCards(kanbanCards)
    }, [rawCards, plans, isDataLoading, ignoredPlanIds]) // Add ignoredPlanIds to dependency

    // Sync card changes back to planner (Supabase)
    const syncCardToPlanner = async (card: KanbanCard) => {
        if (!card.linkedPlanId) return

        const planUpdate: Partial<Plan> = {
            id: card.linkedPlanId,
            title: card.title,
            description: card.description || '',
            date: card.startDate || new Date().toISOString(),
            dueDate: card.endDate,
            hasDueDate: !!(card.startDate && card.endDate && card.startDate !== card.endDate),
            attachments: card.attachments,
            completed: card.status === 'completed',
        }

        try {
            await updatePlan(planUpdate as Plan)
        } catch (error) {
            console.error('Failed to sync card to planner:', error)
        }
    }

    // Create plan in planner when card gets dates
    const createPlanFromCard = async (card: KanbanCard) => {
        if (!card.startDate || card.linkedPlanId) return

        const newPlan: Plan = {
            id: generateUUID(),
            title: card.title,
            description: card.description,
            date: card.startDate,
            hasDueDate: !!(card.endDate && card.startDate !== card.endDate),
            dueDate: card.endDate,
            attachments: card.attachments,
            completed: card.status === 'completed',
            createdAt: card.createdAt,
        }

        const created = await createPlan(newPlan)
        return created ? created.id : null
    }

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return

        const { source, destination, draggableId } = result

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return
        }

        const newStatus = destination.droppableId as CardStatus

        // Find the card being dragged
        const cardLike = cards.find(c => c.id === draggableId)
        if (!cardLike) return

        // Calculate new position
        const destCards = cards
            .filter(c => c.status === newStatus && c.id !== draggableId)
            .sort((a, b) => (a.position || 0) - (b.position || 0))

        let newPosition = 0
        if (destCards.length === 0) {
            newPosition = 1000
        } else if (destination.index === 0) {
            newPosition = (destCards[0].position || 0) / 2
        } else if (destination.index >= destCards.length) {
            newPosition = (destCards[destCards.length - 1].position || 0) + 1000
        } else {
            const prev = destCards[destination.index - 1]
            const next = destCards[destination.index]
            newPosition = ((prev.position || 0) + (next.position || 0)) / 2
        }

        // Create updated card object
        const updatedCard = { ...cardLike, status: newStatus, position: newPosition }

        // Optimistic update
        const sortedCards = cards.map(c =>
            c.id === draggableId ? updatedCard : c
        ).sort((a, b) => (a.position || 0) - (b.position || 0))

        setCards(sortedCards)

        // Also update rawCards to prevent useEffect from reverting status!
        // Only update rawCards for REAL cards (not virtual plan-* cards)
        if (!updatedCard.id.startsWith('plan-')) {
            setRawCards(prevRaw => {
                const exists = prevRaw.find(c => c.id === updatedCard.id)
                if (exists) {
                    return prevRaw.map(c => c.id === updatedCard.id ? updatedCard : c)
                }
                return prevRaw
            })
        }

        // Trigger side effects
        syncCardToPlanner(updatedCard)

        if (updatedCard.id.startsWith('plan-') && updatedCard.linkedPlanId) {
            // It's a virtual plan card, update the underlying plan
            const status = updatedCard.status
            const completed = status === 'completed'

            const planUpdate = {
                id: updatedCard.linkedPlanId,
                title: updatedCard.title,
                description: updatedCard.description,
                date: updatedCard.startDate || new Date().toISOString(),
                hasDueDate: !!(updatedCard.endDate && updatedCard.startDate !== updatedCard.endDate),
                dueDate: updatedCard.endDate,
                completed: completed,
                // These fields are not updated by updatePlan SQL update, but required by type
                timeSlots: updatedCard.timeSlots,
                attachments: updatedCard.attachments,
                createdAt: updatedCard.createdAt
                // Plans don't natively support manual position yet in DB, 
                // but since we are doing manual ordering, we might want to convert it to a real card if moved?
                // For now, let's just trigger updatePlan.
                // NOTE: If the user reorders a plan card, the position won't stick unless we promote it to a real card.
                // Let's rely on my previous "promotion" logic in updateCard!
            }

            // To save position for a PLAN, we MUST call updateCardDB (which promotes it)
            // updateCardDB handles promotion if needed.
            updateCardDB(updatedCard).catch(error => {
                console.error('Failed to update card status/position:', error)
                // Revert
                setCards(prev => prev.map(c =>
                    c.id === draggableId ? cardLike : c
                ))
            })

        } else {
            // It's a real card
            updateCardDB(updatedCard).catch(error => {
                console.error('Failed to update card status:', error)
                // Revert on failure
                setCards(prev => prev.map(c =>
                    c.id === draggableId ? cardLike : c
                ))
            })
        }
    }

    const addCard = async (status: CardStatus) => {
        if (!newCardTitle.trim()) return

        const maxPos = Math.max(0, ...cards.map(c => c.position || 0))
        const newCard: KanbanCard = {
            id: generateUUID(),
            title: newCardTitle.trim(),
            status,
            checklist: [],
            comments: [],
            attachments: [],
            createdAt: new Date().toISOString(),
            position: maxPos + 1000,
        }

        const created = await createCard(newCard)
        if (created) {
            setCards(prev => [...prev, newCard])
        }
        setNewCardTitle('')
        setNewCardColumn(null)
    }

    const updateCard = async (updatedCard: KanbanCard) => {
        let finalCard = { ...updatedCard }

        // 1. Handle Date Clearing Case (Atomic)
        if (!updatedCard.startDate) {
            // Only move to inbox if NOT in a custom section
            if (!finalCard.status.startsWith('custom-')) {
                finalCard.status = 'inbox'
            }

            // Special Case: If this was a virtual plan card (starts with 'plan-'), 
            // we must CREATE a real card to persist it, because the plan (its source) is about to be deleted.
            if (updatedCard.id.startsWith('plan-')) {
                try {
                    const newCardId = generateUUID()
                    const realCard: KanbanCard = {
                        ...finalCard,
                        id: newCardId,
                        linkedPlanId: undefined, // Fully unlink
                        status: finalCard.status, // Preserve accepted status
                        createdAt: new Date().toISOString()
                    }

                    // 1. Create real persistent card
                    const created = await createCard(realCard)
                    if (!created) throw new Error("Failed to persist card during unschedule")

                    // 2. Delete the old plan
                    if (selectedCard?.linkedPlanId) {
                        const planIdToDelete = selectedCard.linkedPlanId
                        // Immediate suppress to prevent ghost
                        setIgnoredPlanIds(prev => [...prev, planIdToDelete])
                        await deletePlan(planIdToDelete)
                    }

                    // 3. Optimistic Update: Replace the virtual card with the new real one
                    setRawCards(prev => [...prev.filter(c => c.id !== updatedCard.id), realCard])
                    setPlans(prev => prev.filter(p => p.id !== selectedCard?.linkedPlanId))

                    // 4. Cleanup
                    // Do NOT await refreshAll() here. It causes a race condition where the plan 
                    // is re-fetched before the DB deletion propagates, causing a duplicate card.
                    // Trust the optimistic update and let Realtime subscription handle eventual consistency.

                    setIsModalOpen(false)
                    setSelectedCard(null)
                    return // Stop further processing
                } catch (err) {
                    console.error("Failed to migrate virtual card:", err)
                    setError("Failed to unschedule card. Please try again.")
                    return
                }
            }

            // Normal Case: It's already a real card, just delete the link
            if (selectedCard?.linkedPlanId) {
                try {
                    await deletePlan(selectedCard.linkedPlanId)
                    finalCard.linkedPlanId = undefined
                } catch (err) {
                    console.error("Failed to delete linked plan during clear:", err)
                }
            }
        }
        // 2. Handle Plan Sync/Creation Case
        else if (finalCard.startDate) {
            // Auto-categorize based on dates if not completed AND not in a custom section
            if (finalCard.status !== 'completed' && !finalCard.status.startsWith('custom-')) {
                const today = startOfDay(new Date())
                const startDate = parseISO(finalCard.startDate)
                const endDate = finalCard.endDate ? parseISO(finalCard.endDate) : startDate

                if (isToday(startDate) || (startDate <= today && endDate >= today)) {
                    finalCard.status = 'in-progress'
                } else if (isOverdue(finalCard.startDate, finalCard.endDate, false)) {
                    finalCard.status = 'in-progress'
                } else if (isAfter(startDate, today)) {
                    finalCard.status = 'pending'
                }
            }

            // Create or update plan
            if (!finalCard.linkedPlanId) {
                const planId = await createPlanFromCard(finalCard)
                if (planId) finalCard.linkedPlanId = planId
            } else {
                await syncCardToPlanner(finalCard)
            }
        }

        // 3. Optimistic Local Update to prevent race condition in useEffect
        if (!finalCard.startDate && selectedCard?.linkedPlanId) {
            setPlans(prev => prev.filter(p => p.id !== selectedCard.linkedPlanId))
        }
        setRawCards(prev => prev.map(c => c.id === finalCard.id ? finalCard : c))

        // 4. Persist to Database
        try {
            const success = await updateCardDB(finalCard)
            if (!success) throw new Error("Could not update card in database.")

            // 5. Force Refreshes and Close
            refreshAll(true) // Silent refresh
            setIsModalOpen(false)
            setSelectedCard(null)
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred while updating the card.")
        }
    }

    const deleteCard = async (cardId: string) => {
        // Find card in the combined list (including virtual ones), not just raw DB cards
        const card = cards.find(c => c.id === cardId)

        // Optimistic update
        setRawCards(prev => prev.filter(c => c.id !== cardId)) // Won't hurt if not in rawCards
        if (card?.linkedPlanId) {
            setPlans(prev => prev.filter(p => p.id !== card.linkedPlanId))
            // Also add to ignore list to prevent ghosts
            setIgnoredPlanIds(prev => [...prev, card.linkedPlanId!])
        }

        // Background persistence
        if (card?.linkedPlanId) {
            await deletePlan(card.linkedPlanId)
        }

        // Only delete from DB if it's a real card (not virtual plan-card)
        if (!cardId.startsWith('plan-')) {
            await deleteCardDB(cardId)
        }

        refreshAll(true)
        setIsModalOpen(false)
        setSelectedCard(null)
    }

    const openCard = (card: KanbanCard) => {
        setSelectedCard(card)
        setIsModalOpen(true)
    }

    const getColumnCards = (status: CardStatus) => {
        return cards
            .filter(card => card.status === status)
            .sort((a, b) => (a.position || 0) - (b.position || 0))
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className={clsx(
                    "text-3xl font-bold",
                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                )}>
                    Cards
                </h1>
                <p className={clsx(
                    "mt-2",
                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                )}>
                    Your task board. Plans from the planner sync here automatically.
                </p>
            </header>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="space-y-8">
                    {/* Row 1: Default Columns */}
                    <div>
                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                            {DEFAULT_COLUMNS.map(column => (
                                <Droppable key={column.id} droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={clsx(
                                                "flex-shrink-0 w-72 p-3 rounded-2xl transition-colors",
                                                isDark ? "bg-[#1A1A1A]" : "bg-gray-100",
                                                snapshot.isDraggingOver && (isDark ? "bg-[#2A2A2A]" : "bg-gray-200")
                                            )}
                                        >
                                            {/* Column Header */}
                                            <div className="mb-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: column.color }}
                                                        />
                                                        <h3 className={clsx(
                                                            "font-semibold",
                                                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                                        )}>
                                                            {column.title}
                                                        </h3>
                                                        <span className={clsx(
                                                            "text-xs px-2 py-0.5 rounded-full",
                                                            isDark ? "bg-[#2A2A2A] text-[#A0A0A0]" : "bg-gray-200 text-gray-600"
                                                        )}>
                                                            {getColumnCards(column.id).length}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className={clsx(
                                                    "text-xs mt-1",
                                                    isDark ? "text-[#666]" : "text-gray-400"
                                                )}>
                                                    {column.description}
                                                </p>
                                            </div>

                                            {/* Cards */}
                                            <div className="space-y-2 min-h-[100px]">
                                                {getColumnCards(column.id).map((card, index) => (
                                                    <Draggable key={card.id} draggableId={card.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                onClick={() => openCard(card)}
                                                                className={clsx(
                                                                    "group p-3 rounded-xl cursor-pointer transition-all border",
                                                                    isDark
                                                                        ? "bg-[#2A2A2A] border-[#3A3A3A] hover:border-[#FF9F1C]"
                                                                        : "bg-white border-gray-200 hover:border-[#FF9F1C]",
                                                                    snapshot.isDragging && "shadow-lg rotate-2",
                                                                    card.linkedPlanId && (isDark ? "border-l-2 border-l-[#FF9F1C]" : "border-l-2 border-l-[#FF9F1C]"),
                                                                    isOverdue(card.startDate, card.endDate, card.status === 'completed') && (
                                                                        isDark
                                                                            ? "border-red-500/50 bg-red-500/10 hover:border-red-500"
                                                                            : "border-red-200 bg-red-50 hover:border-red-400"
                                                                    )
                                                                )}
                                                            >
                                                                <div className="flex items-start justify-between">
                                                                    <p className={clsx(
                                                                        "text-sm font-medium line-clamp-2",
                                                                        isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                                                    )}>
                                                                        {card.title}
                                                                    </p>
                                                                    {column.id === 'completed' && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                deleteCard(card.id)
                                                                            }}
                                                                            className={clsx(
                                                                                "p-1 rounded hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity",
                                                                            )}
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Card Footer */}
                                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                                    {card.timeSlots && card.timeSlots.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                                                                        )}>
                                                                            <Clock className="w-3 h-3" />
                                                                            {formatTimeTo12h(card.timeSlots[0].time)}
                                                                        </span>
                                                                    )}
                                                                    {card.endDate && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FFF2E0] text-[#CC7A00]"
                                                                        )}>
                                                                            <Calendar className="w-3 h-3" />
                                                                            {format(new Date(card.endDate), 'MMM d')}
                                                                        </span>
                                                                    )}
                                                                    {card.checklist.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                                                                        )}>
                                                                            <CheckSquare className="w-3 h-3" />
                                                                            {card.checklist.filter(c => c.completed).length}/{card.checklist.length}
                                                                        </span>
                                                                    )}
                                                                    {card.description && (
                                                                        <span className={clsx(
                                                                            "text-xs p-1 rounded flex items-center gap-1",
                                                                            isDark ? "text-gray-400 hover:bg-gray-700/50" : "text-gray-400 hover:bg-gray-100"
                                                                        )}>
                                                                            <AlignLeft className="w-3.5 h-3.5" />
                                                                        </span>
                                                                    )}
                                                                    {card.comments.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "text-gray-400 bg-gray-700/30" : "text-gray-500 bg-gray-100"
                                                                        )}>
                                                                            <MessageSquare className="w-3 h-3" />
                                                                            {card.comments.length}
                                                                        </span>
                                                                    )}
                                                                    {card.attachments.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "text-gray-400 bg-gray-700/30" : "text-gray-500 bg-gray-100"
                                                                        )}>
                                                                            <Paperclip className="w-3 h-3" />
                                                                            {card.attachments.length}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>

                                            {/* Add Card Button */}
                                            {newCardColumn === column.id ? (
                                                <div className="mt-2">
                                                    <input
                                                        type="text"
                                                        value={newCardTitle}
                                                        onChange={(e) => setNewCardTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') addCard(column.id)
                                                            if (e.key === 'Escape') setNewCardColumn(null)
                                                        }}
                                                        placeholder="Enter card title..."
                                                        autoFocus
                                                        className={clsx(
                                                            "w-full p-2 rounded-lg text-sm border outline-none",
                                                            isDark
                                                                ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                                                : "bg-white border-gray-300 text-[#2D3436]"
                                                        )}
                                                    />
                                                    <div className="flex gap-2 mt-2">
                                                        <button
                                                            onClick={() => addCard(column.id)}
                                                            className="px-3 py-1 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15]"
                                                        >
                                                            Add
                                                        </button>
                                                        <button
                                                            onClick={() => setNewCardColumn(null)}
                                                            className={clsx(
                                                                "p-1 rounded-lg",
                                                                isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-gray-200"
                                                            )}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setNewCardColumn(column.id)}
                                                    className={clsx(
                                                        "w-full mt-2 p-2 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors",
                                                        isDark
                                                            ? "text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-[#F5F5F5]"
                                                            : "text-gray-500 hover:bg-gray-200 hover:text-[#2D3436]"
                                                    )}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add Card
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            ))}
                        </div>
                    </div>

                    {/* Row 2: Custom Sections */}
                    <div className="pt-6 border-t border-dashed border-gray-600/30">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={clsx("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                                <div className="w-2 h-6 bg-[#FF9F1C] rounded-full" />
                                Custom Sections
                            </h3>
                            {!isAddSectionOpen && (
                                <button
                                    onClick={() => setIsAddSectionOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#FF9F1C]/10 text-[#FF9F1C] rounded-lg text-sm font-semibold hover:bg-[#FF9F1C]/20 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    New Section
                                </button>
                            )}
                        </div>

                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar min-h-[300px]">
                            {customColumns.map(column => (
                                <Droppable key={column.id} droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={clsx(
                                                "flex-shrink-0 w-72 p-3 rounded-2xl transition-colors",
                                                isDark ? "bg-[#1A1A1A]/60" : "bg-gray-50",
                                                snapshot.isDraggingOver && (isDark ? "bg-[#2A2A2A]" : "bg-gray-200")
                                            )}
                                        >
                                            {/* Column Header */}
                                            <div className="mb-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: column.color }}
                                                        />
                                                        <h3 className={clsx(
                                                            "font-semibold",
                                                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                                        )}>
                                                            {column.title}
                                                        </h3>
                                                        <span className={clsx(
                                                            "text-xs px-2 py-0.5 rounded-full",
                                                            isDark ? "bg-[#2A2A2A] text-[#A0A0A0]" : "bg-gray-200 text-gray-600"
                                                        )}>
                                                            {getColumnCards(column.id).length}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => deleteSection(column.id)}
                                                        className={clsx(
                                                            "p-1 rounded hover:bg-red-500/10 text-red-500 opacity-50 hover:opacity-100 transition-opacity",
                                                        )}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                {column.description && (
                                                    <p className={clsx(
                                                        "text-xs mt-1",
                                                        isDark ? "text-[#666]" : "text-gray-400"
                                                    )}>
                                                        {column.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Cards */}
                                            <div className="space-y-2 min-h-[100px]">
                                                {getColumnCards(column.id).map((card, index) => (
                                                    <Draggable key={card.id} draggableId={card.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                onClick={() => openCard(card)}
                                                                className={clsx(
                                                                    "group p-3 rounded-xl cursor-pointer transition-all border",
                                                                    isOverdue(card.startDate, card.endDate, card.status === 'completed')
                                                                        ? (isDark
                                                                            ? "bg-red-500/10 border-red-500/50 hover:border-red-500"
                                                                            : "bg-red-100 border-red-400 hover:border-red-500")
                                                                        : (isDark
                                                                            ? "bg-[#2A2A2A] border-[#3A3A3A] hover:border-[#FF9F1C]"
                                                                            : "bg-white border-gray-200 hover:border-[#FF9F1C]"),
                                                                    card.linkedPlanId && (isDark ? "border-l-2 border-l-[#FF9F1C]" : "border-l-2 border-l-[#FF9F1C]")
                                                                )}
                                                            >
                                                                <p className={clsx(
                                                                    "text-sm font-medium line-clamp-2",
                                                                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                                                )}>
                                                                    {card.title}
                                                                </p>
                                                                {/* Card Footer */}
                                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                                    {card.timeSlots && card.timeSlots.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                                                                        )}>
                                                                            <Clock className="w-3 h-3" />
                                                                            {formatTimeTo12h(card.timeSlots[0].time)}
                                                                        </span>
                                                                    )}
                                                                    {card.endDate && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isOverdue(card.startDate, card.endDate, card.status === 'completed')
                                                                                ? (isDark ? "bg-red-900/40 text-red-400" : "bg-red-200 text-red-700")
                                                                                : (isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FFF2E0] text-[#CC7A00]")
                                                                        )}>
                                                                            <Calendar className="w-3 h-3" />
                                                                            {format(new Date(card.endDate), 'MMM d')}
                                                                        </span>
                                                                    )}
                                                                    {card.checklist.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                                                                        )}>
                                                                            <CheckSquare className="w-3 h-3" />
                                                                            {card.checklist.filter(c => c.completed).length}/{card.checklist.length}
                                                                        </span>
                                                                    )}
                                                                    {card.description && (
                                                                        <span className={clsx(
                                                                            "text-xs p-1 rounded flex items-center gap-1",
                                                                            isDark ? "text-gray-400 hover:bg-gray-700/50" : "text-gray-400 hover:bg-gray-100"
                                                                        )}>
                                                                            <AlignLeft className="w-3.5 h-3.5" />
                                                                        </span>
                                                                    )}
                                                                    {card.comments.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "text-gray-400 bg-gray-700/30" : "text-gray-500 bg-gray-100"
                                                                        )}>
                                                                            <MessageSquare className="w-3 h-3" />
                                                                            {card.comments.length}
                                                                        </span>
                                                                    )}
                                                                    {card.attachments.length > 0 && (
                                                                        <span className={clsx(
                                                                            "text-xs px-2 py-0.5 rounded flex items-center gap-1",
                                                                            isDark ? "text-gray-400 bg-gray-700/30" : "text-gray-500 bg-gray-100"
                                                                        )}>
                                                                            <Paperclip className="w-3 h-3" />
                                                                            {card.attachments.length}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>

                                            {/* Add Card Button */}
                                            {newCardColumn === column.id ? (
                                                <div className="mt-2">
                                                    <input
                                                        type="text"
                                                        value={newCardTitle}
                                                        onChange={(e) => setNewCardTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') addCard(column.id)
                                                            if (e.key === 'Escape') setNewCardColumn(null)
                                                        }}
                                                        placeholder="Enter card title..."
                                                        autoFocus
                                                        className={clsx(
                                                            "w-full p-2 rounded-lg text-sm border outline-none",
                                                            isDark
                                                                ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                                                : "bg-white border-gray-300 text-[#2D3436]"
                                                        )}
                                                    />
                                                    <div className="flex gap-2 mt-2">
                                                        <button
                                                            onClick={() => addCard(column.id)}
                                                            className="px-3 py-1 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15]"
                                                        >
                                                            Add
                                                        </button>
                                                        <button
                                                            onClick={() => setNewCardColumn(null)}
                                                            className={clsx(
                                                                "p-1 rounded-lg",
                                                                isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-gray-200"
                                                            )}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setNewCardColumn(column.id)}
                                                    className={clsx(
                                                        "w-full mt-2 p-2 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors",
                                                        isDark
                                                            ? "text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-[#F5F5F5]"
                                                            : "text-gray-500 hover:bg-gray-200 hover:text-[#2D3436]"
                                                    )}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add Card
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            ))}

                            {/* Add Section Form at the end of Row 2 */}
                            {isAddSectionOpen && (
                                <div className="flex-shrink-0 w-72">
                                    <div className={clsx(
                                        "p-4 rounded-2xl border-2 border-dashed",
                                        isDark ? "bg-[#1A1A1A] border-[#3A3A3A]" : "bg-gray-50 border-gray-300"
                                    )}>
                                        <h4 className={clsx("text-sm font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
                                            Create New Section
                                        </h4>
                                        <input
                                            type="text"
                                            value={newSectionTitle}
                                            onChange={(e) => setNewSectionTitle(e.target.value)}
                                            placeholder="Section name..."
                                            className={clsx(
                                                "w-full p-2 mb-2 rounded-lg text-sm border outline-none",
                                                isDark
                                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                                    : "bg-white border-gray-300 text-[#2D3436]"
                                            )}
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            value={newSectionDescription}
                                            onChange={(e) => setNewSectionDescription(e.target.value)}
                                            placeholder="Description (optional)..."
                                            className={clsx(
                                                "w-full p-2 mb-3 rounded-lg text-sm border outline-none",
                                                isDark
                                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                                    : "bg-white border-gray-300 text-[#2D3436]"
                                            )}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={addSection}
                                                className="flex-1 px-4 py-2 bg-[#FF9F1C] text-white rounded-lg text-sm font-semibold hover:bg-[#E08A15] transition-colors"
                                            >
                                                Add Section
                                            </button>
                                            <button
                                                onClick={() => setIsAddSectionOpen(false)}
                                                className={clsx(
                                                    "px-2 py-2 rounded-lg transition-colors",
                                                    isDark ? "bg-[#3A3A3A] text-white hover:bg-[#4A4A4A]" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                                )}
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {customColumns.length === 0 && !isAddSectionOpen && (
                                <div className={clsx(
                                    "flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8",
                                    isDark ? "border-[#2A2A2A] text-[#666]" : "border-gray-200 text-gray-400"
                                )}>
                                    <Plus className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-sm">No custom sections yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DragDropContext>

            {/* Card Modal with Key for State Reset */}
            {isModalOpen && selectedCard && (
                <CardModal
                    key={selectedCard.id}
                    card={selectedCard}
                    onClose={() => {
                        setIsModalOpen(false)
                        setSelectedCard(null)
                    }}
                    onUpdate={updateCard}
                    onDelete={deleteCard}
                    isDark={isDark}
                />
            )}
            {/* Error Modal */}
            {error && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={clsx(
                        "w-full max-w-sm rounded-2xl shadow-2xl p-6 border-2 animate-in zoom-in duration-300",
                        isDark ? "bg-[#1A1A1A] border-red-500/30" : "bg-white border-red-100"
                    )}>
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                                <X className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className={clsx(
                                    "text-lg font-bold",
                                    isDark ? "text-white" : "text-[#2D3436]"
                                )}>
                                    Something went wrong
                                </h3>
                                <p className={clsx(
                                    "text-sm",
                                    isDark ? "text-gray-400" : "text-gray-500"
                                )}>
                                    {error}
                                </p>
                            </div>
                            <button
                                onClick={() => setError(null)}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Card Modal Component with side-by-side layout
interface CardModalProps {
    card: KanbanCard
    onClose: () => void
    onUpdate: (card: KanbanCard) => void
    onDelete: (cardId: string) => void
    isDark: boolean
}

function CardModal({ card, onClose, onUpdate, onDelete, isDark }: CardModalProps) {
    const [title, setTitle] = useState(card.title)
    const [description, setDescription] = useState(card.description || '')
    const [startDate, setStartDate] = useState(card.startDate || '')
    const [endDate, setEndDate] = useState(card.endDate || '')
    const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist)
    const [comments, setComments] = useState<Comment[]>(card.comments)
    const [attachments, setAttachments] = useState<Attachment[]>(card.attachments)
    const [newChecklistItem, setNewChecklistItem] = useState('')
    const [newComment, setNewComment] = useState('')
    const [newLinkName, setNewLinkName] = useState('')
    const [newLinkUrl, setNewLinkUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSave = async () => {
        if (isSubmitting) return
        setIsSubmitting(true)
        try {
            await onUpdate({
                ...card,
                title,
                description,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                checklist,
                comments,
                attachments,
            })
        } catch (error) {
            setIsSubmitting(false)
        }
    }

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

    const saveCardChanges = async () => {
        if (isSubmitting) return
        setIsSubmitting(true)

        // 1. Clear UI states immediately
        setStartDate('')
        setEndDate('')

        // 2. Trigger atomic update: clear dates, remove link, move to inbox
        try {
            await onUpdate({
                ...card,
                title,
                description,
                startDate: undefined,
                endDate: undefined,
                status: 'inbox',
                linkedPlanId: card.linkedPlanId, // Parent uses this to know what to delete
                checklist,
                comments,
                attachments,
            })
        } catch (error) {
            setIsSubmitting(false)
        }

        // Modal will be closed by onUpdate/updateCard
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

    const addLink = () => {
        if (!newLinkName.trim() || !newLinkUrl.trim()) return
        setAttachments([...attachments, {
            id: generateUUID(),
            type: 'link',
            name: newLinkName.trim(),
            url: newLinkUrl.trim(),
        }])
        setNewLinkName('')
        setNewLinkUrl('')
    }

    const deleteAttachment = (id: string) => {
        setAttachments(attachments.filter(a => a.id !== id))
    }

    // File Upload Logic
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            const base64String = reader.result as string
            setAttachments([...attachments, {
                id: generateUUID(),
                type: 'file',
                name: file.name,
                url: base64String
            }])
        }
        reader.readAsDataURL(file)
    }

    const handleAttachmentClick = (attachment: Attachment) => {
        if (attachment.type === 'file') {
            setPreviewAttachment(attachment)
        } else {
            window.open(attachment.url, '_blank')
        }
    }

    const checklistProgress = checklist.length > 0
        ? Math.round((checklist.filter(c => c.completed).length / checklist.length) * 100)
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

            {/* Modal - Wider with side layout */}
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

                    {/* Linked Plan Indicator */}
                    {card.linkedPlanId && (
                        <div className={clsx(
                            "text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1 mb-4",
                            isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FFF2E0] text-[#CC7A00]"
                        )}>
                            📅 Synced with Planner
                        </div>
                    )}

                    {/* Description */}
                    <div className="mb-4">
                        <label className={clsx(
                            "text-sm font-medium",
                            isDark ? "text-[#A0A0A0]" : "text-gray-600"
                        )}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add a more detailed description..."
                            rows={8}
                            className={clsx(
                                "w-full mt-1 p-3 rounded-lg border outline-none resize-none min-h-[120px]",
                                isDark
                                    ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                    : "bg-gray-50 border-gray-200 text-[#2D3436]"
                            )}
                        />
                    </div>

                    {/* Scheduled Toggle */}
                    <div className="flex items-center gap-2 mb-4">
                        <input
                            type="checkbox"
                            id="is-scheduled-checkbox"
                            checked={!!startDate}
                            onChange={(e) => {
                                if (!e.target.checked) {
                                    saveCardChanges()
                                } else {
                                    // Default to today when enabling
                                    setStartDate(new Date().toISOString().split('T')[0])
                                }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-[#FF9F1C] focus:ring-[#FF9F1C]"
                        />
                        <label htmlFor="is-scheduled-checkbox" className={clsx(
                            "text-sm font-bold",
                            isDark ? "text-white" : "text-[#2D3436]"
                        )}>
                            Schedule this task
                        </label>
                    </div>

                    {/* Dates Section - Only visible if scheduled */}
                    {startDate && (
                        <div className="grid grid-cols-2 gap-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="relative group/date">
                                <label className={clsx(
                                    "text-sm font-medium flex items-center justify-between",
                                    isDark ? "text-[#A0A0A0]" : "text-gray-600"
                                )}>
                                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Start Date</span>
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={clsx(
                                        "w-full mt-1 p-2 rounded-lg border outline-none",
                                        isDark
                                            ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                            : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                    )}
                                />
                            </div>
                            <div>
                                <label className={clsx(
                                    "text-sm font-medium flex items-center gap-1",
                                    isDark ? "text-[#A0A0A0]" : "text-gray-600"
                                )}>
                                    <Calendar className="w-4 h-4" /> End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={clsx(
                                        "w-full mt-1 p-2 rounded-lg border outline-none",
                                        isDark
                                            ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5]"
                                            : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                    )}
                                />
                            </div>
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

                    {/* Attachments Section */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Paperclip className="w-4 h-4 text-blue-500" />
                                <span className={clsx(
                                    "text-sm font-medium",
                                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                )}>Attachments</span>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={clsx(
                                        "p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors",
                                        isDark
                                            ? "bg-[#2A2A2A] text-[#F5F5F5] hover:bg-[#3A3A3A]"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    )}
                                >
                                    <Upload className="w-3 h-3" />
                                    Upload File
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 mb-2">
                            {attachments.map(attachment => (
                                <div
                                    key={attachment.id}
                                    className={clsx(
                                        "flex items-center justify-between p-2 rounded-lg",
                                        isDark ? "bg-[#2A2A2A]" : "bg-gray-50"
                                    )}
                                >
                                    <button
                                        onClick={() => handleAttachmentClick(attachment)}
                                        className="flex items-center gap-2 text-sm text-left truncate flex-1 hover:opacity-80 transition-opacity"
                                    >
                                        {attachment.type === 'file' ? (
                                            attachment.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                <ImageIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                            ) : (
                                                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                            )
                                        ) : (
                                            <Link2 className="w-4 h-4 text-[#FF9F1C] flex-shrink-0" />
                                        )}
                                        <span className={clsx(
                                            "truncate",
                                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                        )}>{attachment.name}</span>
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {attachment.type === 'file' && (
                                            <a
                                                href={attachment.url}
                                                download={attachment.name}
                                                className={clsx(
                                                    "p-1 rounded opacity-50 hover:opacity-100",
                                                    isDark ? "hover:bg-[#3A3A3A] text-[#F5F5F5]" : "hover:bg-gray-100 text-[#2D3436]"
                                                )}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => deleteAttachment(attachment.id)}
                                            className={clsx(
                                                "p-1 rounded opacity-50 hover:opacity-100",
                                                isDark ? "hover:bg-[#3A3A3A]" : "hover:bg-gray-100"
                                            )}
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <input
                                type="text"
                                value={newLinkName}
                                onChange={(e) => setNewLinkName(e.target.value)}
                                placeholder="Link name..."
                                className={clsx(
                                    "w-full p-2 rounded-lg text-sm border outline-none",
                                    isDark
                                        ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                        : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                )}
                            />
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={newLinkUrl}
                                    onChange={(e) => setNewLinkUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addLink()}
                                    placeholder="https://..."
                                    className={clsx(
                                        "flex-1 p-2 rounded-lg text-sm border outline-none",
                                        isDark
                                            ? "bg-[#2A2A2A] border-[#3A3A3A] text-[#F5F5F5] placeholder-gray-500"
                                            : "bg-gray-50 border-gray-200 text-[#2D3436]"
                                    )}
                                />
                                <button
                                    onClick={addLink}
                                    className="px-3 py-2 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15]"
                                >
                                    Add Link
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Schedule - Time Slots from Planner (read-only) */}
                    {card.timeSlots && card.timeSlots.length > 0 && (
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-blue-500" />
                                <span className={clsx(
                                    "text-sm font-medium",
                                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                )}>Scheduled Times</span>
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded",
                                    isDark ? "bg-[#2A2A2A] text-[#A0A0A0]" : "bg-gray-100 text-gray-500"
                                )}>from Planner</span>
                            </div>
                            <div className="space-y-2">
                                {card.timeSlots.map(slot => (
                                    <div
                                        key={slot.id}
                                        className={clsx(
                                            "flex items-start gap-3 p-2 rounded-lg",
                                            isDark ? "bg-[#2A2A2A]" : "bg-blue-50"
                                        )}
                                    >
                                        <span className={clsx(
                                            "font-medium text-sm px-2 py-0.5 rounded",
                                            isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                                        )}>
                                            {formatTimeTo12h(slot.time)}
                                        </span>
                                        <span className={clsx(
                                            "text-sm flex-1",
                                            isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                                        )}>
                                            {slot.description || 'No description'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Delete Button */}
                    <div className={clsx(
                        "pt-4 border-t",
                        isDark ? "border-[#2A2A2A]" : "border-gray-200"
                    )}>
                        <button
                            onClick={() => onDelete(card.id)}
                            className="flex items-center gap-2 text-red-500 text-sm hover:underline"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Card
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
                        )}>Comments & Progress</span>
                    </div>

                    {/* Add Comment */}
                    <div className="mb-4">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment or progress note..."
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
            </div >

            {/* Preview Modal */}
            {
                previewAttachment && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className={clsx(
                            "relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden",
                            isDark ? "bg-[#1A1A1A]" : "bg-white"
                        )}>
                            {/* Header */}
                            <div className={clsx(
                                "flex items-center justify-between p-4 border-b",
                                isDark ? "border-[#2A2A2A]" : "border-gray-200"
                            )}>
                                <h3 className={clsx(
                                    "text-lg font-bold truncate",
                                    isDark ? "text-white" : "text-gray-900"
                                )}>
                                    {previewAttachment.name}
                                </h3>
                                <button
                                    onClick={() => setPreviewAttachment(null)}
                                    className={clsx(
                                        "p-2 rounded-lg transition-colors",
                                        isDark ? "hover:bg-[#2A2A2A] text-gray-400" : "hover:bg-gray-100 text-gray-500"
                                    )}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/5 min-h-[300px]">
                                {previewAttachment.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                    <img
                                        src={previewAttachment.url}
                                        alt={previewAttachment.name}
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-gray-500">
                                        <FileText className="w-16 h-16 opacity-50" />
                                        <p>No preview available for this file type.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className={clsx(
                                "p-4 border-t flex justify-end gap-2",
                                isDark ? "border-[#2A2A2A]" : "border-gray-200"
                            )}>
                                <button
                                    onClick={() => setPreviewAttachment(null)}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                        isDark ? "hover:bg-[#2A2A2A] text-gray-300" : "hover:bg-gray-100 text-gray-600"
                                    )}
                                >
                                    Close
                                </button>
                                <a
                                    href={previewAttachment.url}
                                    download={previewAttachment.name}
                                    className="px-4 py-2 bg-[#FF9F1C] text-white rounded-lg text-sm font-medium hover:bg-[#E08A15] flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download File
                                </a>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Custom Confirmation Popup Removed */}
        </div >
    )
}
