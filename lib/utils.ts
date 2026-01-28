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
