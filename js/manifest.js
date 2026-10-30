import {decryptEnvelope} from './crypto.js';
import {fetchCipher} from './photo-loader.js';
export async function readManifest(key){
 if(typeof DecompressionStream==='function')try{const bytes=await decryptEnvelope(await fetchCipher(new URL('../data/manifest-fast.bin',import.meta.url),{cache:'no-store',attempts:2}),key,'manifest:gzip:v1');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text());}catch{/* Original encrypted format remains available for compatibility. */}
 const bytes=await decryptEnvelope(await fetchCipher(new URL('../data/manifest.bin',import.meta.url),{cache:'no-store'}),key,'manifest:v1');return JSON.parse(new TextDecoder().decode(bytes));
}
