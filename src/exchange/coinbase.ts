import tls from 'tls'

export const getConnection = (): tls.TLSSocket =>
  tls.connect(
    {
      host: 'fix.gdax.com',
      port: 4198,
    },
    () => console.log('connected via fix to coinbase')
  )

export const dropConnection = (ws: unknown): tls.TLSSocket | undefined =>
  (ws as tls.TLSSocket).unref()
