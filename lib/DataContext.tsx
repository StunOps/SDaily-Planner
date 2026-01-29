'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { Plan, KanbanCard, Goal, Revenue } from '@/lib/types'
import { fetchPlans, fetchCards, fetchGoals, fetchRevenues, supabase } from '@/lib/supabaseService'

interface DataContextType {
    // Data
    plans: Plan[]
    cards: KanbanCard[]
    goals: Goal[]
    revenues: Revenue[]

    // Loading state
    isLoading: boolean
    isInitialized: boolean
    isDataLoading: boolean

    // Setters for optimistic updates
    setPlans: (plans: Plan[] | ((prev: Plan[]) => Plan[])) => void
    setCards: (cards: KanbanCard[] | ((prev: KanbanCard[]) => KanbanCard[])) => void
    setGoals: (goals: Goal[] | ((prev: Goal[]) => Goal[])) => void
    setRevenues: (revenues: Revenue[] | ((prev: Revenue[]) => Revenue[])) => void

    // Refresh functions
    refreshPlans: (silent?: boolean) => Promise<void>
    refreshCards: (silent?: boolean) => Promise<void>
    refreshGoals: (silent?: boolean) => Promise<void>
    refreshRevenues: (silent?: boolean) => Promise<void>
    refreshAll: (silent?: boolean) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
    const [plans, setPlans] = useState<Plan[]>([])
    const [cards, setCards] = useState<KanbanCard[]>([])
    const [goals, setGoals] = useState<Goal[]>([])
    const [revenues, setRevenues] = useState<Revenue[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isInitialized, setIsInitialized] = useState(false)

    // Refresh functions
    const refreshPlans = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true)
        const data = await fetchPlans()
        setPlans(data)
        if (!silent) setIsLoading(false)
    }, [])

    const refreshCards = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true)
        const data = await fetchCards()
        setCards(data)
        if (!silent) setIsLoading(false)
    }, [])

    const refreshGoals = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true)
        const data = await fetchGoals()
        setGoals(data)
        if (!silent) setIsLoading(false)
    }, [])

    const refreshRevenues = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true)
        const data = await fetchRevenues()
        setRevenues(data)
        if (!silent) setIsLoading(false)
    }, [])

    const refreshAll = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true)
        const [plansData, cardsData, goalsData, revenuesData] = await Promise.all([
            fetchPlans(),
            fetchCards(),
            fetchGoals(),
            fetchRevenues()
        ])
        setPlans(plansData)
        setCards(cardsData)
        setGoals(goalsData)
        setRevenues(revenuesData)
        if (!silent) setIsLoading(false)
    }, [])

    // Real-time subscriptions
    useEffect(() => {
        if (!isInitialized) return

        const channels = [
            // Plans subscription
            supabase
                .channel('plans-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, () => refreshPlans(true))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_attachments' }, () => refreshPlans(true))
                .subscribe(),

            // Cards subscription
            supabase
                .channel('cards-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, () => refreshCards(true))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'card_attachments' }, () => refreshCards(true))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'card_checklist_items' }, () => refreshCards(true))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'card_comments' }, () => refreshCards(true))
                .subscribe(),

            // Goals subscription
            supabase
                .channel('goals-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => refreshGoals(true))
                .subscribe(),

            // Revenues subscription
            supabase
                .channel('revenues-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'revenues' }, () => refreshRevenues(true))
                .subscribe(),
        ]

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel))
        }
    }, [isInitialized, refreshPlans, refreshCards, refreshGoals, refreshRevenues])

    // Load all data once on mount
    useEffect(() => {
        if (!isInitialized) {
            refreshAll().then(() => {
                setIsInitialized(true)
            })
        }
    }, [isInitialized, refreshAll])

    return (
        <DataContext.Provider value={{
            plans,
            cards,
            goals,
            revenues,
            isLoading,
            isInitialized,
            isDataLoading: isLoading,
            setPlans,
            setCards,
            setGoals,
            setRevenues,
            refreshPlans: () => refreshPlans(false),
            refreshCards: () => refreshCards(false),
            refreshGoals: () => refreshGoals(false),
            refreshRevenues: () => refreshRevenues(false),
            refreshAll: () => refreshAll(false)
        }}>
            {children}
        </DataContext.Provider>
    )
}

export function useData() {
    const context = useContext(DataContext)
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider')
    }
    return context
}
