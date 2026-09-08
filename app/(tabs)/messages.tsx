import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { apiDelete, apiGet, apiPost, imageUrl } from '@/lib/api';
import { containsProfanity, PROFANITY_ERROR } from '@/lib/profanity';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useNav } from '@/context/NavContext';

type ChatMessage = {
  id: string;
  from: 'admin' | 'customer';
  text: string;
  time: string;
  isRead?: boolean;
  readAt?: string;
};

type ChatProduct = {
  id: string;
  name: string;
  price: string;
  orderId: string;
  sizeId?: number | string | null;
  imageUrl?: string | null;
  isInCart?: boolean;
  action?: 'add' | 'buy' | 'track' | 'review';
  placedOrderId?: string | null;
  reviewed?: boolean;
};

type Conversation = {
  id: string;
  name: string;
  lastMsg: string;
  time: string;
  unread: number;
  messages: ChatMessage[];
  isAi?: boolean;
  type?: 'support' | 'ai';
  product?: ChatProduct | null;
};

type FilterMode = 'Newest' | 'Oldest' | 'Unread';

function isAiConversation(conversation: Conversation | null) {
  if (!conversation) return false;
  return Boolean(conversation.isAi || conversation.type === 'ai' || /ai assistant/i.test(conversation.name));
}

export default function MessagesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { openNav } = useNav();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { user, token } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(conversationId ?? null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [productActionBusy, setProductActionBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [startingAi, setStartingAi] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('Newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
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
  const activeIsAi = isAiConversation(activeConversation);

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
  const hasAiConversation = useMemo(() => conversations.some(isAiConversation), [conversations]);
  const showAiContact = useMemo(() => {
    if (hasAiConversation || filterMode === 'Unread') return false;
    const needle = query.trim().toLowerCase();
    return !needle || 'ai assistant'.includes(needle) || 'style help'.includes(needle);
  }, [filterMode, hasAiConversation, query]);

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

    if (containsProfanity(text)) {
      Alert.alert('Message not sent', PROFANITY_ERROR);
      return;
    }

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
    
    const selectedConversation = conversations.find((item) => item.id === id);
if (isAiConversation(selectedConversation ?? null)) {
  return;
}

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

  const openAiAssistant = async () => {
    if (!user?.user_id || startingAi) return;

    setStartingAi(true);
    setError('');
    try {
      const conversation = await apiPost<Conversation>(
        '/chat/conversations/ai',
        { userId: user.user_id },
        token,
      );
      setConversations((current) => {
        const next = current.filter((item) => item.id !== conversation.id);
        return [conversation, ...next];
      });
      setActiveId(conversation.id);
      router.setParams({ conversationId: conversation.id });
    } catch (err) {
      Alert.alert('Could not open AI Assistant', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setStartingAi(false);
    }
  };

  const deleteConversationForMe = async (id: string) => {
    if (!user?.user_id || deletingId) return;

    const previous = conversations;
    setDeletingId(id);
    setConversations((current) => current.filter((item) => item.id !== id));
    if (activeId === id) {
      setActiveId(null);
      router.setParams({ conversationId: undefined });
    }

    try {
      await apiDelete(
        `/chat/users/${user.user_id}/conversations/${id}`,
        { userId: user.user_id, scope: 'self', viewer: 'customer' },
        token,
      );
    } catch (err) {
      setConversations(previous);
      Alert.alert('Could not delete chat', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setDeletingId('');
    }
  };

  const confirmDeleteConversation = (id: string) => {
    Alert.alert(
      'Delete chat?',
      'This only removes the chat from your messages. Support will still keep their copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteConversationForMe(id) },
      ],
    );
  };

  const addProductToCart = async (product: ChatProduct) => {
    if (!user?.user_id) {
      Alert.alert('Login required', 'Please login before adding products to your cart.');
      return false;
    }

    if (!product.sizeId) {
      Alert.alert('Item unavailable', 'This product has no available size right now.');
      return false;
    }

    try {
      await apiPost(
        '/cart/items',
        { userId: user.user_id, productId: product.id, sizeId: product.sizeId, quantity: 1 },
        token,
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert(message.includes('already in cart') ? 'Already in cart' : 'Could not add item', message);
      return message.includes('already in cart');
    }
  };

  const handleProductAction = async (product: ChatProduct, action: 'add' | 'buy' | 'track' | 'review') => {
    if (productActionBusy) return;

    if (action === 'track' && product.placedOrderId) {
      router.push({ pathname: '/(tabs)/orders', params: { orderId: product.placedOrderId } });
      return;
    }

    if (action === 'review') {
      router.push({ pathname: '/(tabs)/reviews', params: { productId: product.id } });
      return;
    }

    setProductActionBusy(true);
    try {
      if (!product.isInCart) {
        const added = await addProductToCart(product);
        if (!added) return;
      }
      router.push('/(tabs)/cart');
    } finally {
      setProductActionBusy(false);
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
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
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
              <Text style={styles.supportName}>{activeIsAi ? 'AI Assistant' : "A'FRO Official Support"}</Text>
              <Text style={styles.supportStatus}>{activeIsAi ? 'Online - ready to help' : 'Online - typically replies instantly'}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              activeOpacity={0.75}
              disabled={deletingId === activeConversation.id}
              onPress={() => confirmDeleteConversation(activeConversation.id)}
            >
              {deletingId === activeConversation.id ? (
                <ActivityIndicator color={Colors.text.primary} size="small" />
              ) : (
                <Ionicons name="trash-outline" size={20} color={Colors.text.primary} />
              )}
            </TouchableOpacity>
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
              <View style={styles.productActions}>
                {activeConversation.product.action === 'add' ? (
                  <TouchableOpacity
                    style={[styles.buyButton, productActionBusy && styles.buyButtonDisabled]}
                    activeOpacity={0.75}
                    disabled={productActionBusy}
                    onPress={() => handleProductAction(activeConversation.product!, 'add')}
                  >
                    <Text style={styles.buyText}>Add</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.buyButton, productActionBusy && styles.buyButtonDisabled]}
                  activeOpacity={0.75}
                  disabled={productActionBusy}
                  onPress={() => handleProductAction(activeConversation.product!, activeConversation.product!.action === 'add' ? 'buy' : activeConversation.product!.action ?? 'buy')}
                >
                  <Text style={styles.buyText}>
                    {activeConversation.product.action === 'track'
                      ? 'Track'
                      : activeConversation.product.action === 'review'
                        ? 'Review'
                        : 'Buy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

<ScrollView
  ref={scrollRef}
  style={styles.messages}
  contentContainerStyle={styles.messagesContent}
  keyboardShouldPersistTaps="handled"
>
            {activeConversation.messages.map((message) => {
              const fromCustomer = message.from === 'customer';
              return (
                <View key={message.id} style={[styles.messageRow, fromCustomer && styles.messageRowCustomer]}>
                  {!fromCustomer ? <Avatar /> : null}
                  <View style={[styles.messageBubble, fromCustomer ? styles.customerBubble : styles.adminBubble]}>
                    <Text style={[styles.messageText, fromCustomer && styles.customerMessageText]}>{message.text}</Text>
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
              placeholder={activeIsAi ? 'Message AI Assistant...' : "Message A'FRO Support..."}
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
          <View style={styles.pageHeader}>
            <View style={styles.brandRow}>
              <View style={styles.brandLockup}>
                <Image source={require('@/assets/afro-logo-black.png')} style={styles.brandLogo} resizeMode="contain" />
                <Text style={styles.brandText}>A'FRO</Text>
              </View>
              <TouchableOpacity style={styles.menuButton} onPress={openNav}>
                <Ionicons name="menu-outline" size={28} color={Colors.brand.blue} />
              </TouchableOpacity>
            </View>
            <View style={styles.titleRow}>
              <TouchableOpacity style={styles.backPageButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={25} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.pageTitle}>Messages</Text>
              <View style={styles.backPageButton} />
            </View>
          </View>
          <View style={styles.searchWrap}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={17} color={Colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search conversations"
                placeholderTextColor="#3e6c93"
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

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={() => setFaqOpen((open) => !open)} activeOpacity={0.8}>
              <Ionicons name="help-circle-outline" size={20} color={Colors.brand.blue} />
              <Text style={styles.quickActionText}>FAQ</Text>
            </TouchableOpacity>
          </View>

          {faqOpen ? (
            <View style={styles.faqCard}>
              <Text style={styles.faqTitle}>Quick answers</Text>
              <Text style={styles.faqItem}>Shipping: delivery estimates appear in each order’s tracking view.</Text>
              <Text style={styles.faqItem}>Payment: GCash payment details and receipt upload appear at checkout.</Text>
              <Text style={styles.faqItem}>Sizing: choose an available size from the product page before adding it to your cart.</Text>
              <Text style={styles.faqHint}>Need more help? Send the AI Assistant a message.</Text>
            </View>
          ) : null}

          <View style={styles.listPanel}>
            <Text style={styles.listHeading}>SUPPORT</Text>
            {showAiContact ? (
              <View style={[styles.conversationItem, styles.conversationItemFirst]}>
                <TouchableOpacity
                  style={styles.conversationOpen}
                  onPress={() => openAiAssistant()}
                  activeOpacity={0.8}
                  disabled={startingAi}
                >
                  <Avatar label="AI" />
                  <View style={styles.conversationText}>
                    <Text style={styles.conversationName} numberOfLines={1}>
                      AI Assistant
                    </Text>
                    <Text style={styles.conversationPreview} numberOfLines={1}>
                      Ask for outfit, sizing, or shopping help.
                    </Text>
                  </View>
                  <View style={styles.conversationMeta}>
                    {startingAi ? <ActivityIndicator color={Colors.text.primary} size="small" /> : <Text style={styles.conversationTime}>now</Text>}
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}
            {filteredConversations.length ? (
              filteredConversations.map((conversation, index) => (
                <View
                  key={conversation.id}
                  style={[styles.conversationItem, index === 0 && !showAiContact && styles.conversationItemFirst]}
                >
                  <TouchableOpacity
                    style={styles.conversationOpen}
                    onPress={() => {
                      openConversation(conversation.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <Avatar label={isAiConversation(conversation) ? 'AI' : "A'F"} />
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
                  <TouchableOpacity
                    style={styles.conversationDelete}
                    activeOpacity={0.75}
                    disabled={deletingId === conversation.id}
                    onPress={() => confirmDeleteConversation(conversation.id)}
                  >
                    {deletingId === conversation.id ? (
                      <ActivityIndicator color={Colors.text.primary} size="small" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={Colors.text.secondary} />
                    )}
                  </TouchableOpacity>
                </View>
              ))
            ) : !showAiContact ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={Colors.text.secondary} />
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyText}>Start an inquiry from a product overview.</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Avatar({ label = "A'F" }: { label?: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{label}</Text>
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
  pageHeader: { marginBottom: Spacing.md },
  brandRow: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  brandLogo: { width: 28, height: 28 },
  brandText: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  backPageButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  searchWrap: {
    position: 'relative',
    zIndex: 2,
    marginBottom: Spacing.lg,
  },
  searchRow: {
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.input,
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
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.card,
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
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.lg,
  },
  listHeading: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  conversationItem: {
    minHeight: 78,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderTopWidth: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
  },
  conversationItemFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  conversationText: {
    flex: 1,
  },
  conversationOpen: {
    flex: 1,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  conversationDelete: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  conversationName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  conversationPreview: {
    color: Colors.text.secondary,
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
    borderColor: Colors.border.default,
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
    borderColor: Colors.bg.card,
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
    paddingTop: 60,
    paddingBottom: Spacing.sm,
  },
  chatTopbar: {
    minHeight: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.card,
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
    backgroundColor: '#EAF4FF',
  },
  deleteButton: {
    width: 42,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
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
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.card,
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
    color: Colors.brand.blue,
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
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  buyButton: {
    minWidth: 58,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4FF',
  },
  buyButtonDisabled: {
    opacity: 0.55,
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
  paddingTop: Spacing.lg,
  paddingBottom: Spacing['2xl'],
  gap: Spacing.md,
},
  dateDivider: {
    alignSelf: 'center',
    color: Colors.text.secondary,
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
  adminBubble: { backgroundColor: '#EAF4FF' },
  customerBubble: {
    backgroundColor: Colors.brand.blue,
  },
  messageText: {
    color: '#082D5C',
    fontSize: FontSize.xs,
    fontWeight: '400',
    lineHeight: 17,
  },
  messageTime: {
    color: Colors.text.secondary,
    fontSize: 9,
    fontWeight: '400',
    marginTop: Spacing.xs,
  },
  customerMessageText: { color: Colors.white },
  customerTime: {
    textAlign: 'right',
    color: '#EAF4FF',
  },
  quickActions: { flexDirection: 'row', marginBottom: Spacing.lg },
  quickAction: { alignItems: 'center', gap: 6, minWidth: 72 },
  quickActionText: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '700' },
  faqCard: { backgroundColor: '#FFFFFF', borderColor: Colors.border.default, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  faqTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginBottom: Spacing.sm },
  faqItem: { color: Colors.text.secondary, fontSize: FontSize.xs, lineHeight: 18, marginBottom: Spacing.xs },
  faqHint: { color: Colors.brand.blue, fontSize: FontSize.xs, fontWeight: '700', marginTop: Spacing.xs },
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
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.input,
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
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
