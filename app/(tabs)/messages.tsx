import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';

type ChatMessage = {
  id: string;
  from: 'admin' | 'customer';
  text: string;
  time: string;
  isRead?: boolean;
  readAt?: string;
};

type ChatProduct = {
  name: string;
  price: string;
  orderId: string;
  imageUrl?: string | null;
};

type Conversation = {
  id: string;
  name: string;
  lastMsg: string;
  time: string;
  unread: number;
  messages: ChatMessage[];
  product?: ChatProduct | null;
};

type FilterMode = 'Newest' | 'Oldest' | 'Unread';

export default function MessagesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { user, token } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(conversationId ?? null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('Newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    if (!user?.user_id) {
      setConversations([]);
      return;
    }

    const data = await apiGet<Conversation[]>(`/chat/users/${user.user_id}/conversations`, token);
    setConversations(data);

    if (conversationId && data.some((item) => item.id === conversationId)) {
      setActiveId(conversationId);
      return;
    }

    setActiveId((current) => (current && data.some((item) => item.id === current) ? current : null));
  }, [conversationId, token, user?.user_id]);

  useEffect(() => {
    loadConversations()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load messages.'))
      .finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations().catch(() => undefined);
    }, 4000);

    return () => clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [activeId, conversations]);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    navigation.setOptions({
      title: activeConversation ? '' : 'Messages',
    });
  }, [activeConversation, navigation]);

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const searched = needle
      ? conversations.filter((item) =>
          [item.name, item.lastMsg, item.product?.name]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(needle)),
        )
      : conversations;

    const filtered = filterMode === 'Unread' ? searched.filter((item) => item.unread > 0) : searched;

    return filterMode === 'Oldest' ? [...filtered].reverse() : filtered;
  }, [conversations, filterMode, query]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh messages.');
    } finally {
      setRefreshing(false);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeConversation || !user?.user_id || sending) return;

    setDraft('');
    setSending(true);
    try {
      const updated = await apiPost<Conversation>(
        `/chat/conversations/${activeConversation.id}/messages`,
        { userId: user.user_id, text },
        token,
      );
      setConversations((current) => {
        const next = current.filter((item) => item.id !== updated.id);
        return [updated, ...next];
      });
      setActiveId(updated.id);
    } catch (err) {
      setDraft(text);
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    router.setParams({ conversationId: id });
    setConversations((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: 0 } : item)),
    );

    if (user?.user_id) {
      apiPost(`/chat/conversations/${id}/read`, { userId: user.user_id }, token)
        .then((updated) => {
          const conversation = updated as Conversation;
          setConversations((current) =>
            current.map((item) => (item.id === conversation.id ? conversation : item)),
          );
        })
        .catch(() => undefined);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand.blueLight} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {activeConversation ? (
        <View style={styles.chatPanel}>
          <View style={styles.chatTopbar}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.75}
              onPress={() => {
                setActiveId(null);
                router.setParams({ conversationId: undefined });
              }}
            >
              <Ionicons name="arrow-back" size={23} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.supportTitle}>
              <Text style={styles.supportName}>A'FRO Official Support</Text>
              <Text style={styles.supportStatus}>Online - typically replies instantly</Text>
            </View>
          </View>

          {activeConversation.product ? (
            <View style={styles.productCard}>
              <View style={styles.productImageWrap}>
                {activeConversation.product.imageUrl ? (
                  <Image
                    source={{ uri: imageUrl(activeConversation.product.imageUrl) ?? activeConversation.product.imageUrl }}
                    style={styles.productImage}
                  />
                ) : (
                  <Ionicons name="shirt-outline" size={22} color="#276296" />
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                  {activeConversation.product.name}
                </Text>
                <Text style={styles.productPrice}>{activeConversation.product.price}</Text>
                <Text style={styles.productOrder} numberOfLines={1}>
                  {activeConversation.product.orderId}
                </Text>
              </View>
              <TouchableOpacity style={styles.buyButton} activeOpacity={0.75}>
                <Text style={styles.buyText}>Buy</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
            <Text style={styles.dateDivider}>Today</Text>
            {activeConversation.messages.map((message) => {
              const fromCustomer = message.from === 'customer';
              return (
                <View key={message.id} style={[styles.messageRow, fromCustomer && styles.messageRowCustomer]}>
                  {!fromCustomer ? <Avatar /> : null}
                  <View style={[styles.messageBubble, fromCustomer ? styles.customerBubble : styles.adminBubble]}>
                    <Text style={styles.messageText}>{message.text}</Text>
                    <Text style={[styles.messageTime, fromCustomer && styles.customerTime]}>
                      {message.time}
                      {fromCustomer ? `  ${message.isRead ? `Read at ${message.readAt || message.time}` : 'Delivered'}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.attachButton} activeOpacity={0.75}>
              <Ionicons name="attach-outline" size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message A'FRO Support..."
              placeholderTextColor="#D5E8F8"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!draft.trim() || sending}
              activeOpacity={0.75}
            >
              {sending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Ionicons name="send" size={19} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.inboxContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
        >
          <View style={styles.searchWrap}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={17} color={Colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search conversations"
                placeholderTextColor="#D5E8F8"
              />
              <TouchableOpacity
                style={[styles.filterButton, filterOpen && styles.filterButtonActive]}
                onPress={() => setFilterOpen((open) => !open)}
                activeOpacity={0.75}
              >
                <Ionicons name="options-outline" size={20} color={Colors.brand.blueLight} />
              </TouchableOpacity>
            </View>

            {filterOpen ? (
              <View style={styles.filterMenu}>
                {(['Newest', 'Oldest', 'Unread'] as FilterMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={styles.filterOption}
                    onPress={() => {
                      setFilterMode(mode);
                      setFilterOpen(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterText, filterMode === mode && styles.filterTextActive]}>{mode}</Text>
                    {filterMode === mode ? (
                      <Ionicons name="checkmark" size={16} color={Colors.brand.blueLight} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.listPanel}>
            <Text style={styles.listHeading}>SUPPORT</Text>
            {filteredConversations.length ? (
              filteredConversations.map((conversation, index) => (
                <TouchableOpacity
                  key={conversation.id}
                  style={[styles.conversationItem, index === 0 && styles.conversationItemFirst]}
                  onPress={() => {
                    openConversation(conversation.id);
                  }}
                  activeOpacity={0.8}
                >
                  <Avatar />
                  <View style={styles.conversationText}>
                    <Text style={styles.conversationName} numberOfLines={1}>
                      {conversation.name}
                    </Text>
                    <Text style={styles.conversationPreview} numberOfLines={1}>
                      {conversation.lastMsg}
                    </Text>
                  </View>
                  <View style={styles.conversationMeta}>
                    <Text style={styles.conversationTime}>{conversation.time}</Text>
                    {conversation.unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={Colors.text.secondary} />
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyText}>Start an inquiry from a product overview.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Avatar() {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>A'F</Text>
      <View style={styles.onlineDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  searchWrap: {
    position: 'relative',
    zIndex: 2,
    marginBottom: Spacing.lg,
  },
  searchRow: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#5C718A',
    backgroundColor: 'rgba(9, 17, 31, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    minHeight: 38,
  },
  filterButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  filterMenu: {
    position: 'absolute',
    top: 46,
    right: 0,
    width: 132,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#5C718A',
    backgroundColor: '#111827',
    paddingVertical: Spacing.xs,
    zIndex: 4,
  },
  filterOption: {
    minHeight: 38,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.text.primary,
  },
  listPanel: {
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(89, 110, 132, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.18)',
    padding: Spacing.lg,
  },
  listHeading: {
    color: '#EAF6FF',
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  conversationItem: {
    minHeight: 78,
    borderWidth: 1,
    borderColor: '#5C718A',
    borderTopWidth: 0,
    backgroundColor: 'rgba(18, 29, 50, 0.86)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  conversationItemFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  conversationText: {
    flex: 1,
  },
  conversationName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  conversationPreview: {
    color: '#DCEBFA',
    fontSize: FontSize.xs,
    fontWeight: '400',
    marginTop: 3,
  },
  conversationMeta: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  conversationTime: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '400',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand.blueLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#AEE4FF',
    borderWidth: 2,
    borderColor: '#E8F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#276296',
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.status.success,
    borderWidth: 2,
    borderColor: '#26384D',
  },
  empty: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
    marginTop: Spacing.sm,
  },
  emptyText: {
    color: Colors.text.secondary,
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  chatPanel: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  chatTopbar: {
    minHeight: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#6E86A4',
    backgroundColor: 'rgba(18, 29, 50, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 42,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  supportTitle: {
    flex: 1,
  },
  supportName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  supportStatus: {
    color: Colors.status.success,
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
  },
  productCard: {
    minHeight: 74,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#6E86A4',
    backgroundColor: 'rgba(18, 29, 50, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  productImageWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: '#AEE4FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  productPrice: {
    color: '#AEE4FF',
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  productOrder: {
    color: Colors.text.secondary,
    fontSize: 9,
    fontWeight: '400',
    marginTop: 2,
  },
  buyButton: {
    minWidth: 58,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#65768D',
  },
  buyText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  messages: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  messagesContent: {
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  dateDivider: {
    alignSelf: 'center',
    color: '#D5E8F8',
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  messageRowCustomer: {
    justifyContent: 'flex-end',
    paddingRight: 0,
    paddingLeft: Spacing.xl,
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  adminBubble: {
    backgroundColor: '#718496',
  },
  customerBubble: {
    backgroundColor: '#276296',
  },
  messageText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '400',
    lineHeight: 17,
  },
  messageTime: {
    color: '#E5F3FF',
    fontSize: 9,
    fontWeight: '400',
    marginTop: Spacing.xs,
  },
  customerTime: {
    textAlign: 'right',
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  inputBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: Spacing.sm,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#8FA9C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    borderRadius: Radius.sm,
    backgroundColor: '#65768D',
    color: Colors.text.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: FontSize.sm,
    fontWeight: '400',
  },
  sendButton: {
    width: 42,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: '#276296',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
