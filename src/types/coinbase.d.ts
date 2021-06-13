declare module 'cpro'

type CProOptions = {
  key: string
  secret: string
  passphrase: string
  host: string
  port: string
}

type CoinbaseConnection = {
  connect(): void
  logoff(): void
}
