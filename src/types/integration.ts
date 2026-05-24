export type IntegrationMode = 'onchain'

export type ActionStatus = {
  state: 'idle' | 'pending' | 'success' | 'error'
  message?: string
  txHash?: string
  mode?: IntegrationMode
}
