'use client'

import { supabase } from './supabaseClient'
export { supabase }
import { Plan, KanbanCard, Goal, Revenue, TimeSlot, Attachment, ChecklistItem, Comment } from './types'

// ============================================
// PLANS - CRUD Operations
// ============================================

import { generateUUID } from './uuid'

export async function fetchPlans(): Promise<Plan[]> {
    const { data: plans, error } = await supabase
        .from('plans')
        .select('*')
        .order('date', { ascending: true })

    if (error) {
        console.error('Error fetching plans:', error)
        return []
    }

    if (!plans || plans.length === 0) return []

    const planIds = plans.map(p => p.id)

    // Batch fetch all related data in parallel
    const [allTimeSlots, allAttachments] = await Promise.all([
        supabase.from('plan_time_slots').select('*').in('plan_id', planIds),
        supabase.from('plan_attachments').select('*').in('plan_id', planIds)
    ])

    // Group by plan_id
    const timeSlotsMap = groupByField(allTimeSlots.data || [], 'plan_id')
    const attachmentsMap = groupByField(allAttachments.data || [], 'plan_id')

    return plans.map(plan => ({
        id: plan.id,
        title: plan.title,
        description: plan.description,
        date: plan.date,
        hasDueDate: plan.has_due_date,
        dueDate: plan.due_date,
        timeSlots: (timeSlotsMap[plan.id] || []).map((s: Record<string, string>) => ({ id: s.id, time: s.time, description: s.description })),
        attachments: (attachmentsMap[plan.id] || []).map((a: Record<string, string>) => ({ id: a.id, type: a.type, name: a.name, url: a.url })),
        completed: plan.completed,
        createdAt: plan.created_at
    } as Plan))
}

// Helper function to group array by key (for plans)
function groupByField<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
    return arr.reduce((acc, item) => {
        const k = item[key] as string
        if (!acc[k]) acc[k] = []
        acc[k].push(item)
        return acc
    }, {} as Record<string, T[]>)
}

async function fetchPlanTimeSlots(planId: string): Promise<TimeSlot[]> {
    const { data, error } = await supabase
        .from('plan_time_slots')
        .select('*')
        .eq('plan_id', planId)
        .order('time', { ascending: true })

    if (error) {
        console.error('Error fetching time slots:', error)
        return []
    }

    return (data || []).map(slot => ({
        id: slot.id,
        time: slot.time,
        description: slot.description
    }))
}

async function fetchPlanAttachments(planId: string): Promise<Attachment[]> {
    const { data, error } = await supabase
        .from('plan_attachments')
        .select('*')
        .eq('plan_id', planId)

    if (error) {
        console.error('Error fetching attachments:', error)
        return []
    }

    return (data || []).map(att => ({
        id: att.id,
        type: att.type,
        name: att.name,
        url: att.url
    }))
}

export async function createPlan(plan: Plan): Promise<Plan | null> {
    const { data, error } = await supabase
        .from('plans')
        .insert({
            id: plan.id,
            title: plan.title,
            description: plan.description,
            date: plan.date,
            has_due_date: plan.hasDueDate,
            due_date: plan.dueDate,
            completed: plan.completed,
            created_at: plan.createdAt
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating plan:', error)
        return null
    }

    // Insert time slots
    if (plan.timeSlots && plan.timeSlots.length > 0) {
        await supabase.from('plan_time_slots').insert(
            plan.timeSlots.map(slot => ({
                id: slot.id,
                plan_id: plan.id,
                time: slot.time,
                description: slot.description
            }))
        )
    }

    // Insert attachments
    if (plan.attachments && plan.attachments.length > 0) {
        // Regenerate IDs
        const attachmentsWithNewIds = plan.attachments.map(att => ({
            id: generateUUID(),
            plan_id: plan.id,
            type: att.type,
            name: att.name,
            url: att.url
        }))
        await supabase.from('plan_attachments').insert(attachmentsWithNewIds)
    }

    return plan
}

export async function updatePlan(plan: Plan): Promise<boolean> {
    const { error } = await supabase
        .from('plans')
        .update({
            title: plan.title,
            description: plan.description,
            date: plan.date,
            has_due_date: plan.hasDueDate,
            due_date: plan.dueDate,
            completed: plan.completed
        })
        .eq('id', plan.id)

    if (error) {
        console.error('Error updating plan:', error)
        return false
    }

    // Update attachments
    await supabase.from('plan_attachments').delete().eq('plan_id', plan.id)
    if (plan.attachments && plan.attachments.length > 0) {
        // Regenerate IDs
        const attachmentsWithNewIds = plan.attachments.map(att => ({
            id: generateUUID(),
            plan_id: plan.id,
            type: att.type,
            name: att.name,
            url: att.url
        }))
        await supabase.from('plan_attachments').insert(attachmentsWithNewIds)
    }

    return true
}

export async function deletePlan(planId: string): Promise<boolean> {
    // 1. Manually delete attachments first (in case CASCADE is not set)
    const { error: attError } = await supabase
        .from('plan_attachments')
        .delete()
        .eq('plan_id', planId)

    if (attError) {
        console.error('Error deleting plan attachments:', attError)
        // Continue anyway, maybe they don't exist
    }

    // 2. Manually delete time slots (in case CASCADE is not set)
    const { error: tsError } = await supabase
        .from('plan_time_slots')
        .delete()
        .eq('plan_id', planId)

    if (tsError) {
        console.error('Error deleting plan time slots:', tsError)
    }

    // 3. CRITICAL: Force unlink ANY cards that might still reference this plan
    // This handles "zombie" cards that might be blocking deletion via FK
    const { error: unlinkError } = await supabase
        .from('kanban_cards')
        .update({ linked_plan_id: null })
        .eq('linked_plan_id', planId)

    if (unlinkError) {
        console.error('Error unlinking cards from plan:', unlinkError)
    }

    // 4. Delete the plan
    const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId)

    if (error) {
        console.error('Error deleting plan:', error)
        return false
    }

    // If no error, consider it a success (even if plan was already deleted)
    return true
}

export async function deleteOrphanPlans(title: string): Promise<void> {
    // 1. Find all plans with this title
    const { data: plans, error } = await supabase
        .from('plans')
        .select('id')
        .eq('title', title)

    if (error || !plans || plans.length === 0) return

    const planIds = plans.map(p => p.id)

    // 2. Find which of these are actually linked to cards
    const { data: linkedCards, error: linkError } = await supabase
        .from('kanban_cards')
        .select('linked_plan_id')
        .in('linked_plan_id', planIds)

    if (linkError) return

    const linkedPlanIds = new Set((linkedCards || []).map(c => c.linked_plan_id))

    // 3. Identify orphans (Plans with NO card linking to them)
    const orphanIds = planIds.filter(id => !linkedPlanIds.has(id))

    // 4. Delete orphans
    if (orphanIds.length > 0) {
        console.log(`Cleaning up ${orphanIds.length} orphan plans for title "${title}"`)
        await Promise.all(orphanIds.map(id => deletePlan(id)))
    }
}

// ============================================
// KANBAN CARDS - CRUD Operations
// ============================================

export async function fetchCards(): Promise<KanbanCard[]> {
    const { data: cards, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: false }) // Secondary sort

    if (error) {
        console.error('Error fetching cards:', error)
        return []
    }

    if (!cards || cards.length === 0) return []

    const cardIds = cards.map(c => c.id)

    // Batch fetch all related data in parallel
    const [allTimeSlots, allChecklist, allComments, allAttachments] = await Promise.all([
        supabase.from('card_time_slots').select('*').in('card_id', cardIds),
        supabase.from('card_checklist_items').select('*').in('card_id', cardIds),
        supabase.from('card_comments').select('*').in('card_id', cardIds),
        supabase.from('card_attachments').select('*').in('card_id', cardIds)
    ])

    // Group by card_id
    const timeSlotsMap = groupBy(allTimeSlots.data || [], 'card_id')
    const checklistMap = groupBy(allChecklist.data || [], 'card_id')
    const commentsMap = groupBy(allComments.data || [], 'card_id')
    const attachmentsMap = groupBy(allAttachments.data || [], 'card_id')

    return cards.map(card => ({
        id: card.id,
        title: card.title,
        description: card.description,
        status: card.status,
        startDate: card.start_date,
        endDate: card.end_date,
        linkedPlanId: card.linked_plan_id,
        timeSlots: (timeSlotsMap[card.id] || []).map((s: Record<string, string>) => ({ id: s.id, time: s.time, description: s.description })),
        checklist: (checklistMap[card.id] || []).map((i: Record<string, unknown>) => ({ id: i.id as string, text: i.text as string, completed: i.completed as boolean })),
        comments: (commentsMap[card.id] || []).map((c: Record<string, unknown>) => ({ id: c.id as string, text: c.text as string, createdAt: c.created_at as string, isMarkedDone: c.is_marked_done as boolean })),
        attachments: (attachmentsMap[card.id] || []).map((a: Record<string, string>) => ({ id: a.id, type: a.type, name: a.name, url: a.url })),
        createdAt: card.created_at,
        position: card.position || 0
    } as KanbanCard))
}

// Helper function to group array by key
function groupBy<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
    return arr.reduce((acc, item) => {
        const k = item[key] as string
        if (!acc[k]) acc[k] = []
        acc[k].push(item)
        return acc
    }, {} as Record<string, T[]>)
}

async function fetchCardTimeSlots(cardId: string): Promise<TimeSlot[]> {
    const { data, error } = await supabase
        .from('card_time_slots')
        .select('*')
        .eq('card_id', cardId)
        .order('time', { ascending: true })

    if (error) return []
    return (data || []).map(slot => ({
        id: slot.id,
        time: slot.time,
        description: slot.description
    }))
}

async function fetchCardChecklist(cardId: string): Promise<ChecklistItem[]> {
    const { data, error } = await supabase
        .from('card_checklist_items')
        .select('*')
        .eq('card_id', cardId)

    if (error) return []
    return (data || []).map(item => ({
        id: item.id,
        text: item.text,
        completed: item.completed
    }))
}

async function fetchCardComments(cardId: string): Promise<Comment[]> {
    const { data, error } = await supabase
        .from('card_comments')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true })

    if (error) return []
    return (data || []).map(comment => ({
        id: comment.id,
        text: comment.text,
        createdAt: comment.created_at,
        isMarkedDone: comment.is_marked_done
    }))
}

async function fetchCardAttachments(cardId: string): Promise<Attachment[]> {
    const { data, error } = await supabase
        .from('card_attachments')
        .select('*')
        .eq('card_id', cardId)

    if (error) return []
    return (data || []).map(att => ({
        id: att.id,
        type: att.type,
        name: att.name,
        url: att.url
    }))
}

export async function createCard(card: KanbanCard): Promise<KanbanCard | null> {
    const { error } = await supabase
        .from('kanban_cards')
        .insert({
            id: card.id,
            title: card.title,
            description: card.description,
            status: card.status,
            start_date: card.startDate,
            end_date: card.endDate,
            linked_plan_id: card.linkedPlanId,
            created_at: card.createdAt
        })

    if (error) {
        console.error('Error creating card:', error)
        return null
    }

    // Insert related data
    if (card.checklist.length > 0) {
        await supabase.from('card_checklist_items').insert(
            card.checklist.map(item => ({
                id: item.id,
                card_id: card.id,
                text: item.text,
                completed: item.completed
            }))
        )
    }

    if (card.comments.length > 0) {
        await supabase.from('card_comments').insert(
            card.comments.map(c => ({
                id: c.id,
                card_id: card.id,
                text: c.text,
                is_marked_done: c.isMarkedDone,
                created_at: c.createdAt
            }))
        )
    }

    if (card.attachments.length > 0) {
        await supabase.from('card_attachments').insert(
            card.attachments.map(att => ({
                id: att.id,
                card_id: card.id,
                type: att.type,
                name: att.name,
                url: att.url
            }))
        )
    }

    return card
}

export async function updateCard(card: KanbanCard): Promise<boolean> {
    // If this is a virtual plan card (id starts with 'plan-'), do not update to kanban_cards table
    // It should be handled by updatePlan instead
    // If this is a virtual plan card (id starts with 'plan-'), handle it via updatePlan
    if (card.id.startsWith('plan-')) {
        const planId = card.id.replace('plan-', '')
        // We need to fetch the existing plan to preserve other fields, or construct partial
        // For now, we construct a Plan object with the available info
        const planUpdate: Plan = {
            id: planId,
            title: card.title,
            description: card.description,
            date: card.startDate || new Date().toISOString().split('T')[0], // Fallback if missing
            hasDueDate: !!card.endDate,
            dueDate: card.endDate,
            completed: card.status === 'completed',
            createdAt: card.createdAt,
            // Attachments are key here
            attachments: card.attachments,
            // Checklist/Comments are NOT supported on Plans yet, so they will be lost/ignored
            // timeSlots are read-only on cards usually, but passing them back just in case
            timeSlots: card.timeSlots
        }

        // 1. Update the underlying Plan (title, date, attachments)
        const planUpdated = await updatePlan(planUpdate)
        if (!planUpdated) return false

        // 2. Handle Checklist & Comments (Promote to Real Card if needed)
        // Check if a real card already exists for this plan
        const { data: existingCard } = await supabase
            .from('kanban_cards')
            .select('id')
            .eq('linked_plan_id', planId)
            .single()

        let realCardId = existingCard?.id

        if (realCardId) {
            // Real card exists, update it with these comments/checklist
            // We recursively call updateCard with the REAL ID
            // IMPORTANT: We pass attachments: [] to avoid duplicating them in card_attachments
            // (Synced cards rely on plan_attachments, so we clear card_attachments to avoid confusion)
            return await updateCard({
                ...card,
                id: realCardId,
                attachments: []
            })
        } else if (card.checklist.length > 0 || card.comments.length > 0 || typeof card.position === 'number' || card.status === 'completed') {
            // No real card exists, but we have data to save, so CREATE one
            const newCardId = generateUUID()
            const { error: createError } = await supabase
                .from('kanban_cards')
                .insert({
                    id: newCardId,
                    title: card.title,
                    description: card.description || null,
                    status: card.status,
                    start_date: card.startDate || null,
                    end_date: card.endDate || null,
                    linked_plan_id: planId,
                    created_at: new Date().toISOString(),
                    position: card.position || 0
                })

            if (createError) {
                console.error('Error creating linked card for metadata:', JSON.stringify(createError, null, 2))
                // If it's a FK constraint error (plan doesn't exist), try creating without the link
                if (createError.code === '23503') {
                    const { error: retryError } = await supabase
                        .from('kanban_cards')
                        .insert({
                            id: newCardId,
                            title: card.title,
                            description: card.description || null,
                            status: card.status,
                            start_date: card.startDate || null,
                            end_date: card.endDate || null,
                            linked_plan_id: null, // Skip the link if plan doesn't exist
                            created_at: new Date().toISOString(),
                            position: card.position || 0
                        })
                    if (retryError) return false
                } else {
                    return false
                }
            }

            // Now insert the checklist/comments for this new card
            if (card.checklist.length > 0) {
                await supabase.from('card_checklist_items').insert(
                    card.checklist.map(item => ({
                        id: item.id,
                        card_id: newCardId,
                        text: item.text,
                        completed: item.completed
                    }))
                )
            }

            if (card.comments.length > 0) {
                await supabase.from('card_comments').insert(
                    card.comments.map(c => ({
                        id: c.id,
                        card_id: newCardId,
                        text: c.text,
                        is_marked_done: c.isMarkedDone,
                        created_at: c.createdAt
                    }))
                )
            }

            // Note: We do NOT insert attachments here because they are already on the Plan
        }

        return true
    }

    // Sanitize data for Supabase (convert undefined to null)
    const updatePayload = {
        title: card.title,
        description: card.description || null,
        status: card.status,
        start_date: card.startDate || null,
        end_date: card.endDate || null,
        linked_plan_id: card.linkedPlanId || null,
        position: card.position || 0
    }

    const { error } = await supabase
        .from('kanban_cards')
        .update(updatePayload)
        .eq('id', card.id)

    if (error) {
        console.error('Error updating card:', JSON.stringify(error, null, 2))
        return false
    }

    // Update checklist - delete all and re-insert
    await supabase.from('card_checklist_items').delete().eq('card_id', card.id)
    if (card.checklist.length > 0) {
        await supabase.from('card_checklist_items').insert(
            card.checklist.map(item => ({
                id: item.id,
                card_id: card.id,
                text: item.text,
                completed: item.completed
            }))
        )
    }

    // Update comments
    await supabase.from('card_comments').delete().eq('card_id', card.id)
    if (card.comments.length > 0) {
        await supabase.from('card_comments').insert(
            card.comments.map(c => ({
                id: c.id,
                card_id: card.id,
                text: c.text,
                is_marked_done: c.isMarkedDone,
                created_at: c.createdAt
            }))
        )
    }

    // Update attachments
    await supabase.from('card_attachments').delete().eq('card_id', card.id)
    if (card.attachments.length > 0) {
        // Regenerate IDs to avoid collisions with plan_attachments or other tables
        const attachmentsWithNewIds = card.attachments.map(att => ({
            id: generateUUID(), // CRITICAL: New ID
            card_id: card.id,
            type: att.type,
            name: att.name,
            url: att.url
        }))

        const { error: attError } = await supabase.from('card_attachments').insert(attachmentsWithNewIds)
        if (attError) console.error('Error updating card attachments:', attError)
    }

    return true
}

export async function deleteCard(cardId: string): Promise<boolean> {
    const { error } = await supabase
        .from('kanban_cards')
        .delete()
        .eq('id', cardId)

    if (error) {
        console.error('Error deleting card:', error)
        return false
    }

    return true
}

// ============================================
// GOALS - CRUD Operations
// ============================================

export async function fetchGoals(): Promise<Goal[]> {
    const { data: goals, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching goals:', error)
        return []
    }

    const goalsWithRelations = await Promise.all(
        (goals || []).map(async (goal) => {
            const [checklist, comments] = await Promise.all([
                fetchGoalChecklist(goal.id),
                fetchGoalComments(goal.id)
            ])

            return {
                id: goal.id,
                title: goal.title,
                description: goal.description,
                goalType: goal.goal_type,
                targetDate: goal.target_date,
                budget: goal.budget_target_amount ? {
                    targetAmount: parseFloat(goal.budget_target_amount),
                    currentAmount: parseFloat(goal.budget_current_amount || 0),
                    currency: goal.budget_currency || '₱'
                } : undefined,
                checklist,
                comments,
                createdAt: goal.created_at
            } as Goal
        })
    )

    return goalsWithRelations
}

async function fetchGoalChecklist(goalId: string): Promise<ChecklistItem[]> {
    const { data, error } = await supabase
        .from('goal_checklist_items')
        .select('*')
        .eq('goal_id', goalId)

    if (error) return []
    return (data || []).map(item => ({
        id: item.id,
        text: item.text,
        completed: item.completed
    }))
}

async function fetchGoalComments(goalId: string): Promise<Comment[]> {
    const { data, error } = await supabase
        .from('goal_comments')
        .select('*')
        .eq('goal_id', goalId)
        .order('created_at', { ascending: true })

    if (error) return []
    return (data || []).map(comment => ({
        id: comment.id,
        text: comment.text,
        createdAt: comment.created_at,
        isMarkedDone: comment.is_marked_done
    }))
}

export async function createGoal(goal: Goal): Promise<Goal | null> {
    const { error } = await supabase
        .from('goals')
        .insert({
            id: goal.id,
            title: goal.title,
            description: goal.description,
            goal_type: goal.goalType,
            target_date: goal.targetDate,
            budget_target_amount: goal.budget?.targetAmount,
            budget_current_amount: goal.budget?.currentAmount || 0,
            budget_currency: goal.budget?.currency || '₱',
            created_at: goal.createdAt
        })

    if (error) {
        console.error('Error creating goal:', error)
        return null
    }

    if (goal.checklist.length > 0) {
        await supabase.from('goal_checklist_items').insert(
            goal.checklist.map(item => ({
                id: item.id,
                goal_id: goal.id,
                text: item.text,
                completed: item.completed
            }))
        )
    }

    if (goal.comments.length > 0) {
        await supabase.from('goal_comments').insert(
            goal.comments.map(c => ({
                id: c.id,
                goal_id: goal.id,
                text: c.text,
                is_marked_done: c.isMarkedDone,
                created_at: c.createdAt
            }))
        )
    }

    return goal
}

export async function updateGoal(goal: Goal): Promise<boolean> {
    const { error } = await supabase
        .from('goals')
        .update({
            title: goal.title,
            description: goal.description,
            goal_type: goal.goalType,
            target_date: goal.targetDate,
            budget_target_amount: goal.budget?.targetAmount,
            budget_current_amount: goal.budget?.currentAmount,
            budget_currency: goal.budget?.currency
        })
        .eq('id', goal.id)

    if (error) {
        console.error('Error updating goal:', error)
        return false
    }

    // Update checklist
    await supabase.from('goal_checklist_items').delete().eq('goal_id', goal.id)
    if (goal.checklist.length > 0) {
        await supabase.from('goal_checklist_items').insert(
            goal.checklist.map(item => ({
                id: item.id,
                goal_id: goal.id,
                text: item.text,
                completed: item.completed
            }))
        )
    }

    // Update comments
    await supabase.from('goal_comments').delete().eq('goal_id', goal.id)
    if (goal.comments.length > 0) {
        await supabase.from('goal_comments').insert(
            goal.comments.map(c => ({
                id: c.id,
                goal_id: goal.id,
                text: c.text,
                is_marked_done: c.isMarkedDone,
                created_at: c.createdAt
            }))
        )
    }

    return true
}

export async function deleteGoal(goalId: string): Promise<boolean> {
    const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId)

    if (error) {
        console.error('Error deleting goal:', error)
        return false
    }

    return true
}

// ============================================
// REVENUE - CRUD Operations
// ============================================

export async function fetchRevenues(): Promise<Revenue[]> {
    const { data, error } = await supabase
        .from('revenues')
        .select('*')
        .order('date_completed', { ascending: false })

    if (error) {
        console.error('Error fetching revenues:', error)
        return []
    }

    return (data || []).map(rev => ({
        id: rev.id,
        name: rev.name,
        description: rev.description,
        projectName: rev.project_name,
        price: parseFloat(rev.price),
        currency: rev.currency,
        dateCompleted: rev.date_completed,
        createdAt: rev.created_at
    }))
}

export async function createRevenue(revenue: Revenue): Promise<Revenue | null> {
    const { error } = await supabase
        .from('revenues')
        .insert({
            id: revenue.id,
            name: revenue.name,
            description: revenue.description,
            project_name: revenue.projectName,
            price: revenue.price,
            currency: revenue.currency,
            date_completed: revenue.dateCompleted,
            created_at: revenue.createdAt
        })

    if (error) {
        console.error('Error creating revenue:', error)
        return null
    }

    return revenue
}

export async function updateRevenue(revenue: Revenue): Promise<boolean> {
    const { error } = await supabase
        .from('revenues')
        .update({
            name: revenue.name,
            description: revenue.description,
            project_name: revenue.projectName,
            price: revenue.price,
            currency: revenue.currency,
            date_completed: revenue.dateCompleted
        })
        .eq('id', revenue.id)

    if (error) {
        console.error('Error updating revenue:', error)
        return false
    }

    return true
}

export async function deleteRevenue(revenueId: string): Promise<boolean> {
    const { error } = await supabase
        .from('revenues')
        .delete()
        .eq('id', revenueId)

    if (error) {
        console.error('Error deleting revenue:', error)
        return false
    }

    return true
}

// ============================================
// CUSTOM SECTIONS - CRUD Operations
// ============================================

export interface CustomSection {
    id: string
    title: string
    color: string
    position: number
    createdAt?: string
}

export async function fetchCustomSections(): Promise<CustomSection[]> {
    const { data, error } = await supabase
        .from('custom_sections')
        .select('*')
        .order('position', { ascending: true })

    if (error) {
        console.error('Error fetching custom sections:', error)
        return []
    }

    return (data || []).map(s => ({
        id: s.id,
        title: s.title,
        color: s.color,
        position: s.position,
        createdAt: s.created_at
    }))
}

export async function createCustomSection(section: CustomSection): Promise<CustomSection | null> {
    const { data, error } = await supabase
        .from('custom_sections')
        .insert({
            id: section.id,
            title: section.title,
            color: section.color,
            position: section.position
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating custom section:', error)
        return null
    }

    return {
        id: data.id,
        title: data.title,
        color: data.color,
        position: data.position,
        createdAt: data.created_at
    }
}

export async function deleteCustomSection(sectionId: string): Promise<boolean> {
    const { error } = await supabase
        .from('custom_sections')
        .delete()
        .eq('id', sectionId)

    if (error) {
        console.error('Error deleting custom section:', error)
        return false
    }

    return true
}
