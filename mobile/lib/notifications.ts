
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function setupNotifications() {
    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch (e) {
        console.log('Notification setup failed (Expo Go limitation)');
    }
}

export const QUOTES = [
    "Your only limit is your mind.",
    "Make today so awesome yesterday gets jealous.",
    "Focus on being productive instead of busy.",
    "You don't have to be great to start, but you have to start to be great.",
    "Action is the foundational key to all success.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Believe you can and you're halfway there.",
    "It always seems impossible until it's done.",
    "The future depends on what you do today.",
    "Don't watch the clock; do what it does. Keep going.",
    "Every morning is a new arrival. A new chapter.",
    "Start where you are. Use what you have. Do what you can."
];

export async function registerForPushNotificationsAsync() {
    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                return;
            }
        }
    } catch (error) {
        // Expo Go doesn't support push notifications in SDK 53+
        // Local notifications still work, so we continue silently
        console.log('Push notification registration skipped (Expo Go limitation)');
    }
}

// Schedule 7 days of morning notifications with quotes + task reminders
export async function scheduleSmartNotifications(todayTaskCount?: number, taskTitles?: string[]) {
    try {
        // Cancel all to reset the queue
        await Notifications.cancelAllScheduledNotificationsAsync();

        const now = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);
            date.setHours(8, 0, 0, 0); // 8:00 AM

            // Skip if already past 8 AM for today
            if (date <= now) continue;

            const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

            // Build notification body
            let body = quote;

            // Only add task info for TODAY's notification (i === 0 or next available day)
            if (i <= 1 && todayTaskCount !== undefined && todayTaskCount > 0 && taskTitles) {
                const taskList = taskTitles.slice(0, 3).join(', ');
                body = `📋 ${todayTaskCount} task${todayTaskCount > 1 ? 's' : ''} due: ${taskList}${todayTaskCount > 3 ? '...' : ''}\n\n💪 ${quote}`;
            } else if (i <= 1 && todayTaskCount === 0) {
                body = `✅ No tasks due today!\n\n💪 ${quote}`;
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Good Morning ☀️",
                    body: body,
                    data: { type: 'daily_motivation' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: date,
                },
            });
        }
    } catch (error) {
        console.log('Notification scheduling skipped (Expo Go limitation)');
    }
}

// Schedule a one-shot reminder for TODAY at 9 AM with actual task count
export async function scheduleTodayTaskReminder(dueCount: number, taskTitles: string[]) {
    try {
        // Only schedule if it's before 9 AM
        const now = new Date();
        const nineAM = new Date(now);
        nineAM.setHours(9, 0, 0, 0);

        if (now >= nineAM) return; // Too late for today

        // Build body text
        let body = '';
        if (dueCount === 0) {
            body = "No tasks due today. Enjoy your free time!";
        } else if (dueCount === 1) {
            body = `1 task due today: "${taskTitles[0]}"`;
        } else {
            body = `${dueCount} tasks due today:\n• ${taskTitles.slice(0, 3).join('\n• ')}${dueCount > 3 ? '\n... and more' : ''}`;
        }

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Today's Tasks",
                body: body,
                data: { type: 'daily_tasks' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: nineAM,
            },
        });
    } catch (error) {
        console.log('Task reminder scheduling skipped (Expo Go limitation)');
    }
}

// Send an immediate test notification
export async function sendTestNotification() {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Test Notification",
                body: "If you can read this, notifications are working perfectly! 🚀",
                sound: true,
                data: { type: 'test' },
            },
            trigger: null, // Immediate
        });
    } catch (e) {
        console.log('Test notification failed:', e);
        alert('Failed to send notification. Check console.');
    }
}
