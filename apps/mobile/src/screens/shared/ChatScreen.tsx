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
import { useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useChat, ChatMessage } from '../../hooks/useChat';
import { formatTime } from '../../utils/formatters';
import { AvatarCircle } from '../../components/AvatarCircle';
import { EmptyState } from '../../components/EmptyState';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';

type ChatRoomParams = RootStackParamList['ChatRoom'];

/**
 * ChatScreen — מסך צ׳אט
 * 1:1 real-time chat with image upload support.
 * צ׳אט בזמן אמת עם אפשרות העלאת תמונות
 */
export function ChatScreen(): React.JSX.Element {
  const route = useRoute();
  const params = (route.params as ChatRoomParams) ?? { chatId: '', recipientName: '' };
  const { chatId, recipientName } = params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { messages, sendMessage, sendImage } = useChat(chatId);
  const drawer = useSettingsDrawer();

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
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });

    if (!result.didCancel && result.assets?.[0]) {
      await sendImage({
        chatId,
        senderId: currentUser!.uid,
        imageUri: result.assets[0].uri!,
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
          <View style={[
            styles.bubbleContent,
            isOwn
              ? [styles.ownContent, { backgroundColor: colors.primary }]
              : [styles.otherContent, { backgroundColor: colors.surface, borderColor: colors.border }],
          ]}>
            {item.type === 'image' && item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.chatImage} />
            ) : (
              <Text style={[styles.messageText, { color: colors.textPrimary }, isOwn && styles.ownMessageText]}>
                {item.text}
              </Text>
            )}
            <Text style={[styles.timestamp, { color: colors.textSecondary }, isOwn && styles.ownTimestamp]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [currentUser, recipientName, colors],
  );

  // Chat list is rendered bottom-up — show empty state when no messages
  if (!chatId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TabHeader title={t('tabs.chat')} onSettingsPress={drawer.open} />
        <EmptyState
          icon="message"
          message={t('chat.selectChat')}
          submessage={t('chat.selectChatHint')}
        />
        <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <TabHeader title={t('tabs.chat')} onSettingsPress={drawer.open} />
      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
              {t('chat.startConversation')} {recipientName}
            </Text>
          </View>
        }
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
          <Text style={styles.imageButtonIcon}>📷</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('chat.messagePlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          textAlign="right"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary }, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>{t('chat.send')}</Text>
        </TouchableOpacity>
      </View>
      <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderBottomLeftRadius: 4,
  },
  otherContent: {
    borderBottomRightRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
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
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
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
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendButton: {
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
