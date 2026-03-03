import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useChat, ChatMessage } from '../../hooks/useChat';
import { formatTime } from '../../utils/formatters';
import { AvatarCircle } from '../../components/AvatarCircle';
import { EmptyState } from '../../components/EmptyState';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoom'>;

/**
 * ChatScreen — מסך צ׳אט
 * 1:1 real-time chat with image upload support.
 * צ׳אט בזמן אמת עם אפשרות העלאת תמונות
 */
export function ChatScreen({ route }: Props): React.JSX.Element {
  const { chatId, recipientName } = route.params ?? { chatId: '', recipientName: '' };
  const { currentUser } = useAuth();
  const { messages, sendMessage, sendImage, isLoading } = useChat(chatId);

  const [inputText, setInputText] = useState<string>('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');
    await sendMessage({
      chatId,
      senderId: currentUser!.uid,
      text,
      type: 'text',
    });
  }, [inputText, chatId, currentUser, sendMessage]);

  const handleImagePick = useCallback(async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await sendImage({
        chatId,
        senderId: currentUser!.uid,
        imageUri: result.assets[0].uri,
      });
    }
  }, [chatId, currentUser, sendImage]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isOwn = item.senderId === currentUser?.uid;

      return (
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          {!isOwn && (
            <AvatarCircle name={recipientName} size={28} />
          )}
          <View style={[styles.bubbleContent, isOwn ? styles.ownContent : styles.otherContent]}>
            {item.type === 'image' && item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.chatImage} />
            ) : (
              <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
                {item.text}
              </Text>
            )}
            <Text style={[styles.timestamp, isOwn && styles.ownTimestamp]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [currentUser, recipientName],
  );

  // Chat list is rendered bottom-up — show empty state when no messages
  if (!chatId) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="message"
          message="בחר שיחה"
          submessage="לחץ על כפתור הצ׳אט ממסך המשלוח"
          /* Select a chat / Tap chat button from delivery screen */
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Messages list */}
      {/* רשימת הודעות */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>
              התחל שיחה עם {recipientName}
            </Text>
            {/* Start a conversation with [name] */}
          </View>
        }
      />

      {/* Input bar */}
      {/* שורת הקלט */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
          <Text style={styles.imageButtonIcon}>📷</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="כתוב הודעה..."
          placeholderTextColor={COLORS.textSecondary}
          textAlign="right"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>שלח</Text>
          {/* Send */}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageBubble: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
    gap: 8,
  },
  ownBubble: {
    justifyContent: 'flex-end',
  },
  otherBubble: {
    justifyContent: 'flex-start',
  },
  bubbleContent: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownContent: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 4,
  },
  otherContent: {
    backgroundColor: COLORS.surface,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
    textAlign: 'right',
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  chatImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'left',
  },
  ownTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    transform: [{ scaleY: -1 }], // Flip because list is inverted
  },
  emptyChatText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  imageButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtonIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
