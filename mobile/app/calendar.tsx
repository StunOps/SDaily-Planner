
import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, ArrowLeft, Check, Clock, X } from 'lucide-react-native';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, isBefore, startOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Plan } from '../lib/types';

export default function CalendarScreen() {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    // Fetch all plans (we filter client-side for date ranges)
    const fetchPlans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) setPlans(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh on focus
    useFocusEffect(
        useCallback(() => {
            fetchPlans();
        }, [])
    );

    // Calendar Grid Gen
    const weekStart = startOfWeek(startOfMonth(currentDate));
    const weekEnd = endOfWeek(endOfMonth(currentDate));
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Helper: Check if a plan applies to a given day (date range logic)
    const planAppliesToDay = (plan: Plan, day: Date): boolean => {
        const dayStr = format(day, 'yyyy-MM-dd');
        // If plan.date equals this day
        if (plan.date === dayStr) return true;
        // If plan has a due date range, check if day falls within
        if (plan.has_due_date && plan.due_date) {
            return plan.date <= dayStr && plan.due_date >= dayStr;
        }
        return false;
    };

    // Filter plans for selected date
    const selectedPlans = plans.filter(p => planAppliesToDay(p, selectedDate));

    // Helper to get status color for a day
    const getDayIndicators = (day: Date) => {
        const dayPlans = plans.filter(p => planAppliesToDay(p, day));
        if (dayPlans.length === 0) return null;

        const dayStr = format(day, 'yyyy-MM-dd');
        const today = format(new Date(), 'yyyy-MM-dd');

        // Check for overdue (due_date or date is before today and not completed)
        const hasOverdue = dayPlans.some(p => {
            const dueDate = p.due_date || p.date;
            return dueDate < today && !p.completed;
        });
        const allCompleted = dayPlans.every(p => p.completed);

        if (hasOverdue) return '#EF4444'; // Red
        if (allCompleted) return '#10B981'; // Green
        return '#F59E0B'; // Orange (pending)
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                    <ArrowLeft color="white" size={24} />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))}>
                        <ChevronLeft color="#ccc" size={24} />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                        {format(currentDate, 'MMMM yyyy')}
                    </Text>
                    <TouchableOpacity onPress={() => setCurrentDate(addMonths(currentDate, 1))}>
                        <ChevronRight color="#ccc" size={24} />
                    </TouchableOpacity>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Days Header */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 10, marginBottom: 10 }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <Text key={i} style={{ flex: 1, textAlign: 'center', color: '#666', fontWeight: 'bold' }}>{d}</Text>
                ))}
            </View>

            {/* Calendar Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 }}>
                {days.map((day, i) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const indicatorColor = getDayIndicators(day);

                    return (
                        <TouchableOpacity
                            key={i}
                            onPress={() => setSelectedDate(day)}
                            style={{
                                width: '14.28%',
                                aspectRatio: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: isSelected ? '#FF9F1C' : 'transparent',
                                borderRadius: 20,
                                opacity: isCurrentMonth ? 1 : 0.3,
                                marginBottom: 10
                            }}
                        >
                            <Text style={{
                                color: isSelected ? 'white' : isToday(day) ? '#FF9F1C' : 'white',
                                fontWeight: isSelected || isToday(day) ? 'bold' : 'normal'
                            }}>
                                {format(day, 'd')}
                            </Text>
                            {indicatorColor && !isSelected && (
                                <View style={{
                                    width: 4, height: 4, borderRadius: 2,
                                    backgroundColor: indicatorColor,
                                    marginTop: 4
                                }} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Plan List for Selected Day */}
            <ScrollView style={{ flex: 1, marginTop: 20, paddingHorizontal: 20 }}>
                <Text style={{ color: '#888', marginBottom: 16, fontSize: 16 }}>
                    {format(selectedDate, 'EEEE, MMMM d')}
                </Text>

                {loading ? (
                    <ActivityIndicator color="#FF9F1C" />
                ) : selectedPlans.length === 0 ? (
                    <Text style={{ color: '#444', fontStyle: 'italic' }}>No plans for this day.</Text>
                ) : (
                    selectedPlans.map(plan => (
                        <TouchableOpacity
                            key={plan.id}
                            onPress={() => setSelectedPlan(plan)}
                            style={{
                                backgroundColor: '#1E1E1E',
                                padding: 16,
                                borderRadius: 12,
                                marginBottom: 12,
                                borderLeftWidth: 4,
                                borderLeftColor: plan.completed ? '#10B981' : '#F59E0B'
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', flex: 1 }}>{plan.title}</Text>
                                {plan.completed && <Check size={16} color="#10B981" />}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                <Text style={{ color: '#E11D48', fontSize: 12 }}>
                                    Due: {plan.due_date ? format(parseISO(plan.due_date), 'MMM d') : plan.date}
                                </Text>
                                <Text style={{ color: '#666', fontSize: 12, textTransform: 'uppercase' }}>
                                    {plan.completed ? 'Completed' : 'Pending'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Plan Details Modal */}
            <Modal visible={!!selectedPlan} transparent={true} animationType="slide" onRequestClose={() => setSelectedPlan(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>Plan Details</Text>
                            <TouchableOpacity onPress={() => setSelectedPlan(null)}><X color="#888" /></TouchableOpacity>
                        </View>
                        <Text style={{ color: '#ccc', fontSize: 18, marginBottom: 8 }}>{selectedPlan?.title}</Text>
                        <Text style={{ color: '#666', marginBottom: 20 }}>{selectedPlan?.description || 'No description'}</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ backgroundColor: '#333', padding: 12, borderRadius: 8, flex: 1 }}>
                                <Text style={{ color: '#888', fontSize: 12 }}>Status</Text>
                                <Text style={{ color: selectedPlan?.completed ? '#10B981' : '#F59E0B', fontWeight: 'bold' }}>
                                    {selectedPlan?.completed ? 'Completed' : 'Pending'}
                                </Text>
                            </View>
                            <View style={{ backgroundColor: '#333', padding: 12, borderRadius: 8, flex: 1 }}>
                                <Text style={{ color: '#888', fontSize: 12 }}>Due Date</Text>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                    {selectedPlan?.due_date ? format(parseISO(selectedPlan.due_date), 'MMM d, yyyy') : selectedPlan?.date}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
