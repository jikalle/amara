import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useAgent } from '../../hooks/useAgent'

const C = {
  earth: '#1A1208', soil: '#221A0E', clay: '#2E2010', border: '#4A3520',
  gold: '#D4920A', gold2: '#F0B429', kola: '#C0392B', green: '#2ECC71',
  teal: '#48C9B0', text: '#F5E6C8', text2: '#C8AA7A', muted: '#7A5E3A',
}

const SUGGESTIONS = [
  'Swap 0.1 ETH → USDC',
  'Send 200 USDC to 0xff89',
  'Bridge 500 USDC to Ethereum',
  'What\'s my portfolio value?',
  'Check arb profit this month',
]

export default function ChatScreen() {
  const { messages, isThinking, sendMessage } = useAgent()
  const [input, setInput]             = useState('')
  const [suggsDismissed, setSuggsDismissed] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isThinking) return
    setInput('')
    setSuggsDismissed(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await sendMessage(text)
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [input, isThinking, sendMessage])

  const handleSugg = useCallback((text: string) => {
    setInput(text)
    setSuggsDismissed(true)
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.agentInfo}>
          <View style={styles.agentAvatar}>
            <Text style={styles.agentAvatarText}>AI</Text>
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.agentName}>Anara Agent</Text>
            <Text style={styles.agentStatus}>Online · Base & ETH</Text>
          </View>
        </View>
      </View>
      <View style={styles.kenteBar} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={{ paddingVertical: 12, gap: 10 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* Welcome message */}
          {messages.length === 0 && (
            <View style={styles.agentMsg}>
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>
                  Hey Shehu 👋 I'm your wallet agent. Tell me what to do — I'll handle the rest.{'\n\n'}
                  <Text style={styles.bubbleHint}>Try: "swap 0.5 ETH to USDC" or "send 200 USDC to 0xff89"</Text>
                </Text>
              </View>
              <Text style={styles.msgTime}>Now</Text>
            </View>
          )}

          {messages.map(msg => (
            <View key={msg.id} style={msg.role === 'user' ? styles.userMsgWrap : styles.agentMsgWrap}>
              {msg.role === 'user' ? (
                <View style={styles.userMsg}>
                  <Text style={styles.userMsgText}>{msg.content}</Text>
                </View>
              ) : (
                <View style={styles.agentMsg}>
                  {/* Action card */}
                  {msg.actionCard && (
                    <View style={styles.actionCard}>
                      <View style={styles.actionCardTop}>
                        <Text style={styles.actionCardTitle}>{msg.actionCard.title}</Text>
                        <View style={styles.readyBadge}><Text style={styles.readyText}>READY</Text></View>
                      </View>
                      {msg.actionCard.rows.map((row, i) => (
                        <View key={i} style={styles.actionRow}>
                          <Text style={styles.actionLbl}>{row.label}</Text>
                          <Text style={[styles.actionVal, row.highlight && styles.actionValHighlight]}>{row.value}</Text>
                        </View>
                      ))}
                      <View style={styles.actionBtns}>
                        <TouchableOpacity style={styles.confirmBtn} onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}>
                          <Text style={styles.confirmBtnText}>Execute →</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>{msg.content}</Text>
                  </View>
                  <Text style={styles.msgTime}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              )}
            </View>
          ))}

          {/* Typing indicator */}
          {isThinking && (
            <View style={styles.agentMsg}>
              <View style={styles.typingBubble}>
                {[0,1,2].map(i => (
                  <View key={i} style={[styles.typingDot, { opacity: 0.3 + i * 0.2 }]} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestions */}
        {!suggsDismissed && messages.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggsScroll}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}
          >
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.sugg} onPress={() => handleSugg(s)}>
                <Text style={styles.suggText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Instruct your agent…"
            placeholderTextColor={C.muted}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          {/* Mic button */}
          <TouchableOpacity style={styles.micBtn}>
            <Text style={{ fontSize: 16 }}>🎙️</Text>
          </TouchableOpacity>
          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isThinking) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isThinking}
          >
            {isThinking
              ? <ActivityIndicator size="small" color={C.earth} />
              : <Text style={styles.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.earth },
  header:            { flexDirection: 'row', alignItems: 'center', padding: '12px 14px', gap: 10, backgroundColor: C.soil, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:           { width: 32, height: 32, backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  backText:          { color: C.text2, fontSize: 18, lineHeight: 20 },
  agentInfo:         { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  agentAvatar:       { width: 32, height: 32, backgroundColor: '#3B5BDB', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  agentAvatarText:   { fontSize: 11, fontWeight: '900', color: '#1A1208' },
  onlineDot:         { position: 'absolute', bottom: 1, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, borderWidth: 1.5, borderColor: C.soil },
  agentName:         { fontSize: 13, fontWeight: '700', color: C.text },
  agentStatus:       { fontSize: 10, color: C.green, fontWeight: '600', letterSpacing: 0.5 },
  kenteBar:          { height: 3, backgroundColor: C.gold },
  messages:          { flex: 1, paddingHorizontal: 14 },
  agentMsgWrap:      { alignSelf: 'flex-start', maxWidth: '88%' },
  userMsgWrap:       { alignSelf: 'flex-end', maxWidth: '88%' },
  agentMsg:          { alignItems: 'flex-start', gap: 4 },
  userMsg:           { backgroundColor: C.gold, padding: '10px 13px' },
  userMsgText:       { fontSize: 12.5, color: C.earth, fontWeight: '500', lineHeight: 18 },
  bubble:            { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, padding: '10px 13px' },
  bubbleText:        { fontSize: 12.5, color: C.text, lineHeight: 18 },
  bubbleHint:        { color: C.muted, fontSize: 10.5, fontStyle: 'italic' },
  msgTime:           { fontSize: 9.5, color: C.muted, fontFamily: 'monospace' },
  typingBubble:      { flexDirection: 'row', gap: 4, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, padding: '12px 14px', alignItems: 'center' },
  typingDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  actionCard:        { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, width: 280, overflow: 'hidden', marginBottom: 6 },
  actionCardTop:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottomWidth: 1, borderBottomColor: C.border },
  actionCardTitle:   { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  readyBadge:        { backgroundColor: `${C.gold}15`, borderWidth: 1, borderColor: `${C.gold}30`, paddingHorizontal: 7, paddingVertical: 2 },
  readyText:         { fontSize: 8, fontWeight: '700', color: C.gold2, letterSpacing: 0.6 },
  actionRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: `${C.border}80` },
  actionLbl:         { fontSize: 10.5, color: C.muted },
  actionVal:         { fontSize: 10.5, fontWeight: '700', color: C.text2, fontFamily: 'monospace' },
  actionValHighlight:{ color: C.green },
  actionBtns:        { flexDirection: 'row', gap: 6, padding: 10 },
  confirmBtn:        { flex: 1, backgroundColor: C.gold, padding: '9px 0', alignItems: 'center' },
  confirmBtnText:    { fontSize: 11, fontWeight: '800', color: C.earth, textTransform: 'uppercase', letterSpacing: 0.6 },
  cancelBtn:         { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  cancelBtnText:     { fontSize: 11, fontWeight: '700', color: C.muted },
  suggsScroll:       { flexShrink: 0, paddingVertical: 8 },
  sugg:              { backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7, marginRight: 0 },
  suggText:          { fontSize: 10.5, fontWeight: '600', color: C.text2, whiteSpace: 'nowrap' },
  inputBar:          { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: '8px 12px 12px', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.soil },
  input:             { flex: 1, backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 13, padding: '10px 12px', maxHeight: 80, lineHeight: 18, fontFamily: 'DM Sans' },
  micBtn:            { width: 38, height: 38, backgroundColor: C.clay2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtn:           { width: 38, height: 38, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:   { opacity: 0.4 },
  sendBtnText:       { fontSize: 18, fontWeight: '900', color: C.earth, lineHeight: 20 },
})
