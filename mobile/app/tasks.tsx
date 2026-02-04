
import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Clock, AlertCircle, X, Calendar } from 'lucide-react-native';
import { format, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import { KanbanCard } from '../lib/types';

export default function TasksScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const type = params.type as string; // 'pending' | 'due'

    const [tasks, setTasks] = useState<KanbanCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<KanbanCard | null>(null);

    const title = type === 'pending' ? 'Pending Tasks' : 'Due Today';
    const accentColor = type === 'pending' ? '#F59E0B' : '#E11D48';

    const fetchTasks = async () => {
        setLoading(true);
        try {
            if (type === 'pending') {
                const today = format(new Date(), 'yyyy-MM-dd');

                // 1. Fetch pending cards
                const { data: pendingCards } = await supabase
                    .from('kanban_cards')
                    .select('*')
                    .eq('status', 'pending')
                    .order('position', { ascending: true });

                // 2. Get IDs of plans that already have linked pending cards
                const linkedPlanIds = new Set(
                    (pendingCards || [])
                        .filter(c => c.linked_plan_id)
                        .map(c => c.linked_plan_id)
                );

                // 3. Fetch orphan future plans (not linked to any pending card)
                const { data: futurePlans } = await supabase
                    .from('plans')
                    .select('*')
                    .gt('date', today)
                    .eq('completed', false);

                const orphanPlans = (futurePlans || []).filter(p => !linkedPlanIds.has(p.id));

                // 4. Convert orphan plans to card-like objects for display
                const planCards: KanbanCard[] = orphanPlans.map(plan => ({
                    id: `plan-${plan.id}`,
                    title: plan.title,
                    description: plan.description,
                    status: 'pending',
                    start_date: plan.date,
                    end_date: plan.due_date,
                    linked_plan_id: plan.id,
                    created_at: plan.created_at,
                    position: 999
                }));

                // 5. Merge: real cards first, then virtual plan cards
                setTasks([...(pendingCards || []), ...planCards]);
            } else if (type === 'due') {
                // Fetch all cards for due today
                const { data: allCards } = await supabase
                    .from('kanban_cards')
                    .select('*')
                    .order('position', { ascending: true });

                const today = startOfDay(new Date());
                const filtered = (allCards || []).filter(card => {
                    if (card.status === 'in-progress') return true;
                    if (card.start_date && card.end_date) {
                        const start = startOfDay(parseISO(card.start_date));
                        const end = startOfDay(parseISO(card.end_date));
                        return isWithinInterval(today, { start, end });
                    }
                    if (card.start_date && !card.end_date) {
                        return startOfDay(parseISO(card.start_date)).getTime() === today.getTime();
                    }
                    return false;
                });
                setTasks(filtered);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh on focus
    useFocusEffect(
        useCallback(() => {
            fetchTasks();
        }, [type])
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
                    <ArrowLeft color="white" size={24} />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {type === 'pending' ? <AlertCircle color={accentColor} size={24} /> : <Clock color={accentColor} size={24} />}
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>{title}</Text>
                </View>
            </View>

            {/* List */}
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {loading ? (
                    <ActivityIndicator color={accentColor} size="large" style={{ marginTop: 40 }} />
                ) : tasks.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <Text style={{ color: '#666', fontSize: 16 }}>No {title.toLowerCase()} found.</Text>
                    </View>
                ) : (
                    tasks.map(task => (
                        <TouchableOpacity
                            key={task.id}
                            onPress={() => setSelectedTask(task)}
                            style={{
                                backgroundColor: '#1E1E1E',
                                padding: 16,
                                borderRadius: 12,
                                marginBottom: 12,
                                borderLeftWidth: 4,
                                borderLeftColor: task.status === 'completed' ? '#10B981' : accentColor
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', flex: 1 }}>{task.title}</Text>
                                {task.status === 'completed' && <Check size={16} color="#10B981" />}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} color="#888" />
                                    <Text style={{ color: '#888', fontSize: 12 }}>
                                        {task.start_date ? format(parseISO(task.start_date), 'h:mm a') : 'All Day'}
                                    </Text>
                                </View>
                                {task.start_date && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Calendar size={12} color="#888" />
                                        <Text style={{ color: '#888', fontSize: 12 }}>
                                            {format(parseISO(task.start_date), 'MMM d')}
                                        </Text>
                                    </View>
                                )}
                                <Text style={{ color: '#666', fontSize: 12, textTransform: 'uppercase' }}>
                                    {task.status}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Detail Modal */}
            <Modal visible={!!selectedTask} transparent={true} animationType="slide" onRequestClose={() => setSelectedTask(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>Details</Text>
                            <TouchableOpacity onPress={() => setSelectedTask(null)}><X color="#888" /></TouchableOpacity>
                        </View>
                        <Text style={{ color: '#ccc', fontSize: 18, marginBottom: 8 }}>{selectedTask?.title}</Text>

                        {selectedTask?.description ? (
                            <Text style={{ color: '#aaa', marginBottom: 20, lineHeight: 22 }}>{selectedTask.description}</Text>
                        ) : (
                            <Text style={{ color: '#666', marginBottom: 20, fontStyle: 'italic' }}>No description provided.</Text>
                        )}

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ backgroundColor: '#333', padding: 12, borderRadius: 8, flex: 1 }}>
                                <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Status</Text>
                                <Text style={{ color: 'white', textTransform: 'capitalize', fontWeight: 'bold' }}>{selectedTask?.status}</Text>
                            </View>
                            {selectedTask?.start_date && (
                                <View style={{ backgroundColor: '#333', padding: 12, borderRadius: 8, flex: 1 }}>
                                    <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Date & Time</Text>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                        {format(parseISO(selectedTask.start_date), 'MMM d, h:mm a')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
