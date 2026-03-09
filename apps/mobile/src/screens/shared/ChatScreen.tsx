import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { setActiveChatId } from '../../services/navigation';
import { ChatDeliveryBanner } from '../../components/ChatDeliveryBanner';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useChat, ChatMessage } from '../../hooks/useChat';
import { useChatList, ChatThread } from '../../hooks/useChatList';
import { formatTime } from '../../utils/formatters';
import { AvatarCircle } from '../../components/AvatarCircle';
import { EmptyState } from '../../components/EmptyState';
import { getStatusConfig } from '../../constants/statusConfig';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';

type ChatRoomParams = RootStackParamList['ChatRoom'];

/**
 * ChatScreen — מסך צ׳אט
 * Shows chat list (tab) or 1:1 chat room (stack screen).
 */
export function ChatScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = (route.params as ChatRoomParams) ?? { chatId: '', recipientName: '' };
  const { chatId, recipientName } = params;
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { messages, sendMessage, sendImage } = useChat(chatId);
  const { threads, isLoading: threadsLoading } = useChatList(chatId ? undefined : currentUser?.uid);
  const drawer = useSettingsDrawer();

  const [inputText, setInputText] = useState<string>('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const insets = useSafeAreaInsets();

  // Track active chatId for smart notification suppression
  useFocusEffect(
    useCallback(() => {
      if (chatId) {
        setActiveChatId(chatId);
        return () => setActiveChatId(null);
      }
    }, [chatId]),
  );

  // Navigate to delivery detail from banner
  const handleNavigateToDelivery = useCallback((deliveryId: string) => {
    // Use sender detail for sender, driver detail for driver
    const screen = currentUser?.activeMode === 'driver' ? 'DriverDeliveryDetail' : 'SenderDeliveryDetail';
    navigation.navigate(screen as any, { deliveryId });
  }, [navigation, currentUser?.activeMode]);

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
      quality: 0.5,       // Lower quality for <300KB target
      maxWidth: 1280,      // Max HD resolution
      maxHeight: 1280,
    });

    if (!result.didCancel && result.assets?.[0]) {
      const asset = result.assets[0];
      const fileSize = asset.fileSize ?? 0;
      console.log(`[Chat] Image picked: ${asset.width}x${asset.height}, ${(fileSize / 1024).toFixed(0)}KB`);

      // If still over 300KB, re-pick at lower quality (fallback)
      if (fileSize > 300 * 1024) {
        console.log('[Chat] Image over 300KB, re-picking at lower quality');
        const retry = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.3,
          maxWidth: 960,
          maxHeight: 960,
        });
        if (!retry.didCancel && retry.assets?.[0]) {
          await sendImage({
            chatId,
            senderId: currentUser!.uid,
            imageUri: retry.assets[0].uri!,
          });
          return;
        }
      }

      await sendImage({
        chatId,
        senderId: currentUser!.uid,
        imageUri: asset.uri!,
      });
    }
  }, [chatId, currentUser, sendImage]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      // System messages — centered, gray, no avatar
      if (item.type === 'system') {
        return (
          <View style={styles.systemMessageRow}>
            <View style={[styles.systemMessageBubble, { backgroundColor: colors.surface }]}>
              <Text style={[styles.systemMessageText, { color: colors.textSecondary }]}>
                {item.text}
              </Text>
            </View>
          </View>
        );
      }

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

  // ─── Chat List (Tab view — no chatId) ───
  if (!chatId) {
    const renderThread = ({ item }: { item: ChatThread }) => {
      const isOwnLastMessage = item.lastSenderId === currentUser?.uid;
      const statusCfg = item.deliveryStatus ? getStatusConfig(item.deliveryStatus) : null;
      const hasRoute = item.pickupCity || item.destinationCity;

      return (
        <TouchableOpacity
          style={[styles.threadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, recipientName: item.recipientName })}
          activeOpacity={0.7}
        >
          {/* Top row: avatar + name + time */}
          <View style={styles.threadTopRow}>
            <AvatarCircle name={item.recipientName} photoUrl={item.recipientPhotoUrl} size={44} />
            <View style={styles.threadNameBlock}>
              <Text style={[styles.threadName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.recipientName}
              </Text>
              {statusCfg && (
                <View style={[styles.threadStatusBadge, { backgroundColor: statusCfg.bgColor }]}>
                  <Text style={[styles.threadStatusText, { color: statusCfg.color }]}>
                    {statusCfg.icon} {statusCfg.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.threadTime, { color: colors.textSecondary }]}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </View>

          {/* Route snippet */}
          {hasRoute && (
            <View style={styles.threadRouteRow}>
              <View style={[styles.threadRouteDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={[styles.threadRouteText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.pickupCity}
              </Text>
              <Text style={[styles.threadRouteArrow, { color: colors.textTertiary }]}>→</Text>
              <View style={[styles.threadRouteDot, { backgroundColor: '#F44336' }]} />
              <Text style={[styles.threadRouteText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.destinationCity}
              </Text>
            </View>
          )}

          {/* Last message */}
          <Text style={[styles.threadLastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
            {isOwnLastMessage ? `${t('chat.you')}: ` : ''}{item.lastMessage || t('chat.noMessages')}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TabHeader title={t('tabs.chat')} onSettingsPress={drawer.open} />
        {threadsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : threads.length === 0 ? (
          <EmptyState
            icon="message"
            message={t('chat.noChats')}
            submessage={t('chat.noChatsHint')}
          />
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(item) => item.id}
            renderItem={renderThread}
            contentContainerStyle={styles.threadList}
          />
        )}
        <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
      </View>
    );
  }

  // ─── Chat Room (Stack screen — has chatId) ───
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Delivery info banner */}
      <ChatDeliveryBanner
        chatId={chatId}
        recipientName={recipientName}
        onNavigateToDelivery={handleNavigateToDelivery}
      />

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
      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
          <Text style={styles.imageButtonIcon}>📷</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('chat.messagePlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          textAlign={I18nManager.isRTL ? 'right' : 'left'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ─── Thread list styles ───
  threadList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  threadCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  threadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  threadNameBlock: {
    flex: 1,
    gap: 4,
  },
  threadName: {
    fontSize: 15,
    fontWeight: '700',
  },
  threadStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  threadStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  threadRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingStart: 4,
  },
  threadRouteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  threadRouteText: {
    fontSize: 12,
    flexShrink: 1,
  },
  threadRouteArrow: {
    fontSize: 12,
  },
  threadLastMessage: {
    fontSize: 13,
    paddingStart: 4,
  },
  threadTime: {
    fontSize: 11,
  },
  // ─── Message styles ───
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
    justifyContent: I18nManager.isRTL ? 'flex-start' : 'flex-end',
  },
  otherBubble: {
    justifyContent: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
  bubbleContent: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownContent: {
    borderBottomLeftRadius: I18nManager.isRTL ? undefined : 4,
    borderBottomRightRadius: I18nManager.isRTL ? 4 : undefined,
  },
  otherContent: {
    borderBottomRightRadius: I18nManager.isRTL ? undefined : 4,
    borderBottomLeftRadius: I18nManager.isRTL ? 4 : undefined,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
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
    textAlign: I18nManager.isRTL ? 'right' : 'left',
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
  systemMessageRow: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  systemMessageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
