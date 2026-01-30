
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react-native';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    buttons?: AlertButton[];
    onClose: () => void;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
    visible,
    title,
    message,
    type = 'info',
    buttons = [{ text: 'OK', style: 'default' }],
    onClose
}) => {
    const getIcon = () => {
        const iconProps = { size: 32 };
        switch (type) {
            case 'success':
                return <CheckCircle {...iconProps} color="#10B981" />;
            case 'error':
                return <AlertCircle {...iconProps} color="#EF4444" />;
            case 'warning':
                return <AlertTriangle {...iconProps} color="#F59E0B" />;
            case 'confirm':
                return <AlertTriangle {...iconProps} color="#F59E0B" />;
            default:
                return <Info {...iconProps} color="#3B82F6" />;
        }
    };

    const getButtonStyle = (style?: string) => {
        switch (style) {
            case 'destructive':
                return { backgroundColor: '#EF4444' };
            case 'cancel':
                return { backgroundColor: '#333' };
            default:
                return { backgroundColor: '#8B5CF6' };
        }
    };

    const getButtonTextStyle = (style?: string) => {
        switch (style) {
            case 'cancel':
                return { color: '#888' };
            default:
                return { color: 'white' };
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Close Button */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <X color="#666" size={20} />
                    </TouchableOpacity>

                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        {getIcon()}
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>{title}</Text>

                    {/* Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        {buttons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.button, getButtonStyle(button.style), buttons.length > 1 && { flex: 1 }]}
                                onPress={() => {
                                    button.onPress?.();
                                    onClose();
                                }}
                            >
                                <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                                    {button.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 4,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#2A2A2A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 100,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CustomAlert;
