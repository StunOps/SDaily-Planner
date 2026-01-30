
import { useEffect } from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Index() {
    const router = useRouter();

    useEffect(() => {
        // 2-second splash delay then check session
        const timer = setTimeout(() => {
            checkSession();
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    const checkSession = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            // Navigate regardless of session (for now, to meet "splash then dashboard" requirement)
            // If auth is strictly required, dashboard fetches will fail/return empty, 
            // but user asked to "get rid off sign up", implying streamlined access.
            router.replace('/dashboard');
        } catch (e) {
            router.replace('/dashboard');
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
            {/* Logo Container */}
            <View style={{ marginBottom: 40, alignItems: 'center' }}>
                <Image
                    source={require('../assets/SD Logo Vector(Colored).png')}
                    style={{ width: 150, height: 150, resizeMode: 'contain' }}
                />
            </View>
            <ActivityIndicator size="large" color="#FF9F1C" />
        </View>
    );
}
