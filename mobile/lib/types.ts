
export interface TimeSlot {
    id: string
    time: string // HH:MM
    description: string
}

export interface Attachment {
    id: string
    type: 'link' | 'file'
    name: string
    url: string
}

export interface Plan {
    id: string
    title: string
    description?: string
    date: string // YYYY-MM-DD
    time_slots?: TimeSlot[]
    has_due_date: boolean
    due_date?: string
    attachments?: Attachment[]
    completed: boolean
    created_at: string
}

export interface KanbanCard {
    id: string
    title: string
    description?: string
    status: string // 'inbox' | 'pending' | 'in-progress' | 'completed' | 'custom-...'
    start_date?: string
    end_date?: string
    linked_plan_id?: string
    attachments?: Attachment[]
    position?: number
    created_at?: string
}
