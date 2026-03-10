import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useI18n } from '../i18n/I18nContext';
import avatarDriver from '../assets/avatar-driver.png';
import avatarSender from '../assets/avatar-sender.jpg';

interface Chat {
  id: string;
  deliveryId: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp;
  lastSenderId: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  type: string;
  read: boolean;
  createdAt: Timestamp;
}

interface UserInfo {
  fullName: string;
  email: string;
  role: string;
  profilePhotoURL?: string;
}

export default function ChatsPage() {
  const { t } = useI18n();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [userCache, setUserCache] = useState<Record<string, UserInfo>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load all chats
  useEffect(() => {
    const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chat));
      setChats(list);
      setLoading(false);

      // Cache participant info
      const allUids = new Set<string>();
      list.forEach((c) => c.participants.forEach((p) => allUids.add(p)));
      loadUsers([...allUids]);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Load messages when chat selected
  useEffect(() => {
    if (!selectedChat) { setMessages([]); return; }
    setMessagesLoading(true);
    const q = query(
      collection(db, 'chats', selectedChat, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setMessagesLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, () => setMessagesLoading(false));
    return unsub;
  }, [selectedChat]);

  async function loadUsers(uids: string[]) {
    const toLoad = uids.filter((uid) => uid && !userCache[uid]);
    if (toLoad.length === 0) return;
    const updates: Record<string, UserInfo> = {};
    for (const uid of toLoad) {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const data = snap.data();
          updates[uid] = {
            fullName: data.fullName || data.email || uid.slice(0, 8),
            email: data.email || '',
            role: data.role || 'sender',
            profilePhotoURL: data.profilePhotoURL || '',
          };
        } else {
          updates[uid] = { fullName: uid.slice(0, 8), email: '', role: 'sender' };
        }
      } catch {
        updates[uid] = { fullName: uid.slice(0, 8), email: '', role: 'sender' };
      }
    }
    setUserCache((prev) => ({ ...prev, ...updates }));
  }

  function getUserName(uid: string): string {
    return userCache[uid]?.fullName || uid.slice(0, 8);
  }

  function getUserAvatar(uid: string): string {
    const user = userCache[uid];
    if (user?.profilePhotoURL) return user.profilePhotoURL;
    return user?.role === 'driver' ? avatarDriver : avatarSender;
  }

  function formatTime(ts: Timestamp | undefined): string {
    if (!ts?.toDate) return '';
    const d = ts.toDate();
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  function getChatTitle(chat: Chat): string {
    return chat.participants.map((p) => getUserName(p)).join(' / ');
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{t('chats.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('chats.subtitle')}</p>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Chat List */}
        <div className="w-80 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50">
          {chats.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">{t('chats.noChats')}</div>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`w-full border-b border-gray-100 p-4 text-right transition-colors hover:bg-gray-100 ${
                  selectedChat === chat.id ? 'bg-brand-50 border-r-2 border-r-brand-600' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {chat.participants.slice(0, 2).map((uid) => (
                      <img
                        key={uid}
                        src={getUserAvatar(uid)}
                        alt=""
                        className="h-8 w-8 rounded-full border-2 border-white object-cover"
                      />
                    ))}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-gray-900">{getChatTitle(chat)}</p>
                    <p className="truncate text-xs text-gray-500">{chat.lastMessage}</p>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">{formatTime(chat.lastMessageAt)}</p>
              </button>
            ))
          )}
        </div>

        {/* Messages Area */}
        <div className="flex flex-1 flex-col">
          {!selectedChat ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              {t('chats.selectChat')}
            </div>
          ) : messagesLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-3">
                {chats.find((c) => c.id === selectedChat)?.participants.map((uid) => (
                  <div key={uid} className="flex items-center gap-2">
                    <img src={getUserAvatar(uid)} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{getUserName(uid)}</p>
                      <p className="text-xs text-gray-400">{userCache[uid]?.email}</p>
                    </div>
                  </div>
                ))}
                <div className="flex-1" />
                <span className="text-xs text-gray-400">
                  {t('chats.delivery')}: {selectedChat?.slice(0, 8)}...
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-gray-400 py-8">{t('chats.noMessages')}</div>
                ) : (
                  messages.map((msg) => {
                    const isFirst = chats.find((c) => c.id === selectedChat)?.participants[0] === msg.senderId;
                    return (
                      <div key={msg.id} className={`flex ${isFirst ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[70%] items-end gap-2 ${isFirst ? 'flex-row-reverse' : ''}`}>
                          <img
                            src={getUserAvatar(msg.senderId)}
                            alt=""
                            className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                          />
                          <div>
                            <div
                              className={`rounded-2xl px-4 py-2 text-sm ${
                                isFirst
                                  ? 'rounded-br-sm bg-brand-600 text-white'
                                  : 'rounded-bl-sm bg-gray-100 text-gray-900'
                              }`}
                            >
                              {msg.text}
                            </div>
                            <div className={`mt-0.5 flex items-center gap-1 text-xs text-gray-400 ${isFirst ? 'justify-end' : ''}`}>
                              <span>{getUserName(msg.senderId)}</span>
                              <span>{formatTime(msg.createdAt)}</span>
                              {msg.read && <span className="text-green-500">&#10003;</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
