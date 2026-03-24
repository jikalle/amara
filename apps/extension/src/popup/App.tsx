import { useState } from 'react'
import { AnaraLogo, KenteStrip, Card, Badge, LiveDot, StatGrid } from '@anara/ui'
import { colors } from '@anara/ui/tokens'

// The extension renders the same Anara UI in a 390×600 fixed frame.
// It shares components with the web and mobile apps.

type Screen = 'home' | 'agent' | 'settings'

export function ExtensionApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div style={{ width: 390, height: 600, background: colors.earth, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: '"DM Sans", sans-serif', color: colors.text }}>
      <KenteStrip height={4} />

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AnaraLogo size={26} />
          <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 15 }}>Anara</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChainPills />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${colors.green}40`, background: `${colors.green}08`, padding: '4px 10px' }}>
            <LiveDot />
            <span style={{ fontSize: 9, fontWeight: 700, color: colors.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Scrollable main */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {screen === 'home'     && <HomeScreen onOpenChat={() => setChatOpen(true)} />}
        {screen === 'agent'    && <AgentScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </div>

      {/* Agent FAB */}
      <button
        onClick={() => setChatOpen(v => !v)}
        style={{
          position: 'absolute', bottom: 54, right: 12,
          width: 48, height: 48, borderRadius: 24,
          background: colors.gold, border: 'none',
          fontSize: 20, cursor: 'pointer',
          boxShadow: `0 4px 16px ${colors.gold}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        🤖
        <span style={{
          position: 'absolute', top: 4, right: 4,
          width: 8, height: 8, borderRadius: 4,
          background: colors.green, border: `2px solid ${colors.gold}`,
        }} />
      </button>

      {/* Chat overlay */}
      {chatOpen && (
        <div style={{
          position: 'absolute', inset: 0, background: colors.earth,
          display: 'flex', flexDirection: 'column', zIndex: 50,
        }}>
          <KenteStrip height={3} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${colors.border}`, background: colors.soil, flexShrink: 0 }}>
            <AnaraLogo size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Anara Agent</div>
              <div style={{ fontSize: 9, color: colors.green, fontWeight: 600, letterSpacing: '0.1em' }}>Online · Base & ETH</div>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ background: colors.clay, border: `1px solid ${colors.border}`, color: colors.muted, width: 26, height: 26, cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: colors.soil, border: `1px solid ${colors.border}`, padding: '10px 12px', maxWidth: '90%' }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                Hey! I'm your Anara agent. Tell me what to do — I'll handle the rest.<br /><br />
                <span style={{ color: colors.muted, fontSize: 10.5 }}>Try: <em>"swap 0.1 ETH to USDC"</em></span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px 12px', borderTop: `1px solid ${colors.border}`, background: colors.soil, flexShrink: 0 }}>
            <input
              placeholder="Instruct your agent…"
              style={{ flex: 1, background: colors.clay, border: `1px solid ${colors.border}`, color: colors.text, padding: '9px 11px', fontSize: 13, outline: 'none', fontFamily: '"DM Sans", sans-serif' }}
            />
            <button style={{ width: 36, height: 36, background: colors.gold, border: 'none', color: colors.earth, fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ display: 'flex', borderTop: `1px solid ${colors.border}`, background: colors.soil, flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 3, background: `repeating-linear-gradient(90deg, ${colors.gold} 0, ${colors.gold} 8px, ${colors.kola} 8px, ${colors.kola} 16px, ${colors.turmeric} 16px, ${colors.turmeric} 22px, ${colors.earth} 22px, ${colors.earth} 26px)` }} />
        {([
          { id: 'home' as const,     icon: '🏠', label: 'Home'     },
          { id: 'agent' as const,    icon: '🤖', label: 'Agent'    },
          { id: 'settings' as const, icon: '⚙️', label: 'Settings' },
        ]).map(item => (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            style={{
              flex: 1, padding: '8px 4px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              color: screen === item.id ? colors.gold2 : colors.muted,
              fontFamily: '"DM Sans", sans-serif',
            }}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Placeholder screens ────────────────────────────────────────────

function HomeScreen({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hero */}
      <div style={{ background: colors.soil, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <div style={{ height: 3, background: `repeating-linear-gradient(90deg, ${colors.kola} 0, ${colors.kola} 8px, ${colors.gold} 8px, ${colors.gold} 18px, ${colors.turmeric} 18px, ${colors.turmeric} 26px)` }} />
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: colors.muted, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>TOTAL PORTFOLIO VALUE</div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
            <span style={{ color: colors.gold2 }}>$</span>24,847<span style={{ fontSize: 20, color: colors.muted, fontWeight: 700 }}>.32</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ background: `${colors.green}18`, border: `1px solid ${colors.green}25`, color: colors.green, fontSize: 10, fontWeight: 700, padding: '3px 10px', fontFamily: 'monospace' }}>▲ +$312.48 (1.27%)</span>
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', borderTop: `1px solid ${colors.border}` }}>
          {[{ label: 'Send', icon: '↑', color: colors.kola }, { label: 'Receive', icon: '↓', color: colors.green }, { label: 'Swap', icon: '⇄', color: colors.gold }, { label: 'Bridge', icon: '⛓', color: colors.teal }].map(a => (
            <button key={a.label} style={{ flex: 1, padding: '8px 4px', background: colors.clay2, border: `1px solid ${colors.border}`, borderTop: `2px solid ${a.color}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontFamily: '"DM Sans", sans-serif' }}>
              <span style={{ fontSize: 14 }}>{a.icon}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: colors.text2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{a.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', height: 3 }}>
          <div style={{ flex: 62, background: '#1C6EFF' }} />
          <div style={{ flex: 38, background: '#627EEA' }} />
        </div>
      </div>

      {/* Quick agent action */}
      <button onClick={onOpenChat} style={{ background: `${colors.gold}12`, border: `1px solid ${colors.gold}25`, padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: '"DM Sans", sans-serif', width: '100%', textAlign: 'left' }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>Ask the Agent</div>
          <div style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>Swap, send, bridge with one message</div>
        </div>
        <span style={{ marginLeft: 'auto', color: colors.gold2, fontSize: 16 }}>›</span>
      </button>

      {/* Agent stats */}
      <StatGrid stats={[
        { label: 'Actions today',  value: '23' },
        { label: 'Profit',         value: '+$70.50', color: colors.green },
        { label: 'Errors',         value: '0',       color: colors.green },
        { label: 'Uptime',         value: '99.9%',   color: colors.teal  },
      ]} />
    </div>
  )
}

function AgentScreen() {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: colors.muted, textTransform: 'uppercase', marginBottom: 10 }}>Agent Control</div>
      {['Arb Bot', 'Yield Optimizer', 'Auto-Rebalance', 'Brickt Pools'].map((name, i) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: colors.soil, border: `1px solid ${colors.border}`, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>{['⚡','🌾','⚖️','🏗️'][i]}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 10, color: colors.muted }}>Active</div>
          </div>
          <div style={{ width: 36, height: 20, background: `${colors.green}15`, border: `1px solid ${colors.green}30`, borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: 'flex-end' }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: colors.green }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SettingsScreen() {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: colors.muted, textTransform: 'uppercase', marginBottom: 10 }}>Settings</div>
      <div style={{ background: colors.soil, border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
        {['Connected Wallets', 'Saved Contacts', 'Guard Rails', 'Networks', 'Notifications', 'Security'].map(label => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: `1px solid ${colors.border}50`, cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
            <span style={{ color: colors.muted, fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChainPills() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: colors.clay, border: `1px solid ${colors.border}`, padding: '4px 8px' }}>
      {[colors.chains.base, colors.chains.eth, colors.chains.arb].map((c, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: c }} />
      ))}
      <span style={{ fontSize: 9, fontWeight: 700, color: colors.text2, marginLeft: 3, fontFamily: '"Space Mono", monospace' }}>10 ▾</span>
    </div>
  )
}
