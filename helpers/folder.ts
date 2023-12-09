import { ACHIEVO_TMP_DIR } from '@constants/deployments';
import fs from 'fs';

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
