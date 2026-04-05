'use client'

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AgentActionCard } from '@anara/types'
import { chainMeta, colors } from '../lib/ui-tokens'

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

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
      <rect width="100" height="100" fill={colors.logo.blue} />
      <polygon points="50,0 100,50 50,100 0,50" fill={colors.logo.purple} />
      <polygon points="50,18 82,50 50,82 18,50" fill={colors.logo.gold} />
      <rect x="38" y="38" width="24" height="24" fill="none" stroke={colors.logo.black} strokeWidth="5" />
    </svg>
  )
}

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

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-earth font-bold hover:bg-gold2 active:scale-95',
  secondary: 'bg-clay border border-border text-text2 hover:border-border2 active:scale-95',
  ghost: 'bg-transparent border border-border text-muted hover:border-gold hover:text-gold2 active:scale-95',
  danger: 'bg-kola/10 border border-kola/30 text-kola hover:bg-kola/20 active:scale-95',
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
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {variant === 'primary' && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,0,0,0.06) 6px, rgba(0,0,0,0.06) 7px)',
          }}
        />
      )}
      <span className="relative z-10">
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </span>
    </button>
  )
}

type BadgeVariant = 'active' | 'watching' | 'paused' | 'error' | 'chain' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  color?: string
  className?: string
}

const badgeVariants: Record<BadgeVariant, string> = {
  active: 'bg-green/10 text-green border-green/20',
  watching: 'bg-gold/10 text-gold2 border-gold/20',
  paused: 'bg-muted2/30 text-muted border-muted2/40',
  error: 'bg-kola/10 text-kola border-kola/20',
  chain: '',
  default: 'bg-clay border-border text-text2',
}

export function Badge({ variant = 'default', children, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider',
        badgeVariants[variant],
        className,
      )}
      style={color ? { color, borderColor: `${color}40`, backgroundColor: `${color}15` } : undefined}
    >
      {children}
    </span>
  )
}

export function ChainBadge({ chainId, className }: { chainId: number; className?: string }) {
  const meta = chainMeta[chainId]
  if (!meta) return null
  return (
    <Badge variant="chain" color={meta.color} className={cn('font-mono', className)}>
      {meta.shortName}
    </Badge>
  )
}

export function ChainLogo({
  chainId,
  size = 20,
  className,
}: {
  chainId: number
  size?: number
  className?: string
}) {
  const localLogoSrc = getLocalChainLogoSrc(chainId)
  if (localLogoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={localLogoSrc}
        alt={chainMeta[chainId]?.name ?? `Chain ${chainId}`}
        className={cn('object-cover', chainId === 8453 ? 'rounded-[22%]' : 'rounded-full', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  if (chainId === 1) {
    return (
      <div
        className={cn('flex items-center justify-center overflow-hidden rounded-full border border-border/40 bg-[#627EEA]/15', className)}
        style={{ width: size, height: size }}
      >
        <svg width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M127.9 0L125.1 9.5V279.1L127.9 281.9L255.8 206.3L127.9 0Z" fill="#627EEA"/>
          <path d="M127.9 0L0 206.3L127.9 281.9V151.1V0Z" fill="#8A92F0"/>
          <path d="M127.9 306.1L126.3 308V414.1L127.9 416.9L255.9 230.6L127.9 306.1Z" fill="#627EEA"/>
          <path d="M127.9 416.9V306.1L0 230.6L127.9 416.9Z" fill="#8A92F0"/>
          <path d="M127.9 281.9L255.8 206.3L127.9 151.1V281.9Z" fill="#4457C6"/>
          <path d="M0 206.3L127.9 281.9V151.1L0 206.3Z" fill="#627EEA"/>
        </svg>
      </div>
    )
  }

  if (chainId === 56) {
    return (
      <div
        className={cn('flex items-center justify-center overflow-hidden rounded-full border border-border/40 bg-[#F3BA2F]/12', className)}
        style={{ width: size, height: size }}
      >
        <svg width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M32 8L38.2 14.2L26.5 25.9L20.3 19.7L32 8Z" fill="#F3BA2F"/>
          <path d="M43.7 19.7L49.9 25.9L38.2 37.6L32 31.4L43.7 19.7Z" fill="#F3BA2F"/>
          <path d="M20.3 19.7L32 31.4L25.8 37.6L14.1 25.9L20.3 19.7Z" fill="#F3BA2F"/>
          <path d="M32 31.4L38.2 37.6L32 43.8L25.8 37.6L32 31.4Z" fill="#F3BA2F"/>
          <path d="M26.5 39.3L32.7 45.5L32 46.2L31.3 45.5L25.1 39.3L26.5 39.3Z" fill="#F3BA2F"/>
          <path d="M38.2 39.3L39.6 39.3L33.4 45.5L32.7 46.2L32 45.5L38.2 39.3Z" fill="#F3BA2F"/>
          <path d="M32 55.4L20.3 43.7L26.5 37.5L32 43L37.5 37.5L43.7 43.7L32 55.4Z" fill="#F3BA2F"/>
        </svg>
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden rounded-[22%] border border-border/40 bg-white', className)}
      style={{ width: size, height: size }}
    >
      <svg width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#0052FF" />
        <rect x="18" y="18" width="28" height="28" rx="7" fill="white" />
      </svg>
    </div>
  )
}

export function TokenLogo({
  symbol,
  name,
  logoUrl,
  chainId,
  size = 32,
  className,
}: {
  symbol: string
  name?: string
  logoUrl?: string
  chainId?: number
  size?: number
  className?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = (symbol || name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?'
  const localLogoSrc = getLocalTokenLogoSrc(symbol, chainId)
  const resolvedLogoSrc = localLogoSrc ?? logoUrl
  const hasImage = Boolean(resolvedLogoSrc && !imageFailed)

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedLogoSrc}
        alt={name ?? symbol}
        className={cn('rounded-full border border-border/30 object-cover bg-clay', className)}
        style={{ width: size, height: size }}
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (symbol.toUpperCase() === 'ETH' || symbol.toUpperCase() === 'WETH') {
    return <ChainLogo chainId={chainId ?? 1} size={size} className={className} />
  }

  return (
    <div
      className={cn('flex items-center justify-center rounded-full border border-border/35 font-mono font-black', className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${getTokenFallbackColor(chainId)}22 0%, ${colors.clay2} 100%)`,
        color: getTokenFallbackColor(chainId),
        fontSize: Math.max(10, Math.round(size * 0.32)),
      }}
    >
      {initials}
    </div>
  )
}

function getTokenFallbackColor(chainId?: number) {
  if (chainId === 1) return colors.chains.eth
  if (chainId === 56) return colors.chains.bnb
  return colors.chains.base
}

function getLocalChainLogoSrc(chainId: number) {
  if (chainId === 56) return '/logos/bnb-logo.svg'
  if (chainId === 8453) return '/logos/base-logo.png'
  return null
}

function getLocalTokenLogoSrc(symbol: string, chainId?: number) {
  const normalized = symbol.toUpperCase()
  if (normalized === 'USDC') return '/logos/usdc-logo.png'
  if (normalized === 'USDT') return '/logos/usdt-logo.png'
  if ((normalized === 'ETH' || normalized === 'WETH') && chainId === 8453) return '/logos/eth-base-logo.png'
  if (normalized === 'BNB') return '/logos/bnb-logo.svg'
  return null
}

export function Card({
  children,
  kente = false,
  className,
  onClick,
}: {
  children: ReactNode
  kente?: boolean
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        'overflow-hidden border border-border bg-soil',
        onClick && 'cursor-pointer transition-colors hover:border-border2 active:bg-clay',
        className,
      )}
      onClick={onClick}
    >
      {kente && <KenteStrip height={3} />}
      {children}
    </div>
  )
}

export function StatGrid({ stats }: { stats: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid border border-border" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)` }}>
      {stats.map((stat, index) => (
        <div key={stat.label} className={cn('bg-soil p-3', index < stats.length - 1 && 'border-r border-border')}>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{stat.label}</div>
          <div className="font-mono text-[13px] font-bold" style={{ color: stat.color ?? colors.text2 }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ActionCard({
  card,
  onConfirm,
  onCancel,
  disabled = false,
}: {
  card: AgentActionCard
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
}) {
  const actionCardAccent: Record<string, string> = {
    swap: colors.gold,
    send: colors.kola,
    bridge: colors.teal,
    query: colors.chains.base,
  }
  const actionCardIcons: Record<string, string> = {
    swap: '⇄',
    send: '↑',
    bridge: '⛓',
    query: '?',
  }
  const accent = actionCardAccent[card.type] ?? colors.gold
  const icon = actionCardIcons[card.type] ?? '◆'
  const done = card.status === 'submitted' || card.status === 'confirmed' || card.status === 'failed' || card.status === 'cancelled'
  const badgeVariant =
    card.status === 'pending'
      ? 'watching'
      : card.status === 'submitted'
        ? 'watching'
      : card.status === 'confirmed'
        ? 'active'
        : card.status === 'failed'
          ? 'error'
          : 'paused'

  return (
    <div className="w-full overflow-hidden border border-border bg-soil">
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}88, ${accent})` }} />
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text2">{card.title}</span>
        <Badge variant={badgeVariant} className="ml-auto">
          {card.status === 'executing' ? '⟳ Executing' : card.status === 'submitted' ? 'SUBMITTED' : card.status.toUpperCase()}
        </Badge>
      </div>
      <div className="divide-y divide-border/50 px-3">
        {card.rows.map((row, index) => (
          <div key={index} className="flex items-center justify-between py-2">
            <span className="text-[11px] text-muted">{row.label}</span>
            <span className={cn('font-mono text-[11px] font-bold', row.highlight && 'text-green')} style={!row.highlight ? { color: colors.text2 } : undefined}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {!done && card.status !== 'executing' && (
        <div className="flex gap-2 p-3">
          <button
            onClick={onConfirm}
            disabled={disabled}
            className="flex-1 py-2 text-[11px] font-bold uppercase tracking-wide text-earth transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            Confirm →
          </button>
          <button
            onClick={onCancel}
            disabled={disabled}
            className="border border-border px-4 py-2 text-[11px] font-bold text-muted transition-colors hover:border-kola hover:text-kola disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
      {card.status === 'executing' && (
        <div className="flex items-center gap-2 px-3 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
          <span className="text-[11px] text-muted">Processing on-chain…</span>
        </div>
      )}
      {card.status === 'submitted' && (
        <div className="flex items-center gap-2 px-3 py-3 text-gold2">
          <span>↗</span>
          <span className="text-[11px] font-bold">Submitted, awaiting confirmation</span>
          {card.txHash && <span className="ml-auto text-[11px] font-mono text-muted">{card.txHash.slice(0, 10)}…{card.txHash.slice(-4)}</span>}
        </div>
      )}
      {card.status === 'confirmed' && (
        <div className="flex items-center gap-2 px-3 py-3 text-green">
          <span>✓</span>
          <span className="text-[11px] font-bold">Confirmed</span>
          {card.txHash && <span className="ml-auto text-[11px] font-mono text-muted">{card.txHash.slice(0, 10)}…{card.txHash.slice(-4)}</span>}
        </div>
      )}
      {card.status === 'cancelled' && <div className="px-3 py-3 text-[11px] text-muted">✕ Cancelled</div>}
      {card.status === 'failed' && (
        <div className="px-3 py-3 text-[11px] font-bold text-kola">
          Transaction could not be completed. Review the route or try again.
        </div>
      )}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-1.5 border border-border bg-soil px-3 py-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${index * 150}ms` }} />
      ))}
    </div>
  )
}

export function LiveDot({ color = colors.green }: { color?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 animate-pulse rounded-full"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 0 0 ${color}80`,
        animation: 'pulse-dot 1.8s ease-in-out infinite',
      }}
    />
  )
}