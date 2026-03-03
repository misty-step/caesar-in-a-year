import { Sword } from '@phosphor-icons/react'

interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 24, className }: LogoProps) {
  return <Sword size={size} weight="regular" className={className} />
}
