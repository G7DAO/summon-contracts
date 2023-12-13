// eslint-disable-next-line @typescript-eslint/no-var-requires
import crypto from 'crypto';

const encryptionKey = process.env.ENCRYPTION_KEY;

export async function encryptPrivateKey(privateKey: string) {
    if (!encryptionKey) throw '⛔️ Encryption key not detected! Add it to the .env file!';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(privateKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
