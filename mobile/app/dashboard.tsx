
import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Modal, Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, AlertCircle, X, Check, Clock, Inbox, Mic, Trash2, Edit3, Send, Paperclip, Image as ImageIcon, Download, Globe } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { KanbanCard, Plan, Attachment } from '../lib/types';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { registerForPushNotificationsAsync, scheduleSmartNotifications, scheduleTodayTaskReminder, QUOTES, setupNotifications } from '../lib/notifications';
import CustomAlert, { AlertType } from '../components/CustomAlert';

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [todayPlans, setTodayPlans] = useState<Plan[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const router = useRouter();

    // Inbox State
    const [inboxCards, setInboxCards] = useState<KanbanCard[]>([]);
    const [isInboxExpanded, setIsInboxExpanded] = useState(false);

    // Quick Add State
    const [quickAddText, setQuickAddText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

    // Voice Input State
    const [isListening, setIsListening] = useState(false);

    // Edit Modal State
    const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
    const [editText, setEditText] = useState('');

    const [viewingCard, setViewingCard] = useState<KanbanCard | null>(null);

    // Full Screen Image State
    const [fullScreenImage, setFullScreenImage] = useState<Attachment | null>(null);

    // Voice Input Custom Modal State
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [voiceText, setVoiceText] = useState('');

    // Link Input Modal State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkName, setLinkName] = useState('');
    const [linkUrl, setLinkUrl] = useState('');

    // Dock State
    const [isDockVisible, setIsDockVisible] = useState(true);
    const [isDockExpanded, setIsDockExpanded] = useState(false);

    // Custom Alert State
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{
        title: string;
        message: string;
        type: AlertType;
        buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[];
    }>({ title: '', message: '', type: 'info', buttons: [] });

    const showAlert = (title: string, message: string, type: AlertType = 'info', buttons?: typeof alertConfig.buttons) => {
        setAlertConfig({ title, message, type, buttons: buttons || [{ text: 'OK', style: 'default' }] });
        setAlertVisible(true);
    };

    const fetchData = async () => {
        try {
            // Get pending count
            const { count } = await supabase
                .from('kanban_cards')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingCount(count || 0);

            // Fetch inbox cards with attachments
            const { data: inbox } = await supabase
                .from('kanban_cards')
                .select('*')
                .eq('status', 'inbox')
                .order('created_at', { ascending: false });

            if (inbox) {
                // Fetch attachments for each inbox card
                const cardIds = inbox.map(c => c.id);
                if (cardIds.length > 0) {
                    const { data: attachments } = await supabase
                        .from('card_attachments')
                        .select('*')
                        .in('card_id', cardIds);

                    // Map attachments to cards
                    const cardsWithAttachments = inbox.map(card => ({
                        ...card,
                        attachments: (attachments || []).filter(a => a.card_id === card.id)
                    }));
                    setInboxCards(cardsWithAttachments);
                } else {
                    setInboxCards([]);
                }
            }

            // Fetch plans for today
            const { data: allPlans } = await supabase
                .from('plans')
                .select('*')
                .order('created_at', { ascending: false });

            if (allPlans) {
                const today = format(new Date(), 'yyyy-MM-dd');
                const filtered = allPlans.filter(plan => {
                    if (plan.date === today) return true;
                    if (plan.has_due_date && plan.due_date) {
                        return plan.date <= today && plan.due_date >= today;
                    }
                    return false;
                });
                setTodayPlans(filtered);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));
    const onRefresh = () => { setRefreshing(true); fetchData(); };

    // Setup notifications on first mount
    useEffect(() => {
        (async () => {
            await setupNotifications();
            await registerForPushNotificationsAsync();
            await scheduleSmartNotifications();
        })();
    }, []);

    // Schedule today's task reminder when plans are loaded
    useEffect(() => {
        if (todayPlans.length > 0) {
            const pendingPlans = todayPlans.filter(p => !p.completed);
            scheduleTodayTaskReminder(
                pendingPlans.length,
                pendingPlans.map(p => p.title)
            );
        }
    }, [todayPlans]);

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    // Pick Image Attachment
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission Required', 'Please allow access to photos.', 'warning');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
            base64: true
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const fileName = `inbox_${Date.now()}.jpg`;

            // Upload to Supabase Storage
            const base64Data = asset.base64;
            if (base64Data) {
                try {
                    const { data, error } = await supabase.storage
                        .from('attachments')
                        .upload(fileName, decode(base64Data), {
                            contentType: 'image/jpeg'
                        });

                    if (data) {
                        const { data: urlData } = supabase.storage
                            .from('attachments')
                            .getPublicUrl(fileName);

                        setPendingAttachments([...pendingAttachments, {
                            id: Date.now().toString(),
                            type: 'file',
                            name: fileName,
                            url: urlData.publicUrl
                        }]);
                    }
                } catch (e) {
                    console.error('Upload error:', e);
                    showAlert('Upload Failed', 'Could not upload image.', 'error');
                }
            }
        }
    };

    // Voice Input - Custom Modal (works on Android unlike Alert.prompt)
    const startVoiceInput = () => {
        setVoiceText('');
        setShowVoiceModal(true);
    };

    // Save Image to Gallery
    const saveImage = async (url: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permission needed', 'Please allow storage access to save images.', 'warning');
                return;
            }

            const filename = url.split('/').pop() || `image_${Date.now()}.jpg`;
            if (!(FileSystem as any).documentDirectory) {
                showAlert('Error', 'Device storage not available.', 'error');
                return;
            }
            const fileUri = (FileSystem as any).documentDirectory + filename;

            const { uri } = await FileSystem.downloadAsync(url, fileUri);
            await MediaLibrary.createAssetAsync(uri);
            showAlert('Saved!', 'Image saved to your gallery.', 'success');
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Failed to save image.', 'error');
        }
    };

    // Quick Add - Save to Inbox
    const handleQuickAdd = async () => {
        if (!quickAddText.trim() && pendingAttachments.length === 0) return;
        setIsSaving(true);
        try {
            // Insert card
            const { data: newCard, error } = await supabase.from('kanban_cards').insert({
                title: quickAddText.trim() || 'Attachment',
                status: 'inbox',
                position: 0
            }).select().single();

            if (newCard && pendingAttachments.length > 0) {
                // Insert attachments
                await supabase.from('card_attachments').insert(
                    pendingAttachments.map(att => ({
                        card_id: newCard.id,
                        type: att.type,
                        name: att.name,
                        url: att.url
                    }))
                );
            }

            if (!error) {
                setQuickAddText('');
                setPendingAttachments([]);
                fetchData();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    // Edit Inbox Card
    const handleEditCard = async () => {
        if (!editingCard || !editText.trim()) return;
        try {
            await supabase.from('kanban_cards').update({ title: editText.trim() }).eq('id', editingCard.id);
            setEditingCard(null);
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    // Delete Inbox Card
    const handleDeleteCard = (card: KanbanCard) => {
        showAlert('Delete', `Delete "${card.title}"?`, 'confirm', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('card_attachments').delete().eq('card_id', card.id);
                    await supabase.from('kanban_cards').delete().eq('id', card.id);
                    fetchData();
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    contentContainerStyle={{ padding: 20, paddingBottom: 180 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9F1C" />}
                >
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 4 }}>
                                <Image
                                    source={require('../assets/SD Logo Vector(Colored).png')}
                                    style={{ width: 32, height: 32, resizeMode: 'contain' }}
                                />
                            </View>
                            <View>
                                <Text style={{ color: '#FF9F1C', fontSize: 14 }}>{getGreeting()}, Stun</Text>
                                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>SDaily Planner</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => Linking.openURL('https://sdailyplanner.vercel.app/')} style={{ padding: 8, backgroundColor: '#2A2A2A', borderRadius: 12 }}>
                                <Globe color="#3B82F6" size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/calendar')} style={{ padding: 8, backgroundColor: '#2A2A2A', borderRadius: 12 }}>
                                <CalendarIcon color="#FF9F1C" size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Quick Add Input */}
                    <View style={{ backgroundColor: '#1E1E1E', borderRadius: 16, padding: 16, marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TextInput
                                value={quickAddText}
                                onChangeText={setQuickAddText}
                                placeholder="Quick note..."
                                placeholderTextColor="#666"
                                style={{
                                    flex: 1,
                                    color: 'white',
                                    fontSize: 16,
                                    padding: 12,
                                    backgroundColor: '#2A2A2A',
                                    borderRadius: 12
                                }}
                                onSubmitEditing={handleQuickAdd}
                                returnKeyType="send"
                            />

                            <TouchableOpacity
                                onPress={handleQuickAdd}
                                disabled={isSaving || (!quickAddText.trim() && pendingAttachments.length === 0)}
                                style={{
                                    backgroundColor: (quickAddText.trim() || pendingAttachments.length > 0) ? '#FF9F1C' : '#333',
                                    padding: 12,
                                    borderRadius: 12
                                }}
                            >
                                {isSaving ? <ActivityIndicator color="white" size={20} /> : <Send color="white" size={20} />}
                            </TouchableOpacity>
                        </View>

                        {/* Pending Attachments Preview */}
                        {pendingAttachments.length > 0 && (
                            <ScrollView horizontal style={{ marginTop: 12 }} showsHorizontalScrollIndicator={false}>
                                {pendingAttachments.map((att, i) => (
                                    <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                                        {att.type === 'link' ? (
                                            <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' }}>
                                                <Globe color="#FF9F1C" size={24} />
                                            </View>
                                        ) : (
                                            <Image source={{ uri: att.url }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                                        )}
                                        <TouchableOpacity
                                            onPress={() => setPendingAttachments(pendingAttachments.filter((_, idx) => idx !== i))}
                                            style={{ position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, padding: 2 }}
                                        >
                                            <X size={12} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        {/* Media Buttons Row (Moved Below Text) */}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 16, marginBottom: 16, paddingLeft: 4, marginTop: 12 }}>
                            <TouchableOpacity onPress={startVoiceInput}>
                                <Mic size={22} color="#A0A0A0" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={pickImage}>
                                <Paperclip size={22} color="#A0A0A0" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowLinkModal(true)}>
                                <Globe size={22} color="#A0A0A0" />
                            </TouchableOpacity>
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                            onPress={handleQuickAdd}
                            disabled={isSaving || (!quickAddText.trim() && pendingAttachments.length === 0)}
                            style={{
                                backgroundColor: (quickAddText.trim() || pendingAttachments.length > 0) ? '#FF9F1C' : '#333',
                                borderRadius: 12,
                                paddingVertical: 14,
                                alignItems: 'center',
                                marginTop: 0
                            }}
                        >
                            {isSaving ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Save to Inbox</Text>}
                        </TouchableOpacity>
                    </View>

                    {/* Inbox Section */}
                    <TouchableOpacity
                        onPress={() => setIsInboxExpanded(!isInboxExpanded)}
                        activeOpacity={0.9}
                        style={{
                            backgroundColor: '#1E1E1E',
                            borderRadius: 16,
                            padding: 24,
                            marginBottom: 24,
                            borderLeftWidth: 4,
                            borderLeftColor: '#8B5CF6'
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Inbox size={24} color="#8B5CF6" />
                                <Text style={{ color: '#ccc', fontSize: 16 }}>Inbox</Text>
                                <View style={{ backgroundColor: '#8B5CF620', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                    <Text style={{ color: '#8B5CF6', fontSize: 12, fontWeight: 'bold' }}>{inboxCards.length}</Text>
                                </View>
                            </View>
                            <Text style={{ color: '#666', fontSize: 12 }}>{isInboxExpanded ? 'Hide' : 'Show'}</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Inbox Items (Expanded) */}
                    {isInboxExpanded && inboxCards.length > 0 && (
                        <View style={{ marginBottom: 24 }}>
                            {inboxCards.map(card => (
                                <TouchableOpacity
                                    key={card.id}
                                    onPress={() => setViewingCard(card)}
                                    style={{
                                        backgroundColor: '#1E1E1E',
                                        borderRadius: 12,
                                        padding: 16,
                                        marginBottom: 8
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: 'white', fontSize: 14 }}>{card.title}</Text>
                                            {card.attachments && card.attachments.length > 0 && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                    <Paperclip size={12} color="#3B82F6" />
                                                    <Text style={{ color: '#3B82F6', fontSize: 10 }}>{card.attachments.length} attachment(s)</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity
                                                onPress={() => { setEditingCard(card); setEditText(card.title); }}
                                                style={{ padding: 8, backgroundColor: '#2A2A2A', borderRadius: 8 }}
                                            >
                                                <Edit3 size={16} color="#8B5CF6" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteCard(card)}
                                                style={{ padding: 8, backgroundColor: '#2A2A2A', borderRadius: 8 }}
                                            >
                                                <Trash2 size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Pending Tasks Card */}
                    <TouchableOpacity
                        onPress={() => router.push('/tasks?type=pending')}
                        activeOpacity={0.9}
                        style={{
                            backgroundColor: '#1E1E1E',
                            borderRadius: 16,
                            padding: 24,
                            marginBottom: 24,
                            borderLeftWidth: 4,
                            borderLeftColor: '#F59E0B'
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <AlertCircle size={24} color="#F59E0B" />
                            <Text style={{ color: '#ccc', fontSize: 16 }}>Pending Tasks</Text>
                        </View>
                        <Text style={{ color: 'white', fontSize: 48, fontWeight: 'bold' }}>{pendingCount}</Text>
                        <Text style={{ color: '#666', marginTop: 8 }}>Tap to see full list</Text>
                    </TouchableOpacity>

                    {/* Due Today Card */}
                    <TouchableOpacity
                        onPress={() => router.push('/tasks?type=due')}
                        activeOpacity={0.9}
                        style={{
                            backgroundColor: '#1E1E1E',
                            borderRadius: 16,
                            padding: 24,
                            marginBottom: 24,
                            borderLeftWidth: 4,
                            borderLeftColor: '#E11D48'
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Clock size={24} color="#E11D48" />
                            <Text style={{ color: '#ccc', fontSize: 16 }}>Due Today</Text>
                        </View>
                        <Text style={{ color: 'white', fontSize: 48, fontWeight: 'bold' }}>
                            {todayPlans.filter(p => !p.completed).length}
                        </Text>
                        <Text style={{ color: '#666', marginTop: 8 }}>Tap to see full list</Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Today's Plan Dock */}
                {isDockVisible && (
                    <View style={{
                        position: 'absolute',
                        bottom: 20,
                        left: 20,
                        right: 20,
                        backgroundColor: '#1A1A1A',
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: '#333',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 10,
                        overflow: 'hidden'
                    }}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setIsDockExpanded(!isDockExpanded)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: 16,
                                backgroundColor: '#2A2A2A'
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <CalendarIcon size={20} color="#FF9F1C" />
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Today's Plan</Text>
                                {todayPlans.length > 0 && (
                                    <View style={{ backgroundColor: '#FF9F1C20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                        <Text style={{ color: '#FF9F1C', fontSize: 12, fontWeight: 'bold' }}>{todayPlans.length}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={{ color: '#888', fontSize: 12 }}>{isDockExpanded ? 'Hide' : 'Show'}</Text>
                        </TouchableOpacity>

                        {isDockExpanded && (
                            <View style={{ maxHeight: 300 }}>
                                <ScrollView contentContainerStyle={{ padding: 16 }}>
                                    {todayPlans.length === 0 ? (
                                        <Text style={{ color: '#666', textAlign: 'center' }}>Relax, no plans for today!</Text>
                                    ) : (
                                        todayPlans.map(plan => (
                                            <TouchableOpacity
                                                key={plan.id}
                                                onPress={() => setSelectedPlan(plan)}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    marginBottom: 12,
                                                    backgroundColor: plan.completed ? '#10B98110' : 'transparent',
                                                    borderRadius: 8,
                                                    padding: 8
                                                }}
                                            >
                                                <View style={{
                                                    width: 20, height: 20,
                                                    borderRadius: 10, borderWidth: 2,
                                                    borderColor: plan.completed ? '#10B981' : '#666',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    marginRight: 10
                                                }}>
                                                    {plan.completed && <Check size={12} color="#10B981" />}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{
                                                        color: plan.completed ? '#888' : 'white',
                                                        textDecorationLine: plan.completed ? 'line-through' : 'none',
                                                        fontSize: 14
                                                    }}>
                                                        {plan.title}
                                                    </Text>
                                                    <Text style={{ color: '#E11D48', fontSize: 10, marginTop: 2 }}>
                                                        Due: {plan.due_date ? format(parseISO(plan.due_date), 'MMM d') : plan.date}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                )}
            </KeyboardAvoidingView>

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
                                    {selectedPlan?.due_date ? format(parseISO(selectedPlan.due_date), 'MMM d, yyyy') : 'No due date'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Card Modal */}
            <Modal visible={!!editingCard} transparent={true} animationType="slide" onRequestClose={() => setEditingCard(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#1E1E1E', borderRadius: 24, padding: 24 }}>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Edit Card</Text>
                        <TextInput
                            value={editText}
                            onChangeText={setEditText}
                            style={{
                                color: 'white',
                                fontSize: 16,
                                padding: 16,
                                backgroundColor: '#2A2A2A',
                                borderRadius: 12,
                                marginBottom: 16
                            }}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setEditingCard(null)}
                                style={{ flex: 1, padding: 16, backgroundColor: '#333', borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#888' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleEditCard}
                                style={{ flex: 1, padding: 16, backgroundColor: '#8B5CF6', borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* View Card Modal (with Attachments) */}
            <Modal visible={!!viewingCard} transparent={true} animationType="slide" onRequestClose={() => setViewingCard(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>Inbox Item</Text>
                            <TouchableOpacity onPress={() => setViewingCard(null)}><X color="#888" /></TouchableOpacity>
                        </View>
                        <Text style={{ color: '#ccc', fontSize: 18, marginBottom: 16 }}>{viewingCard?.title}</Text>

                        {/* Attachments */}
                        {viewingCard?.attachments && viewingCard.attachments.length > 0 && (
                            <View>
                                <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Attachments</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {viewingCard.attachments.map((att, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => att.type === 'link' ? Linking.openURL(att.url) : setFullScreenImage(att)}
                                            style={{ marginRight: 8, alignItems: 'center', width: 100 }}
                                        >
                                            {att.type === 'link' ? (
                                                <View style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' }}>
                                                    <Globe color="#FF9F1C" size={32} />
                                                    <Text numberOfLines={2} style={{ color: '#FF9F1C', fontSize: 10, textAlign: 'center', marginTop: 4, paddingHorizontal: 4 }}>
                                                        {att.name || 'Link'}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <Image source={{ uri: att.url }} style={{ width: 100, height: 100, borderRadius: 12 }} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Voice Input Modal */}
            <Modal visible={showVoiceModal} transparent={true} animationType="fade" onRequestClose={() => setShowVoiceModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#1E1E1E', borderRadius: 24, padding: 24 }}>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Voice Note</Text>
                        <Text style={{ color: '#888', marginBottom: 16 }}>Use your keyboard microphone to dictate.</Text>

                        <TextInput
                            value={voiceText}
                            onChangeText={setVoiceText}
                            placeholder="Listening..."
                            placeholderTextColor="#666"
                            multiline
                            autoFocus
                            style={{
                                color: 'white',
                                fontSize: 16,
                                padding: 16,
                                backgroundColor: '#2A2A2A',
                                borderRadius: 12,
                                marginBottom: 16,
                                height: 120,
                                textAlignVertical: 'top'
                            }}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setShowVoiceModal(false)}
                                style={{ flex: 1, padding: 16, backgroundColor: '#333', borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#888' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (voiceText) setQuickAddText(prev => prev + (prev ? ' ' : '') + voiceText);
                                    setShowVoiceModal(false);
                                }}
                                style={{ flex: 1, padding: 16, backgroundColor: '#8B5CF6', borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Add Text</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Link Modal */}
            <Modal visible={showLinkModal} transparent={true} animationType="fade" onRequestClose={() => setShowLinkModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#1E1E1E', borderRadius: 24, padding: 24 }}>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Add Link</Text>

                        <TextInput
                            value={linkName}
                            onChangeText={setLinkName}
                            placeholder="Link Name (e.g., Design Inspiration)"
                            placeholderTextColor="#666"
                            style={{
                                color: 'white',
                                fontSize: 16,
                                padding: 16,
                                backgroundColor: '#2A2A2A',
                                borderRadius: 12,
                                marginBottom: 16,
                            }}
                        />

                        <TextInput
                            value={linkUrl}
                            onChangeText={setLinkUrl}
                            placeholder="URL (https://...)"
                            placeholderTextColor="#666"
                            autoCapitalize="none"
                            style={{
                                color: 'white',
                                fontSize: 16,
                                padding: 16,
                                backgroundColor: '#2A2A2A',
                                borderRadius: 12,
                                marginBottom: 16,
                            }}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setShowLinkModal(false)}
                                style={{ flex: 1, padding: 16, backgroundColor: '#333', borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#888' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (linkUrl) {
                                        setPendingAttachments([...pendingAttachments, {
                                            id: Date.now().toString(),
                                            type: 'link',
                                            name: linkName || linkUrl,
                                            url: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
                                        }]);
                                        setLinkUrl('');
                                        setLinkName('');
                                        setShowLinkModal(false);
                                    }
                                }}
                                style={{ flex: 1, padding: 16, backgroundColor: '#FF9F1C', borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Add Link</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Full Screen Image Modal */}
            <Modal visible={!!fullScreenImage} transparent={true} animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
                <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', position: 'relative' }}>
                    <TouchableOpacity
                        onPress={() => setFullScreenImage(null)}
                        style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}
                    >
                        <X color="white" size={24} />
                    </TouchableOpacity>

                    {fullScreenImage && (
                        <>
                            <Image
                                source={{ uri: fullScreenImage.url }}
                                style={{ width: '100%', height: '80%', resizeMode: 'contain' }}
                            />
                            <TouchableOpacity
                                onPress={() => saveImage(fullScreenImage.url)}
                                style={{
                                    position: 'absolute', bottom: 40, alignSelf: 'center',
                                    flexDirection: 'row', alignItems: 'center', gap: 8,
                                    backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24
                                }}
                            >
                                <Download color="black" size={20} />
                                <Text style={{ color: 'black', fontWeight: 'bold' }}>Save to Gallery</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </Modal>

            {/* Custom Alert */}
            <CustomAlert
                visible={alertVisible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                buttons={alertConfig.buttons}
                onClose={() => setAlertVisible(false)}
            />
        </SafeAreaView>
    );
}

// Helper function to decode base64 without atob (RN compatible)
function decode(base64: string): Uint8Array {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    // Handle padding
    let len = base64.length;
    while (len > 0 && base64[len - 1] === '=') len--;

    const bytes = new Uint8Array(Math.floor((len * 3) / 4));
    let i = 0, j = 0;
    let a, b, c, d;

    while (i < len) {
        a = lookup[base64.charCodeAt(i++)] || 0;
        b = lookup[base64.charCodeAt(i++)] || 0;
        c = lookup[base64.charCodeAt(i++)] || 0;
        d = lookup[base64.charCodeAt(i++)] || 0;

        bytes[j++] = (a << 2) | (b >> 4);
        if (j < bytes.length) bytes[j++] = ((b & 15) << 4) | (c >> 2);
        if (j < bytes.length) bytes[j++] = ((c & 3) << 6) | (d & 63);
    }
    return bytes;
}
