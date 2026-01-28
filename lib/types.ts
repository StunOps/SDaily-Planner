// Plan/Event types for the Planner

export interface TimeSlot {
    id: string
    time: string // HH:MM format
    description: string
}

export interface Attachment {
    id: string
    type: 'link' | 'file'
    name: string
    url: string // For links, the URL. For files, the data URL or file path
}

export interface Plan {
    id: string
    title: string
    description?: string
    date: string // YYYY-MM-DD format
    timeSlots?: TimeSlot[] // Multiple time slots (only if hasDueDate is false)
    hasDueDate: boolean // true = multi-day task with due date, false = single-day task with times
    dueDate?: string // YYYY-MM-DD format (only if hasDueDate is true)
    attachments?: Attachment[] // Optional attachments
    completed: boolean
    createdAt: string
}

export interface PlanFormData {
    title: string
    description: string
    date: string
    timeSlots: TimeSlot[]
    hasDueDate: boolean
    dueDate: string
    includeTime: boolean
    attachments: Attachment[]
}

// ========== Kanban Board Types ==========

// Card status for Kanban columns (includes custom section IDs)
export type CardStatus = 'inbox' | 'pending' | 'in-progress' | 'completed' | (string & {})

// Checklist item within a card
export interface ChecklistItem {
    id: string
    text: string
    completed: boolean
}

// Comment with like/done feature
export interface Comment {
    id: string
    text: string
    createdAt: string
    isMarkedDone: boolean
}

// Main Kanban card type
export interface KanbanCard {
    id: string
    title: string
    description?: string
    status: CardStatus
    startDate?: string  // YYYY-MM-DD
    endDate?: string    // YYYY-MM-DD
    timeSlots?: TimeSlot[]  // Time slots from planner (read-only on cards)
    checklist: ChecklistItem[]
    comments: Comment[]
    attachments: Attachment[]
    createdAt: string
    linkedPlanId?: string  // Links to Plan.id for sync
}

// ========== Goals Types ==========

export type GoalType = 'material' | 'personal'

export interface GoalBudget {
    targetAmount: number
    currentAmount: number
    currency: string  // e.g., '₱', '$', '€'
}

export interface Goal {
    id: string
    title: string
    description?: string
    goalType: GoalType
    targetDate?: string  // YYYY-MM-DD
    budget?: GoalBudget  // Only for material goals
    checklist: ChecklistItem[]
    comments: Comment[]
    createdAt: string
}

// ========== Revenue Types ==========

export interface Revenue {
    id: string
    name: string
    description?: string
    projectName: string
    price: number
    currency: string  // e.g., '₱', '$', '€'
    dateCompleted: string  // YYYY-MM-DD
    createdAt: string
}

