'use strict';

const MSG = {
    ja: {
        welcome: 'OpenClaw × Gemini CLI アダプタ 【Docker版】セットアップへようこそ！',
        caution_title: '🛡️  保護された環境',
        caution_text: 'このセットアップはホスト環境を汚さず、AIの働きを安全なワークスペース内に限定します。',
        auth_title: '🔑 Gemini CLI 認証 (Google ログイン)',
        auth_guide: [
            'ブラウザで認証を行います。',
            'すぐにタブが開くからブラウザを確認してください。',
            '自動で開かない場合は、この後に表示されるURLをブラウザに貼り付けてください。',
        ],
        auth_start: 'Enter を押して認証を開始...',
        auth_done: '✓ 認証が完了しました！',
        done: '🎉 全ての準備が整い、コンテナを起動しています...',
    },
    en: {
        welcome: 'Welcome to OpenClaw x Gemini CLI Adapter [Docker Edition] Setup!',
        caution_title: '🛡️  Protected Environment',
        caution_text: 'This setup will not pollute your host environment and restricts AI to a safe workspace.',
        auth_title: '🔑 Gemini CLI Authentication (Google Login)',
        auth_guide: [
            'Authentication will be done in your browser.',
            'A new tab will open shortly, please check your browser.',
            'If it does not open automatically, copy and paste the URL shown below.',
        ],
        auth_start: 'Press Enter to start authentication...',
        auth_done: '✓ Authentication complete!',
        done: '🎉 Everything is ready. Starting the container...',
    }
};

let currentLang = 'ja';

function setLang(langCode) {
    if (MSG[langCode]) {
        currentLang = langCode;
    }
}

function getLang() {
    return currentLang;
}

function L() {
    return MSG[currentLang];
}

module.exports = {
    MSG,
    setLang,
    getLang,
    L
};
