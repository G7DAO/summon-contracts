import fs from 'fs';
import path from 'path';

import { ABI_PATH, ABI_PATH_ZK, ACHIEVO_TMP_DIR } from '@constants/deployments';

export const createDefaultFolders = (chain: string) => {
    if (!chain) {
        throw new Error('Chain is required');
    }
    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}`);
    }

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/${chain}`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/${chain}`);
    }

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/checksums`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/checksums`);
    }

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/${chain}/upgradeables`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/${chain}/upgradeables`);
    }

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/deployments`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/deployments`);
    }

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/deployments/${chain}`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/deployments/${chain}`);
    }

    if (!fs.existsSync(`${ACHIEVO_TMP_DIR}/deployments/${chain}/upgradeables`)) {
        fs.mkdirSync(`${ACHIEVO_TMP_DIR}/deployments/${chain}/upgradeables`);
    }
};

export const getFilePath = (folderPath: string, fileName: string): string | null => {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
        const resolvedPath = path.resolve(folderPath, entry.name);

        if (entry.isDirectory()) {
            const nestedFilePath = getFilePath(resolvedPath, fileName);
            if (nestedFilePath) return nestedFilePath;
        } else if (entry.isFile() && entry.name === fileName) {
            return resolvedPath;
        }
    }

    return null;
};

export const getABIFilePath = (isZkSync: boolean, contractFileName: string): string | null => {
    const folder = isZkSync ? ABI_PATH_ZK : ABI_PATH;
    const abiPath = getFilePath(folder, `${contractFileName}.json`);

    if (!abiPath) {
        throw new Error(`File ${contractFileName}.json not found`);
    }

    return path.relative('', abiPath);
};
