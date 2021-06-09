import tls from 'tls'

// const BeginString = '8=FIX.4.2'
// const TargetComp = '56=Coinbase'
// const SenderCompIDBase = '49='

// const EncryptMethod = '98=0'
// const HeartBtInt = '108=30'
// const PasswordBase = '554='
// const RawDataBase = '96='
// const CancelOrdersOnDisconnect = '8013=Y'
// const DropCopyFlag = '9406=Y'

// const SendingTime = new Date()

// const buildHeader = (key: string): [number, string] => [
//   TargetComp.length + SenderCompIDBase.length + key.length,
//   `${BeginString}|${SenderCompIDBase}${key}|${TargetComp}`,
// ]

// const buildLogon = (
//   passphrase: string,
//   signature: string,
//   [headerLength, headerString]: [number, string]
// ): [number, string] => [
//   headerLength +
//     EncryptMethod.length +
//     HeartBtInt.length +
//     PasswordBase.length +
//     passphrase.length +
//     RawDataBase.length +
//     signature.length +
//     CancelOrdersOnDisconnect.length +
//     DropCopyFlag.length,
//   `${headerString}|
//   ${HeartBtInt}|
//   ${PasswordBase}${passphrase}|
//   ${RawDataBase}${signature}|
//   ${CancelOrdersOnDisconnect}|
//   ${DropCopyFlag}`,
// ]

// const sign = (data: string): string => {
//   const presign = [
//     new Date(),
//     logon.MsgType,
//     session.outgoing_seq_num,
//     session.sender_comp_id,
//     session.target_comp_id,
//     passphrase
// ].join('\x01');
// }

function sleep(ms: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const getConnection = (): tls.TLSSocket => {
  const conn = tls.connect(
    {
      host: 'fix-public.sandbox.pro.coinbase.com',
      port: 4198,
    },
    () => console.log('connected!') // send logon message here
  )
  while (conn.writable === false) sleep(10)

  // const msg = buildLogon(passphrase, sign)
  // conn.write(msg)
  return conn
}

export const dropConnection = (ws: unknown): tls.TLSSocket | undefined =>
  (ws as tls.TLSSocket).unref()
