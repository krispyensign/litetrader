import cpro from 'cpro'

const url = 'fix-public.sandbox.pro.coinbase.com'
const port = '4198'

const customizeConnection = (key?: Key): CoinbaseConnection =>
  new cpro({
    key: key?.apiKey,
    secret: key?.apiPrivateKey,
    passphrase: key?.passphrase,
    host: url,
    port: port,
  } as CProOptions)

const doConnection = (fixConnection: CoinbaseConnection): CoinbaseConnection => (
  fixConnection.connect(), fixConnection
)

export const getConnection = (key?: Key): unknown => doConnection(customizeConnection(key))

export const dropConnection = (fixConnection: unknown): void => console.log(fixConnection)
