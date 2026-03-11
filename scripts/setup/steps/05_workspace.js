'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { C, logBold, logSuccess, logDim } = require('../utils/logger');
const { promptUser } = require('../utils/prompt');
const { PROJECT_ROOT } = require('../utils/docker-env');

module.exports = async function runStep() {
    logBold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logBold('🛡️  安全なワークスペースの設定');
    logDim('AIが自由に読み書きできる専用のフォルダ（ワークスペース）を指定します。');
    logDim('OSの重要なファイルや個人情報が含まれていない場所を指定してください。');

    const defaultWorkspace = path.join(os.homedir(), 'openclaw-workspace');
    let workspace = await promptUser(`AI用ワークスペースのパスを入力してください \n  [未入力でデフォルト: ${defaultWorkspace}]:`);
    if (!workspace) workspace = defaultWorkspace;

    // 絶対パス解決
    workspace = path.resolve(workspace.replace(/^~/, os.homedir()));
    if (!fs.existsSync(workspace)) {
        fs.mkdirSync(workspace, { recursive: true });
        logSuccess(`✓ ワークスペースを作成しました: ${workspace}`);
    } else {
        logSuccess(`✓ 既存のワークスペースを使用します: ${workspace}`);
    }

    // 環境変数ファイル（.env）に書き出して docker-compose で利用する
    const envPath = path.join(PROJECT_ROOT, '.env');
    fs.writeFileSync(envPath, `HOST_WORKSPACE_DIR=${workspace}\n`);
    logSuccess(`✓ Docker用環境変数を更新しました (.env)`);
};
