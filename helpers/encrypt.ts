// eslint-disable-next-line @typescript-eslint/no-var-requires
import crypto from 'crypto';

const encryptionKey = process.env.ENCRYPTION_KEY; // YOU MUST PUT THIS AS VAR ENV

const IV = new Uint8Array([0x47, 0xb7, 0xd3, 0x71, 0x7e, 0xb1, 0xab, 0x93, 0x8b, 0x4c, 0x44, 0x3a, 0x82, 0xc3, 0x65, 0x49]);

export async function encryptPrivateKey(privateKey: string) {
    if (!encryptionKey) throw '⛔️ Encryption Key not detected! Add it to the .env file!';

    const keyBuffer = new Uint8Array(encryptionKey.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

    const key = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-CBC', length: 256 }, false, ['encrypt']);

    const textEncoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: IV }, key, textEncoder.encode(privateKey));

    const encryptedText = Array.from(new Uint8Array(encrypted))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    const ivText = Array.from(IV)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    return `${ivText}:${encryptedText}`;
}
