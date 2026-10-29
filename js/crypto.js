// MMZ1 | 96-bit IV | ciphertext | 128-bit authentication tag.
export async function decryptEnvelope(bytes, key, label) {
  const input = new Uint8Array(bytes);
  if (input.length < 33 || new TextDecoder().decode(input.slice(0,4)) !== 'MMZ1') throw Error('invalid-data');
  return crypto.subtle.decrypt({name:'AES-GCM',iv:input.slice(4,16),additionalData:new TextEncoder().encode(label),tagLength:128},key,input.slice(16));
}
