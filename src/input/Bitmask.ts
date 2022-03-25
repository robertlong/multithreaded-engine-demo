const bitsPerMask = Uint32Array.BYTES_PER_ELEMENT * 8;

export const flagOn = (view, i) => {
  const masksIndex = Math.floor(i/bitsPerMask)
  const index = i - bitsPerMask*masksIndex
  const bitflag = Math.pow(2,index)
  view[masksIndex] |= bitflag
}

export const flagOff = (view, i) => {
  const masksIndex = Math.floor(i/bitsPerMask)
  const index = i - bitsPerMask*masksIndex
  const bitflag = Math.pow(2,index)
  view[masksIndex] &= ~bitflag
}

export const flagSet = (view, i,v) => {
  if(v) flagOn(view, i)
  else flagOff(view, i)
}

export const flagGet = (view, i) => {
  const masksIndex = Math.floor(i/bitsPerMask)
  const index = i - bitsPerMask*masksIndex
  const bitflag = Math.pow(2,index)
  return ((bitflag & view[masksIndex]) !== 0) ? 1 : 0
}

export const flagToggle = (view, i) => {
  const masksIndex = Math.floor(i/bitsPerMask)
  const index = i - bitsPerMask*masksIndex
  const bitflag = Math.pow(2,index)
  view[masksIndex] ^= bitflag
  return view[masksIndex] ? 1 : 0
}
