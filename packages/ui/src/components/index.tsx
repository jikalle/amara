'use client'

import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AgentActionCard } from '@anara/types'
import { colors, chainMeta } from '../tokens'

// ── Utility ────────────────────────────────────────────────────
export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

// ── AnaraLogo ──────────────────────────────────────────────────
export function AnaraLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Blue square base */}
      <rect width="100" height="100" fill={colors.logo.blue} />
      {/* Purple diamond */}
      <polygon points="50,0 100,50 50,100 0,50" fill={colors.logo.purple} />
      {/* Gold diamond */}
      <polygon points="50,18 82,50 50,82 18,50" fill={colors.logo.gold} />
      {/* Black hollow square */}
      <rect x="38" y="38" width="24" height="24" fill="none" stroke={colors.logo.black} strokeWidth="5" />
    </svg>
  )
}

// ── KenteStrip ─────────────────────────────────────────────────
export function KenteStrip({ height = 4, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn('w-full flex-shrink-0', className)}
      style={{
        height,
        background: `repeating-linear-gradient(90deg,
          ${colors.gold} 0, ${colors.gold} 10px,
          ${colors.kola} 10px, ${colors.kola} 20px,
          ${colors.earth} 20px, ${colors.earth} 26px,
          ${colors.turmeric} 26px, ${colors.turmeric} 36px,
          ${colors.earth} 36px, ${colors.earth} 42px,
          ${colors.teal} 42px, ${colors.teal} 52px,
          ${colors.earth} 52px, ${colors.earth} 58px
        )`,
      }}
    />
  )
}

// ── Button ─────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:   'bg-gold text-earth font-bold hover:bg-gold2 active:scale-95',
  secondary: 'bg-clay border border-border text-text2 hover:border-border2 active:scale-95',
  ghost:     'bg-transparent border border-border text-muted hover:border-gold hover:text-gold2 active:scale-95',
  danger:    'bg-kola/10 border border-kola/30 text-kola hover:bg-kola/20 active:scale-95',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs tracking-wide',
  md: 'px-5 py-2.5 text-sm tracking-wide',
  lg: 'px-6 py-3 text-sm tracking-wider',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'relative overflow-hidden font-display font-bold uppercase tracking-wider transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {/* Kente texture overlay on primary */}
      {variant === 'primary' && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,0,0,0.06) 6px, rgba(0,0,0,0.06) 7px)',
          }}
        />
      )}
      <span className="relative z-10">
        {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : children}
      </span>
    </button>
  )
}

// ── Badge ──────────────────────────────────────────────────────
type BadgeVariant = 'active' | 'watching' | 'paused' | 'error' | 'chain' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  color?: string
  className?: string
}

const badgeVariants: Record<BadgeVariant, string> = {
  active:   'bg-green/10 text-green border-green/20',
  watching: 'bg-gold/10 text-gold2 border-gold/20',
  paused:   'bg-muted2/30 text-muted border-muted2/40',
  error:    'bg-kola/10 text-kola border-kola/20',
  chain:    '',
  default:  'bg-clay border-border text-text2',
}

export function Badge({ variant = 'default', children, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase border font-mono',
        badgeVariants[variant],
        className
      )}
      style={color ? { color, borderColor: `${color}40`, backgroundColor: `${color}15` } : undefined}
    >
      {children}
    </span>
  )
}

// ── ChainBadge ─────────────────────────────────────────────────
export function ChainBadge({ chainId, className }: { chainId: number; className?: string }) {
  const meta = chainMeta[chainId]
  if (!meta) return null
  return (
    <Badge variant="chain" color={meta.color} className={cn('font-mono', className)}>
      {meta.shortName}
    </Badge>
  )
}

// ── Card ───────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  kente?: boolean
  className?: string
  onClick?: () => void
}

export function Card({ children, kente = false, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-soil border border-border overflow-hidden',
        onClick && 'cursor-pointer transition-colors hover:border-border2 active:bg-clay',
        className
      )}
      onClick={onClick}
    >
      {kente && <KenteStrip height={3} />}
      {children}
    </div>
  )
}

// ── StatGrid ───────────────────────────────────────────────────
interface Stat { label: string; value: string; color?: string }

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div
      className="grid border border-border"
      style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)` }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn('bg-soil p-3', i < stats.length - 1 && 'border-r border-border')}
        >
          <div className="text-[9px] font-bold tracking-wider text-muted uppercase mb-1">{s.label}</div>
          <div
            className="text-[13px] font-bold font-mono"
            style={{ color: s.color ?? colors.text2 }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ActionCard ─────────────────────────────────────────────────
// Rendered in agent chat when a swap/send/bridge is previewed

interface ActionCardProps {
  card: AgentActionCard
  onConfirm: () => void
  onCancel:  () => void
}

const actionCardAccent: Record<string, string> = {
  swap:   colors.gold,
  send:   colors.kola,
  bridge: colors.teal,
  query:  colors.chains.base,
}

const actionCardIcons: Record<string, string> = {
  swap: '⇄', send: '↑', bridge: '⛓', query: '?',
}

export function ActionCard({ card, onConfirm, onCancel }: ActionCardProps) {
  const accent = actionCardAccent[card.type] ?? colors.gold
  const icon   = actionCardIcons[card.type] ?? '◆'
  const done   = card.status === 'confirmed' || card.status === 'failed' || card.status === 'cancelled'

  return (
    <div className="bg-soil border border-border overflow-hidden w-full">
      {/* Kente top */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}88, ${accent})` }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text2">{card.title}</span>
        <Badge
          variant={card.status === 'pending' ? 'watching' : card.status === 'confirmed' ? 'active' : 'paused'}
          className="ml-auto"
        >
          {card.status === 'executing' ? '⟳ Executing' : card.status.toUpperCase()}
        </Badge>
      </div>

      {/* Rows */}
      <div className="px-3 divide-y divide-border/50">
        {card.rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <span className="text-[11px] text-muted">{row.label}</span>
            <span
              className={cn('text-[11px] font-bold font-mono', row.highlight && 'text-green')}
              style={!row.highlight ? { color: colors.text2 } : undefined}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!done && card.status !== 'executing' && (
        <div className="flex gap-2 p-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-[11px] font-bold uppercase tracking-wide text-earth transition-colors"
            style={{ backgroundColor: accent }}
          >
            Confirm →
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[11px] font-bold text-muted border border-border hover:border-kola hover:text-kola transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {card.status === 'executing' && (
        <div className="flex items-center gap-2 px-3 py-3">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
          <span className="text-[11px] text-muted">Processing on-chain…</span>
        </div>
      )}

      {card.status === 'confirmed' && (
        <div className="flex items-center gap-2 px-3 py-3 text-green">
          <span>✓</span>
          <span className="text-[11px] font-bold">Confirmed</span>
          {card.txHash && (
            <span className="text-[9px] font-mono text-muted ml-auto">
              {card.txHash.slice(0, 10)}…{card.txHash.slice(-4)}
            </span>
          )}
        </div>
      )}

      {card.status === 'cancelled' && (
        <div className="px-3 py-3 text-muted text-[11px]">✕ Cancelled</div>
      )}
    </div>
  )
}

// ── AgentTypingIndicator ────────────────────────────────────────
export function TypingIndicator() {
  return (
    <div className="flex gap-1.5 px-3 py-3 bg-soil border border-border">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

// ── LiveDot ─────────────────────────────────────────────────────
export function LiveDot({ color = colors.green }: { color?: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full animate-pulse"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 0 0 ${color}80`,
        animation: 'pulse-dot 1.8s ease-in-out infinite',
      }}
    />
  )
}

// ── FeeDivider ──────────────────────────────────────────────────
export function FeeRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={cn('text-[11px] font-bold font-mono', highlight ? 'text-green' : 'text-text2')}>
        {value}
      </span>
    </div>
  )
}
