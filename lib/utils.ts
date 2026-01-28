import { isBefore, startOfDay, parseISO } from 'date-fns'

/**
 * Converts a 24-hour time string (HH:mm) to a 12-hour format string (h:mm AM/PM).
 * @param time 24-hour time string (e.g., "14:30")
 * @returns 12-hour time string (e.g., "2:30 PM")
 */
export function formatTimeTo12h(time: string): string {
    if (!time) return '';

    const [hoursStr, minutes] = time.split(':');
    let hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    return `${hours}:${minutes} ${ampm}`;
}

/**
 * Checks if a task is overdue.
 * A task is overdue if today is after the due date (or start date if no due date) and it's not completed.
 * @param date Start date in YYYY-MM-DD format
 * @param dueDate Due date in YYYY-MM-DD format
 * @param completed Completion status
 */
export function isOverdue(date?: string, dueDate?: string, completed?: boolean): boolean {
    if (completed || !date) return false

    const today = startOfDay(new Date())
    const targetDateStr = dueDate || date
    if (!targetDateStr) return false

    const targetDate = parseISO(targetDateStr)
    return isBefore(targetDate, today)
}
